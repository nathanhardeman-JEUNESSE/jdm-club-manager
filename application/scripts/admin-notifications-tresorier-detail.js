const notifications = JSON.parse(localStorage.getItem("notificationsTresorierJDM")) || [];
const zoneNotifications = document.getElementById("notifications-tresorier");

if (notifications.length === 0) {
    zoneNotifications.innerHTML = `
        <section class="card">
            <h2>Aucune notification</h2>
            <p>Aucune action financière à prévoir pour le moment.</p>
        </section>
    `;
} else {
    zoneNotifications.innerHTML = "";

    notifications
        .slice()
        .reverse()
        .forEach((notification) => {
            zoneNotifications.innerHTML += `
                <section class="card">
                    <h2>⚠️ ${notification.type || "Notification trésorier"}</h2>

                    <p><strong>Date :</strong> ${notification.date || "Non renseignée"}</p>
                    <p><strong>Commande :</strong> n°${notification.commande || "Non renseignée"}</p>
                    <p><strong>Client :</strong> ${notification.client || "Non renseigné"}</p>
                    <p><strong>Email :</strong> ${notification.email || "Non renseigné"}</p>
                    <p><strong>Téléphone :</strong> ${notification.telephone || "Non renseigné"}</p>
                    <p><strong>Montant :</strong> ${notification.total || "0"} €</p>
                    <p><strong>Paiement :</strong> ${notification.paiement || "Non renseigné"}</p>

                    <hr>

                    <h3>Articles concernés</h3>

                    ${
                        notification.articles && notification.articles.length > 0
                            ? notification.articles.map(article => `
                                <p>
                                    <strong>${article.nom || "Article"}</strong><br>
                                    ${article.options ? article.options.join(" / ") : ""}<br>
                                    Quantité : ${article.quantite || 1}
                                </p>
                            `).join("")
                            : "<p>Aucun article renseigné.</p>"
                    }
                </section>
            `;
        });
}