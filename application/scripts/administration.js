const notificationsAdmin = JSON.parse(localStorage.getItem("notificationsJDM")) || [];
const badgeAdmin = document.getElementById("badge-notifications-admin");

const nonLues = notificationsAdmin.filter(notification =>
    !notification.lue &&
    !notification.archivee
);

if (badgeAdmin && nonLues.length > 0) {
    badgeAdmin.textContent = nonLues.length;
    badgeAdmin.className = "notification-badge";
} else if (badgeAdmin) {
    badgeAdmin.textContent = "";
    badgeAdmin.className = "";
}

const sectionsAdmin = [
    "coach",
    "club",
    "communication",
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