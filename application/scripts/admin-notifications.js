let notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
let notificationsTresorier = JSON.parse(localStorage.getItem("notificationsTresorierJDM")) || [];

const zone = document.getElementById("centre-notifications");

function convertirAnciennesNotificationsTresorier() {
    let modification = false;

    notificationsTresorier.forEach(notification => {
        const existe = notifications.some(n =>
            n.categorie === "tresorier" &&
            n.donnees &&
            n.donnees.commande === notification.commande
        );

        if (!existe) {
            notifications.push({
                id: Date.now() + Math.floor(Math.random() * 100000),
                categorie: "tresorier",
                titre: notification.type || "Notification trésorier",
                message: `Commande n°${notification.commande} - ${notification.client} - ${notification.total} €`,
                priorite: "haute",
                lue: false,
                traitee: false,
                archivee: false,
                dateCreation: new Date().toISOString(),
                donnees: notification
            });

            modification = true;
        }
    });

    if (modification) {
        localStorage.setItem("notificationsJDM", JSON.stringify(notifications));
    }
}

function compterNonLues(categorie) {
    return notifications.filter(notification =>
        notification.categorie === categorie &&
        !notification.lue &&
        !notification.archivee
    ).length;
}

function carteCategorie(titre, texte, icone, categorie, lien) {
    const nombre = compterNonLues(categorie);

    return `
        <a href="${lien}?categorie=${categorie}" class="navigation-link">
            <section class="navigation-card">
                <div class="navigation-icon">${icone}</div>

                <div class="navigation-content">
                    <h2>
                        ${titre}
                        ${nombre > 0 ? `<span class="notification-badge">${nombre}</span>` : ""}
                    </h2>
                    <p>${texte}</p>
                </div>

                <div class="navigation-arrow">➜</div>
            </section>
        </a>
    `;
}

function afficherCentre() {
    zone.innerHTML = `
        ${carteCategorie("Trésorier", "Paiements, remboursements et actions financières.", "💰", "tresorier", "admin-notifications-categorie.html")}

        ${carteCategorie("Parents / Groupes", "Absences, planning et messages aux familles.", "👨‍👩‍👧", "parents-groupes", "admin-notifications-categorie.html")}

        ${carteCategorie("Boutique", "Commandes prêtes, retraits et informations boutique.", "🛍️", "boutique", "admin-notifications-categorie.html")}
    `;
}

convertirAnciennesNotificationsTresorier();
afficherCentre();