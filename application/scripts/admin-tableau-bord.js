const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const organisation = JSON.parse(localStorage.getItem("organisationJDM")) || [];
const absences = JSON.parse(localStorage.getItem("absencesJDM")) || [];
const commandes = JSON.parse(localStorage.getItem("commandesJDM")) || [];
const competitions = JSON.parse(localStorage.getItem("competitionsJDM")) || [];
const notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
const inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];
const exceptionsPlanning = JSON.parse(localStorage.getItem("planningExceptionsJDM")) || [];

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
    const naissance = new Date(dateNaissance);
    if (Number.isNaN(naissance.getTime())) return null;
    const aujourdHui = new Date();
    let age = aujourdHui.getFullYear() - naissance.getFullYear();
    const mois = aujourdHui.getMonth() - naissance.getMonth();
    if (mois < 0 || (mois === 0 && aujourdHui.getDate() < naissance.getDate())) age--;
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

function cotisationAControler(adherent) {
    if (adherent.cotisationAJour === true || adherent.reglementAJour === true) return false;
    const inscription = derniereInscription(adherent.numeroAdherent);
    if (!inscription) return true;
    const texte = nettoyer(JSON.stringify(inscription.donneesHelloAsso || {}));
    return !(texte.includes("regle") || texte.includes("réglé") || texte.includes("payee") || texte.includes("payé") || texte.includes("cb") || texte.includes("carte bancaire"));
}

function licenceAControler(adherent) {
    if (adherent.licence === "validée" || adherent.licenceValidee === true) return false;
    const inscription = derniereInscription(adherent.numeroAdherent);
    const texte = nettoyer(JSON.stringify(inscription || {}));
    return !(texte.includes("licence valide") || texte.includes("licence validée"));
}

function dossierIncomplet(adherent) {
    const groupe = groupeAdherent(adherent);
    return !emailAdherent(adherent) || !groupe || groupe === "Non renseigné";
}

function compterCoachs() {
    const noms = new Set();
    groupes.forEach(groupe => (groupe.coachs || []).forEach(coach => coach && noms.add(nettoyer(coach))));
    organisation.forEach(p => {
        const role = nettoyer(p.role || p.fonction || "");
        if (role.includes("coach") && (p.nom || p.prenom)) noms.add(nettoyer(`${p.prenom || ""} ${p.nom || ""}`));
    });
    return noms.size;
}

function commandesEnAttente() {
    return commandes.filter(c => !c.vueAdmin || c.statut === "En cours de préparation" || c.statut === "En attente de règlement").length;
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
    return exceptionsPlanning.filter(e => e.statut === "annule" && e.date >= debut && e.date <= fin).length;
}

function notificationsNonLues() {
    return notifications.filter(n => !n.lue && !n.archivee && n.categorie !== "parent" && n.type !== "commande-prete").length;
}

function carteStat(titre, valeur, texte) {
    return `<section class="navigation-card"><div class="navigation-content"><h2>${titre}</h2><p class="dashboard-number">${valeur}</p><p>${texte}</p></div></section>`;
}

function afficherResume() {
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
        ${carteStat("🧾 Cotisations à contrôler", adherents.filter(cotisationAControler).length, "À jour / à vérifier uniquement")}
    `;
}

function afficherDossiersControle() {
    const liste = adherents.filter(a => dossierIncomplet(a) || licenceAControler(a) || cotisationAControler(a));
    if (liste.length === 0) {
        zoneDossiers.innerHTML = `<section class="card"><h2>✅ Aucun dossier à contrôler</h2><p>Tous les dossiers semblent complets.</p></section>`;
        return;
    }
    zoneDossiers.innerHTML = liste.map(a => {
        const alertes = [];
        if (dossierIncomplet(a)) alertes.push("Dossier incomplet");
        if (licenceAControler(a)) alertes.push("Licence à vérifier");
        if (cotisationAControler(a)) alertes.push("Cotisation à contrôler");
        return `<section class="card"><h2>${a.prenom || ""} ${a.nom || ""}</h2><p><strong>Groupe :</strong> ${groupeAdherent(a)}</p><p><strong>Email :</strong> ${emailAdherent(a) || "Non renseigné"}</p><p><strong>À contrôler :</strong> ${alertes.join(" · ")}</p></section>`;
    }).join("");
}

function afficherStatsAge() {
    const tranches = {"2-5 ans":0,"6-8 ans":0,"9-11 ans":0,"12-15 ans":0,"16-18 ans":0,"19 ans et +":0,"Non renseigné":0};
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
    zoneStatsAge.innerHTML = Object.entries(tranches).map(([k, v]) => `<p><strong>${k} :</strong> ${v}</p>`).join("");
}

function afficherStatsGroupes() {
    const stats = {};
    adherents.forEach(a => {
        const groupe = groupeAdherent(a);
        stats[groupe] = (stats[groupe] || 0) + 1;
    });
    const lignes = Object.entries(stats).sort((a, b) => b[1] - a[1]);
    zoneStatsGroupes.innerHTML = lignes.length ? lignes.map(([g, n]) => `<p><strong>${g} :</strong> ${n}</p>`).join("") : `<p>Aucune donnée de groupe disponible.</p>`;
}

afficherResume();
afficherDossiersControle();
afficherStatsAge();
afficherStatsGroupes();
