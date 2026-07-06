const notificationsAdmin = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
const absencesAdmin = JSON.parse(localStorage.getItem("absencesJDM")) || [];
const commandesAdmin = JSON.parse(localStorage.getItem("commandesJDM")) || [];

function ajouterBadgeSurCarte(titreCarte, nombre) {
    const titres = document.querySelectorAll(".navigation-content h2");

    titres.forEach(titre => {
        const texte = titre.textContent.trim().toLowerCase();

        if (!texte.startsWith(titreCarte.toLowerCase())) return;

        const ancienBadge = titre.querySelector(".notification-badge");
        if (ancienBadge) ancienBadge.remove();

        if (nombre > 0) {
            const badge = document.createElement("span");
            badge.className = "notification-badge";
            badge.textContent = nombre;
            titre.appendChild(badge);
        }
    });
}

function notificationAdminActive(notification) {
    if (notification.archivee || notification.lue) return false;

    return notification.categorie === "tresorier" ||
           notification.categorie === "parents-groupes" ||
           notification.categorie === "boutique";
}

function absenceAdminActive(absence) {
    return !absence.archiveeAdmin &&
           !absence.lueAdmin &&
           String(absence.statut || "déclarée").toLowerCase() !== "traitée";
}

function commandeAdminActive(commande) {
    const statut = commande.statut || "En cours de préparation";

    return !commande.vueAdmin &&
           statut !== "Annulée" &&
           statut !== "Distribuée" &&
           statut !== "Livrée";
}

const totalNotifications = notificationsAdmin.filter(notificationAdminActive).length;
const totalAbsences = absencesAdmin.filter(absenceAdminActive).length;
const totalCommandes = commandesAdmin.filter(commandeAdminActive).length;

ajouterBadgeSurCarte("Notifications", totalNotifications);
ajouterBadgeSurCarte("Absences", totalAbsences);
ajouterBadgeSurCarte("Commandes", totalCommandes);

const badgeAdmin = document.getElementById("badge-notifications-admin");

if (badgeAdmin) {
    if (totalNotifications > 0) {
        badgeAdmin.textContent = totalNotifications;
        badgeAdmin.className = "notification-badge";
    } else {
        badgeAdmin.textContent = "";
        badgeAdmin.className = "";
    }
}
