const notificationsAdmin = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
const badgeAdmin = document.getElementById("badge-notifications-admin");

const nonLues = notificationsAdmin.filter(notification =>
    !notification.lue &&
    !notification.archivee
);

if (badgeAdmin && nonLues.length > 0) {
    badgeAdmin.textContent = nonLues.length;
    badgeAdmin.className = "notification-badge";
}