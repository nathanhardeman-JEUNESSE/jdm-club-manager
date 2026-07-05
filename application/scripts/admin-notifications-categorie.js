const notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
const zone = document.getElementById("liste-notifications-categorie");
const types = window.typeNotifications || [];

if (!zone) {
    console.error("Zone notifications catégorie introuvable");
} else {
    const notificationsFiltrees = notifications.filter(notification =>
        types.includes(notification.type)
    );

    if (notificationsFiltrees.length === 0) {
        zone.innerHTML = `
            <section class="card">
                <h2>Aucune notification</h2>
                <p>Aucune notification dans cette catégorie.</p>
            </section>
        `;
    } else {
        zone.innerHTML = "";

        notificationsFiltrees
            .slice()
            .reverse()
            .forEach(notification => {
                zone.innerHTML += `
                    <section class="card">
                        <h2>${notification.titre || "Notification"}</h2>
                        <p>${notification.message || ""}</p>

                        ${notification.groupeNom ? `<p><strong>Groupe :</strong> ${notification.groupeNom}</p>` : ""}
                        ${notification.date ? `<p><strong>Date :</strong> ${notification.date}</p>` : ""}

                        <p>
                            <strong>Créée le :</strong>
                            ${notification.dateCreation ? new Date(notification.dateCreation).toLocaleString("fr-FR") : "Non renseigné"}
                        </p>
                    </section>
                `;
            });
    }
}