import {
    listUsers,
    listPendingUsers,
    createPendingUser,
    updatePendingUser,
    updateUserRole,
    updateUserActif,
    updateUserAccesPages
} from "../firebase/firebase-db.js";

const zone = document.getElementById("liste-utilisateurs");
const boutonRecharger = document.getElementById("recharger-utilisateurs");
const champRecherche = document.getElementById("recherche-utilisateur");
const champNouveauPrenom = document.getElementById("nouveau-prenom");
const champNouveauNom = document.getElementById("nouveau-nom");
const champNouveauEmail = document.getElementById("nouveau-email");
const champNouveauRole = document.getElementById("nouveau-role");
const boutonCreerAcces = document.getElementById("creer-acces-manuel");

const roles = ["membre", "coach", "admin", "super_admin"];

const pagesAcces = [
    { categorie: "Espace membre", pages: [
        { key: "accueil", titre: "Accueil", url: "accueil.html", defautLecture: true },
        { key: "espace-membre", titre: "Espace membre", url: "espace-membre.html", defautLecture: true },
        { key: "planning-membre", titre: "Planning membre", url: "planning-membre.html", defautLecture: true },
        { key: "mon-club", titre: "Mon club", url: "mon-club.html", defautLecture: true },
        { key: "actualites", titre: "Actualités", url: "actualites.html", defautLecture: true },
        { key: "contact", titre: "Contact", url: "contact.html", defautLecture: true },
        { key: "notifications", titre: "Notifications membre", url: "notifications.html", defautLecture: true },
        { key: "absence", titre: "Signaler une absence", url: "absence.html", defautLecture: true, defautEcriture: true },
        { key: "boutique", titre: "Boutique portail", url: "boutique.html", defautLecture: true },
        { key: "boutique-accessoires", titre: "Boutique accessoires", url: "boutique-accessoires.html", defautLecture: true },
        { key: "boutique-ephemere", titre: "Boutique éphémère", url: "boutique-ephemere.html", defautLecture: true },
        { key: "panier", titre: "Panier", url: "panier.html", defautLecture: true, defautEcriture: true },
        { key: "commande", titre: "Commande", url: "commande.html", defautLecture: true, defautEcriture: true },
        { key: "paiement", titre: "Paiement", url: "paiement.html", defautLecture: true, defautEcriture: true },
        { key: "confirmation-commande", titre: "Confirmation commande", url: "confirmation-commande.html", defautLecture: true },
        { key: "fiche-adherent-complete", titre: "Fiche adhérent PDF", url: "fiche-adherent-complete.html", defautLecture: true },
        { key: "carte-adherent", titre: "Carte adhérent", url: "carte-adherent.html", defautLecture: true }
    ]},
    { categorie: "Espace coach", pages: [
        { key: "admin-appel", titre: "Appel", url: "admin-appel.html" },
        { key: "admin-absences", titre: "Absences", url: "admin-absences.html" },
        { key: "admin-planning", titre: "Planning admin", url: "admin-planning.html" },
        { key: "admin-groupes", titre: "Groupes", url: "admin-groupes.html" },
        { key: "admin-adherents", titre: "Adhérents", url: "admin-adherents.html" },
        { key: "admin-competitions", titre: "Compétitions", url: "admin-competitions.html" },
        { key: "competition-convocation", titre: "Convocation compétition", url: "competition-convocation.html" }
    ]},
    { categorie: "Gestion club", pages: [
        { key: "admin-import-helloasso", titre: "Import HelloAsso", url: "admin-import-helloasso.html" },
        { key: "admin-aide-licence", titre: "Cotisations & aides", url: "admin-aide-licence.html" },
        { key: "admin-organisation", titre: "Organisation", url: "admin-organisation.html" },
        { key: "admin-notifications-tresorier", titre: "Notifications", url: "admin-notifications-tresorier.html" },
        { key: "admin-tableau-bord", titre: "Tableau de bord du club", url: "admin-tableau-bord.html" }
    ]},
    { categorie: "Communication & site", pages: [
        { key: "admin-contenu-site", titre: "Contenu du site", url: "admin-contenu-site.html" },
        { key: "admin-actualites", titre: "Actualités admin", url: "admin-actualites.html" },
        { key: "admin-boutique", titre: "Boutique admin", url: "admin-boutique.html" },
        { key: "admin-commandes", titre: "Commandes", url: "admin-commandes.html" },
        { key: "admin-notifications-boutique", titre: "Notifications boutique", url: "admin-notifications-boutique.html" },
        { key: "admin-notifications-absence", titre: "Notifications absence", url: "admin-notifications-absence.html" },
        { key: "admin-notifications-coach", titre: "Notifications coach", url: "admin-notifications-coach.html" },
        { key: "admin-notifications-bureau", titre: "Notifications bureau", url: "admin-notifications-bureau.html" },
        { key: "admin-notifications-categorie", titre: "Notifications catégorie", url: "admin-notifications-categorie.html" },
        { key: "admin-notifications-groupe-parent", titre: "Notification groupe parent", url: "admin-notifications-groupe-parent.html" },
        { key: "admin-notifications-groupes-parents", titre: "Notifications groupes parents", url: "admin-notifications-groupes-parents.html" },
        { key: "admin-notifications-tresorier-detail", titre: "Notification trésorier détail", url: "admin-notifications-tresorier-detail.html" }
    ]},
    { categorie: "Sécurité & technique", pages: [
        { key: "admin-utilisateurs", titre: "Gestion des utilisateurs", url: "admin-utilisateurs.html", sensible: true },
        { key: "dev", titre: "Développement", url: "dev.html", sensible: true },
        { key: "admin-assistant-rentree", titre: "Assistant rentrée", url: "admin-assistant-rentree.html" },
        { key: "documents", titre: "Documents", url: "documents.html" },
        { key: "reseaux", titre: "Réseaux", url: "reseaux.html" },
        { key: "resultats", titre: "Résultats", url: "resultats.html" }
    ]}
];

let utilisateursCache = [];

function formatDateFirebase(valeur) {
    if (!valeur) return "Jamais";

    let date = null;

    if (valeur.toDate) {
        date = valeur.toDate();
    } else if (typeof valeur === "string") {
        date = new Date(valeur);
    }

    if (!date || isNaN(date.getTime())) return "Jamais";

    return date.toLocaleString("fr-FR");
}

function utilisateurEnLigne(user) {
    if (user.online === true) return true;

    if (!user.lastSeenAt || !user.lastSeenAt.toDate) return false;

    const lastSeen = user.lastSeenAt.toDate();
    const maintenant = new Date();
    const differenceMinutes = (maintenant - lastSeen) / 1000 / 60;

    return differenceMinutes <= 5;
}

function afficherStatsUtilisation() {
    const zoneStats = document.getElementById("stats-utilisation");
    if (!zoneStats) return;

    const users = utilisateursCache.filter(user => !user.pending);
    const pending = utilisateursCache.filter(user => user.pending);

    const actifs = users.filter(user => user.actif !== false).length;
    const enLigne = users.filter(utilisateurEnLigne).length;
    const membres = users.filter(user => (user.role || "membre") === "membre").length;
    const coachs = users.filter(user => user.role === "coach").length;
    const admins = users.filter(user => user.role === "admin").length;
    const superAdmins = users.filter(user => user.role === "super_admin").length;

    zoneStats.innerHTML = `
        <section class="card usage-card"><strong>${users.length}</strong><span>Comptes créés</span></section>
        <section class="card usage-card"><strong>${actifs}</strong><span>Comptes actifs</span></section>
        <section class="card usage-card"><strong>${enLigne}</strong><span>En ligne</span></section>
        <section class="card usage-card"><strong>${pending.length}</strong><span>Accès préparés</span></section>
        <section class="card usage-card"><strong>${membres}</strong><span>Membres</span></section>
        <section class="card usage-card"><strong>${coachs}</strong><span>Coachs</span></section>
        <section class="card usage-card"><strong>${admins}</strong><span>Admins</span></section>
        <section class="card usage-card"><strong>${superAdmins}</strong><span>Super admins</span></section>
    `;
}

function toutesLesPages() {
    return pagesAcces.flatMap(c => c.pages);
}

function normaliserTexte(texte) {
    return String(texte || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function emailId(email) {
    return String(email || "").trim().toLowerCase();
}

function optionRole(roleActuel) {
    return roles.map(role => `<option value="${role}" ${role === roleActuel ? "selected" : ""}>${role}</option>`).join("");
}

function accesUtilisateur(user) {
    const acces = user.accesPages || {};
    toutesLesPages().forEach(page => {
        if (!acces[page.key]) {
            acces[page.key] = {
                lecture: page.defautLecture === true,
                ecriture: page.defautEcriture === true
            };
        }
    });
    return acces;
}

function valeurLecture(user, key) {
    return (accesUtilisateur(user)[key] || {}).lecture === true;
}

function valeurEcriture(user, key) {
    return (accesUtilisateur(user)[key] || {}).ecriture === true;
}

function resumeUtilisateur(user) {
    const acces = accesUtilisateur(user);
    const totalLecture = Object.values(acces).filter(v => v && v.lecture === true).length;
    const totalEcriture = Object.values(acces).filter(v => v && v.ecriture === true).length;
    return `${totalLecture} lecture(s) · ${totalEcriture} écriture(s)`;
}

function filtrerUtilisateurs() {
    const recherche = normaliserTexte(champRecherche ? champRecherche.value : "");
    if (!recherche) return utilisateursCache;
    return utilisateursCache.filter(user => {
        const cible = normaliserTexte(`${user.email || ""} ${user.nom || ""} ${user.prenom || ""} ${user.role || ""}`);
        return cible.includes(recherche);
    });
}

function rouvrir(uid) {
    setTimeout(() => {
        const details = document.getElementById("details-user-" + uid);
        const arrow = document.getElementById("arrow-user-" + uid);
        if (details) details.classList.add("open");
        if (arrow) arrow.textContent = "▼";
    }, 0);
}

function afficherUtilisateurs() {
    afficherStatsUtilisation();
    const utilisateurs = filtrerUtilisateurs();

    if (utilisateurs.length === 0) {
        zone.innerHTML = `<section class="card"><h2>Aucun utilisateur</h2><p>Aucun compte ne correspond à la recherche.</p></section>`;
        return;
    }

    zone.innerHTML = utilisateurs.map(user => `
        <section class="card user-line">
            <div class="user-line-header" onclick="toggleUserLine('${user.uid}')">
                <div class="user-line-title">
                    <h2>${user.prenom || ""} ${user.nom || ""} ${(!user.prenom && !user.nom) ? (user.email || "Email inconnu") : ""}</h2>
                    <p>${user.email || "Email inconnu"} ${user.pending ? `<span class="pending-badge">Accès préparé</span>` : ""}</p>
                    <p>
                        <span class="role-badge">${user.role || "membre"}</span>
                        · ${user.actif === false ? "Compte désactivé" : "Compte actif"}
                        · ${user.pending ? "Accès préparé" : (utilisateurEnLigne(user) ? '<span class="online-dot">● En ligne</span>' : '<span class="offline-dot">○ Hors ligne</span>')}
                        · ${resumeUtilisateur(user)}
                    </p>
                    ${!user.pending ? `<p class="small-muted">Dernière connexion : ${formatDateFirebase(user.lastLoginAt)} · Dernière activité : ${formatDateFirebase(user.lastSeenAt)}</p>` : ""}
                </div>
                <div class="user-arrow" id="arrow-user-${user.uid}">▶</div>
            </div>

            <div class="user-details" id="details-user-${user.uid}">
                <p><strong>UID :</strong> ${user.uid}</p>

                <label>
                    <strong>Rôle principal</strong>
                    <select class="form-input" onchange="changerRoleUtilisateur('${user.uid}', this.value)">
                        ${optionRole(user.role || "membre")}
                    </select>
                </label>

                <p class="small-muted">Le rôle sert de base. Les cases ci-dessous permettent d'ouvrir ou fermer précisément chaque page.</p>

                ${pagesAcces.map(categorie => `
                    <section class="access-section">
                        <h3 class="access-category-title">${categorie.categorie}</h3>
                        <table class="access-table">
                            <thead><tr><th>Page</th><th>Lecture</th><th>Écriture</th></tr></thead>
                            <tbody>
                                ${categorie.pages.map(page => `
                                    <tr>
                                        <td><strong>${page.titre}${page.sensible ? " ⚠️" : ""}</strong><br><span class="small-muted">${page.url}</span></td>
                                        <td><input type="checkbox" ${valeurLecture(user, page.key) ? "checked" : ""} onchange="modifierAcces('${user.uid}', '${page.key}', 'lecture', this.checked)"></td>
                                        <td><input type="checkbox" ${valeurEcriture(user, page.key) ? "checked" : ""} onchange="modifierAcces('${user.uid}', '${page.key}', 'ecriture', this.checked)"></td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </section>
                `).join("")}

                <div class="user-actions">
                    <button class="primary-button order-button" onclick="enregistrerAccesUtilisateur('${user.uid}')">Enregistrer les modifications</button>
                    <button class="secondary-button" onclick="appliquerProfilMembre('${user.uid}')">Profil membre</button>
                    <button class="secondary-button" onclick="appliquerProfilCoach('${user.uid}')">Profil coach</button>
                    <button class="secondary-button" onclick="appliquerProfilAdmin('${user.uid}')">Profil admin</button>
                    <button class="secondary-button" onclick="basculerUtilisateur('${user.uid}', ${user.actif === false ? "true" : "false"})">${user.actif === false ? "Réactiver" : "Désactiver"}</button>
                </div>
            </div>
        </section>
    `).join("");
}

async function chargerUtilisateurs() {
    zone.innerHTML = `<section class="card"><p>Chargement des utilisateurs...</p></section>`;
    try {
        const users = await listUsers();
        const pending = await listPendingUsers();
        const usersEmails = users.map(user => emailId(user.email));

        utilisateursCache = [
            ...users.map(user => ({
                ...user,
                pending: false,
                accesPages: accesUtilisateur(user)
            })),
            ...pending
                .filter(user => !usersEmails.includes(emailId(user.email)))
                .map(user => ({
                    ...user,
                    uid: user.uid || user.email,
                    pending: true,
                    actif: user.actif !== false,
                    accesPages: accesUtilisateur(user)
                }))
        ];

        afficherStatsUtilisation();
        afficherUtilisateurs();
    } catch (error) {
        console.error(error);
        zone.innerHTML = `<section class="card"><h2>Erreur</h2><p>Impossible de charger les utilisateurs.</p><p><small>${error.message || ""}</small></p></section>`;
    }
}

window.toggleUserLine = function(uid) {
    const details = document.getElementById("details-user-" + uid);
    const arrow = document.getElementById("arrow-user-" + uid);
    if (!details || !arrow) return;
    if (details.classList.contains("open")) {
        details.classList.remove("open");
        arrow.textContent = "▶";
    } else {
        details.classList.add("open");
        arrow.textContent = "▼";
    }
};

window.modifierAcces = function(uid, pageKey, type, valeur) {
    const user = utilisateursCache.find(item => String(item.uid) === String(uid));
    if (!user) return;

    user.accesPages = accesUtilisateur(user);
    user.accesPages[pageKey] = user.accesPages[pageKey] || { lecture: false, ecriture: false };
    user.accesPages[pageKey][type] = valeur;

    if (type === "ecriture" && valeur === true) {
        user.accesPages[pageKey].lecture = true;
    }

    if (type === "lecture" && valeur === false) {
        user.accesPages[pageKey].ecriture = false;
    }

    const resume = document.getElementById("resume-user-" + uid);
    if (resume) resume.textContent = resumeUtilisateur(user);
};

async function sauvegarderUser(user) {
    if (user.pending) {
        await updatePendingUser(user.uid, {
            email: user.email,
            nom: user.nom || "",
            prenom: user.prenom || "",
            role: user.role || "membre",
            actif: user.actif !== false,
            accesPages: user.accesPages || {}
        });
    } else {
        await updateUserRole(user.uid, user.role || "membre");
        await updateUserActif(user.uid, user.actif !== false);
        await updateUserAccesPages(user.uid, user.accesPages || {});
    }
}

window.enregistrerAccesUtilisateur = async function(uid) {
    const user = utilisateursCache.find(item => String(item.uid) === String(uid));
    if (!user) return;
    await sauvegarderUser(user);
    alert("Accès enregistrés ✅");
};

window.changerRoleUtilisateur = function(uid, role) {
    const user = utilisateursCache.find(item => String(item.uid) === String(uid));
    if (!user) return;
    if (role === "super_admin" && !confirm("Confirmer le passage en super_admin ?")) return;
    user.role = role;
};

window.basculerUtilisateur = async function(uid, actif) {
    const user = utilisateursCache.find(item => String(item.uid) === String(uid));
    if (!user) return;
    user.actif = actif;
    await sauvegarderUser(user);
    afficherUtilisateurs();
};

function setAllFalse() {
    const acces = {};
    toutesLesPages().forEach(page => { acces[page.key] = { lecture: false, ecriture: false }; });
    return acces;
}

function profilMembre() {
    const acces = setAllFalse();
    toutesLesPages().forEach(page => {
        acces[page.key] = {
            lecture: page.defautLecture === true,
            ecriture: page.defautEcriture === true
        };
    });
    return acces;
}

function appliquerProfil(uid, typeProfil) {
    const user = utilisateursCache.find(item => String(item.uid) === String(uid));
    if (!user) return;

    if (typeProfil === "membre") {
        user.accesPages = profilMembre();
        user.role = "membre";
    }

    if (typeProfil === "coach") {
        user.accesPages = profilMembre();
        ["admin-appel","admin-absences","admin-planning","admin-groupes","admin-adherents","admin-competitions","competition-convocation","admin-tableau-bord"].forEach(key => {
            user.accesPages[key] = { lecture: true, ecriture: true };
        });
        user.role = "coach";
    }

    if (typeProfil === "admin") {
        user.accesPages = {};
        toutesLesPages().forEach(page => { user.accesPages[page.key] = { lecture: true, ecriture: true }; });
        user.role = "admin";
    }

    afficherUtilisateurs();
    rouvrir(uid);
}

window.appliquerProfilMembre = uid => appliquerProfil(uid, "membre");
window.appliquerProfilCoach = uid => appliquerProfil(uid, "coach");
window.appliquerProfilAdmin = uid => appliquerProfil(uid, "admin");


async function creerAccesManuel() {
    const prenom = champNouveauPrenom.value.trim();
    const nom = champNouveauNom.value.trim();
    const email = emailId(champNouveauEmail.value);
    const role = champNouveauRole.value || "membre";

    if (!email) {
        alert("Merci d'indiquer un email.");
        return;
    }

    const accesPages = role === "admin"
        ? Object.fromEntries(toutesLesPages().map(page => [page.key, { lecture: true, ecriture: true }]))
        : role === "coach"
            ? (() => {
                const acces = profilMembre();
                ["admin-appel","admin-absences","admin-planning","admin-groupes","admin-adherents","admin-competitions","competition-convocation","admin-tableau-bord"].forEach(key => {
                    acces[key] = { lecture: true, ecriture: true };
                });
                return acces;
            })()
            : profilMembre();

    await createPendingUser({
        email,
        nom,
        prenom,
        role,
        actif: true,
        accesPages
    });

    champNouveauPrenom.value = "";
    champNouveauNom.value = "";
    champNouveauEmail.value = "";
    champNouveauRole.value = "membre";

    await chargerUtilisateurs();
    alert("Accès préparé ✅ La personne devra créer son compte avec ce même email.");
}

if (boutonRecharger) boutonRecharger.addEventListener("click", chargerUtilisateurs);
if (champRecherche) champRecherche.addEventListener("input", afficherUtilisateurs);
if (boutonCreerAcces) boutonCreerAcces.addEventListener("click", creerAccesManuel);

chargerUtilisateurs();
