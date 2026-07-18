import { watchSession } from "./session.js";
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

function imprimerMois() {
    const groupe = groupes.find(g => String(g.id) === String(selectGroupe.value));
    const seance = seances[indexSeance];
    if (!groupe || !seance) return;

    const membres = membresDuGroupe(groupe);
    const moisSeances = seancesDuMois(groupe, seance.dateISO);
    const moisLabel = new Date(`${seance.dateISO}T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const saison = membres.find(m => m.saison)?.saison || inscriptions.find(i => i.saison)?.saison || "";
    const coachs = Array.isArray(groupe.coachs) ? groupe.coachs.join(", ") : (groupe.coach || "");

    const lignes = membres.map(membre => {
        const numero = String(membre.numeroAdherent || membre.id || "");
        const cases = moisSeances.map(s => {
            const appel = appels.find(a => String(a.numeroAdherent || a.adherentId) === numero && String(a.groupeId) === String(groupe.id) && a.date === s.dateISO);
            return `<td class="${appel?.statut === "absent" ? "absent" : ""}">${appel ? (appel.statut === "present" ? "P" : "A") : "—"}</td>`;
        }).join("");
        return `<tr><td class="name">${escapeHtml(membre.nom)} ${escapeHtml(membre.prenom)}</td>${cases}</tr>`;
    }).join("");

    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
        afficherMessage("Autorisez les fenêtres contextuelles pour générer le PDF.", "error");
        return;
    }

    popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Présences ${escapeHtml(groupe.nom)} - ${escapeHtml(moisLabel)}</title><style>
        @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1f2937;margin:0}h1{font-size:20px;margin:0 0 4px}.meta{display:flex;gap:24px;font-size:11px;margin-bottom:10px}.meta span{white-space:nowrap}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #94a3b8;padding:5px;text-align:center}th{background:#e2e8f0}.name{text-align:left;white-space:nowrap;font-weight:700}.absent{background:#f3dfc5}.legend{margin-top:8px;font-size:10px}.footer{display:flex;justify-content:space-between;margin-top:8px;font-size:9px;color:#64748b}
    </style></head><body>
        <h1>Feuille de présence — ${escapeHtml(groupe.nom)}</h1>
        <div class="meta"><span><strong>Mois :</strong> ${escapeHtml(moisLabel)}</span><span><strong>Saison :</strong> ${escapeHtml(saison)}</span><span><strong>Coach :</strong> ${escapeHtml(coachs || "Non renseigné")}</span><span><strong>Créneau :</strong> ${escapeHtml(Object.entries(groupe.horaires || {}).map(([j,h]) => `${j} ${h}`).join(" · "))}</span></div>
        <table><thead><tr><th>Gymnaste</th>${moisSeances.map(s => `<th>${s.dateISO.slice(8,10)}<br>${escapeHtml(s.jourNom.slice(0,3))}</th>`).join("")}</tr></thead><tbody>${lignes}</tbody></table>
        <div class="legend">P = présent · A = absent · — = appel non enregistré</div>
        <div class="footer"><span>La Jeunesse du Marais</span><span>Généré le ${new Date().toLocaleDateString("fr-FR")}</span></div>
        <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`);
    popup.document.close();
}

function lireCache(cle) {
    try {
        const valeur = JSON.parse(localStorage.getItem(cle) || "[]");
        return Array.isArray(valeur) ? valeur : [];
    } catch (error) {
        console.warn(`Cache local illisible : ${cle}`, error);
        return [];
    }
}

function resultatOuCache(resultat, cle) {
    if (resultat.status === "fulfilled") {
        const valeur = Array.isArray(resultat.value) ? resultat.value : [];
        localStorage.setItem(cle, JSON.stringify(valeur));
        return valeur;
    }

    console.error(`Chargement Firestore impossible : ${cle}`, resultat.reason);
    return lireCache(cle);
}

async function initialiser() {
    zoneAppel.innerHTML = `<p>Chargement des groupes et des gymnastes…</p>`;
    afficherMessage("");

    const resultats = await Promise.allSettled([
        listGroupesFirestore(),
        listAdherents(),
        listInscriptions(),
        listAbsencesFirestore(),
        listAppelsFirestore()
    ]);

    const [groupesResultat, adherentsResultat, inscriptionsResultat, absencesResultat, appelsResultat] = resultats;

    const tousLesGroupes = resultatOuCache(groupesResultat, "groupesJDM");
    adherents = resultatOuCache(adherentsResultat, "adherentsJDM");
    inscriptions = resultatOuCache(inscriptionsResultat, "inscriptionsJDM");
    absences = resultatOuCache(absencesResultat, "absencesJDM");
    appels = resultatOuCache(appelsResultat, "appelsJDM");
    groupes = tousLesGroupes.filter(groupeAutorise);

    selectGroupe.innerHTML = `<option value="">Choisir un groupe</option>${groupes.map(groupe => `<option value="${escapeHtml(groupe.id)}">${escapeHtml(groupe.nom)}</option>`).join("")}`;

    const echecs = resultats
        .map((resultat, index) => ({ resultat, index }))
        .filter(({ resultat }) => resultat.status === "rejected")
        .map(({ index }) => ["groupes", "adhérents", "inscriptions", "absences", "appels"][index]);

    if (groupesResultat.status === "rejected" && !tousLesGroupes.length) {
        afficherMessage("Les groupes n'ont pas pu être chargés. Vérifiez les droits Firestore de la collection groupes.", "error");
        zoneAppel.innerHTML = `<h2>Groupes indisponibles</h2><p>La page reste ouverte, mais aucun groupe n'est disponible pour commencer l'appel.</p>`;
        return;
    }

    if (echecs.length) {
        afficherMessage(`Certaines données sont temporairement indisponibles : ${echecs.join(", ")}. Les données locales disponibles ont été utilisées.`, "warning");
    }

    zoneAppel.innerHTML = groupes.length
        ? `<div class="attendance-empty-icon">✓</div><h2>Prêt pour l'appel</h2><p>Choisissez un groupe pour afficher les gymnastes de la séance.</p>`
        : `<h2>Aucun groupe disponible</h2><p>Aucun groupe n'est associé à votre profil. Vérifiez que votre nom est bien renseigné parmi les coachs du groupe.</p>`;
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
