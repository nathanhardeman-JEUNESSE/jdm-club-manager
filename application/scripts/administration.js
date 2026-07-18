const notificationsAdmin = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
const absencesAdmin = JSON.parse(localStorage.getItem("absencesJDM")) || [];
const commandesAdmin = JSON.parse(localStorage.getItem("commandesJDM")) || [];

const badgeNotifications = document.getElementById("badge-notifications-admin");
const badgeAbsences = document.getElementById("badge-absences-admin");
const badgeCommandes = document.getElementById("badge-commandes-admin");
const badgeCotisations = document.getElementById("badge-cotisations-admin");
const aidesLicenceAdmin = JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];
const logoUrl = new URL("../assets/images/logo-jdm-noir.png", import.meta.url).href;

function afficherBadge(element, nombre) {
    if (!element) return;

    if (nombre > 0) {
        element.textContent = nombre;
        element.className = "notification-badge";
    } else {
        element.textContent = "";
        element.className = "";
    }
}

function statutCommandeNormalise(statut) {
    if (statut === "Livrée") return "Distribuée";
    return statut || "En cours de préparation";
}

const absencesNonLues = absencesAdmin.filter(absence =>
    !absence.lueAdmin &&
    absence.statut !== "traitée"
).length;

const commandesNonVues = commandesAdmin.filter(commande => {
    const statut = statutCommandeNormalise(commande.statut);

    return !commande.vueAdmin &&
        statut !== "Annulée" &&
        statut !== "Distribuée";
}).length;

const notificationsNonLues = notificationsAdmin.filter(notification =>
    !notification.lue &&
    !notification.archivee &&
    notification.categorie !== "parent" &&
    notification.categorie !== "boutique" &&
    notification.type !== "commande-prete" &&
    notification.type !== "absence"
).length;

afficherBadge(badgeAbsences, absencesNonLues);
afficherBadge(badgeCommandes, commandesNonVues);
afficherBadge(badgeNotifications, notificationsNonLues);
const cotisationsAControler = aidesLicenceAdmin.filter(a =>
    a.statutCotisation !== "regle" || a.relance === "oui"
).length;
afficherBadge(badgeCotisations, cotisationsAControler);

const sectionsAdmin = [
    "coach",
    "club",
    "communication",
    "securite",
    "technique"
];

function chargerSectionsAdmin() {
    sectionsAdmin.forEach(section => {
        const bloc = document.getElementById("section-" + section);
        const fleche = document.getElementById("arrow-" + section);

        if (!bloc || !fleche) return;

        const etat = localStorage.getItem("admin-section-" + section);

        if (etat === null) {
            if (section === "coach") {
                bloc.style.display = "block";
                fleche.textContent = "▼";
            } else {
                bloc.style.display = "none";
                fleche.textContent = "▶";
            }

            return;
        }

        if (etat === "ouverte") {
            bloc.style.display = "block";
            fleche.textContent = "▼";
        } else {
            bloc.style.display = "none";
            fleche.textContent = "▶";
        }
    });
}

function toggleSection(section) {
    const bloc = document.getElementById("section-" + section);
    const fleche = document.getElementById("arrow-" + section);

    if (!bloc || !fleche) return;

    if (bloc.style.display === "none") {
        bloc.style.display = "block";
        fleche.textContent = "▼";
        localStorage.setItem("admin-section-" + section, "ouverte");
    } else {
        bloc.style.display = "none";
        fleche.textContent = "▶";
        localStorage.setItem("admin-section-" + section, "fermee");
    }
}

chargerSectionsAdmin();
