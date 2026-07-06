let notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];

const zoneNotifications = document.getElementById("liste-notifications-parent");
const resumeNotifications = document.getElementById("resume-notifications");
const boutonToutLu = document.getElementById("tout-marquer-lu");
const boutonSupprimerLues = document.getElementById("supprimer-notifications-lues");

function sauvegarderNotifications() {
    localStorage.setItem("notificationsJDM", JSON.stringify(notifications));
}

function notificationVisibleParent(notification) {
    if (notification.archivee) return false;

    return (
        notification.categorie === "parent" ||
        notification.categorie === "parents-groupes" ||
        notification.destinataire === "parent" ||
        notification.type === "commande-prete" ||
        notification.type === "planning" ||
        notification.type === "competition"
    );
}

function notificationsVisiblesParent() {
    return notifications.filter(notificationVisibleParent);
}

function notificationsNonLuesParent() {
    return notificationsVisiblesParent().filter(notification => !notification.lue);
}

function afficherResume() {
    if (!resumeNotifications) return;

    const nonLues = notificationsNonLuesParent().length;

    if (nonLues === 0) {
        resumeNotifications.textContent = "Aucune notification non lue.";
    } else {
        resumeNotifications.textContent = `${nonLues} notification(s) non lue(s).`;
    }
}

function marquerCommeLue(id) {
    notifications = notifications.map(notification => {
        if (String(notification.id) === String(id)) {
            return { ...notification, lue: true };
        }
        return notification;
    });

    sauvegarderNotifications();
    afficherNotifications();
}

function supprimerNotification(id) {
    notifications = notifications.map(notification => {
        if (String(notification.id) === String(id)) {
            return { ...notification, archivee: true, lue: true, traitee: true };
        }
        return notification;
    });

    sauvegarderNotifications();
    afficherNotifications();
}

function toutMarquerCommeLu() {
    const idsVisibles = notificationsVisiblesParent().map(n => String(n.id));

    notifications = notifications.map(notification => {
        if (idsVisibles.includes(String(notification.id))) {
            return { ...notification, lue: true };
        }
        return notification;
    });

    sauvegarderNotifications();
    afficherNotifications();
}

function supprimerNotificationsLues() {
    const idsVisibles = notificationsVisiblesParent().map(n => String(n.id));

    notifications = notifications.map(notification => {
        if (idsVisibles.includes(String(notification.id)) && notification.lue) {
            return { ...notification, archivee: true, traitee: true };
        }
        return notification;
    });

    sauvegarderNotifications();
    afficherNotifications();
}

function detailsNotification(notification) {
    const donnees = notification.donnees || {};
    let html = "";

    if (notification.groupeNom) {
        html += `<p><strong>Groupe :</strong> ${notification.groupeNom}</p>`;
    }

    if (notification.date) {
        html += `<p><strong>Date :</strong> ${notification.date}</p>`;
    }

    if (donnees.numeroCommande) {
        html += `<p><strong>Commande :</strong> n°${donnees.numeroCommande}</p>`;
    }

    if (donnees.total) {
        html += `<p><strong>Montant :</strong> ${donnees.total} €</p>`;
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
                <p>Vous n'avez aucune notification pour le moment.</p>
            </section>
        `;
        return;
    }

    zoneNotifications.innerHTML = "";

    liste.forEach(notification => {
        const classe = notification.lue ? "notification-lue" : "notification-non-lue";

        zoneNotifications.innerHTML += `
            <section class="card ${classe}">
                <h2>
                    ${notification.lue ? "✅" : "🔴"}
                    ${notification.titre || "Notification"}
                </h2>

                <p>${notification.message || ""}</p>
                ${detailsNotification(notification)}

                <p>
                    <strong>Reçue le :</strong>
                    ${notification.dateCreation ? new Date(notification.dateCreation).toLocaleString("fr-FR") : "Non renseigné"}
                </p>

                ${!notification.lue ? `
                    <button class="primary-button order-button" onclick="marquerCommeLue('${notification.id}')">
                        Marquer comme lu
                    </button>
                ` : ""}

                <button class="secondary-button" onclick="supprimerNotification('${notification.id}')">
                    Supprimer
                </button>
            </section>
        `;
    });
}

if (boutonToutLu) {
    boutonToutLu.addEventListener("click", toutMarquerCommeLu);
}

if (boutonSupprimerLues) {
    boutonSupprimerLues.addEventListener("click", supprimerNotificationsLues);
}

afficherNotifications();
