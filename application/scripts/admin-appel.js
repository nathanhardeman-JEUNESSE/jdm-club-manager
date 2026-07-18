import { watchSession } from "./session.js";
import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";
import {
    listGroupesFirestore,
    listAdherents,
    listInscriptions,
    listAbsencesFirestore,
    listAppelsFirestore,
    saveAppelsSeanceFirestore
} from "../firebase/firebase-db.js";

const selectGroupe = document.getElementById("groupe-appel");
const boutonPrecedent = document.getElementById("seance-precedente");
const boutonSuivant = document.getElementById("seance-suivante");
const titreSeance = document.getElementById("titre-seance");
const detailsSeance = document.getElementById("details-seance");
const zoneAppel = document.getElementById("zone-appel");
const zoneMessage = document.getElementById("message-appel");
const zoneActions = document.getElementById("actions-appel");
const zoneArchive = document.getElementById("archive-appel");
const boutonEnregistrer = document.getElementById("enregistrer-appel");
const boutonImprimer = document.getElementById("imprimer-mois");
const totalGymnastes = document.getElementById("total-gymnastes");
const totalPresents = document.getElementById("total-presents");
const totalAbsents = document.getElementById("total-absents");

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const JOURS_LABEL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

let profilConnecte = null;
let groupes = [];
let adherents = [];
let inscriptions = [];
let absences = [];
let appels = [];
let seances = [];
let indexSeance = 0;
let pointages = new Map();

function normaliser(value) {
    return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatLong(dateISO) {
    const [y, m, d] = dateISO.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
}

function groupeAutorise(groupe) {
    const role = normaliser(profilConnecte?.role);
    if (["admin", "super_admin"].includes(role)) return true;

    const identites = [
        profilConnecte?.email,
        `${profilConnecte?.prenom || ""} ${profilConnecte?.nom || ""}`,
        `${profilConnecte?.nom || ""} ${profilConnecte?.prenom || ""}`
    ].map(normaliser).filter(Boolean);

    const coachs = Array.isArray(groupe.coachs) ? groupe.coachs : [groupe.coach, groupe.entraineur].filter(Boolean);
    return coachs.some(coach => identites.some(id => normaliser(typeof coach === "string" ? coach : `${coach?.prenom || ""} ${coach?.nom || ""} ${coach?.email || ""}`).includes(id)));
}

function groupeDeInscription(inscription) {
    return inscription?.groupe || inscription?.groupeNom || inscription?.nomGroupe || inscription?.donneesHelloAsso?.name || "";
}

function numerosDuGroupe(groupe) {
    const noms = new Set([normaliser(groupe.nom), normaliser(groupe.id)]);
    return new Set(inscriptions
        .filter(i => noms.has(normaliser(groupeDeInscription(i))))
        .map(i => String(i.numeroAdherent || ""))
        .filter(Boolean));
}

function membresDuGroupe(groupe) {
    const numeros = numerosDuGroupe(groupe);
    return adherents.filter(a => {
        const numero = String(a.numeroAdherent || a.id || "");
        return normaliser(a.groupe || a.groupeNom) === normaliser(groupe.nom) || numeros.has(numero);
    }).sort((a, b) => `${a.nom || ""} ${a.prenom || ""}`.localeCompare(`${b.nom || ""} ${b.prenom || ""}`, "fr"));
}

function construireSeances(groupe, centre = new Date()) {
    const resultat = [];
    const debut = new Date(centre);
    debut.setDate(debut.getDate() - 60);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(centre);
    fin.setDate(fin.getDate() + 120);

    for (const date = new Date(debut); date <= fin; date.setDate(date.getDate() + 1)) {
        const jourCle = JOURS[date.getDay()];
        const horaire = groupe?.horaires?.[jourCle];
        if (!horaire) continue;
        resultat.push({
            dateISO: formatISO(date),
            jourCle,
            jourNom: JOURS_LABEL[date.getDay()],
            horaire: String(horaire)
        });
    }
    return resultat;
}

function indexSeanceProche() {
    const aujourdHui = formatISO(new Date());
    const futur = seances.findIndex(s => s.dateISO >= aujourdHui);
    if (futur < 0) return Math.max(seances.length - 1, 0);
    if (futur === 0) return 0;
    const d1 = Math.abs(new Date(`${seances[futur].dateISO}T12:00:00`) - new Date());
    const d0 = Math.abs(new Date(`${seances[futur - 1].dateISO}T12:00:00`) - new Date());
    return d0 < d1 ? futur - 1 : futur;
}

function absencePour(adherent, groupe, dateISO) {
    const numero = String(adherent.numeroAdherent || adherent.id || "");
    return absences.find(a =>
        String(a.numeroAdherent || "") === numero &&
        normaliser(a.groupeNom || a.groupe) === normaliser(groupe.nom) &&
        a.date === dateISO
    );
}

function appelPour(adherent, groupe, dateISO) {
    const numero = String(adherent.numeroAdherent || adherent.id || "");
    return appels.find(a =>
        String(a.numeroAdherent || a.adherentId || "") === numero &&
        String(a.groupeId || "") === String(groupe.id) &&
        a.date === dateISO
    );
}

function dossierARegulariser(adherent) {
    const dossierIncomplet = adherent.dossierComplet === false || adherent.statutDossier === "incomplet";
    const licenceNonReglee = adherent.cotisationAJour === false || ["a_regler", "impaye", "non_regle"].includes(normaliser(adherent.statutCotisationTresorier));
    return { dossierIncomplet, licenceNonReglee, alerte: dossierIncomplet || licenceNonReglee };
}

function texteAlerte(adherent) {
    const etat = dossierARegulariser(adherent);
    const motifs = [];
    if (etat.dossierIncomplet) motifs.push("dossier incomplet");
    if (etat.licenceNonReglee) motifs.push("licence à régulariser");
    return motifs.join(" · ") || "Dossier à jour";
}

function afficherMessage(message = "", type = "") {
    zoneMessage.textContent = message;
    zoneMessage.className = `attendance-message ${type}`.trim();
}

function mettreAJourTotaux() {
    const valeurs = [...pointages.values()];
    totalGymnastes.textContent = valeurs.length;
    totalPresents.textContent = valeurs.filter(v => v.statut === "present").length;
    totalAbsents.textContent = valeurs.filter(v => v.statut === "absent").length;
}

function modifierStatut(numero, statut) {
    const valeur = pointages.get(numero);
    if (!valeur) return;
    valeur.statut = statut;
    pointages.set(numero, valeur);
    document.querySelector(`[data-attendance-row="${CSS.escape(numero)}"]`)?.classList.toggle("is-absent", statut === "absent");
    mettreAJourTotaux();
}

function afficherSeance() {
    const groupe = groupes.find(g => String(g.id) === String(selectGroupe.value));
    const seance = seances[indexSeance];
    if (!groupe || !seance) return;

    titreSeance.textContent = formatLong(seance.dateISO);
    detailsSeance.textContent = `${seance.jourNom} · ${seance.horaire}${Array.isArray(groupe.coachs) && groupe.coachs.length ? ` · Coach : ${groupe.coachs.join(", ")}` : ""}`;
    boutonPrecedent.disabled = indexSeance <= 0;
    boutonSuivant.disabled = indexSeance >= seances.length - 1;

    const membres = membresDuGroupe(groupe);
    pointages = new Map();

    membres.forEach(adherent => {
        const numero = String(adherent.numeroAdherent || adherent.id || "");
        const absence = absencePour(adherent, groupe, seance.dateISO);
        const existant = appelPour(adherent, groupe, seance.dateISO);
        pointages.set(numero, {
            numeroAdherent: numero,
            adherentId: adherent.id || numero,
            nom: adherent.nom || "",
            prenom: adherent.prenom || "",
            statut: existant?.statut || (absence ? "absent" : "present"),
            absenceSignalee: Boolean(absence)
        });
    });

    if (!membres.length) {
        zoneAppel.className = "attendance-empty card";
        zoneAppel.innerHTML = `<h2>Aucun gymnaste</h2><p>Aucun adhérent actif n'est rattaché à ce groupe.</p>`;
        zoneActions.hidden = true;
        zoneArchive.hidden = false;
        return;
    }

    zoneAppel.className = "attendance-list";
    zoneAppel.innerHTML = `
        <div class="attendance-list-header"><span>Gymnaste</span><span>Présent</span><span>Absent</span></div>
        ${membres.map(adherent => {
            const numero = String(adherent.numeroAdherent || adherent.id || "");
            const valeur = pointages.get(numero);
            const alerte = dossierARegulariser(adherent);
            const detail = valeur.absenceSignalee ? "Absence signalée par la famille" : texteAlerte(adherent);
            return `<article class="attendance-row ${valeur.statut === "absent" ? "is-absent" : ""}" data-attendance-row="${escapeHtml(numero)}">
                <div class="attendance-member">
                    <span class="attendance-member-status ${alerte.alerte ? "has-warning" : ""}" title="${escapeHtml(texteAlerte(adherent))}"></span>
                    <div class="attendance-member-name">
                        <strong>${escapeHtml(adherent.nom)} ${escapeHtml(adherent.prenom)}</strong>
                        <small>${escapeHtml(detail)}</small>
                    </div>
                </div>
                <label class="attendance-choice">
                    <input type="radio" name="appel-${escapeHtml(numero)}" value="present" ${valeur.statut === "present" ? "checked" : ""}>
                    <span>Présent</span>
                </label>
                <label class="attendance-choice absent">
                    <input type="radio" name="appel-${escapeHtml(numero)}" value="absent" ${valeur.statut === "absent" ? "checked" : ""}>
                    <span>Absent</span>
                </label>
            </article>`;
        }).join("")}
    `;

    zoneAppel.querySelectorAll("input[type=radio]").forEach(input => {
        input.addEventListener("change", event => {
            const numero = event.target.name.replace(/^appel-/, "");
            modifierStatut(numero, event.target.value);
        });
    });

    zoneActions.hidden = false;
    zoneArchive.hidden = false;
    mettreAJourTotaux();
    afficherMessage(appels.some(a => String(a.groupeId) === String(groupe.id) && a.date === seance.dateISO) ? "Appel déjà enregistré : vous pouvez le corriger puis enregistrer à nouveau." : "");
}

function chargerGroupe() {
    const groupe = groupes.find(g => String(g.id) === String(selectGroupe.value));
    if (!groupe) return;
    seances = construireSeances(groupe);
    indexSeance = indexSeanceProche();
    afficherSeance();
}

async function enregistrer() {
    const groupe = groupes.find(g => String(g.id) === String(selectGroupe.value));
    const seance = seances[indexSeance];
    if (!groupe || !seance || !pointages.size) return;

    boutonEnregistrer.disabled = true;
    afficherMessage("Enregistrement en cours…");
    try {
        await saveAppelsSeanceFirestore({
            groupe,
            seance,
            pointages: [...pointages.values()],
            auteur: {
                uid: profilConnecte?.uid,
                nom: `${profilConnecte?.prenom || ""} ${profilConnecte?.nom || ""}`.trim(),
                email: profilConnecte?.email
            }
        });
        appels = await listAppelsFirestore();
        localStorage.setItem("appelsJDM", JSON.stringify(appels));
        afficherMessage("Appel enregistré.", "success");
    } catch (error) {
        console.error(error);
        afficherMessage("Impossible d'enregistrer l'appel. Vérifiez la connexion et les droits Firestore.", "error");
    } finally {
        boutonEnregistrer.disabled = false;
    }
}

function seancesDuMois(groupe, dateISO) {
    const [annee, mois] = dateISO.split("-").map(Number);
    const debut = new Date(annee, mois - 1, 1);
    const fin = new Date(annee, mois, 0);
    return construireSeances(groupe, debut).filter(s => s.dateISO >= formatISO(debut) && s.dateISO <= formatISO(fin));
}

function textePdf(value) {
    return String(value ?? "")
        .replace(/[–—]/g, "-")
        .replace(/œ/g, "oe")
        .replace(/Œ/g, "OE");
}

function nomFichierPdf(value) {
    return normaliser(value)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "groupe";
}

async function chargerImagePdf(url) {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Impossible de charger le logo (${response.status}).`);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("Lecture du logo impossible."));
        reader.readAsDataURL(blob);
    });
}

function avecOpacite(pdf, opacity, dessiner) {
    const gState = new pdf.GState({ opacity });
    pdf.setGState(gState);
    dessiner();
    pdf.setGState(new pdf.GState({ opacity: 1 }));
}

async function imprimerMois() {
    const groupe = groupes.find(g => String(g.id) === String(selectGroupe.value));
    const seance = seances[indexSeance];
    if (!groupe || !seance) return;

    const membres = membresDuGroupe(groupe);
    const moisSeances = seancesDuMois(groupe, seance.dateISO);
    const moisDate = new Date(`${seance.dateISO}T12:00:00`);
    const moisLabel = moisDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const saison = membres.find(m => m.saison)?.saison || inscriptions.find(i => i.saison)?.saison || "Non renseignée";
    const coachs = Array.isArray(groupe.coachs) ? groupe.coachs.join(", ") : (groupe.coach || groupe.entraineur || "Non renseigné");
    const creneaux = Object.entries(groupe.horaires || {}).map(([jour, horaire]) => `${jour} ${horaire}`).join(" - ") || "Non renseigné";

    if (!membres.length || !moisSeances.length) {
        afficherMessage("Aucune donnée disponible pour générer la feuille mensuelle.", "error");
        return;
    }

    try {
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
        const largeurPage = pdf.internal.pageSize.getWidth();
        const hauteurPage = pdf.internal.pageSize.getHeight();
        const marge = 10;
        const largeurTable = largeurPage - (marge * 2);
        const largeurNom = Math.min(78, Math.max(54, largeurTable * 0.29));
        const largeurDate = (largeurTable - largeurNom) / moisSeances.length;

        const logoUrl = new URL("../assets/images/logo-jdm-noir.png", import.meta.url).href;
        const logoData = await chargerImagePdf(logoUrl);
        const dimensionsLogo = pdf.getImageProperties(logoData);
        const largeurLogo = Math.min(190, largeurPage - 42);
        const hauteurLogo = largeurLogo * (dimensionsLogo.height / dimensionsLogo.width);
        const xLogo = (largeurPage - largeurLogo) / 2;
        const yLogo = (hauteurPage - hauteurLogo) / 2 + 5;

        avecOpacite(pdf, 0.055, () => {
            pdf.addImage(logoData, "PNG", xLogo, yLogo, largeurLogo, hauteurLogo, undefined, "FAST");
        });

        pdf.setFillColor(37, 59, 78);
        pdf.roundedRect(marge, 9, largeurTable, 25, 3, 3, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.text(textePdf(`Feuille de présence - ${groupe.nom}`), marge + 5, 18);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.text(textePdf(`${moisLabel}  |  Saison ${saison}  |  Coach : ${coachs}`), marge + 5, 24);
        pdf.text(textePdf(`Créneau : ${creneaux}`), marge + 5, 29);

        const yTable = 39;
        const hauteurEntete = 12;
        const hauteurPied = 20;
        const hauteurDisponible = hauteurPage - yTable - hauteurPied - marge;
        const hauteurLigne = Math.max(4.6, Math.min(7.2, (hauteurDisponible - hauteurEntete - 10) / (membres.length + 2)));
        const tailleNom = hauteurLigne < 5.3 ? 6.3 : 7.5;
        const tailleCase = hauteurLigne < 5.3 ? 6.2 : 7.4;

        pdf.setDrawColor(148, 163, 184);
        pdf.setLineWidth(0.2);
        pdf.setFillColor(226, 232, 240);
        pdf.rect(marge, yTable, largeurNom, hauteurEntete, "FD");
        pdf.setTextColor(30, 41, 59);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text("GYMNASTE", marge + 3, yTable + 7.5);

        moisSeances.forEach((s, index) => {
            const x = marge + largeurNom + (index * largeurDate);
            pdf.setFillColor(226, 232, 240);
            pdf.rect(x, yTable, largeurDate, hauteurEntete, "FD");
            pdf.setFontSize(Math.min(7.5, Math.max(5.6, largeurDate * 0.48)));
            pdf.text(`${s.dateISO.slice(8, 10)}`, x + (largeurDate / 2), yTable + 5, { align: "center" });
            pdf.setFont("helvetica", "normal");
            pdf.text(textePdf(s.jourNom.slice(0, 3)), x + (largeurDate / 2), yTable + 9, { align: "center" });
            pdf.setFont("helvetica", "bold");
        });

        membres.forEach((membre, ligneIndex) => {
            const y = yTable + hauteurEntete + (ligneIndex * hauteurLigne);
            const fondPair = ligneIndex % 2 === 0;
            pdf.setFillColor(fondPair ? 248 : 241, fondPair ? 250 : 245, fondPair ? 252 : 249);
            avecOpacite(pdf, 0.72, () => pdf.rect(marge, y, largeurNom, hauteurLigne, "FD"));

            pdf.setTextColor(30, 41, 59);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(tailleNom);
            const nomComplet = textePdf(`${membre.nom || ""} ${membre.prenom || ""}`.trim());
            const nomCoupe = pdf.splitTextToSize(nomComplet, largeurNom - 5)[0] || "";
            pdf.text(nomCoupe, marge + 3, y + (hauteurLigne * 0.67));

            const numero = String(membre.numeroAdherent || membre.id || "");
            moisSeances.forEach((s, index) => {
                const x = marge + largeurNom + (index * largeurDate);
                const appel = appels.find(a =>
                    String(a.numeroAdherent || a.adherentId || "") === numero &&
                    String(a.groupeId || "") === String(groupe.id) &&
                    a.date === s.dateISO
                );
                const statut = appel?.statut || "";
                if (statut === "absent") pdf.setFillColor(224, 147, 78);
                else if (statut === "present") pdf.setFillColor(66, 139, 105);
                else pdf.setFillColor(fondPair ? 248 : 241, fondPair ? 250 : 245, fondPair ? 252 : 249);
                avecOpacite(pdf, statut ? 0.14 : 0.58, () => pdf.rect(x, y, largeurDate, hauteurLigne, "FD"));
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(tailleCase);
                pdf.setTextColor(statut === "absent" ? 126 : 42, statut === "absent" ? 79 : 92, statut === "absent" ? 39 : 69);
                pdf.text(statut === "present" ? "P" : statut === "absent" ? "A" : "-", x + (largeurDate / 2), y + (hauteurLigne * 0.68), { align: "center" });
            });
        });

        const yTotaux = yTable + hauteurEntete + (membres.length * hauteurLigne);
        [
            { libelle: "Total présents", statut: "present", fond: [224, 238, 230] },
            { libelle: "Total absents", statut: "absent", fond: [244, 226, 205] }
        ].forEach((ligne, offset) => {
            const y = yTotaux + (offset * hauteurLigne);
            pdf.setFillColor(...ligne.fond);
            avecOpacite(pdf, 0.5, () => pdf.rect(marge, y, largeurNom, hauteurLigne, "FD"));
            pdf.setTextColor(30, 41, 59);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(tailleNom);
            pdf.text(ligne.libelle, marge + 3, y + (hauteurLigne * 0.67));

            moisSeances.forEach((s, index) => {
                const x = marge + largeurNom + (index * largeurDate);
                const total = membres.filter(membre => {
                    const numero = String(membre.numeroAdherent || membre.id || "");
                    return appels.some(a =>
                        String(a.numeroAdherent || a.adherentId || "") === numero &&
                        String(a.groupeId || "") === String(groupe.id) &&
                        a.date === s.dateISO &&
                        a.statut === ligne.statut
                    );
                }).length;
                pdf.setFillColor(...ligne.fond);
                avecOpacite(pdf, 0.5, () => pdf.rect(x, y, largeurDate, hauteurLigne, "FD"));
                pdf.text(String(total), x + (largeurDate / 2), y + (hauteurLigne * 0.67), { align: "center" });
            });
        });

        pdf.setTextColor(71, 85, 105);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text("P = présent  |  A = absent  |  - = appel non enregistré", marge, hauteurPage - 8);
        const maintenant = new Date();
        const horodatage = `${maintenant.toLocaleDateString("fr-FR")} à ${maintenant.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
        pdf.text(textePdf(`La Jeunesse du Marais - JDM Club Manager - Généré le ${horodatage}`), largeurPage - marge, hauteurPage - 8, { align: "right" });

        const nomMois = `${moisDate.getFullYear()}-${String(moisDate.getMonth() + 1).padStart(2, "0")}`;
        pdf.save(`presences-${nomFichierPdf(groupe.nom)}-${nomMois}.pdf`);
        afficherMessage("PDF mensuel généré.", "success");
    } catch (error) {
        console.error(error);
        afficherMessage("Impossible de générer le PDF. Rechargez la page puis réessayez.", "error");
    }
}
async function initialiser() {
    zoneAppel.innerHTML = `<p>Chargement des groupes et des gymnastes…</p>`;
    try {
        const [g, a, i, ab, ap] = await Promise.all([
            listGroupesFirestore(), listAdherents(), listInscriptions(), listAbsencesFirestore(), listAppelsFirestore()
        ]);
        groupes = (g.length ? g : JSON.parse(localStorage.getItem("groupesJDM") || "[]")).filter(groupeAutorise);
        adherents = a.length ? a : JSON.parse(localStorage.getItem("adherentsJDM") || "[]");
        inscriptions = i.length ? i : JSON.parse(localStorage.getItem("inscriptionsJDM") || "[]");
        absences = ab;
        appels = ap;

        localStorage.setItem("groupesJDM", JSON.stringify(groupes));
        localStorage.setItem("adherentsJDM", JSON.stringify(adherents));
        localStorage.setItem("inscriptionsJDM", JSON.stringify(inscriptions));
        localStorage.setItem("absencesJDM", JSON.stringify(absences));
        localStorage.setItem("appelsJDM", JSON.stringify(appels));

        selectGroupe.innerHTML = `<option value="">Choisir un groupe</option>${groupes.map(groupe => `<option value="${escapeHtml(groupe.id)}">${escapeHtml(groupe.nom)}</option>`).join("")}`;
        zoneAppel.innerHTML = groupes.length
            ? `<div class="attendance-empty-icon">✓</div><h2>Prêt pour l'appel</h2><p>Choisissez un groupe pour afficher les gymnastes de la séance.</p>`
            : `<h2>Aucun groupe disponible</h2><p>Aucun groupe n'est associé à votre profil ou à vos droits.</p>`;
    } catch (error) {
        console.error(error);
        afficherMessage("Les données de l'appel n'ont pas pu être chargées.", "error");
        zoneAppel.innerHTML = `<h2>Chargement impossible</h2><p>Vérifiez la connexion à Firestore.</p>`;
    }
}

selectGroupe.addEventListener("change", chargerGroupe);
boutonPrecedent.addEventListener("click", () => { if (indexSeance > 0) { indexSeance--; afficherSeance(); } });
boutonSuivant.addEventListener("click", () => { if (indexSeance < seances.length - 1) { indexSeance++; afficherSeance(); } });
boutonEnregistrer.addEventListener("click", enregistrer);
boutonImprimer.addEventListener("click", imprimerMois);

watchSession((user, profile) => {
    if (!user || !profile || profilConnecte) return;
    profilConnecte = { uid: user.uid, email: user.email, ...profile };
    initialiser();
});
