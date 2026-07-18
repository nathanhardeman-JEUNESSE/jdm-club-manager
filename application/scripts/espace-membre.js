import {
    watchSession,
    logoutAndRedirect
} from "./session.js";

import {
    findAdherentsByEmail,
    getAdherentsByNumbers,
    listInscriptions,
    listNotificationsFirestore
} from "../firebase/firebase-db.js";

const zoneProfilMembre = document.getElementById("profil-membre-connecte");
const badge = document.getElementById("badge-notifications");
const notificationModeSummary = document.getElementById("notification-mode-summary");

let adherentsCompte = [];
let inscriptions = [];
let adherentSelectionne = null;
let profileActuel = null;

function nettoyer(texte) {
    return String(texte || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function inscriptionsPour(numeroAdherent) {
    return inscriptions.filter(item =>
        String(item.numeroAdherent) === String(numeroAdherent)
    );
}

function groupesPour(adherent) {
    const depuisAdherent = Array.isArray(adherent?.groupes)
        ? adherent.groupes
        : [];

    const depuisInscriptions = inscriptionsPour(
        adherent?.numeroAdherent
    ).map(item =>
        item.groupeFinal ||
        item.groupe ||
        item.donneesHelloAsso?.Tarif ||
        item.donneesHelloAsso?.tarif ||
        item.donneesHelloAsso?.name ||
        ""
    );

    return [...new Set([
        ...depuisAdherent,
        adherent?.groupe,
        ...depuisInscriptions
    ].filter(Boolean))]
        .filter(groupe => nettoyer(groupe) !== "fixed");
}

function estCompetition(adherent) {
    return groupesPour(adherent).some(groupe =>
        nettoyer(groupe).includes("compet")
    );
}

function identite(adherent) {
    return [
        adherent?.prenom,
        adherent?.nom
    ].filter(Boolean).join(" ") || "Adhérent";
}

function rendreSelecteur() {
    if (!zoneProfilMembre || adherentsCompte.length <= 1) return "";

    return `
        <label class="member-switcher-label" for="member-switcher">
            Adhérent affiché
        </label>

        <select id="member-switcher" class="member-switcher">
            ${adherentsCompte.map(adherent => `
                <option value="${adherent.id}"
                    ${adherent.id === adherentSelectionne?.id
                        ? "selected"
                        : ""}>
                    ${identite(adherent)}
                    ${adherent.numeroMembre
                        ? ` · ${adherent.numeroMembre}`
                        : ""}
                </option>
            `).join("")}
        </select>
    `;
}

function afficherProfil() {
    if (!zoneProfilMembre || !adherentSelectionne) return;

    const groupes = groupesPour(adherentSelectionne);
    const numero =
        adherentSelectionne.numeroMembre ||
        adherentSelectionne.numeroAdherent ||
        "Non renseigné";

    zoneProfilMembre.innerHTML = `
        ${rendreSelecteur()}

        <div class="member-dashboard-summary">
            <h2>Bonjour ${adherentSelectionne.prenom || ""} 👋</h2>

            <p>
                <strong>Nom :</strong>
                ${adherentSelectionne.nom || "Non renseigné"}
            </p>

            <p>
                <strong>Prénom :</strong>
                ${adherentSelectionne.prenom || "Non renseigné"}
            </p>

            <p>
                <strong>Email du compte :</strong>
                ${profileActuel?.email || "Non renseigné"}
            </p>

            <p>
                <strong>N° membre :</strong>
                ${numero}
            </p>

            <div class="member-groups">
                <strong>Groupe(s) :</strong>

                ${
                    groupes.length === 0
                        ? `<span>Non renseigné</span>`
                        : groupes.map(groupe =>
                            `<span class="member-group-chip">${groupe}</span>`
                        ).join("")
                }
            </div>
        </div>
    `;

    document.getElementById("member-switcher")
        ?.addEventListener("change", event => {
            const suivant = adherentsCompte.find(
                adherent => adherent.id === event.target.value
            );

            if (!suivant) return;

            adherentSelectionne = suivant;
            sessionStorage.setItem(
                "jdmAdherentSelectionne",
                suivant.numeroAdherent || suivant.id
            );

            afficherProfil();
            appliquerModulesConditionnels();
        });
}

function appliquerModulesConditionnels() {
    const competition = estCompetition(adherentSelectionne);

    document.querySelectorAll(
        '[data-member-module="resultats"], #resultats-card, .resultats-card'
    ).forEach(element => {
        element.hidden = !competition;
        element.style.display = competition ? "" : "none";
    });

    document.body.dataset.numeroAdherentSelectionne =
        adherentSelectionne?.numeroAdherent || "";

    window.dispatchEvent(new CustomEvent(
        "jdm:member-changed",
        {
            detail: {
                adherent: adherentSelectionne,
                groupes: groupesPour(adherentSelectionne)
            }
        }
    ));
}

function afficherModeNotifications(profile) {
    if (!notificationModeSummary) return;

    const mode = profile?.preferencesNotifications?.mode || "sonore";
    const libelles = {
        sonore: "Son activé",
        silencieux: "Mode silencieux",
        importantes: "Alertes importantes uniquement"
    };

    notificationModeSummary.textContent = `Réglage : ${libelles[mode] || libelles.sonore}`;
}

async function actualiserBadge(profile) {
    if (!badge) return;

    try {
        const notifications = await listNotificationsFirestore();
        const numeros = new Set(
            adherentsCompte
                .map(adherent => adherent.numeroAdherent)
                .filter(Boolean)
                .map(String)
        );

        const nonLues = notifications.filter(notification => {
            if (notification.archivee === true || notification.lue === true) {
                return false;
            }

            if (
                notification.numeroAdherent &&
                numeros.has(String(notification.numeroAdherent))
            ) {
                return true;
            }

            return (
                notification.categorie === "parents-groupes" ||
                notification.categorie === "parent" ||
                notification.destinataire === "parent" ||
                ["planning", "commande-prete", "competition"]
                    .includes(notification.type)
            );
        });

        badge.textContent = nonLues.length > 0
            ? String(nonLues.length)
            : "";

        badge.className = nonLues.length > 0
            ? "notification-badge"
            : "";
    } catch (error) {
        console.warn("Notifications indisponibles", error);
    }
}

async function chargerAdherentsCompte(user, profile) {
    const numeros = [
        ...(Array.isArray(profile.numeroAdherents)
            ? profile.numeroAdherents
            : []),
        profile.numeroAdherent
    ].filter(Boolean);

    let adherents = numeros.length > 0
        ? await getAdherentsByNumbers(numeros)
        : [];

    if (adherents.length === 0) {
        adherents = await findAdherentsByEmail(
            profile.email || user.email
        );
    }

    return adherents
        .filter(adherent => adherent.actif !== false)
        .sort((a, b) =>
            identite(a).localeCompare(identite(b), "fr")
        );
}

watchSession(async (user, profile) => {
    if (!user || !profile) return;

    profileActuel = profile;

    try {
        [adherentsCompte, inscriptions] = await Promise.all([
            chargerAdherentsCompte(user, profile),
            listInscriptions()
        ]);

        if (adherentsCompte.length === 0) {
            if (zoneProfilMembre) {
                zoneProfilMembre.innerHTML = `
                    <p>
                        Aucune fiche adhérent n'est encore rattachée
                        à ce compte.
                    </p>
                `;
            }

            return;
        }

        const selectionSauvee = sessionStorage.getItem(
            "jdmAdherentSelectionne"
        );

        adherentSelectionne =
            adherentsCompte.find(adherent =>
                String(adherent.numeroAdherent) ===
                String(selectionSauvee)
            ) ||
            adherentsCompte[0];

        afficherProfil();
        appliquerModulesConditionnels();
        actualiserBadge(profile);
        afficherModeNotifications(profile);
    } catch (error) {
        console.error(
            "Impossible de charger l'espace membre",
            error
        );

        if (zoneProfilMembre) {
            zoneProfilMembre.innerHTML = `
                <p>
                    Impossible de charger les informations
                    du compte.
                </p>
            `;
        }
    }
});

const boutonDeconnexion = document.getElementById("deconnexion-button");
boutonDeconnexion?.addEventListener("click", logoutAndRedirect);
boutonDeconnexion?.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        logoutAndRedirect();
    }
});
