const notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
const zoneNotifications = document.getElementById("liste-notifications-parent");

function afficherNotifications() {
    if (notifications.length === 0) {
        zoneNotifications.innerHTML = `
            <section class="card">
                <h2>Aucune notification</h2>
                <p>Vous n'avez aucune notification pour le moment.</p>
            </section>
        `;
        return;
    }

    zoneNotifications.innerHTML = "";

    notifications
        .slice()
        .reverse()
        .forEach(notification => {
            zoneNotifications.innerHTML += `
                <section class="card">
                    <h2>${notification.titre || "Notification"}</h2>

                    <p>${notification.message || ""}</p>

                    ${notification.groupeNom ? `
                        <p><strong>Groupe :</strong> ${notification.groupeNom}</p>
                    ` : ""}

                    ${notification.date ? `
                        <p><strong>Date concernée :</strong> ${notification.date}</p>
                    ` : ""}

                    <p>
                        <strong>Reçue le :</strong>
                        ${new Date(notification.dateCreation).toLocaleString("fr-FR")}
                    </p>
                </section>
            `;
        });
}

afficherNotifications();