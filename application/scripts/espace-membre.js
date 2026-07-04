const notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
const badge = document.getElementById("badge-notifications");

if (badge && notifications.length > 0) {
    badge.textContent = notifications.length;
    badge.className = "notification-badge";
}