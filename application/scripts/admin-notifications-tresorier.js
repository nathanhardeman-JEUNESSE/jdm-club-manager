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
    notifications
        .slice()
        .reverse()
        .forEach((notification) => {
            zoneNotifications.innerHTML += `
                <section class="card">
                    <h2>⚠️ ${notification.type}</h2>

                    <p><strong>Date :</strong> ${notification.date}</p>
                    <p><strong>Commande :</strong> n°${notification.commande}</p>
                    <p><strong>Client :</strong> ${notification.client}</p>
                    <p><strong>Email :</strong> ${notification.email}</p>
                    <p><strong>Téléphone :</strong> ${notification.telephone}</p>
                    <p><strong>Montant :</strong> ${notification.total} €</p>
                    <p><strong>Paiement :</strong> ${notification.paiement}</p>

                    <hr>

                    <h3>Articles concernés</h3>

                    ${notification.articles.map(article => `
                        <p>
                            <strong>${article.nom}</strong><br>
                            ${article.options.join(" / ")}<br>
                            Quantité : ${article.quantite}
                        </p>
                    `).join("")}
                </section>
            `;
        });
}