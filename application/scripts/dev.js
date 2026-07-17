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

document.getElementById("bouton-nouvelle-saison").addEventListener("click", nouvelleSaison);
document.getElementById("vider-pointages").addEventListener("click", () => viderCles("Pointages vidés", [clesLocales.pointages, clesLocales.appels]));
document.getElementById("vider-planning").addEventListener("click", () => viderCles("Planning vidé", [clesLocales.planning]));
document.getElementById("vider-competitions").addEventListener("click", () => viderCles("Compétitions vidées", [clesLocales.competitions]));
document.getElementById("vider-notifications").addEventListener("click", () => viderCles("Notifications vidées", [clesLocales.notifications, clesLocales.notificationsTresorier]));
document.getElementById("vider-boutique").addEventListener("click", () => viderCles("Commandes boutique vidées", [clesLocales.commandes, clesLocales.notificationsTresorier, clesLocales.panier]));
document.getElementById("vider-adherents").addEventListener("click", () => viderCles("Adhérents et inscriptions vidés", [clesLocales.adherents, clesLocales.inscriptions]));
document.getElementById("export-local").addEventListener("click", exporterSauvegardeLocale);

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

    if (diagSaison) {
        diagSaison.textContent = saisonActuelle();
    }

    if (diagHelloAsso) {
        const localSecret = lireJSON("helloAssoSecretLocalJDM", {});
        try {
            const snap = await getDoc(doc(db, "settings", "helloasso"));
            if (snap.exists() && localSecret.clientSecret) {
                diagHelloAsso.textContent = "🟠 Paramètres enregistrés";
            } else {
                diagHelloAsso.textContent = "⚪ Non configuré";
            }
        } catch (error) {
            diagHelloAsso.textContent = "❌ Erreur lecture";
        }
    }

    if (diagFirebase) {
        try {
            await getDocs(collection(db, "users"));
            diagFirebase.textContent = "✅ OK";
        } catch (error) {
            console.warn("Diagnostic Firebase :", error);
            diagFirebase.textContent = "❌ Erreur";
        }
    }

    if (diagConnexion) {
        try {
            const users = await getDocs(collection(db, "users"));
            diagConnexion.textContent = `✅ ${users.size} compte(s)`;
        } catch (error) {
            console.warn("Diagnostic connexion :", error);
            diagConnexion.textContent = "❌ Impossible";
        }
    }
}

async function chargerParametresHelloAssoConsolide() {
    const clientId = document.getElementById("helloasso-client-id");
    const clientSecret = document.getElementById("helloasso-client-secret");
    const organizationSlug = document.getElementById("helloasso-organization-slug");
    const etat = document.getElementById("etat-helloasso");

    if (!clientId || !clientSecret || !organizationSlug || !etat) return;

    try {
        const snap = await getDoc(doc(db, "settings", "helloasso"));

        if (snap.exists()) {
            const params = snap.data();
            clientId.value = params.clientId || "";
            organizationSlug.value = params.organizationSlug || "";
        }

        const secretLocal = lireJSON("helloAssoSecretLocalJDM", {});
        clientSecret.value = secretLocal.clientSecret || "";

        if (clientId.value && organizationSlug.value && clientSecret.value) {
            etat.textContent = "Paramètres HelloAsso chargés ✅";
        } else {
            etat.textContent = "Aucun paramètre HelloAsso complet enregistré.";
        }
    } catch (error) {
        console.warn("Chargement HelloAsso impossible :", error);
        etat.textContent = "Chargement Firebase impossible pour HelloAsso.";
    }
}

async function enregistrerParametresHelloAssoConsolide() {
    if (!demanderCodeSecurite()) return;

    const clientId = document.getElementById("helloasso-client-id");
    const clientSecret = document.getElementById("helloasso-client-secret");
    const organizationSlug = document.getElementById("helloasso-organization-slug");
    const etat = document.getElementById("etat-helloasso");

    if (!clientId || !clientSecret || !organizationSlug || !etat) return;

    const clientIdValue = clientId.value.trim();
    const clientSecretValue = clientSecret.value.trim();
    const organizationSlugValue = organizationSlug.value.trim();

    if (!clientIdValue || !clientSecretValue || !organizationSlugValue) {
        alert("Merci de compléter Client ID, Client Secret et Slug organisation.");
        return;
    }

    try {
        await setDoc(doc(db, "settings", "helloasso"), {
            clientId: clientIdValue,
            organizationSlug: organizationSlugValue,
            mode: "preparation",
            secretStockage: "local-browser-only",
            updatedAt: serverTimestamp(),
            clubId: JDM_CONFIG.clubId
        }, { merge: true });

        ecrireJSON("helloAssoSecretLocalJDM", {
            clientSecret: clientSecretValue,
            updatedAt: new Date().toISOString()
        });

        etat.textContent = "Paramètres HelloAsso enregistrés ✅";
        ajouterJournal("Paramètres HelloAsso enregistrés", organizationSlugValue);
        lancerDiagnosticSystemeSimple();
        alert("Paramètres HelloAsso enregistrés ✅");
    } catch (error) {
        console.error(error);
        alert("Impossible d'enregistrer les paramètres HelloAsso.");
    }
}

async function testerConnexionHelloAssoConsolide() {
    const clientId = document.getElementById("helloasso-client-id");
    const clientSecret = document.getElementById("helloasso-client-secret");
    const organizationSlug = document.getElementById("helloasso-organization-slug");
    const etat = document.getElementById("etat-helloasso");

    if (!clientId || !clientSecret || !organizationSlug || !etat) return;

    const clientIdValue = clientId.value.trim();
    const clientSecretValue = clientSecret.value.trim();
    const organizationSlugValue = organizationSlug.value.trim();

    if (!clientIdValue || !clientSecretValue || !organizationSlugValue) {
        alert("Merci de compléter Client ID, Client Secret et Slug organisation avant le test.");
        return;
    }

    etat.textContent = "Test de connexion HelloAsso en cours...";

    try {
        const body = new URLSearchParams();
        body.append("grant_type", "client_credentials");
        body.append("client_id", clientIdValue);
        body.append("client_secret", clientSecretValue);

        const response = await fetch("https://api.helloasso.com/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.access_token) {
            console.error("HelloAsso OAuth error", data);
            etat.textContent = "Connexion HelloAsso refusée ❌";
            alert("Connexion HelloAsso refusée. Vérifie Client ID, Client Secret et droits API.");
            return;
        }

        ecrireJSON("helloAssoTokenTestJDM", {
            accessTokenPreview: String(data.access_token).slice(0, 12) + "...",
            tokenType: data.token_type || "",
            expiresIn: data.expires_in || "",
            organizationSlug: organizationSlugValue,
            testedAt: new Date().toISOString()
        });

        etat.textContent = "Connexion HelloAsso OK ✅ Token obtenu.";
        const diagHelloAsso = document.getElementById("diag-helloasso");
        if (diagHelloAsso) diagHelloAsso.textContent = "✅ Connexion OK";

        ajouterJournal("Test connexion HelloAsso OK", organizationSlugValue);
        alert("Connexion HelloAsso OK ✅");
    } catch (error) {
        console.error(error);
        etat.textContent = "Test impossible depuis le navigateur ❌";
        alert(
            "Test impossible depuis le navigateur. Cela peut venir du CORS HelloAsso.\n" +
            "Si les identifiants sont bons, on passera par Firebase Functions pour le test sécurisé."
        );
    }
}

function initialiserHelloAssoConsolide() {
    const boutonEnregistrer = document.getElementById("enregistrer-helloasso");
    const boutonTester = document.getElementById("tester-helloasso");

    if (boutonEnregistrer) {
        boutonEnregistrer.addEventListener("click", enregistrerParametresHelloAssoConsolide);
    }

    if (boutonTester) {
        boutonTester.addEventListener("click", testerConnexionHelloAssoConsolide);
    }

    chargerParametresHelloAssoConsolide();
}

initialiserImportSauvegardeLocale();
initialiserHelloAssoConsolide();
lancerDiagnosticSystemeSimple();



async function obtenirTokenHelloAssoDev() {
    const clientId = document.getElementById("helloasso-client-id");
    const clientSecret = document.getElementById("helloasso-client-secret");

    const clientIdValue = clientId ? clientId.value.trim() : "";
    const clientSecretValue = clientSecret ? clientSecret.value.trim() : "";

    if (!clientIdValue || !clientSecretValue) {
        throw new Error("Client ID ou Client Secret manquant.");
    }

    const body = new URLSearchParams();
    body.append("grant_type", "client_credentials");
    body.append("client_id", clientIdValue);
    body.append("client_secret", clientSecretValue);

    const response = await fetch("https://api.helloasso.com/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.access_token) {
        console.error("HelloAsso token error", data);
        throw new Error("Token HelloAsso impossible.");
    }

    return data.access_token;
}

async function chargerFormulairesHelloAsso() {
    const zone = document.getElementById("liste-formulaires-helloasso");
    const organizationSlug = document.getElementById("helloasso-organization-slug");

    if (!zone || !organizationSlug) return;

    const slug = organizationSlug.value.trim();

    if (!slug) {
        alert("Slug organisation manquant.");
        return;
    }

    zone.innerHTML = `<section class="card"><p>Chargement des formulaires HelloAsso...</p></section>`;

    try {
        const token = await obtenirTokenHelloAssoDev();

        const url = `https://api.helloasso.com/v5/organizations/${encodeURIComponent(slug)}/forms?pageIndex=1&pageSize=20`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error("HelloAsso forms error", data);
            zone.innerHTML = `<section class="card"><h3>Erreur</h3><p>Impossible de charger les formulaires HelloAsso.</p></section>`;
            return;
        }

        const formulaires = data.data || [];

        ecrireJSON("helloAssoFormulairesTestJDM", {
            organizationSlug: slug,
            loadedAt: new Date().toISOString(),
            total: formulaires.length,
            formulaires
        });

        if (formulaires.length === 0) {
            zone.innerHTML = `<section class="card"><h3>Aucun formulaire</h3><p>Aucun formulaire HelloAsso trouvé pour cette organisation.</p></section>`;
            ajouterJournal("HelloAsso formulaires chargés", "0 formulaire trouvé.");
            return;
        }

        zone.innerHTML = formulaires.map(formulaire => `
            <section class="card">
                <h3>${formulaire.title || formulaire.privateTitle || "Formulaire sans titre"}</h3>
                <p><strong>Type :</strong> ${formulaire.formType || "-"}</p>
                <p><strong>Slug :</strong> ${formulaire.formSlug || "-"}</p>
                <p><strong>État :</strong> ${formulaire.state || "-"}</p>
                ${formulaire.url ? `<p><a href="${formulaire.url}" target="_blank" rel="noopener noreferrer">Ouvrir sur HelloAsso</a></p>` : ""}
            </section>
        `).join("");

        ajouterJournal("HelloAsso formulaires chargés", `${formulaires.length} formulaire(s).`);
        if (typeof remplirSelectFormulairesHelloAsso === "function") remplirSelectFormulairesHelloAsso();
    } catch (error) {
        console.error(error);
        zone.innerHTML = `<section class="card"><h3>Erreur</h3><p>${error.message || "Chargement impossible."}</p></section>`;
        alert("Impossible de charger les formulaires HelloAsso.");
    }
}

const boutonChargerFormulairesHelloAsso = document.getElementById("charger-formulaires-helloasso");

if (boutonChargerFormulairesHelloAsso) {
    boutonChargerFormulairesHelloAsso.addEventListener("click", chargerFormulairesHelloAsso);
}



function remplirSelectFormulairesHelloAsso() {
    const select = document.getElementById("helloasso-formulaire-select");
    if (!select) return;

    const cache = lireJSON("helloAssoFormulairesTestJDM", null);
    const formulaires = cache && Array.isArray(cache.formulaires) ? cache.formulaires : [];

    select.innerHTML = `<option value="">Choisir un formulaire chargé</option>`;

    formulaires.forEach((formulaire, index) => {
        const type = formulaire.formType || "";
        const slug = formulaire.formSlug || "";
        const titre = formulaire.title || formulaire.privateTitle || `Formulaire ${index + 1}`;

        if (!type || !slug) return;

        select.innerHTML += `
            <option value="${index}">
                ${titre} · ${type} · ${slug}
            </option>
        `;
    });
}

async function chargerCommandesHelloAsso() {
    const zone = document.getElementById("liste-commandes-helloasso");
    const select = document.getElementById("helloasso-formulaire-select");
    const organizationSlug = document.getElementById("helloasso-organization-slug");

    if (!zone || !select || !organizationSlug) return;

    const cache = lireJSON("helloAssoFormulairesTestJDM", null);
    const formulaires = cache && Array.isArray(cache.formulaires) ? cache.formulaires : [];
    const formulaire = formulaires[Number(select.value)];

    if (!formulaire) {
        alert("Charge d'abord les formulaires puis sélectionne celui à lire.");
        return;
    }

    const slugOrganisation = organizationSlug.value.trim();
    const formType = formulaire.formType;
    const formSlug = formulaire.formSlug;

    if (!slugOrganisation || !formType || !formSlug) {
        alert("Formulaire HelloAsso incomplet.");
        return;
    }

    zone.innerHTML = `<section class="card"><p>Chargement des commandes HelloAsso...</p></section>`;

    try {
        const token = await obtenirTokenHelloAssoDev();

        const url = `https://api.helloasso.com/v5/organizations/${encodeURIComponent(slugOrganisation)}/forms/${encodeURIComponent(formType)}/${encodeURIComponent(formSlug)}/orders?pageIndex=1&pageSize=20`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error("HelloAsso orders error", data);
            zone.innerHTML = `<section class="card"><h3>Erreur</h3><p>Impossible de charger les commandes du formulaire.</p></section>`;
            return;
        }

        const commandes = data.data || [];

        ecrireJSON("helloAssoCommandesTestJDM", {
            organizationSlug: slugOrganisation,
            formType,
            formSlug,
            loadedAt: new Date().toISOString(),
            total: commandes.length,
            commandes
        });

        if (commandes.length === 0) {
            zone.innerHTML = `<section class="card"><h3>Aucune commande</h3><p>Aucune commande trouvée pour ce formulaire.</p></section>`;
            ajouterJournal("HelloAsso commandes chargées", "0 commande trouvée.");
            return;
        }

        zone.innerHTML = commandes.map(commande => {
            const payer = commande.payer || {};
            const items = commande.items || [];
            const montant = commande.amount ? (commande.amount.total / 100).toFixed(2) + " €" : "-";

            return `
                <section class="card">
                    <h3>Commande ${commande.id || commande.orderId || "-"}</h3>
                    <p><strong>Payeur :</strong> ${payer.firstName || ""} ${payer.lastName || ""}</p>
                    <p><strong>Email :</strong> ${payer.email || "-"}</p>
                    <p><strong>Montant :</strong> ${montant}</p>
                    <p><strong>Date :</strong> ${commande.date ? new Date(commande.date).toLocaleString("fr-FR") : "-"}</p>
                    <p><strong>Articles / inscriptions :</strong> ${items.length}</p>
                </section>
            `;
        }).join("");

        ajouterJournal("HelloAsso commandes chargées", `${commandes.length} commande(s) lue(s).`);
    } catch (error) {
        console.error(error);
        zone.innerHTML = `<section class="card"><h3>Erreur</h3><p>${error.message || "Chargement impossible."}</p></section>`;
        alert("Impossible de charger les commandes HelloAsso.");
    }
}

const boutonChargerCommandesHelloAsso = document.getElementById("charger-commandes-helloasso");

if (boutonChargerCommandesHelloAsso) {
    boutonChargerCommandesHelloAsso.addEventListener("click", chargerCommandesHelloAsso);
}

remplirSelectFormulairesHelloAsso();

function extraireAdherentsHelloAssoLocal() {
    const cache = lireJSON("helloAssoCommandesTestJDM", null);
    const commandes = cache && Array.isArray(cache.commandes) ? cache.commandes : [];
    const adherents = [];
    const inscriptions = [];

    commandes.forEach((commande, commandeIndex) => {
        const payer = commande.payer || {};
        const items = Array.isArray(commande.items) ? commande.items : [];
        if (items.length === 0) {
            const numero = `HA-${commande.id || commandeIndex + 1}`;
            adherents.push({ numeroAdherent: numero, nom: payer.lastName || "", prenom: payer.firstName || "", email: payer.email || "", emailParent1: payer.email || "", telephone: payer.phone || "", source: "helloasso", helloAssoOrderId: commande.id || "", dateImport: new Date().toISOString() });
            inscriptions.push({ id: `${numero}-inscription`, numeroAdherent: numero, source: "helloasso", helloAssoOrderId: commande.id || "", statutPaiement: "payé", montant: commande.amount && commande.amount.total ? commande.amount.total / 100 : 0, dateInscription: commande.date || new Date().toISOString() });
            return;
        }
        items.forEach((item, itemIndex) => {
            const numero = `HA-${commande.id || commandeIndex + 1}-${itemIndex + 1}`;
            const customFields = item.customFields || item.fields || item.answers || [];
            const findField = (mot) => {
                const champ = Array.isArray(customFields) ? customFields.find(c => String(c.name || c.label || c.fieldName || "").toLowerCase().includes(mot)) : null;
                return champ ? (champ.answer || champ.value || champ.displayValue || "") : "";
            };
            const nom = item.lastName || item.lastname || findField("nom") || payer.lastName || "";
            const prenom = item.firstName || item.firstname || findField("prenom") || findField("prénom") || payer.firstName || "";
            const email = item.email || findField("email") || payer.email || "";
            const groupe = item.name || item.title || item.tierName || item.priceCategory || "";
            adherents.push({ numeroAdherent: numero, nom, prenom, email, emailParent1: payer.email || email, telephone: payer.phone || "", dateNaissance: item.birthDate || findField("naissance") || "", groupe, source: "helloasso", helloAssoOrderId: commande.id || "", helloAssoItemId: item.id || "", dateImport: new Date().toISOString() });
            inscriptions.push({ id: `${numero}-inscription`, numeroAdherent: numero, source: "helloasso", helloAssoOrderId: commande.id || "", helloAssoItemId: item.id || "", groupe, tarif: groupe, statutPaiement: "payé", montant: item.amount ? item.amount / 100 : (commande.amount && commande.amount.total ? commande.amount.total / 100 : 0), dateInscription: commande.date || new Date().toISOString(), donneesHelloAsso: item });
        });
    });
    return { commandes, adherents, inscriptions };
}
function cleImportHelloAsso(adherent) {
    return [String(adherent.nom || "").toLowerCase().trim(), String(adherent.prenom || "").toLowerCase().trim(), String(adherent.dateNaissance || "").toLowerCase().trim(), String(adherent.email || adherent.emailParent1 || "").toLowerCase().trim()].join("|");
}
function previsualiserImportHelloAsso() {
    const zone = document.getElementById("preview-import-helloasso");
    if (!zone) return;
    const data = extraireAdherentsHelloAssoLocal();
    if (data.commandes.length === 0) { zone.innerHTML = `<section class="card"><h3>Aucune donnée</h3><p>Charge d'abord les commandes HelloAsso.</p></section>`; return; }
    const existants = lireJSON(clesLocales.adherents, []);
    const clesExistantes = new Set(existants.map(cleImportHelloAsso));
    const nouveaux = data.adherents.filter(a => !clesExistantes.has(cleImportHelloAsso(a)));
    zone.innerHTML = `<section class="card"><h3>Prévisualisation</h3><p><strong>Commandes lues :</strong> ${data.commandes.length}</p><p><strong>Adhérents détectés :</strong> ${data.adherents.length}</p><p><strong>Nouveaux probables :</strong> ${nouveaux.length}</p><p><strong>Doublons probables :</strong> ${data.adherents.length - nouveaux.length}</p></section>${data.adherents.slice(0, 20).map(a => `<section class="card"><h3>${a.prenom || ""} ${a.nom || ""}</h3><p><strong>Email :</strong> ${a.email || a.emailParent1 || "-"}</p><p><strong>Groupe / tarif :</strong> ${a.groupe || "-"}</p></section>`).join("")}`;
    ecrireJSON("helloAssoPreviewImportJDM", { generatedAt: new Date().toISOString(), adherents: data.adherents, inscriptions: data.inscriptions });
}
function importerHelloAssoLocal() {
    if (!demanderCodeSecurite()) return;
    const data = extraireAdherentsHelloAssoLocal();
    if (data.adherents.length === 0) { alert("Aucun adhérent HelloAsso à importer."); return; }
    if (!confirm("Importer les adhérents HelloAsso dans JDM local ?")) return;
    const existants = lireJSON(clesLocales.adherents, []);
    const inscriptionsExistantes = lireJSON(clesLocales.inscriptions, []);
    const cles = new Set(existants.map(cleImportHelloAsso));
    const nouveaux = data.adherents.filter(a => { const cle = cleImportHelloAsso(a); if (cles.has(cle)) return false; cles.add(cle); return true; });
    const numerosNouveaux = new Set(nouveaux.map(a => a.numeroAdherent));
    const inscriptions = data.inscriptions.filter(i => numerosNouveaux.has(i.numeroAdherent));
    ecrireJSON(clesLocales.adherents, [...existants, ...nouveaux]);
    ecrireJSON(clesLocales.inscriptions, [...inscriptionsExistantes, ...inscriptions]);
    ajouterJournal("Import HelloAsso local", `${nouveaux.length} adhérent(s), ${inscriptions.length} inscription(s).`);
    afficherStats();
    previsualiserImportHelloAsso();
    alert(`Import terminé ✅\n${nouveaux.length} adhérent(s) ajouté(s).`);
}
const boutonPrevisualiserImportHelloAsso = document.getElementById("previsualiser-import-helloasso");
const boutonImporterHelloAssoLocal = document.getElementById("importer-helloasso-local");
if (boutonPrevisualiserImportHelloAsso) boutonPrevisualiserImportHelloAsso.addEventListener("click", previsualiserImportHelloAsso);
if (boutonImporterHelloAssoLocal) boutonImporterHelloAssoLocal.addEventListener("click", importerHelloAssoLocal);



function emailAdherentImport(adherent) {
    return String(
        adherent.emailParent1 ||
        adherent.email ||
        adherent.emailPayeur ||
        ""
    ).trim().toLowerCase();
}

async function preparerComptesHelloAssoFirebase() {
    if (!demanderCodeSecurite()) return;

    const zone = document.getElementById("rapport-comptes-helloasso");
    const adherents = lireJSON(clesLocales.adherents, [])
        .filter(adherent => adherent.source === "helloasso");

    if (!zone) return;

    if (adherents.length === 0) {
        zone.innerHTML = `<section class="card"><h3>Aucun adhérent HelloAsso</h3><p>Importe d'abord les données HelloAsso localement.</p></section>`;
        return;
    }

    const emails = {};

    adherents.forEach(adherent => {
        const email = emailAdherentImport(adherent);
        if (!email) return;

        if (!emails[email]) {
            emails[email] = {
                email,
                nom: adherent.nom || "",
                prenom: adherent.prenom || "",
                role: "membre",
                actif: true,
                numeroAdherent: adherent.numeroAdherent || "",
                enfants: []
            };
        }

        if (adherent.numeroAdherent && !emails[email].enfants.includes(adherent.numeroAdherent)) {
            emails[email].enfants.push(adherent.numeroAdherent);
        }
    });

    const comptes = Object.values(emails);

    if (comptes.length === 0) {
        zone.innerHTML = `<section class="card"><h3>Aucun email</h3><p>Aucun email exploitable trouvé dans les adhérents HelloAsso.</p></section>`;
        return;
    }

    if (!confirm(`Préparer ${comptes.length} accès membre dans Firebase pendingUsers ?`)) {
        return;
    }

    zone.innerHTML = `<section class="card"><p>Création des accès préparés...</p></section>`;

    let crees = 0;
    let erreurs = 0;

    for (const compte of comptes) {
        try {
            await setDoc(doc(db, "pendingUsers", compte.email), {
                email: compte.email,
                nom: compte.nom,
                prenom: compte.prenom,
                role: "membre",
                actif: true,
                numeroAdherent: compte.numeroAdherent || "",
                enfants: compte.enfants,
                source: "helloasso",
                accesPages: {
                    "accueil": { lecture: true, ecriture: false },
                    "espace-membre": { lecture: true, ecriture: false },
                    "planning-membre": { lecture: true, ecriture: false },
                    "notifications": { lecture: true, ecriture: false },
                    "absence": { lecture: true, ecriture: true },
                    "boutique": { lecture: true, ecriture: false },
                    "boutique-accessoires": { lecture: true, ecriture: false },
                    "panier": { lecture: true, ecriture: true },
                    "commande": { lecture: true, ecriture: true },
                    "fiche-adherent-complete": { lecture: true, ecriture: false },
                    "carte-adherent": { lecture: true, ecriture: false }
                },
                clubId: JDM_CONFIG.clubId,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
            }, { merge: true });

            crees++;
        } catch (error) {
            console.error("Erreur compte HelloAsso", compte.email, error);
            erreurs++;
        }
    }

    zone.innerHTML = `
        <section class="card">
            <h3>Comptes préparés</h3>
            <p><strong>${crees}</strong> accès membre créé(s) / mis à jour.</p>
            <p><strong>${erreurs}</strong> erreur(s).</p>
        </section>

        ${comptes.slice(0, 30).map(compte => `
            <section class="card">
                <h3>${compte.prenom || ""} ${compte.nom || ""}</h3>
                <p><strong>Email :</strong> ${compte.email}</p>
                <p><strong>Enfants / adhérents :</strong> ${compte.enfants.length}</p>
            </section>
        `).join("")}
    `;

    ajouterJournal("Comptes HelloAsso préparés", `${crees} compte(s), ${erreurs} erreur(s).`);
    alert(`Préparation terminée ✅\n${crees} compte(s) préparé(s).`);
}

const boutonPreparerComptesHelloAsso = document.getElementById("preparer-comptes-helloasso");

if (boutonPreparerComptesHelloAsso) {
    boutonPreparerComptesHelloAsso.addEventListener("click", preparerComptesHelloAssoFirebase);
}



function idFirebaseDepuisTexte(texte) {
    return String(texte || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

async function synchroniserHelloAssoVersFirebase() {
    if (!demanderCodeSecurite()) return;

    const zone = document.getElementById("rapport-sync-helloasso-firebase");
    if (!zone) return;

    const adherents = lireJSON(clesLocales.adherents, [])
        .filter(adherent => adherent.source === "helloasso");

    const inscriptions = lireJSON(clesLocales.inscriptions, [])
        .filter(inscription => inscription.source === "helloasso");

    if (adherents.length === 0 && inscriptions.length === 0) {
        zone.innerHTML = `<section class="card"><h3>Aucune donnée</h3><p>Aucune donnée HelloAsso locale à synchroniser.</p></section>`;
        return;
    }

    if (!confirm(`Synchroniser ${adherents.length} adhérent(s) et ${inscriptions.length} inscription(s) vers Firebase ?`)) {
        return;
    }

    zone.innerHTML = `<section class="card"><p>Synchronisation Firebase en cours...</p></section>`;

    let adherentsOK = 0;
    let inscriptionsOK = 0;
    let erreurs = 0;

    for (const adherent of adherents) {
        try {
            const id = idFirebaseDepuisTexte(adherent.numeroAdherent || `${adherent.nom}-${adherent.prenom}-${adherent.email}`);
            if (!id) continue;

            await setDoc(doc(db, "adherents", id), {
                ...adherent,
                firebaseId: id,
                source: "helloasso",
                clubId: JDM_CONFIG.clubId,
                updatedAt: serverTimestamp()
            }, { merge: true });

            adherentsOK++;
        } catch (error) {
            console.error("Erreur synchro adhérent", adherent, error);
            erreurs++;
        }
    }

    for (const inscription of inscriptions) {
        try {
            const id = idFirebaseDepuisTexte(inscription.id || `${inscription.numeroAdherent}-${inscription.helloAssoOrderId}`);
            if (!id) continue;

            await setDoc(doc(db, "inscriptions", id), {
                ...inscription,
                firebaseId: id,
                source: "helloasso",
                clubId: JDM_CONFIG.clubId,
                updatedAt: serverTimestamp()
            }, { merge: true });

            inscriptionsOK++;
        } catch (error) {
            console.error("Erreur synchro inscription", inscription, error);
            erreurs++;
        }
    }

    zone.innerHTML = `
        <section class="card">
            <h3>Synchronisation terminée</h3>
            <p><strong>Adhérents synchronisés :</strong> ${adherentsOK}</p>
            <p><strong>Inscriptions synchronisées :</strong> ${inscriptionsOK}</p>
            <p><strong>Erreurs :</strong> ${erreurs}</p>
        </section>
    `;

    ajouterJournal(
        "Synchronisation HelloAsso Firebase",
        `${adherentsOK} adhérent(s), ${inscriptionsOK} inscription(s), ${erreurs} erreur(s).`
    );

    alert(`Synchronisation terminée ✅\n${adherentsOK} adhérent(s)\n${inscriptionsOK} inscription(s)`);
}

const boutonSynchroniserHelloAssoFirebase = document.getElementById("synchroniser-helloasso-firebase");

if (boutonSynchroniserHelloAssoFirebase) {
    boutonSynchroniserHelloAssoFirebase.addEventListener("click", synchroniserHelloAssoVersFirebase);
}



async function verifierSynchronisationHelloAssoFirebase() {
    const zone = document.getElementById("rapport-verif-helloasso-firebase");
    if (!zone) return;

    zone.innerHTML = `<section class="card"><p>Vérification Firebase en cours...</p></section>`;

    try {
        const adherentsLocaux = lireJSON(clesLocales.adherents, [])
            .filter(adherent => adherent.source === "helloasso");

        const inscriptionsLocales = lireJSON(clesLocales.inscriptions, [])
            .filter(inscription => inscription.source === "helloasso");

        const adherentsSnap = await getDocs(collection(db, "adherents"));
        const inscriptionsSnap = await getDocs(collection(db, "inscriptions"));

        const adherentsFirebase = adherentsSnap.docs
            .map(document => ({ id: document.id, ...document.data() }))
            .filter(adherent => adherent.source === "helloasso");

        const inscriptionsFirebase = inscriptionsSnap.docs
            .map(document => ({ id: document.id, ...document.data() }))
            .filter(inscription => inscription.source === "helloasso");

        const okAdherents = adherentsFirebase.length >= adherentsLocaux.length;
        const okInscriptions = inscriptionsFirebase.length >= inscriptionsLocales.length;

        zone.innerHTML = `
            <section class="card">
                <h3>${okAdherents && okInscriptions ? "✅" : "⚠️"} Résultat</h3>
                <p><strong>Adhérents HelloAsso locaux :</strong> ${adherentsLocaux.length}</p>
                <p><strong>Adhérents HelloAsso Firebase :</strong> ${adherentsFirebase.length}</p>
                <p><strong>Inscriptions HelloAsso locales :</strong> ${inscriptionsLocales.length}</p>
                <p><strong>Inscriptions HelloAsso Firebase :</strong> ${inscriptionsFirebase.length}</p>
            </section>

            <section class="card">
                <h3>Lecture Firebase</h3>
                <p>${okAdherents && okInscriptions ? "Synchronisation cohérente ✅" : "Synchronisation incomplète ou règles Firestore à vérifier ⚠️"}</p>
            </section>
        `;

        ajouterJournal(
            "Vérification Firebase HelloAsso",
            `${adherentsFirebase.length} adhérent(s), ${inscriptionsFirebase.length} inscription(s) Firebase.`
        );
    } catch (error) {
        console.error(error);

        zone.innerHTML = `
            <section class="card">
                <h3>❌ Erreur Firebase</h3>
                <p>${error.message || "Lecture impossible."}</p>
                <p>Vérifie les règles Firestore du Patch 23.</p>
            </section>
        `;
    }
}

const boutonVerifierHelloAssoFirebase = document.getElementById("verifier-helloasso-firebase");

if (boutonVerifierHelloAssoFirebase) {
    boutonVerifierHelloAssoFirebase.addEventListener("click", verifierSynchronisationHelloAssoFirebase);
}



async function lancerSynchronisationCompleteHelloAsso() {
    if (!demanderCodeSecurite()) return;

    const zone = document.getElementById("rapport-sync-complete-helloasso");
    if (!zone) return;

    if (!confirm("Lancer la synchronisation complète HelloAsso ?\n\nCette action va lire HelloAsso, importer localement, préparer les comptes et synchroniser Firebase.")) {
        return;
    }

    const etapes = [];

    function afficherEtapes() {
        zone.innerHTML = `
            ${etapes.map(etape => `
                <section class="card">
                    <h3>${etape.ok ? "✅" : etape.error ? "❌" : "⏳"} ${etape.titre}</h3>
                    <p>${etape.detail || ""}</p>
                </section>
            `).join("")}
        `;
    }

    async function etape(titre, action) {
        const ligne = { titre, detail: "En cours..." };
        etapes.push(ligne);
        afficherEtapes();

        try {
            const detail = await action();
            ligne.ok = true;
            ligne.detail = detail || "Terminé.";
        } catch (error) {
            console.error(titre, error);
            ligne.error = true;
            ligne.detail = error.message || "Erreur.";
            afficherEtapes();
            throw error;
        }

        afficherEtapes();
    }

    try {
        await etape("Charger les formulaires HelloAsso", async () => {
            if (typeof chargerFormulairesHelloAsso !== "function") {
                throw new Error("Fonction formulaires indisponible.");
            }

            await chargerFormulairesHelloAsso();

            const cache = lireJSON("helloAssoFormulairesTestJDM", null);
            const total = cache && cache.total ? cache.total : 0;

            if (typeof remplirSelectFormulairesHelloAsso === "function") {
                remplirSelectFormulairesHelloAsso();
            }

            return `${total} formulaire(s) chargé(s).`;
        });

        await etape("Sélection formulaire", async () => {
            const select = document.getElementById("helloasso-formulaire-select");

            if (!select) {
                throw new Error("Sélecteur formulaire indisponible.");
            }

            if (!select.value && select.options.length > 1) {
                select.selectedIndex = 1;
            }

            if (!select.value) {
                throw new Error("Aucun formulaire disponible.");
            }

            return `Formulaire sélectionné : ${select.options[select.selectedIndex].textContent}`;
        });

        await etape("Charger les commandes HelloAsso", async () => {
            if (typeof chargerCommandesHelloAsso !== "function") {
                throw new Error("Fonction commandes indisponible.");
            }

            await chargerCommandesHelloAsso();

            const cache = lireJSON("helloAssoCommandesTestJDM", null);
            const total = cache && cache.total ? cache.total : 0;

            return `${total} commande(s) chargée(s).`;
        });

        await etape("Prévisualiser l'import", async () => {
            if (typeof previsualiserImportHelloAsso !== "function") {
                throw new Error("Fonction prévisualisation indisponible.");
            }

            previsualiserImportHelloAsso();

            const preview = lireJSON("helloAssoPreviewImportJDM", null);
            const total = preview && preview.adherents ? preview.adherents.length : 0;

            return `${total} adhérent(s) détecté(s).`;
        });

        await etape("Importer localement", async () => {
            if (typeof importerHelloAssoLocal !== "function") {
                throw new Error("Fonction import local indisponible.");
            }

            importerHelloAssoLocal();

            return "Import local exécuté.";
        });

        await etape("Préparer les comptes membres", async () => {
            if (typeof preparerComptesHelloAssoFirebase !== "function") {
                throw new Error("Fonction comptes membres indisponible.");
            }

            await preparerComptesHelloAssoFirebase();

            return "Comptes membres préparés.";
        });

        await etape("Synchroniser vers Firebase", async () => {
            if (typeof synchroniserHelloAssoVersFirebase !== "function") {
                throw new Error("Fonction synchronisation Firebase indisponible.");
            }

            await synchroniserHelloAssoVersFirebase();

            return "Synchronisation Firebase exécutée.";
        });

        await etape("Vérifier Firebase", async () => {
            if (typeof verifierSynchronisationHelloAssoFirebase !== "function") {
                throw new Error("Fonction vérification Firebase indisponible.");
            }

            await verifierSynchronisationHelloAssoFirebase();

            return "Vérification terminée.";
        });

        ajouterJournal("Synchronisation complète HelloAsso", "Processus terminé.");
        alert("Synchronisation complète HelloAsso terminée ✅");
    } catch (error) {
        ajouterJournal("Synchronisation complète HelloAsso interrompue", error.message || "Erreur.");
        alert("Synchronisation interrompue. Consulte le rapport affiché.");
    }
}

const boutonSyncCompleteHelloAsso = document.getElementById("sync-complete-helloasso");

if (boutonSyncCompleteHelloAsso) {
    boutonSyncCompleteHelloAsso.addEventListener("click", lancerSynchronisationCompleteHelloAsso);
}



function actualiserEtatHelloAssoDetaille() {
    const zone = document.getElementById("etat-detaille-helloasso");
    if (!zone) return;

    const config = lireJSON("helloAssoSecretLocalJDM", null);
    const formulaires = lireJSON("helloAssoFormulairesTestJDM", null);
    const commandes = lireJSON("helloAssoCommandesTestJDM", null);
    const preview = lireJSON("helloAssoPreviewImportJDM", null);
    const token = lireJSON("helloAssoTokenTestJDM", null);

    const totalFormulaires = formulaires && formulaires.total ? formulaires.total : 0;
    const totalCommandes = commandes && commandes.total ? commandes.total : 0;
    const totalAdherents = preview && Array.isArray(preview.adherents) ? preview.adherents.length : 0;
    const totalInscriptions = preview && Array.isArray(preview.inscriptions) ? preview.inscriptions.length : 0;

    zone.innerHTML = `
        <section class="card">
            <h3>Résumé</h3>
            <p><strong>Configuration locale :</strong> ${config ? "✅ Présente" : "❌ Absente"}</p>
            <p><strong>Dernier test token :</strong> ${token && token.testedAt ? new Date(token.testedAt).toLocaleString("fr-FR") : "Jamais"}</p>
            <p><strong>Formulaires chargés :</strong> ${totalFormulaires}</p>
            <p><strong>Commandes chargées :</strong> ${totalCommandes}</p>
            <p><strong>Adhérents détectés :</strong> ${totalAdherents}</p>
            <p><strong>Inscriptions détectées :</strong> ${totalInscriptions}</p>
        </section>

        <section class="card">
            <h3>Derniers chargements</h3>
            <p><strong>Formulaires :</strong> ${formulaires && formulaires.loadedAt ? new Date(formulaires.loadedAt).toLocaleString("fr-FR") : "Jamais"}</p>
            <p><strong>Commandes :</strong> ${commandes && commandes.loadedAt ? new Date(commandes.loadedAt).toLocaleString("fr-FR") : "Jamais"}</p>
            <p><strong>Prévisualisation :</strong> ${preview && preview.generatedAt ? new Date(preview.generatedAt).toLocaleString("fr-FR") : "Jamais"}</p>
        </section>
    `;
}

function exporterDonneesHelloAssoBrutes() {
    const exportData = {
        exportedAt: new Date().toISOString(),
        tokenTest: lireJSON("helloAssoTokenTestJDM", null),
        formulaires: lireJSON("helloAssoFormulairesTestJDM", null),
        commandes: lireJSON("helloAssoCommandesTestJDM", null),
        previewImport: lireJSON("helloAssoPreviewImportJDM", null)
    };

    const blob = new Blob(
        [JSON.stringify(exportData, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");

    lien.href = url;
    lien.download = `donnees-helloasso-jdm-${new Date().toISOString().slice(0, 10)}.json`;
    lien.click();

    URL.revokeObjectURL(url);

    ajouterJournal("Données HelloAsso exportées", "Export JSON brut généré.");
}

const boutonActualiserEtatHelloAsso = document.getElementById("actualiser-etat-helloasso");
const boutonExporterDonneesHelloAsso = document.getElementById("exporter-donnees-helloasso");

if (boutonActualiserEtatHelloAsso) {
    boutonActualiserEtatHelloAsso.addEventListener("click", actualiserEtatHelloAssoDetaille);
}

if (boutonExporterDonneesHelloAsso) {
    boutonExporterDonneesHelloAsso.addEventListener("click", exporterDonneesHelloAssoBrutes);
}

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

function nettoyerInscriptionsHelloAssoLocales() {
    const inscriptions = lireJSON(clesLocales.inscriptions, []);
    const conservees = inscriptions.filter(item => !estDonneeHelloAsso(item));
    ecrireJSON(clesLocales.inscriptions, conservees);
    return inscriptions.length - conservees.length;
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

    const [inscriptions, tresorerie, dons] = await Promise.all([
        compterDocuments("inscriptions", data => estDonneeHelloAsso(data)),
        compterDocuments(
            "tresorerieCotisations",
            data => estDonneeHelloAsso(data) &&
                data.licenceValidee !== true &&
                data.cotisationRegularisee !== true
        ),
        compterDocuments("helloassoDonations")
    ]);

    const inscriptionsLocales = lireJSON(clesLocales.inscriptions, [])
        .filter(item => estDonneeHelloAsso(item)).length;
    const cachesLocaux = CLES_CACHE_HELLOASSO
        .filter(cle => localStorage.getItem(cle) !== null).length;

    zone.innerHTML = `
        <section class="card">
            <h3>🔍 Simulation terminée — aucune donnée modifiée</h3>
            ${ligneSimulation("Inscriptions HelloAsso Firestore qui seraient supprimées", inscriptions)}
            ${ligneSimulation("Dossiers trésorerie HelloAsso non validés qui seraient supprimés", tresorerie)}
            ${ligneSimulation("Dons HelloAsso qui seraient supprimés puis réimportés", dons)}
            <p><strong>Inscriptions HelloAsso locales qui seraient supprimées :</strong> ${inscriptionsLocales}</p>
            <p><strong>Caches techniques HelloAsso qui seraient vidés :</strong> ${cachesLocaux}</p>
            <hr>
            <p><strong>Conservés :</strong> adhérents, numéros d'adhérent, licences, profils Firestore, comptes membres et réglages des familles.</p>
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
        "Les adhérents, numéros, licences, comptes membres et profils familles seront conservés."
    )) return;

    const texte = prompt("Tape exactement RAFRAICHIR pour confirmer :");
    if (texte !== "RAFRAICHIR") {
        alert("Confirmation incorrecte. Aucune donnée modifiée.");
        return;
    }

    if (!demanderCodeSecurite()) return;

    const etapes = [
        { id: "sauvegarde", label: "Sauvegarde JSON avant nettoyage" },
        { id: "inscriptions", label: "Inscriptions HelloAsso Firestore" },
        { id: "tresorerie", label: "Dossiers trésorerie HelloAsso non validés" },
        { id: "dons", label: "Dons HelloAsso" },
        { id: "local", label: "Inscriptions HelloAsso locales" },
        { id: "caches", label: "Caches techniques HelloAsso" }
    ];
    const suivi = creerSuiviOperation(zone, "🔄 Rafraîchissement sécurisé HelloAsso", etapes);
    const rapport = {};

    const sauvegarde = await executerEtapeSuivie(suivi, "sauvegarde", async () => {
        const donnees = {
            type: "rafraichissement-imports-helloasso",
            date: new Date().toISOString(),
            inscriptions: await lireCollectionPourSauvegarde("inscriptions"),
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

    rapport.inscriptions = await executerEtapeSuivie(
        suivi,
        "inscriptions",
        () => supprimerDocuments("inscriptions", data => estDonneeHelloAsso(data)),
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
        async () => nettoyerInscriptionsHelloAssoLocales(),
        { formaterSucces: total => `${total} inscription(s) locale(s) supprimée(s)` }
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
