let notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];

const params = new URLSearchParams(window.location.search);
const categorie = params.get("categorie");

const titreCategorie = document.getElementById("titre-categorie");
const zone = document.getElementById("liste-notifications-admin");

const titres = {
    "tresorier": "💰 Notifications trésorier",
    "parents-groupes": "👨‍👩‍👧 Parents / Groupes",
    "boutique": "🛍️ Notifications boutique"
};

if (titreCategorie) {
    titreCategorie.textContent = titres[categorie] || "Notifications";
}

function sauvegarder() {
    localStorage.setItem("notificationsJDM", JSON.stringify(notifications));
}

function marquerCommeLue(id) {
    notifications = notifications.map(notification => {
        if (String(notification.id) === String(id)) {
            return { ...notification, lue: true };
        }
        return notification;
    });

    sauvegarder();
    afficherNotifications();
}

function marquerCommeTraitee(id) {
    notifications = notifications.map(notification => {
        if (String(notification.id) === String(id)) {
            return { ...notification, lue: true, traitee: true };
        }
        return notification;
    });

    sauvegarder();
    afficherNotifications();
}

function archiverNotification(id) {
    notifications = notifications.map(notification => {
        if (String(notification.id) === String(id)) {
            return { ...notification, lue: true, traitee: true, archivee: true };
        }
        return notification;
    });

    sauvegarder();
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

    if (donnees.commande || donnees.numeroCommande) {
        html += `<p><strong>Commande :</strong> n°${donnees.commande || donnees.numeroCommande}</p>`;
    }

    if (donnees.client) {
        html += `<p><strong>Client :</strong> ${donnees.client}</p>`;
    }

    if (donnees.total) {
        html += `<p><strong>Montant :</strong> ${donnees.total} €</p>`;
    }

    if (donnees.paiement) {
        html += `<p><strong>Paiement :</strong> ${donnees.paiement}</p>`;
    }

    return html;
}

function afficherNotifications() {
    if (!zone) return;

    const liste = notifications
        .filter(notification =>
            notification.categorie === categorie &&
            !notification.archivee
        )
        .slice()
        .reverse();

    if (liste.length === 0) {
        zone.innerHTML = `
            <section class="card">
                <h2>Aucune notification</h2>
                <p>Aucune action en attente.</p>
            </section>
        `;
        return;
    }

    zone.innerHTML = "";

    liste.forEach(notification => {
        const classe = notification.lue ? "notification-lue" : "notification-non-lue";

        zone.innerHTML += `
            <section class="card ${classe}">
                <h2>
                    ${!notification.lue ? "🔴 " : "✅ "}
                    ${notification.titre || "Notification"}
                </h2>

                <p>${notification.message || ""}</p>
                ${detailsNotification(notification)}

                <p>
                    <strong>Créée le :</strong>
                    ${notification.dateCreation ? new Date(notification.dateCreation).toLocaleString("fr-FR") : "Non renseigné"}
                </p>

                ${!notification.lue ? `
                    <button class="primary-button order-button" onclick="marquerCommeLue('${notification.id}')">
                        Marquer comme lu
                    </button>
                ` : ""}

                ${!notification.traitee ? `
                    <button class="secondary-button" onclick="marquerCommeTraitee('${notification.id}')">
                        Marquer comme traité
                    </button>
                ` : ""}

                <button class="secondary-button" onclick="archiverNotification('${notification.id}')">
                    Archiver
                </button>
            </section>
        `;
    });
}

afficherNotifications();
