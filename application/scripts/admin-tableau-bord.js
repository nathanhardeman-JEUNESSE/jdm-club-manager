const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const organisation = JSON.parse(localStorage.getItem("organisationJDM")) || [];
const absences = JSON.parse(localStorage.getItem("absencesJDM")) || [];
const commandes = JSON.parse(localStorage.getItem("commandesJDM")) || [];
const competitions = JSON.parse(localStorage.getItem("competitionsJDM")) || [];
const notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
const inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];
const exceptionsPlanning = JSON.parse(localStorage.getItem("planningExceptionsJDM")) || [];
const aidesLicence = JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];

const zoneResume = document.getElementById("resume-president");
const zoneDossiers = document.getElementById("liste-dossiers-controle");
const zoneStatsAge = document.getElementById("stats-age");
const zoneStatsGroupes = document.getElementById("stats-groupes");

function nettoyer(texte) {
    return String(texte || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatDateISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function debutSemaine(date) {
    const copie = new Date(date);
    const jour = copie.getDay();
    copie.setDate(copie.getDate() + (jour === 0 ? -6 : 1 - jour));
    copie.setHours(0, 0, 0, 0);
    return copie;
}

function finSemaine(date) {
    const fin = debutSemaine(date);
    fin.setDate(fin.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    return fin;
}

function calculerAge(dateNaissance) {
    if (!dateNaissance) return null;

    let naissance = null;

    if (String(dateNaissance).includes("/")) {
        const morceaux = String(dateNaissance).split("/");
        if (morceaux.length === 3) {
            naissance = new Date(Number(morceaux[2]), Number(morceaux[1]) - 1, Number(morceaux[0]));
        }
    } else {
        naissance = new Date(dateNaissance);
    }

    if (!naissance || Number.isNaN(naissance.getTime())) return null;

    const aujourdHui = new Date();
    let age = aujourdHui.getFullYear() - naissance.getFullYear();
    const mois = aujourdHui.getMonth() - naissance.getMonth();

    if (mois < 0 || (mois === 0 && aujourdHui.getDate() < naissance.getDate())) {
        age--;
    }

    return age;
}

function derniereInscription(numeroAdherent) {
    const liste = inscriptions.filter(i => String(i.numeroAdherent) === String(numeroAdherent));
    return liste[liste.length - 1] || null;
}

function champInscription(inscription, mots) {
    if (!inscription || !inscription.donneesHelloAsso) return "";

    const donnees = inscription.donneesHelloAsso;
    const cle = Object.keys(donnees).find(cle =>
        mots.every(mot => nettoyer(cle).includes(nettoyer(mot)))
    );

    return cle ? donnees[cle] : "";
}

function groupeAdherent(adherent) {
    if (adherent.groupe) return adherent.groupe;

    const inscription = derniereInscription(adherent.numeroAdherent);
    return champInscription(inscription, ["tarif"]) || "Non renseigné";
}

function dateNaissanceAdherent(adherent) {
    if (adherent.dateNaissance) return adherent.dateNaissance;
    if (adherent.naissance) return adherent.naissance;

    const inscription = derniereInscription(adherent.numeroAdherent);
    return champInscription(inscription, ["naissance"]) || "";
}

function emailAdherent(adherent) {
    if (adherent.email) return adherent.email;

    const inscription = derniereInscription(adherent.numeroAdherent);
    return champInscription(inscription, ["email"]) || "";
}

function aidePour(adherent) {
    let aide = aidesLicence.find(a =>
        String(a.numeroAdherent) === String(adherent.numeroAdherent)
    );

    if (!aide) {
        aide = {
            numeroAdherent: adherent.numeroAdherent,
            statutCotisation: "a-controler",
            modePaiement: "inconnu",
            montantLicence: "",
            montantRegle: "",
            montantAideLomme: "",
            montantPassSport: "",
            passSport: "non",
            aideLomme: "non",
            relance: "non",
            commentaire: ""
        };
    }

    if (!aide.statutCotisation) {
        aide.statutCotisation = aide.statut === "rembourse-famille" ? "regle" : "a-controler";
    }

    if (!aide.modePaiement) aide.modePaiement = "inconnu";
    if (!("relance" in aide)) aide.relance = "non";

    return aide;
}

function statutCotisation(adherent) {
    return aidePour(adherent).statutCotisation || "a-controler";
}

function modePaiementLabel(mode) {
    const labels = {
        "cb-helloasso": "CB HelloAsso",
        "cheque": "Chèque",
        "especes": "Espèces",
        "cheque-sport": "Chèque sport",
        "aide-lomme": "Aide Ville de Lomme",
        "passsport": "Pass’Sport",
        "mixte": "Paiement mixte",
        "inconnu": "Non renseigné"
    };

    return labels[mode] || "Non renseigné";
}

function statutLabel(statut) {
    const labels = {
        "a-controler": "À contrôler",
        "a-relancer": "À relancer",
        "partiel": "Partiellement réglé",
        "regle": "Réglé",
        "attente-aide": "En attente aide"
    };

    return labels[statut] || "À contrôler";
}

function dossierIncomplet(adherent) {
    const groupe = groupeAdherent(adherent);
    return !emailAdherent(adherent) || !groupe || groupe === "Non renseigné";
}

function licenceAControler(adherent) {
    if (adherent.licence === "validée" || adherent.licenceValidee === true) return false;

    const inscription = derniereInscription(adherent.numeroAdherent);
    const texte = nettoyer(JSON.stringify(inscription || {}));

    return !(texte.includes("licence valide") || texte.includes("licence validée"));
}

function cotisationAControler(adherent) {
    const statut = statutCotisation(adherent);
    return statut !== "regle";
}

function cotisationARelancer(adherent) {
    const aide = aidePour(adherent);
    return aide.statutCotisation === "a-relancer" || aide.relance === "oui";
}

function cotisationPartielle(adherent) {
    return statutCotisation(adherent) === "partiel";
}

function cotisationAttenteAide(adherent) {
    return statutCotisation(adherent) === "attente-aide";
}

function attentePassSport(adherent) {
    const aide = aidePour(adherent);
    return aide.passSport === "oui" && !aide.montantPassSport;
}

function compterCoachs() {
    const noms = new Set();

    groupes.forEach(groupe => {
        (groupe.coachs || []).forEach(coach => {
            if (coach) noms.add(nettoyer(coach));
        });
    });

    organisation.forEach(p => {
        const role = nettoyer(p.role || p.fonction || "");

        if (role.includes("coach") && (p.nom || p.prenom)) {
            noms.add(nettoyer(`${p.prenom || ""} ${p.nom || ""}`));
        }
    });

    return noms.size;
}

function commandesEnAttente() {
    return commandes.filter(c =>
        !c.vueAdmin ||
        c.statut === "En cours de préparation" ||
        c.statut === "En attente de règlement"
    ).length;
}

function commandesPretes() {
    return commandes.filter(c => c.statut === "Commande prête").length;
}

function competitionsAVenir() {
    const today = formatDateISO(new Date());
    return competitions.filter(c => c.date && c.date >= today).length;
}

function absencesSemaine() {
    const debut = debutSemaine(new Date());
    const fin = finSemaine(new Date());

    return absences.filter(a => {
        const d = new Date(a.date + "T12:00:00");
        return d >= debut && d <= fin;
    }).length;
}

function coursAnnulesSemaine() {
    const debut = formatDateISO(debutSemaine(new Date()));
    const fin = formatDateISO(finSemaine(new Date()));

    return exceptionsPlanning.filter(e =>
        e.statut === "annule" &&
        e.date >= debut &&
        e.date <= fin
    ).length;
}

function notificationsNonLues() {
    return notifications.filter(n =>
        !n.lue &&
        !n.archivee &&
        n.categorie !== "parent" &&
        n.type !== "commande-prete"
    ).length;
}

function carteStat(titre, valeur, texte) {
    return `
        <section class="navigation-card">
            <div class="navigation-content">
                <h2>${titre}</h2>
                <p class="dashboard-number">${valeur}</p>
                <p>${texte}</p>
            </div>
        </section>
    `;
}

function afficherResume() {
    const cotisationsReglees = adherents.filter(a => statutCotisation(a) === "regle").length;
    const cotisationsControler = adherents.filter(a => statutCotisation(a) === "a-controler").length;
    const cotisationsRelancer = adherents.filter(cotisationARelancer).length;
    const cotisationsPartielles = adherents.filter(cotisationPartielle).length;
    const attenteAide = adherents.filter(cotisationAttenteAide).length;
    const attentePS = adherents.filter(attentePassSport).length;

    zoneResume.innerHTML = `
        ${carteStat("👥 Adhérents", adherents.length, "Adhérents enregistrés")}
        ${carteStat("🤸 Groupes", groupes.length, "Groupes créés")}
        ${carteStat("👨‍🏫 Coachs", compterCoachs(), "Coachs identifiés")}
        ${carteStat("🙋 Absences semaine", absencesSemaine(), "Absences déclarées cette semaine")}
        ${carteStat("📅 Cours annulés", coursAnnulesSemaine(), "Cours annulés cette semaine")}
        ${carteStat("🏆 Compétitions", competitionsAVenir(), "Compétitions à venir")}
        ${carteStat("📦 Commandes", commandesEnAttente(), "Commandes à préparer / contrôler")}
        ${carteStat("✅ Commandes prêtes", commandesPretes(), "Commandes prêtes à distribuer")}
        ${carteStat("🔔 Alertes", notificationsNonLues(), "Notifications admin non lues")}
        ${carteStat("📋 Dossiers incomplets", adherents.filter(dossierIncomplet).length, "Coordonnées ou groupe à vérifier")}
        ${carteStat("🪪 Licences à vérifier", adherents.filter(licenceAControler).length, "Sans détail financier")}
        ${carteStat("✅ Cotisations réglées", cotisationsReglees, "Statut validé par le suivi cotisations")}
        ${carteStat("🟡 À contrôler", cotisationsControler, "Cotisations à vérifier")}
        ${carteStat("🟠 Partiels", cotisationsPartielles, "Règlements partiels")}
        ${carteStat("🔴 À relancer", cotisationsRelancer, "Familles à recontacter")}
        ${carteStat("🏛️ Attente aide", attenteAide, "Ville / aide en attente")}
        ${carteStat("🎟️ Pass’Sport", attentePS, "Pass’Sport à compléter")}
    `;
}

function detailsControle(adherent) {
    const aide = aidePour(adherent);
    const alertes = [];

    if (cotisationARelancer(adherent)) alertes.push("À relancer");
    if (statutCotisation(adherent) === "a-controler") alertes.push("Cotisation à contrôler");
    if (cotisationPartielle(adherent)) alertes.push("Partiellement réglé");
    if (cotisationAttenteAide(adherent)) alertes.push("En attente aide");
    if (attentePassSport(adherent)) alertes.push("Pass’Sport à compléter");
    if (dossierIncomplet(adherent)) alertes.push("Dossier incomplet");
    if (licenceAControler(adherent)) alertes.push("Licence à vérifier");

    const montantLicence = Number(aide.montantLicence || aide.montantTarifHelloAsso || 0);
    const montantRegle = Number(aide.montantRegle || aide.montantRegleCB || 0);
    const montantAide = Number(aide.montantAideLomme || 0);
    const montantPassSport = Number(aide.montantPassSport || aide.montantPassSportImport || 0);
    const reste = Math.max(0, montantLicence - montantRegle - montantAide - montantPassSport);

    return {
        alertes,
        aide,
        reste
    };
}

function carteDossier(adherent) {
    const details = detailsControle(adherent);
    const aide = details.aide;

    return `
        <section class="card">
            <h2>${adherent.prenom || ""} ${adherent.nom || ""}</h2>
            <p><strong>Groupe :</strong> ${groupeAdherent(adherent)}</p>
            <p><strong>Email :</strong> ${emailAdherent(adherent) || "Non renseigné"}</p>
            <p><strong>Statut cotisation :</strong> ${statutLabel(aide.statutCotisation)}</p>
            <p><strong>Mode :</strong> ${modePaiementLabel(aide.modePaiement)}</p>
            <p><strong>À contrôler :</strong> ${details.alertes.join(" · ")}</p>
            <p><strong>Reste estimé :</strong> ${details.reste} €</p>
            ${aide.commentaire ? `<p><strong>Commentaire :</strong> ${aide.commentaire}</p>` : ""}
        </section>
    `;
}

function sectionControle(id, titre, liste) {
    const ouverte = id === "relancer" || id === "controler";
    const display = ouverte ? "block" : "none";
    const fleche = ouverte ? "▼" : "▶";

    return `
        <section class="card collapsible-title" onclick="toggleSousSectionControle('${id}')">
            <h2><span id="arrow-controle-${id}">${fleche}</span> ${titre} (${liste.length})</h2>
        </section>

        <section id="section-controle-${id}" style="display:${display};">
            ${
                liste.length === 0
                    ? `<section class="card"><p>Aucun dossier dans cette catégorie.</p></section>`
                    : liste.map(carteDossier).join("")
            }
        </section>
    `;
}

function afficherDossiersControle() {
    const relancer = adherents.filter(cotisationARelancer);
    const controler = adherents.filter(a =>
        statutCotisation(a) === "a-controler" &&
        !cotisationARelancer(a)
    );
    const partiels = adherents.filter(cotisationPartielle);
    const attenteAides = adherents.filter(cotisationAttenteAide);
    const passSport = adherents.filter(attentePassSport);
    const licences = adherents.filter(licenceAControler);
    const incomplets = adherents.filter(dossierIncomplet);

    const total =
        relancer.length +
        controler.length +
        partiels.length +
        attenteAides.length +
        passSport.length +
        licences.length +
        incomplets.length;

    if (total === 0) {
        zoneDossiers.innerHTML = `
            <section class="card">
                <h2>✅ Aucun dossier à contrôler</h2>
                <p>Tous les dossiers semblent complets.</p>
            </section>
        `;
        return;
    }

    zoneDossiers.innerHTML = `
        ${sectionControle("relancer", "🔴 À relancer", relancer)}
        ${sectionControle("controler", "🟡 Cotisations à contrôler", controler)}
        ${sectionControle("partiel", "🟠 Règlements partiels", partiels)}
        ${sectionControle("attente-aide", "🏛️ Aides en attente", attenteAides)}
        ${sectionControle("passsport", "🎟️ Pass’Sport à compléter", passSport)}
        ${sectionControle("licences", "🪪 Licences à vérifier", licences)}
        ${sectionControle("incomplets", "📋 Dossiers incomplets", incomplets)}
    `;
}

function afficherStatsAge() {
    const tranches = {
        "2-5 ans": 0,
        "6-8 ans": 0,
        "9-11 ans": 0,
        "12-15 ans": 0,
        "16-18 ans": 0,
        "19 ans et +": 0,
        "Non renseigné": 0
    };

    adherents.forEach(a => {
        const age = calculerAge(dateNaissanceAdherent(a));

        if (age === null) tranches["Non renseigné"]++;
        else if (age <= 5) tranches["2-5 ans"]++;
        else if (age <= 8) tranches["6-8 ans"]++;
        else if (age <= 11) tranches["9-11 ans"]++;
        else if (age <= 15) tranches["12-15 ans"]++;
        else if (age <= 18) tranches["16-18 ans"]++;
        else tranches["19 ans et +"]++;
    });

    zoneStatsAge.innerHTML = Object.entries(tranches)
        .map(([k, v]) => `<p><strong>${k} :</strong> ${v}</p>`)
        .join("");
}

function afficherStatsGroupes() {
    const stats = {};

    adherents.forEach(a => {
        const groupe = groupeAdherent(a);
        stats[groupe] = (stats[groupe] || 0) + 1;
    });

    const lignes = Object.entries(stats).sort((a, b) => b[1] - a[1]);

    zoneStatsGroupes.innerHTML = lignes.length
        ? lignes.map(([g, n]) => `<p><strong>${g} :</strong> ${n}</p>`).join("")
        : `<p>Aucune donnée de groupe disponible.</p>`;
}

function toggleDossiersControle() {
    const bloc = document.getElementById("bloc-dossiers-controle");
    const fleche = document.getElementById("arrow-dossiers-controle");

    if (!bloc || !fleche) return;

    if (bloc.style.display === "none") {
        bloc.style.display = "block";
        fleche.textContent = "▼";
    } else {
        bloc.style.display = "none";
        fleche.textContent = "▶";
    }
}

function toggleSousSectionControle(id) {
    const bloc = document.getElementById("section-controle-" + id);
    const fleche = document.getElementById("arrow-controle-" + id);

    if (!bloc || !fleche) return;

    if (bloc.style.display === "none") {
        bloc.style.display = "block";
        fleche.textContent = "▼";
    } else {
        bloc.style.display = "none";
        fleche.textContent = "▶";
    }
}

afficherResume();
afficherDossiersControle();
afficherStatsAge();
afficherStatsGroupes();
