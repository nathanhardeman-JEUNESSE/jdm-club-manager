import {
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db, JDM_CONFIG } from "../firebase/firebase.js";

const CODE_SECURITE_DEV = "JDM-admin-0";

const clesLocales = {
    adherents: "adherentsJDM",
    inscriptions: "inscriptionsJDM",
    groupes: "groupesJDM",
    planning: "planningExceptionsJDM",
    pointages: "pointagesJDM",
    appels: "appelsJDM",
    absences: "absencesJDM",
    competitions: "competitionsJDM",
    notifications: "notificationsJDM",
    commandes: "commandesJDM",
    notificationsTresorier: "notificationsTresorierJDM",
    panier: "panierJDM",
    articlesBoutique: "articlesBoutiqueJDM",
    organisation: "organisationJDM",
    validationsDossiers: "validationsDossiersJDM",
    aidesLicence: "aidesLicenceLommeJDM",
    saison: "saisonJDM",
    journal: "journalSystemeJDM"
};

const zoneSaison = document.getElementById("bloc-saison-actuelle");
const zoneStats = document.getElementById("stats-techniques");
const zoneJournal = document.getElementById("journal-systeme");

function lireJSON(cle, defaut = []) {
    try {
        return JSON.parse(localStorage.getItem(cle)) || defaut;
    } catch (error) {
        return defaut;
    }
}

function ecrireJSON(cle, valeur) {
    localStorage.setItem(cle, JSON.stringify(valeur));
}

function demanderCodeSecurite() {
    const code = prompt("Code de sécurité administrateur principal :");

    if (code !== CODE_SECURITE_DEV) {
        alert("Code incorrect. Action annulée.");
        return false;
    }

    return true;
}

function saisonActuelle() {
    const sauvegarde = localStorage.getItem(clesLocales.saison);

    if (sauvegarde) return sauvegarde;

    const maintenant = new Date();
    const annee = maintenant.getMonth() >= 7
        ? maintenant.getFullYear()
        : maintenant.getFullYear() - 1;

    return `${annee}/${annee + 1}`;
}

function saisonSuivante(saison) {
    const morceaux = String(saison || "").split("/");
    const debut = Number(morceaux[0]);

    if (!debut) {
        const maintenant = new Date().getFullYear();
        return `${maintenant}/${maintenant + 1}`;
    }

    return `${debut + 1}/${debut + 2}`;
}

function ajouterJournal(action, detail = "") {
    const journal = lireJSON(clesLocales.journal, []);

    journal.unshift({
        date: new Date().toISOString(),
        action,
        detail
    });

    ecrireJSON(clesLocales.journal, journal.slice(0, 200));
    afficherJournal();
}

function afficherSaison() {
    const saison = saisonActuelle();
    const suivante = saisonSuivante(saison);

    zoneSaison.innerHTML = `
        <p><strong>Saison actuelle :</strong> ${saison}</p>
        <p><strong>Prochaine saison proposée :</strong> ${suivante}</p>
    `;
}

function compter(cle) {
    const valeur = lireJSON(cle, []);

    if (Array.isArray(valeur)) return valeur.length;
    if (valeur && typeof valeur === "object") return Object.keys(valeur).length;

    return 0;
}

function afficherStats() {
    const stats = [
        ["Adhérents", compter(clesLocales.adherents)],
        ["Inscriptions", compter(clesLocales.inscriptions)],
        ["Groupes", compter(clesLocales.groupes)],
        ["Planning exceptions", compter(clesLocales.planning)],
        ["Pointages", compter(clesLocales.pointages)],
        ["Appels", compter(clesLocales.appels)],
        ["Absences", compter(clesLocales.absences)],
        ["Compétitions", compter(clesLocales.competitions)],
        ["Notifications", compter(clesLocales.notifications)],
        ["Commandes", compter(clesLocales.commandes)],
        ["Articles boutique admin", compter(clesLocales.articlesBoutique)],
        ["Organisation", compter(clesLocales.organisation)]
    ];

    zoneStats.innerHTML = stats.map(([label, valeur]) => `
        <section class="card">
            <h3>${label}</h3>
            <p><strong>${valeur}</strong></p>
        </section>
    `).join("");
}

function afficherJournal() {
    const journal = lireJSON(clesLocales.journal, []);

    if (journal.length === 0) {
        zoneJournal.innerHTML = `<p>Aucune action enregistrée.</p>`;
        return;
    }

    zoneJournal.innerHTML = journal.map(entree => `
        <div class="dev-log-entry">
            <strong>${new Date(entree.date).toLocaleString("fr-FR")}</strong><br>
            ${entree.action}<br>
            <span class="dev-small">${entree.detail || ""}</span>
        </div>
    `).join("");
}

async function marquerSaisonFirebase(saison, suivante) {
    try {
        await setDoc(doc(db, "settings", "saison"), {
            saisonActuelle: suivante,
            saisonPrecedente: saison,
            renouvellementObligatoire: true,
            messageRenouvellement: `La saison ${saison} est terminée. Nous vous invitons à prendre une nouvelle inscription pour retrouver l'accès à votre espace.`,
            lienInscription: "",
            updatedAt: serverTimestamp(),
            clubId: JDM_CONFIG.clubId
        }, { merge: true });

        const snap = await getDocs(collection(db, "users"));
        const actions = [];

        snap.forEach(document => {
            const user = document.data();

            if (user.role === "membre") {
                actions.push(updateDoc(doc(db, "users", document.id), {
                    saisonActive: false,
                    renouvellementObligatoire: true,
                    updatedAt: serverTimestamp()
                }));
            }
        });

        await Promise.all(actions);
        return actions.length;
    } catch (error) {
        console.warn("Mise à jour Firebase saison impossible :", error);
        return null;
    }
}

async function nouvelleSaison() {
    const saison = saisonActuelle();
    const suivante = saisonSuivante(saison);

    const confirmation1 = confirm(
        `Préparer la nouvelle saison ${suivante} ?\n\n` +
        "Cette action va remettre à zéro les groupes, planning, pointages, absences et compétitions locales.\n" +
        "Les comptes membres seront marqués à renouveler dans Firebase si possible."
    );

    if (!confirmation1) return;

    const confirmationTexte = prompt(`Tape exactement ${suivante} pour confirmer :`);

    if (confirmationTexte !== suivante) {
        alert("Confirmation incorrecte. Action annulée.");
        return;
    }

    if (!demanderCodeSecurite()) return;

    const archive = {
        saison,
        dateArchivage: new Date().toISOString(),
        groupes: lireJSON(clesLocales.groupes, []),
        planning: lireJSON(clesLocales.planning, []),
        pointages: lireJSON(clesLocales.pointages, []),
        appels: lireJSON(clesLocales.appels, []),
        absences: lireJSON(clesLocales.absences, []),
        competitions: lireJSON(clesLocales.competitions, [])
    };

    ecrireJSON(`archiveSaisonJDM-${saison}`, archive);
    localStorage.setItem(clesLocales.saison, suivante);

    localStorage.removeItem(clesLocales.groupes);
    localStorage.removeItem(clesLocales.planning);
    localStorage.removeItem(clesLocales.pointages);
    localStorage.removeItem(clesLocales.appels);
    localStorage.removeItem(clesLocales.absences);
    localStorage.removeItem(clesLocales.competitions);

    const comptesMaj = await marquerSaisonFirebase(saison, suivante);

    ajouterJournal(
        "Nouvelle saison préparée",
        comptesMaj === null
            ? `Saison ${saison} archivée, saison ${suivante} créée. Firebase non mis à jour.`
            : `Saison ${saison} archivée, saison ${suivante} créée. ${comptesMaj} compte(s) membre(s) marqués à renouveler.`
    );

    afficherSaison();
    afficherStats();

    alert("Nouvelle saison préparée ✅");
}

function viderCles(label, cles) {
    if (!demanderCodeSecurite()) return;
    if (!confirm(`Confirmer : ${label} ?`)) return;

    cles.forEach(cle => localStorage.removeItem(cle));

    ajouterJournal("Maintenance locale", label);
    afficherStats();

    alert(label + " ✅");
}

function exporterSauvegardeLocale() {
    const exportData = {};

    Object.entries(localStorage).forEach(([cle, valeur]) => {
        if (cle.includes("JDM") || cle.includes("archiveSaison")) {
            exportData[cle] = valeur;
        }
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");

    lien.href = url;
    lien.download = `sauvegarde-jdm-${new Date().toISOString().slice(0, 10)}.json`;
    lien.click();

    URL.revokeObjectURL(url);

    ajouterJournal("Sauvegarde locale exportée", "Fichier JSON généré.");
}

function lierBouton(id, gestionnaire) {
    const bouton = document.getElementById(id);

    if (!bouton) {
        console.warn(`[DEV] Bouton absent : #${id}`);
        return;
    }

    bouton.addEventListener("click", gestionnaire);
}

lierBouton("bouton-nouvelle-saison", nouvelleSaison);
lierBouton("vider-pointages", () => viderCles("Pointages vidés", [clesLocales.pointages, clesLocales.appels]));
lierBouton("vider-planning", () => viderCles("Planning vidé", [clesLocales.planning]));
lierBouton("vider-competitions", () => viderCles("Compétitions vidées", [clesLocales.competitions]));
lierBouton("vider-notifications", () => viderCles("Notifications vidées", [clesLocales.notifications, clesLocales.notificationsTresorier]));
lierBouton("vider-boutique", () => viderCles("Commandes boutique vidées", [clesLocales.commandes, clesLocales.notificationsTresorier, clesLocales.panier]));
lierBouton("vider-adherents", () => viderCles("Adhérents et inscriptions vidés", [clesLocales.adherents, clesLocales.inscriptions]));
lierBouton("export-local", exporterSauvegardeLocale);

afficherSaison();
afficherStats();
afficherJournal();


/* =========================================================
   CONSOLIDATION DEV - SAUVEGARDE IMPORT + HELLOASSO
   ========================================================= */

function importerSauvegardeLocale(fichier) {
    if (!fichier) return;

    const lecteur = new FileReader();

    lecteur.onload = (event) => {
        try {
            const donnees = JSON.parse(event.target.result);

            if (!confirm("Restaurer cette sauvegarde locale ? Les données JDM présentes dans ce navigateur seront remplacées.")) {
                return;
            }

            Object.entries(donnees).forEach(([cle, valeur]) => {
                localStorage.setItem(cle, valeur);
            });

            ajouterJournal("Sauvegarde restaurée", fichier.name);
            afficherStats();
            afficherJournal();

            alert("Sauvegarde restaurée avec succès. Recharge la page pour appliquer toutes les données.");
        } catch (error) {
            console.error(error);
            alert("Fichier de sauvegarde invalide.");
        }
    };

    lecteur.readAsText(fichier);
}

function initialiserImportSauvegardeLocale() {
    const boutonImport = document.getElementById("import-local");
    const champImport = document.getElementById("fichier-import-local");

    if (!boutonImport || !champImport) return;

    boutonImport.addEventListener("click", () => champImport.click());

    champImport.addEventListener("change", (event) => {
        importerSauvegardeLocale(event.target.files[0]);
        event.target.value = "";
    });
}

async function lancerDiagnosticSystemeSimple() {
    const diagFirebase = document.getElementById("diag-firebase");
    const diagConnexion = document.getElementById("diag-connexion");
    const diagSaison = document.getElementById("diag-saison");
    const diagHelloAsso = document.getElementById("diag-helloasso");

    if (diagSaison) diagSaison.textContent = saisonActuelle();

    if (diagFirebase || diagConnexion) {
        try {
            const users = await getDocs(collection(db, "users"));
            if (diagFirebase) diagFirebase.textContent = "✅ OK";
            if (diagConnexion) diagConnexion.textContent = `✅ ${users.size} compte(s)`;
        } catch (error) {
            console.warn("Diagnostic Firebase :", error);
            if (diagFirebase) diagFirebase.textContent = "❌ Erreur";
            if (diagConnexion) diagConnexion.textContent = "❌ Impossible";
        }
    }

    if (diagHelloAsso) {
        try {
            const snap = await getDoc(doc(db, "syncStatus", "helloasso"));
            if (!snap.exists()) {
                diagHelloAsso.textContent = "⚪ Aucune synchronisation";
            } else {
                const status = String(snap.data()?.status || "inconnu");
                diagHelloAsso.textContent = status === "success"
                    ? "✅ Dernière synchro réussie"
                    : status === "running"
                        ? "⏳ Synchronisation en cours"
                        : status === "error"
                            ? "❌ Dernière synchro en erreur"
                            : `ℹ️ ${status}`;
            }
        } catch (error) {
            diagHelloAsso.textContent = "❌ Lecture impossible";
        }
    }
}

const URL_WORKFLOW_HELLOASSO = "https://github.com/nathanhardeman-jeunesse/jdm-club-manager/actions/workflows/helloasso-sync.yml";
let minuterieSuiviHelloAsso = null;

function dateDepuisFirestore(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateFirestore(value) {
    const date = dateDepuisFirestore(value);
    return date ? date.toLocaleString("fr-FR") : "—";
}

function libelleStatistique(cle) {
    const libelles = {
        ordersRead: "Commandes lues",
        ordersWritten: "Commandes enregistrées",
        paymentsWritten: "Paiements enregistrés",
        adherentsWritten: "Adhérents enregistrés",
        registrationsWritten: "Inscriptions enregistrées",
        pendingUsersWritten: "Accès membres préparés",
        donationsWritten: "Dons enregistrés",
        productsIgnored: "Produits ignorés",
        uniqueAdherentsWritten: "Adhérents uniques",
        duplicateMembershipsMerged: "Lignes fusionnées",
        skipped: "Éléments ignorés",
        errors: "Erreurs"
    };
    return libelles[cle] || cle;
}

function afficherProgressionHelloAsso(data = {}) {
    const zoneEtat = document.getElementById("etat-sync-helloasso");
    const zoneProgression = document.getElementById("progression-sync-helloasso");
    if (!zoneEtat || !zoneProgression) return;

    const status = String(data.status || "absent");
    const stats = data.stats || {};
    const icone = status === "success" ? "✅" : status === "running" ? "⏳" : status === "error" ? "❌" : "⚪";
    const titre = status === "success"
        ? "Synchronisation terminée"
        : status === "running"
            ? "Synchronisation en cours"
            : status === "error"
                ? "Synchronisation interrompue"
                : "Aucune synchronisation enregistrée";

    zoneEtat.innerHTML = `
        <h3>${icone} ${titre}</h3>
        <p><strong>Mode :</strong> ${echapperHTML(data.mode || "—")}</p>
        <p><strong>Saison :</strong> ${echapperHTML(data.season || "—")}</p>
        <p><strong>Début :</strong> ${formatDateFirestore(data.startedAt)}</p>
        <p><strong>Fin :</strong> ${formatDateFirestore(data.finishedAt || data.lastSuccessAt)}</p>
        ${data.errorMessage ? `<p style="color:#ff8c94;"><strong>Erreur :</strong> ${echapperHTML(data.errorMessage)}</p>` : ""}
    `;

    const ordre = ["ordersRead", "ordersWritten", "paymentsWritten", "uniqueAdherentsWritten", "duplicateMembershipsMerged", "registrationsWritten", "pendingUsersWritten", "donationsWritten", "productsIgnored", "skipped", "errors"];
    zoneProgression.innerHTML = `
        <section class="card">
            <h3>📊 Rapport GitHub → Firestore</h3>
            ${ordre.map(cle => `<p><strong>${libelleStatistique(cle)} :</strong> ${Number(stats[cle] || 0)}</p>`).join("")}
            <p class="dev-small">Le suivi se rafraîchit automatiquement toutes les 5 secondes pendant une synchronisation.</p>
        </section>
    `;
}

async function actualiserEtatHelloAssoDetaille() {
    try {
        const snap = await getDoc(doc(db, "syncStatus", "helloasso"));
        const data = snap.exists() ? snap.data() : {};
        afficherProgressionHelloAsso(data);

        const diag = document.getElementById("diag-helloasso");
        if (diag) {
            const status = String(data.status || "absent");
            diag.textContent = status === "success" ? "✅ Dernière synchro réussie"
                : status === "running" ? "⏳ Synchronisation en cours"
                : status === "error" ? "❌ Dernière synchro en erreur"
                : "⚪ Aucune synchronisation";
        }

        if (statusEstEnCours(data.status)) demarrerSuiviHelloAsso();
        else arreterSuiviHelloAsso();
    } catch (error) {
        console.error("Lecture syncStatus/helloasso", error);
        afficherProgressionHelloAsso({ status: "error", errorMessage: error.message || "Lecture Firestore impossible." });
    }
}

function statusEstEnCours(status) {
    return String(status || "").toLowerCase() === "running";
}

function demarrerSuiviHelloAsso() {
    if (minuterieSuiviHelloAsso) return;
    minuterieSuiviHelloAsso = window.setInterval(actualiserEtatHelloAssoDetaille, 5000);
}

function arreterSuiviHelloAsso() {
    if (!minuterieSuiviHelloAsso) return;
    window.clearInterval(minuterieSuiviHelloAsso);
    minuterieSuiviHelloAsso = null;
}

function ouvrirSynchronisationGitHub() {
    window.open(URL_WORKFLOW_HELLOASSO, "_blank", "noopener,noreferrer");
    ajouterJournal("Synchronisation HelloAsso", "Ouverture du workflow GitHub Actions.");
    alert("GitHub va s'ouvrir. Clique sur Run workflow, puis choisis complete après un reset global ou incremental pour une mise à jour normale. Reviens ensuite ici : le suivi se mettra à jour automatiquement.");
    demarrerSuiviHelloAsso();
}

async function verifierDonneesHelloAssoFirestore() {
    const zone = document.getElementById("rapport-verification-helloasso");
    if (!zone) return;
    zone.innerHTML = `<section class="card"><p>⏳ Comptage des données Firestore...</p></section>`;

    const cibles = [
        ["adherents", "Adhérents", data => estDonneeHelloAsso(data)],
        ["inscriptions", "Inscriptions", data => estDonneeHelloAsso(data)],
        ["helloassoOrders", "Commandes HelloAsso", () => true],
        ["helloassoPayments", "Paiements HelloAsso", () => true],
        ["helloassoDonations", "Dons HelloAsso", () => true],
        ["pendingUsers", "Accès membres préparés", data => estDonneeHelloAsso(data)]
    ];

    const lignes = [];
    for (const [nom, libelle, filtre] of cibles) {
        try {
            const snap = await getDocs(collection(db, nom));
            let total = 0;
            snap.forEach(document => {
                if (filtre(document.data() || {})) total += 1;
            });
            lignes.push({ libelle, total, ok: true });
        } catch (error) {
            lignes.push({ libelle, total: 0, ok: false, erreur: error.message || "Permission refusée" });
        }
    }

    zone.innerHTML = `<section class="card"><h3>📋 Données actuellement présentes</h3>${lignes.map(ligne => `
        <p><strong>${ligne.ok ? "✅" : "❌"} ${echapperHTML(ligne.libelle)} :</strong> ${ligne.ok ? ligne.total : echapperHTML(ligne.erreur)}</p>
    `).join("")}</section>`;

    ajouterJournal("Vérification HelloAsso Firestore", lignes.filter(l => l.ok).map(l => `${l.libelle}: ${l.total}`).join(" · "));
}

const boutonOuvrirWorkflowHelloAsso = document.getElementById("ouvrir-sync-helloasso-github");
const boutonActualiserWorkflowHelloAsso = document.getElementById("actualiser-sync-helloasso");
const boutonVerifierHelloAssoFirestore = document.getElementById("verifier-donnees-helloasso-firestore");

if (boutonOuvrirWorkflowHelloAsso) boutonOuvrirWorkflowHelloAsso.addEventListener("click", ouvrirSynchronisationGitHub);
if (boutonActualiserWorkflowHelloAsso) boutonActualiserWorkflowHelloAsso.addEventListener("click", actualiserEtatHelloAssoDetaille);
if (boutonVerifierHelloAssoFirestore) boutonVerifierHelloAssoFirestore.addEventListener("click", verifierDonneesHelloAssoFirestore);

actualiserEtatHelloAssoDetaille();


/* =========================================================
   DOUBLE RESET DEV / HELLOASSO
   ========================================================= */

const CLES_CACHE_HELLOASSO = [
    "helloAssoFormulairesTestJDM",
    "helloAssoCommandesTestJDM",
    "helloAssoPreviewImportJDM",
    "helloAssoTokenTestJDM"
];

function estDonneeHelloAsso(data = {}) {
    return (
        String(data.source || "").toLowerCase() === "helloasso" ||
        Boolean(data.helloAssoOrderId) ||
        Boolean(data.helloassoOrderId) ||
        Boolean(data.helloAssoItemId) ||
        Boolean(data.helloassoItemId) ||
        Boolean(data.helloAssoPaymentId) ||
        Boolean(data.helloassoPaymentId)
    );
}

function telechargerJSON(nom, data) {
    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nom;
    lien.click();
    URL.revokeObjectURL(url);
}

async function lireCollectionPourSauvegarde(nomCollection) {
    try {
        const snap = await getDocs(collection(db, nomCollection));
        return {
            collection: nomCollection,
            documents: snap.docs.map(item => ({ id: item.id, ...item.data() }))
        };
    } catch (error) {
        return {
            collection: nomCollection,
            documents: [],
            erreur: error.message || "Lecture impossible"
        };
    }
}

async function supprimerDocuments(nomCollection, filtre = () => true) {
    const snap = await getDocs(collection(db, nomCollection));
    const cibles = snap.docs.filter(item => filtre(item.data(), item.id));

    for (let index = 0; index < cibles.length; index += 20) {
        const lot = cibles.slice(index, index + 20);
        await Promise.all(lot.map(item => deleteDoc(item.ref)));
    }

    return cibles.length;
}

function viderCachesHelloAssoLocaux() {
    CLES_CACHE_HELLOASSO.forEach(cle => localStorage.removeItem(cle));
}

function nettoyerDonneesHelloAssoLocales() {
    const adherents = lireJSON(clesLocales.adherents, []);
    const inscriptions = lireJSON(clesLocales.inscriptions, []);
    const adherentsConserves = adherents.filter(item => !estDonneeHelloAsso(item));
    const inscriptionsConservees = inscriptions.filter(item => !estDonneeHelloAsso(item));
    ecrireJSON(clesLocales.adherents, adherentsConserves);
    ecrireJSON(clesLocales.inscriptions, inscriptionsConservees);
    return {
        adherents: adherents.length - adherentsConserves.length,
        inscriptions: inscriptions.length - inscriptionsConservees.length
    };
}


async function compterDocuments(nomCollection, filtre = () => true) {
    try {
        const snap = await getDocs(collection(db, nomCollection));
        return {
            total: snap.docs.filter(item => filtre(item.data(), item.id)).length,
            erreur: ""
        };
    } catch (error) {
        return {
            total: 0,
            erreur: error.message || "Lecture impossible"
        };
    }
}

function ligneSimulation(label, resultat) {
    if (resultat.erreur) {
        return `<p><strong>${label} :</strong> ⚠️ lecture impossible (${resultat.erreur})</p>`;
    }
    return `<p><strong>${label} :</strong> ${resultat.total}</p>`;
}

async function analyserRafraichissementHelloAsso() {
    const zone = document.getElementById("rapport-rafraichissement-helloasso");
    if (!zone) return;

    zone.innerHTML = `<section class="card"><p>🔍 Analyse en lecture seule de Firestore...</p></section>`;

    const [adherents, inscriptions, accesMembres, commandes, paiements, tresorerie, dons] = await Promise.all([
        compterDocuments("adherents", data => estDonneeHelloAsso(data)),
        compterDocuments("inscriptions", data => estDonneeHelloAsso(data)),
        compterDocuments("pendingUsers", data => estDonneeHelloAsso(data) && !["admin", "superadmin", "super-admin", "super_admin"].includes(String(data.role || "").toLowerCase())),
        compterDocuments("helloassoOrders"),
        compterDocuments("helloassoPayments"),
        compterDocuments(
            "tresorerieCotisations",
            data => estDonneeHelloAsso(data) &&
                data.licenceValidee !== true &&
                data.cotisationRegularisee !== true
        ),
        compterDocuments("helloassoDonations")
    ]);

    const adherentsLocaux = lireJSON(clesLocales.adherents, [])
        .filter(item => estDonneeHelloAsso(item)).length;
    const inscriptionsLocales = lireJSON(clesLocales.inscriptions, [])
        .filter(item => estDonneeHelloAsso(item)).length;
    const cachesLocaux = CLES_CACHE_HELLOASSO
        .filter(cle => localStorage.getItem(cle) !== null).length;

    zone.innerHTML = `
        <section class="card">
            <h3>🔍 Simulation terminée — aucune donnée modifiée</h3>
            ${ligneSimulation("Adhérents importés HelloAsso qui seraient supprimés", adherents)}
            ${ligneSimulation("Inscriptions HelloAsso Firestore qui seraient supprimées", inscriptions)}
            ${ligneSimulation("Accès membres préparés par HelloAsso qui seraient supprimés", accesMembres)}
            ${ligneSimulation("Commandes techniques HelloAsso qui seraient supprimées", commandes)}
            ${ligneSimulation("Paiements techniques HelloAsso qui seraient supprimés", paiements)}
            ${ligneSimulation("Dossiers trésorerie HelloAsso non validés qui seraient supprimés", tresorerie)}
            ${ligneSimulation("Dons HelloAsso qui seraient supprimés puis réimportés", dons)}
            <p><strong>Adhérents HelloAsso locaux qui seraient supprimés :</strong> ${adherentsLocaux}</p>
            <p><strong>Inscriptions HelloAsso locales qui seraient supprimées :</strong> ${inscriptionsLocales}</p>
            <p><strong>Caches techniques HelloAsso qui seraient vidés :</strong> ${cachesLocaux}</p>
            <hr>
            <p><strong>Conservés :</strong> administrateurs, groupes, planning, configuration Firebase/HelloAsso et données créées manuellement sans source HelloAsso.</p>
        </section>
    `;
}

function echapperHTML(valeur) {
    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function creerSuiviOperation(zone, titre, etapes) {
    const suivi = {
        titre,
        etapes: etapes.map((etape, index) => ({
            id: etape.id || `etape-${index + 1}`,
            label: etape.label,
            statut: "attente",
            detail: "En attente",
            total: null
        }))
    };

    function afficher() {
        if (!zone) return;

        const terminees = suivi.etapes.filter(etape => ["ok", "erreur", "ignore"].includes(etape.statut)).length;
        const progression = suivi.etapes.length
            ? Math.round((terminees / suivi.etapes.length) * 100)
            : 0;

        zone.innerHTML = `
            <section class="card">
                <h3>${echapperHTML(suivi.titre)}</h3>
                <div style="height:14px;background:rgba(255,255,255,.10);border-radius:999px;overflow:hidden;margin:12px 0 16px;">
                    <div style="height:100%;width:${progression}%;background:linear-gradient(90deg,#2583ff,#37d67a);transition:width .25s ease;"></div>
                </div>
                <p><strong>Progression :</strong> ${terminees}/${suivi.etapes.length} étape(s) — ${progression}%</p>
                <div style="display:grid;gap:8px;margin-top:12px;">
                    ${suivi.etapes.map(etape => {
                        const icone = etape.statut === "ok" ? "✅"
                            : etape.statut === "erreur" ? "❌"
                            : etape.statut === "encours" ? "⏳"
                            : etape.statut === "ignore" ? "⚪"
                            : "▫️";
                        const couleur = etape.statut === "erreur" ? "#ff8c94"
                            : etape.statut === "ok" ? "#8ce5ad"
                            : "inherit";
                        return `
                            <div style="padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:10px;">
                                <div style="color:${couleur};"><strong>${icone} ${echapperHTML(etape.label)}</strong></div>
                                <div class="dev-small" style="margin-top:4px;">${echapperHTML(etape.detail)}</div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    }

    function modifier(id, modifications) {
        const etape = suivi.etapes.find(item => item.id === id);
        if (!etape) return;
        Object.assign(etape, modifications);
        afficher();
    }

    afficher();
    return { suivi, afficher, modifier };
}

async function executerEtapeSuivie(suivi, id, action, options = {}) {
    suivi.modifier(id, { statut: "encours", detail: options.messageEnCours || "Traitement en cours..." });

    try {
        const resultat = await action();
        const detail = options.formaterSucces
            ? options.formaterSucces(resultat)
            : `${resultat ?? 0} élément(s) traité(s)`;
        suivi.modifier(id, { statut: "ok", detail, total: resultat });
        return { ok: true, resultat };
    } catch (error) {
        const message = error?.message || "Erreur inconnue";
        console.error(`Étape ${id}`, error);
        suivi.modifier(id, { statut: "erreur", detail: message });
        return { ok: false, erreur: message };
    }
}

async function rafraichirImportsHelloAsso() {
    const zone = document.getElementById("rapport-rafraichissement-helloasso");

    if (!confirm(
        "Nettoyer les imports HelloAsso ?\n\n" +
        "Tous les adhérents, inscriptions et accès membres provenant de HelloAsso seront supprimés puis reconstruits au prochain import.\n" +
        "Les administrateurs, groupes, planning et réglages techniques seront conservés."
    )) return;

    const texte = prompt("Tape exactement RAFRAICHIR pour confirmer :");
    if (texte !== "RAFRAICHIR") {
        alert("Confirmation incorrecte. Aucune donnée modifiée.");
        return;
    }

    if (!demanderCodeSecurite()) return;

    const etapes = [
        { id: "sauvegarde", label: "Sauvegarde JSON avant nettoyage" },
        { id: "adherents", label: "Adhérents importés HelloAsso" },
        { id: "inscriptions", label: "Inscriptions HelloAsso Firestore" },
        { id: "pendingUsers", label: "Accès membres préparés par HelloAsso" },
        { id: "orders", label: "Commandes techniques HelloAsso" },
        { id: "payments", label: "Paiements techniques HelloAsso" },
        { id: "tresorerie", label: "Dossiers trésorerie HelloAsso non validés" },
        { id: "dons", label: "Dons HelloAsso" },
        { id: "local", label: "Adhérents et inscriptions HelloAsso locales" },
        { id: "caches", label: "Caches techniques HelloAsso" }
    ];
    const suivi = creerSuiviOperation(zone, "🔄 Rafraîchissement sécurisé HelloAsso", etapes);
    const rapport = {};

    const sauvegarde = await executerEtapeSuivie(suivi, "sauvegarde", async () => {
        const donnees = {
            type: "rafraichissement-imports-helloasso",
            date: new Date().toISOString(),
            adherents: await lireCollectionPourSauvegarde("adherents"),
            inscriptions: await lireCollectionPourSauvegarde("inscriptions"),
            pendingUsers: await lireCollectionPourSauvegarde("pendingUsers"),
            commandes: await lireCollectionPourSauvegarde("helloassoOrders"),
            paiements: await lireCollectionPourSauvegarde("helloassoPayments"),
            tresorerie: await lireCollectionPourSauvegarde("tresorerieCotisations"),
            dons: await lireCollectionPourSauvegarde("helloassoDonations")
        };
        telechargerJSON(
            `sauvegarde-avant-rafraichissement-helloasso-${new Date().toISOString().slice(0,10)}.json`,
            donnees
        );
        return 1;
    }, { formaterSucces: () => "Sauvegarde téléchargée" });
    rapport.sauvegarde = sauvegarde;


    rapport.adherents = await executerEtapeSuivie(
        suivi,
        "adherents",
        () => supprimerDocuments("adherents", data => estDonneeHelloAsso(data)),
        { formaterSucces: total => `${total} document(s) supprimé(s)` }
    );
    rapport.inscriptions = await executerEtapeSuivie(
        suivi,
        "inscriptions",
        () => supprimerDocuments("inscriptions", data => estDonneeHelloAsso(data)),
        { formaterSucces: total => `${total} document(s) supprimé(s)` }
    );
    rapport.pendingUsers = await executerEtapeSuivie(
        suivi,
        "pendingUsers",
        () => supprimerDocuments("pendingUsers", data => estDonneeHelloAsso(data) && !["admin", "superadmin", "super-admin", "super_admin"].includes(String(data.role || "").toLowerCase())),
        { formaterSucces: total => `${total} document(s) supprimé(s)` }
    );
    rapport.orders = await executerEtapeSuivie(
        suivi,
        "orders",
        () => supprimerDocuments("helloassoOrders"),
        { formaterSucces: total => `${total} document(s) supprimé(s)` }
    );
    rapport.payments = await executerEtapeSuivie(
        suivi,
        "payments",
        () => supprimerDocuments("helloassoPayments"),
        { formaterSucces: total => `${total} document(s) supprimé(s)` }
    );
    rapport.tresorerie = await executerEtapeSuivie(
        suivi,
        "tresorerie",
        () => supprimerDocuments(
            "tresorerieCotisations",
            data => estDonneeHelloAsso(data) &&
                data.licenceValidee !== true &&
                data.cotisationRegularisee !== true
        ),
        { formaterSucces: total => `${total} document(s) supprimé(s)` }
    );
    rapport.dons = await executerEtapeSuivie(
        suivi,
        "dons",
        () => supprimerDocuments("helloassoDonations"),
        { formaterSucces: total => `${total} document(s) supprimé(s)` }
    );
    rapport.local = await executerEtapeSuivie(
        suivi,
        "local",
        async () => nettoyerDonneesHelloAssoLocales(),
        { formaterSucces: resultat => `${resultat.adherents} adhérent(s) et ${resultat.inscriptions} inscription(s) locale(s) supprimé(s)` }
    );
    rapport.caches = await executerEtapeSuivie(
        suivi,
        "caches",
        async () => {
            const total = CLES_CACHE_HELLOASSO.filter(cle => localStorage.getItem(cle) !== null).length;
            viderCachesHelloAssoLocaux();
            return total;
        },
        { formaterSucces: total => `${total} cache(s) vidé(s)` }
    );

    const erreurs = Object.values(rapport).filter(resultat => resultat && resultat.ok === false);

    ajouterJournal(
        "Rafraîchissement imports HelloAsso",
        erreurs.length
            ? `${erreurs.length} étape(s) en erreur. Voir le rapport Dev.`
            : "Toutes les étapes ont été exécutées."
    );
    afficherStats();
    actualiserEtatHelloAssoDetaille();

    if (erreurs.length) {
        alert(`Rafraîchissement terminé avec ${erreurs.length} erreur(s). Consulte le rapport affiché.`);
    } else {
        alert("Rafraîchissement terminé ✅\nTu peux maintenant relancer un import HelloAsso propre.");
    }
}


async function analyserResetGlobalDeveloppement() {
    const zone = document.getElementById("rapport-reset-global");
    if (!zone) return;

    const conserverPlanning = Boolean(
        document.getElementById("conserver-planning-groupes")?.checked
    );

    zone.innerHTML = `<section class="card"><p>🔍 Inventaire en lecture seule de Firestore...</p></section>`;

    const collections = [
        ["adherents", "Adhérents", () => true],
        ["inscriptions", "Inscriptions", () => true],
        ["tresorerieCotisations", "Dossiers de trésorerie", () => true],
        ["helloassoDonations", "Dons HelloAsso", () => true],
        ["pendingUsers", "Accès membres préparés", data => !["admin", "superadmin", "super-admin", "super_admin"].includes(String(data.role || "").toLowerCase())],
        ["notifications", "Notifications", () => true],
        ["absences", "Absences", () => true],
        ["pointages", "Pointages", () => true],
        ["appels", "Appels", () => true],
        ["competitions", "Compétitions", () => true],
        ["commandes", "Commandes", () => true],
        ["users", "Profils membres Firestore", data => ["membre", "parent", "adherent", "adhérent"].includes(String(data.role || "").toLowerCase())]
    ];

    if (!conserverPlanning) {
        collections.push(
            ["groupes", "Groupes", () => true],
            ["planningExceptions", "Exceptions de planning", () => true]
        );
    }

    const resultats = await Promise.all(
        collections.map(async ([nom, label, filtre]) => ({
            nom,
            label,
            ...(await compterDocuments(nom, filtre))
        }))
    );

    const totalFirestore = resultats.reduce((somme, item) => somme + item.total, 0);

    zone.innerHTML = `
        <section class="card">
            <h3>🔍 Simulation nucléaire — aucune donnée modifiée</h3>
            <p><strong>Total Firestore qui serait supprimé :</strong> ${totalFirestore} document(s)</p>
            ${resultats.map(item => ligneSimulation(item.label, item)).join("")}
            <hr>
            <p><strong>Groupes et planning :</strong> ${conserverPlanning ? "✅ conservés" : "☠️ supprimés"}</p>
            <p><strong>Toujours conservés :</strong> administrateurs, paramètres Firebase, configuration HelloAsso et comptes Firebase Authentication.</p>
            <p class="dev-small">Une ligne « lecture impossible » signale une règle Firestore qui empêchera aussi la suppression de cette collection.</p>
        </section>
    `;
}

async function resetGlobalDeveloppement() {
    const zone = document.getElementById("rapport-reset-global");
    const conserverPlanning = Boolean(
        document.getElementById("conserver-planning-groupes")?.checked
    );

    if (!confirm(
        "☠️ RÉINITIALISATION GLOBALE DE DÉVELOPPEMENT\n\n" +
        "Cette action efface les données de travail et les espaces membres de test.\n" +
        "Les administrateurs, paramètres Firebase et identifiants HelloAsso restent conservés.\n\n" +
        "Continuer ?"
    )) return;

    const texte = prompt("Tape exactement JE DETRUIS LES DONNEES DE TEST :");
    if (texte !== "JE DETRUIS LES DONNEES DE TEST") {
        alert("Phrase incorrecte. Aucune donnée modifiée.");
        return;
    }

    if (!demanderCodeSecurite()) return;

    if (!confirm(
        `DERNIÈRE CONFIRMATION ☠️\n\nGroupes et planning : ${conserverPlanning ? "CONSERVÉS" : "SUPPRIMÉS"}\n\nÊtes-vous absolument certain ?`
    )) return;

    const definitions = [
        { id: "adherents", collection: "adherents", label: "Adhérents", filtre: () => true },
        { id: "inscriptions", collection: "inscriptions", label: "Inscriptions", filtre: () => true },
        { id: "tresorerie", collection: "tresorerieCotisations", label: "Dossiers de trésorerie", filtre: () => true },
        { id: "dons", collection: "helloassoDonations", label: "Dons HelloAsso", filtre: () => true },
        { id: "pendingUsers", collection: "pendingUsers", label: "Accès membres préparés", filtre: data => !["admin", "superadmin", "super-admin", "super_admin"].includes(String(data.role || "").toLowerCase()) },
        { id: "notifications", collection: "notifications", label: "Notifications", filtre: () => true },
        { id: "absences", collection: "absences", label: "Absences", filtre: () => true },
        { id: "pointages", collection: "pointages", label: "Pointages", filtre: () => true },
        { id: "appels", collection: "appels", label: "Appels", filtre: () => true },
        { id: "competitions", collection: "competitions", label: "Compétitions", filtre: () => true },
        { id: "commandes", collection: "commandes", label: "Commandes", filtre: () => true },
        { id: "users", collection: "users", label: "Profils membres Firestore", filtre: data => ["membre", "parent", "adherent", "adhérent"].includes(String(data.role || "").toLowerCase()) }
    ];

    if (!conserverPlanning) {
        definitions.push(
            { id: "groupes", collection: "groupes", label: "Groupes", filtre: () => true },
            { id: "planning", collection: "planningExceptions", label: "Exceptions de planning", filtre: () => true }
        );
    }

    const etapes = [
        { id: "sauvegarde", label: "Sauvegarde JSON complète" },
        ...definitions.map(item => ({ id: item.id, label: item.label })),
        { id: "local", label: "Données locales du navigateur" },
        { id: "caches", label: "Caches techniques HelloAsso" }
    ];
    const suivi = creerSuiviOperation(zone, "☠️ Réinitialisation globale en cours", etapes);
    const rapport = [];

    const collectionsSauvegarde = [...new Set(definitions.map(item => item.collection))];
    const sauvegarde = await executerEtapeSuivie(suivi, "sauvegarde", async () => {
        const sauvegardes = [];
        for (const nom of collectionsSauvegarde) {
            sauvegardes.push(await lireCollectionPourSauvegarde(nom));
        }
        telechargerJSON(
            `sauvegarde-avant-reset-global-jdm-${new Date().toISOString().slice(0,10)}.json`,
            {
                type: "reset-global-developpement",
                date: new Date().toISOString(),
                conserverPlanningGroupes: conserverPlanning,
                collections: sauvegardes
            }
        );
        const erreursLecture = sauvegardes.filter(item => item.erreur).length;
        return { collections: sauvegardes.length, erreursLecture };
    }, {
        formaterSucces: resultat => resultat.erreursLecture
            ? `Sauvegarde téléchargée — ${resultat.erreursLecture} collection(s) illisible(s), signalée(s) dans le fichier`
            : `Sauvegarde téléchargée — ${resultat.collections} collection(s)`
    });
    rapport.push({ label: "Sauvegarde JSON", ...sauvegarde });

    for (const definition of definitions) {
        const resultat = await executerEtapeSuivie(
            suivi,
            definition.id,
            () => supprimerDocuments(definition.collection, definition.filtre),
            { formaterSucces: total => `${total} document(s) supprimé(s)` }
        );
        rapport.push({ label: definition.label, collection: definition.collection, ...resultat });
    }

    const resultatLocal = await executerEtapeSuivie(suivi, "local", async () => {
        const clesASupprimer = [
            clesLocales.adherents,
            clesLocales.inscriptions,
            clesLocales.pointages,
            clesLocales.appels,
            clesLocales.absences,
            clesLocales.competitions,
            clesLocales.notifications,
            clesLocales.notificationsTresorier,
            clesLocales.commandes,
            clesLocales.panier,
            clesLocales.validationsDossiers,
            clesLocales.aidesLicence
        ];
        if (!conserverPlanning) {
            clesASupprimer.push(clesLocales.groupes, clesLocales.planning);
        }
        const total = clesASupprimer.filter(cle => localStorage.getItem(cle) !== null).length;
        clesASupprimer.forEach(cle => localStorage.removeItem(cle));
        return total;
    }, { formaterSucces: total => `${total} clé(s) locale(s) supprimée(s)` });
    rapport.push({ label: "Données locales", ...resultatLocal });

    const resultatCaches = await executerEtapeSuivie(suivi, "caches", async () => {
        const total = CLES_CACHE_HELLOASSO.filter(cle => localStorage.getItem(cle) !== null).length;
        viderCachesHelloAssoLocaux();
        return total;
    }, { formaterSucces: total => `${total} cache(s) vidé(s)` });
    rapport.push({ label: "Caches HelloAsso", ...resultatCaches });

    const erreurs = rapport.filter(item => item.ok === false);
    const reussites = rapport.filter(item => item.ok === true);

    ajouterJournal(
        "☠️ Réinitialisation globale développement",
        `${reussites.length} étape(s) réussie(s), ${erreurs.length} erreur(s). ` +
        rapport.filter(item => typeof item.resultat === "number")
            .map(item => `${item.label}: ${item.resultat}`)
            .join(" · ")
    );

    afficherStats();
    actualiserEtatHelloAssoDetaille();

    const titreFinal = erreurs.length
        ? `⚠️ Réinitialisation terminée avec ${erreurs.length} erreur(s)`
        : "✅ Réinitialisation terminée";
    suivi.suivi.titre = titreFinal;
    suivi.afficher();

    if (zone) {
        zone.insertAdjacentHTML("beforeend", `
            <section class="card" style="margin-top:12px;">
                <h3>📋 Rapport final complet</h3>
                ${rapport.map(item => `
                    <p>
                        <strong>${item.ok ? "✅" : "❌"} ${echapperHTML(item.label)} :</strong>
                        ${item.ok
                            ? (typeof item.resultat === "number" ? `${item.resultat} élément(s) supprimé(s)` : "terminé")
                            : echapperHTML(item.erreur || "Erreur inconnue")}
                    </p>
                `).join("")}
                <hr>
                <p><strong>Groupes et planning :</strong> ${conserverPlanning ? "conservés" : "suppression demandée"}</p>
                <p><strong>Administrateurs :</strong> conservés</p>
                <p><strong>Paramètres Firebase et configuration HelloAsso :</strong> conservés</p>
                <p><strong>Comptes Firebase Authentication :</strong> conservés (seuls les profils membres Firestore sont ciblés)</p>
                ${erreurs.length ? `<p style="color:#ff8c94;"><strong>À corriger :</strong> les collections marquées ❌ sont bloquées par les règles Firestore et n'ont pas été supprimées.</p>` : ""}
            </section>
        `);
    }

    if (erreurs.length) {
        alert(`Réinitialisation terminée avec ${erreurs.length} erreur(s). Les lignes rouges indiquent exactement ce qui n'a pas pu être supprimé.`);
    } else {
        alert("☠️ Réinitialisation globale terminée. La base de test est prête.");
    }
}

const boutonAnalyserRafraichissement = document.getElementById("analyser-rafraichissement-helloasso");
const boutonRafraichirImports = document.getElementById("rafraichir-imports-helloasso");
const boutonAnalyserResetGlobal = document.getElementById("analyser-reset-global");
const boutonResetGlobal = document.getElementById("reset-global-developpement");

if (boutonAnalyserRafraichissement) {
    boutonAnalyserRafraichissement.addEventListener("click", analyserRafraichissementHelloAsso);
}

if (boutonRafraichirImports) {
    boutonRafraichirImports.addEventListener("click", rafraichirImportsHelloAsso);
}

if (boutonAnalyserResetGlobal) {
    boutonAnalyserResetGlobal.addEventListener("click", analyserResetGlobalDeveloppement);
}

if (boutonResetGlobal) {
    boutonResetGlobal.addEventListener("click", resetGlobalDeveloppement);
}
