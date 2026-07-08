const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];
const aidesLicence = JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];
const validationsDossiers = JSON.parse(localStorage.getItem("validationsDossiersJDM")) || [];
const exceptionsPlanning = JSON.parse(localStorage.getItem("planningExceptionsJDM")) || [];

const zoneProgression = document.getElementById("progression-rentree");
const zoneEtapes = document.getElementById("liste-etapes-rentree");
const zoneAlertes = document.getElementById("alertes-rentree");
const zoneGroupes = document.getElementById("stats-groupes-rentree");

function nettoyer(texte) {
    return String(texte || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toggleAssistantSection(section) {
    const bloc = document.getElementById("section-" + section);
    const fleche = document.getElementById("arrow-" + section);
    if (!bloc || !fleche) return;

    if (bloc.style.display === "none") {
        bloc.style.display = "block";
        fleche.textContent = "▼";
    } else {
        bloc.style.display = "none";
        fleche.textContent = "▶";
    }
}

function derniereInscription(numeroAdherent) {
    const resultats = inscriptions.filter(i => String(i.numeroAdherent) === String(numeroAdherent));
    return resultats[resultats.length - 1] || null;
}

function champ(donnees, mots) {
    if (!donnees) return "";
    const cle = Object.keys(donnees).find(cle =>
        mots.every(mot => nettoyer(cle).includes(nettoyer(mot)))
    );
    return cle ? donnees[cle] : "";
}

function aidePour(numeroAdherent) {
    return aidesLicence.find(a => String(a.numeroAdherent) === String(numeroAdherent)) || null;
}

function validationPour(numeroAdherent) {
    return validationsDossiers.find(v => String(v.numeroAdherent) === String(numeroAdherent)) || null;
}

function groupeAdherent(adherent) {
    if (adherent.groupe) return adherent.groupe;
    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
    return champ(donnees, ["tarif"]) || "Non renseigné";
}

function emailAdherent(adherent) {
    if (adherent.email) return adherent.email;
    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
    return champ(donnees, ["email"]) || champ(donnees, ["email", "adherent"]) || champ(donnees, ["email", "parent"]) || "";
}

function dossierComplet(adherent) {
    const validation = validationPour(adherent.numeroAdherent);
    if (validation && validation.valideManuellement === true) return true;

    const aide = aidePour(adherent.numeroAdherent);
    const groupe = groupeAdherent(adherent);

    if (!emailAdherent(adherent)) return false;
    if (!groupe || groupe === "Non renseigné") return false;
    if (aide && aide.statutCotisation && aide.statutCotisation !== "regle") return false;

    return true;
}

function cotisationReglee(adherent) {
    const aide = aidePour(adherent.numeroAdherent);
    if (aide && aide.statutCotisation === "regle") return true;

    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
    const texte = nettoyer(JSON.stringify(donnees));

    return texte.includes("cb") || texte.includes("carte bancaire") || texte.includes("regle") || texte.includes("réglé") || texte.includes("paye") || texte.includes("payé");
}

function licenceAControler(adherent) {
    if (adherent.licence === "validée" || adherent.licenceValidee === true) return false;
    const inscription = derniereInscription(adherent.numeroAdherent);
    const texte = nettoyer(JSON.stringify(inscription || {}));
    return !(texte.includes("licence valide") || texte.includes("licence validée"));
}

function planningConfigure() {
    if (groupes.length === 0) return false;
    return groupes.some(g => g.horaires && Object.values(g.horaires).some(h => h)) || exceptionsPlanning.length > 0;
}

function pourcentage(valide, total) {
    if (!total) return 0;
    return Math.round((valide / total) * 100);
}

function calculerEtapes() {
    const total = adherents.length;
    const dossiers = adherents.filter(dossierComplet).length;
    const cotisations = adherents.filter(cotisationReglee).length;
    const licences = adherents.filter(licenceAControler).length;

    return [
        {titre:"Adhésions détectées", ok: total > 0, detail:`${total} adhérent(s)`, lien:"admin-import-helloasso.html"},
        {titre:"Groupes créés", ok: groupes.length > 0, detail:`${groupes.length} groupe(s)`, lien:"admin-groupes.html"},
        {titre:"Planning préparé", ok: planningConfigure(), detail: planningConfigure() ? "Planning détecté" : "Aucun planning détecté", lien:"admin-planning.html"},
        {titre:"Dossiers administratifs", ok: total > 0 && dossiers === total, detail:`${dossiers}/${total} complet(s)`, lien:"admin-adherents.html"},
        {titre:"Cotisations validées", ok: total > 0 && cotisations === total, detail:`${cotisations}/${total} réglée(s)`, lien:"admin-aide-licence.html"},
        {titre:"Licences vérifiées", ok: total > 0 && licences === 0, detail:`${licences} à vérifier`, lien:"admin-adherents.html"}
    ];
}

function afficherProgression() {
    const etapes = calculerEtapes();
    const ok = etapes.filter(e => e.ok).length;
    const progression = pourcentage(ok, etapes.length);
    const dossiers = adherents.filter(dossierComplet).length;

    zoneProgression.innerHTML = `
        <p><strong>Progression :</strong> ${progression} %</p>
        <p><strong>Étapes validées :</strong> ${ok}/${etapes.length}</p>
        <p><strong>Adhérents :</strong> ${adherents.length}</p>
        <p><strong>Dossiers complets :</strong> ${dossiers}</p>
        <p><strong>Dossiers incomplets :</strong> ${adherents.length - dossiers}</p>
    `;
}

function afficherEtapes() {
    zoneEtapes.innerHTML = calculerEtapes().map(e => `
        <a href="${e.lien}" class="navigation-link">
            <section class="navigation-card">
                <div class="navigation-icon">${e.ok ? "✅" : "⬜"}</div>
                <div class="navigation-content">
                    <h2>${e.titre}</h2>
                    <p>${e.detail}</p>
                </div>
                <div class="navigation-arrow">➜</div>
            </section>
        </a>
    `).join("");
}

function afficherAlertes() {
    const dossiers = adherents.filter(a => !dossierComplet(a)).length;
    const cotisations = adherents.filter(a => !cotisationReglee(a)).length;
    const licences = adherents.filter(licenceAControler).length;

    zoneAlertes.innerHTML = `
        <section class="card"><h2>🔴 Dossiers incomplets</h2><p>${dossiers} dossier(s) à compléter.</p></section>
        <section class="card"><h2>🧾 Cotisations à contrôler</h2><p>${cotisations} cotisation(s) à vérifier.</p></section>
        <section class="card"><h2>🪪 Licences à vérifier</h2><p>${licences} licence(s) à contrôler.</p></section>
    `;
}

function afficherGroupes() {
    const stats = {};
    adherents.forEach(a => {
        const groupe = groupeAdherent(a);
        stats[groupe] = (stats[groupe] || 0) + 1;
    });

    const lignes = Object.entries(stats).sort((a, b) => b[1] - a[1]);

    zoneGroupes.innerHTML = lignes.length
        ? lignes.map(([groupe, total]) => `<section class="card"><h2>${groupe}</h2><p><strong>Adhérents :</strong> ${total}</p></section>`).join("")
        : `<section class="card"><p>Aucune répartition de groupe disponible.</p></section>`;
}

afficherProgression();
afficherEtapes();
afficherAlertes();
afficherGroupes();
