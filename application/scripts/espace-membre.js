const notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
const badge = document.getElementById("badge-notifications");

const notificationsParentNonLues = notifications.filter(notification =>
    !notification.lue &&
    !notification.archivee &&
    (
        notification.categorie === "parents-groupes" ||
        notification.categorie === "parent" ||
        notification.type === "planning" ||
        notification.type === "commande-prete" ||
        notification.type === "competition"
    )
);

if (badge && notificationsParentNonLues.length > 0) {
    badge.textContent = notificationsParentNonLues.length;
    badge.className = "notification-badge";
} else if (badge) {
    badge.textContent = "";
    badge.className = "";
}