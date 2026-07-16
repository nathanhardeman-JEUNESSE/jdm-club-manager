import {
    listNotificationsFirestore,
    updateNotificationFirestore
} from "../firebase/firebase-db.js";

import { watchSession } from "./session.js";

let notifications = [];
let profileActuel = null;

const zoneNotifications =
    document.getElementById("liste-notifications-parent");

const resumeNotifications =
    document.getElementById("resume-notifications");

const boutonToutLu =
    document.getElementById("tout-marquer-lu");

const boutonSupprimerLues =
    document.getElementById("supprimer-notifications-lues");

function notificationVisibleParent(notification) {
    if (notification.archivee === true) return false;

    const numeros = new Set([
        profileActuel?.numeroAdherent,
        ...(Array.isArray(profileActuel?.numeroAdherents)
            ? profileActuel.numeroAdherents
            : [])
    ].filter(Boolean).map(String));

    if (
        notification.numeroAdherent &&
        numeros.has(String(notification.numeroAdherent))
    ) {
        return true;
    }

    return (
        notification.categorie === "parent" ||
        notification.categorie === "parents-groupes" ||
        notification.destinataire === "parent" ||
        ["commande-prete", "planning", "competition"]
            .includes(notification.type)
    );
}

function notificationsVisiblesParent() {
    return notifications.filter(notificationVisibleParent);
}

function notificationsNonLuesParent() {
    return notificationsVisiblesParent().filter(
        notification => notification.lue !== true
    );
}

function afficherResume() {
    if (!resumeNotifications) return;

    const nonLues = notificationsNonLuesParent().length;

    resumeNotifications.textContent = nonLues === 0
        ? "Aucune notification non lue."
        : `${nonLues} notification(s) non lue(s).`;
}

async function marquerCommeLue(id) {
    await updateNotificationFirestore(id, { lue: true });
    await chargerNotifications();
}

async function supprimerNotification(id) {
    await updateNotificationFirestore(id, {
        archivee: true,
        lue: true,
        traitee: true
    });

    await chargerNotifications();
}

async function toutMarquerCommeLu() {
    await Promise.all(
        notificationsVisiblesParent().map(notification =>
            updateNotificationFirestore(
                notification.id,
                { lue: true }
            )
        )
    );

    await chargerNotifications();
}

async function supprimerNotificationsLues() {
    await Promise.all(
        notificationsVisiblesParent()
            .filter(notification => notification.lue === true)
            .map(notification =>
                updateNotificationFirestore(
                    notification.id,
                    {
                        archivee: true,
                        traitee: true
                    }
                )
            )
    );

    await chargerNotifications();
}

function detailsNotification(notification) {
    const donnees = notification.donnees || {};
    let html = "";

    if (notification.groupeNom) {
        html += `
            <p>
                <strong>Groupe :</strong>
                ${notification.groupeNom}
            </p>
        `;
    }

    if (notification.date) {
        html += `
            <p>
                <strong>Date :</strong>
                ${notification.date}
            </p>
        `;
    }

    if (donnees.numeroCommande) {
        html += `
            <p>
                <strong>Commande :</strong>
                n°${donnees.numeroCommande}
            </p>
        `;
    }

    if (donnees.total) {
        html += `
            <p>
                <strong>Montant :</strong>
                ${donnees.total} €
            </p>
        `;
    }

    return html;
}

function afficherNotifications() {
    if (!zoneNotifications) return;

    const liste = notificationsVisiblesParent()
        .slice()
        .reverse();

    afficherResume();

    if (liste.length === 0) {
        zoneNotifications.innerHTML = `
            <section class="card">
                <h2>Aucune notification</h2>
                <p>
                    Vous n'avez aucune notification
                    pour le moment.
                </p>
            </section>
        `;
        return;
    }

    zoneNotifications.innerHTML = liste.map(notification => {
        const classe = notification.lue
            ? "notification-lue"
            : "notification-non-lue";

        return `
            <section class="card ${classe}">
                <h2>
                    ${notification.lue ? "✅" : "🔴"}
                    ${notification.titre || "Notification"}
                </h2>

                <p>${notification.message || ""}</p>

                ${detailsNotification(notification)}

                <p>
                    <strong>Reçue le :</strong>
                    ${
                        notification.dateCreation
                            ? new Date(
                                notification.dateCreation
                            ).toLocaleString("fr-FR")
                            : "Non renseigné"
                    }
                </p>

                ${
                    !notification.lue
                        ? `
                            <button
                                class="primary-button order-button"
                                onclick="marquerCommeLue('${notification.id}')">
                                Marquer comme lu
                            </button>
                        `
                        : ""
                }

                <button
                    class="secondary-button"
                    onclick="supprimerNotification('${notification.id}')">
                    Supprimer
                </button>
            </section>
        `;
    }).join("");
}

async function chargerNotifications() {
    try {
        notifications = await listNotificationsFirestore();
        afficherNotifications();
    } catch (error) {
        console.error(
            "Impossible de charger les notifications",
            error
        );

        if (zoneNotifications) {
            zoneNotifications.innerHTML = `
                <section class="card">
                    <h2>Erreur</h2>
                    <p>
                        Impossible de charger les notifications.
                    </p>
                </section>
            `;
        }
    }
}

window.marquerCommeLue = marquerCommeLue;
window.supprimerNotification = supprimerNotification;

boutonToutLu?.addEventListener(
    "click",
    toutMarquerCommeLu
);

boutonSupprimerLues?.addEventListener(
    "click",
    supprimerNotificationsLues
);

watchSession((user, profile) => {
    if (!user || !profile) return;

    profileActuel = profile;
    chargerNotifications();
});
