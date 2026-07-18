import { watchSession, logoutAndRedirect } from "./session.js";
import { listNotificationsFirestore } from "../firebase/firebase-db.js";

function injecterBarre() {
    if (document.querySelector(".jdm-global-topbar")) return;

    document.body.insertAdjacentHTML("afterbegin", `
        <header class="jdm-global-topbar">
            <div class="jdm-global-topbar-spacer"></div>

            <div class="jdm-global-topbar-actions">
                <a href="accueil.html"
                   class="jdm-topbar-icon"
                   aria-label="Retour au menu"
                   title="Menu">⌂</a>

                <a href="notifications.html"
                   class="jdm-topbar-icon jdm-notification-link"
                   aria-label="Notifications"
                   title="Notifications">
                    🔔
                    <span id="jdm-global-notification-badge"
                          class="jdm-global-badge"
                          hidden></span>
                </a>

                <button type="button"
                        id="jdm-profile-menu-button"
                        class="jdm-topbar-icon"
                        aria-label="Mon espace"
                        aria-expanded="false"
                        title="Mon espace">👤</button>
            </div>

            <div id="jdm-profile-menu" class="jdm-profile-menu" hidden>
                <div class="jdm-profile-menu-identity">
                    <strong id="jdm-profile-menu-name">Membre</strong>
                    <small id="jdm-profile-menu-role"></small>
                </div>

                <a href="mon-profil.html">Mon profil</a>
                <a href="espace-membre.html">Mon espace</a>
                <a href="documents-membre.html">Mes documents</a>

                <button type="button" id="jdm-profile-logout">
                    Déconnexion
                </button>
            </div>
        </header>
    `);

    const bouton = document.getElementById("jdm-profile-menu-button");
    const menu = document.getElementById("jdm-profile-menu");

    bouton?.addEventListener("click", () => {
        const ouvert = !menu.hidden;
        menu.hidden = ouvert;
        bouton.setAttribute("aria-expanded", String(!ouvert));
    });

    document.addEventListener("click", event => {
        if (
            !menu.hidden &&
            !menu.contains(event.target) &&
            event.target !== bouton
        ) {
            menu.hidden = true;
            bouton?.setAttribute("aria-expanded", "false");
        }
    });

    document.getElementById("jdm-profile-logout")
        ?.addEventListener("click", logoutAndRedirect);
}

function notificationVisible(notification, profile) {
    if (notification.archivee === true) return false;

    const numeros = new Set([
        profile?.numeroAdherent,
        ...(Array.isArray(profile?.numeroAdherents)
            ? profile.numeroAdherents
            : [])
    ].filter(Boolean).map(String));

    if (
        notification.destinataireUid &&
        notification.destinataireUid === profile?.uid
    ) {
        return true;
    }

    if (
        notification.numeroAdherent &&
        numeros.has(String(notification.numeroAdherent))
    ) {
        return true;
    }

    return (
        notification.destinataire === "parent" ||
        notification.categorie === "parent" ||
        notification.categorie === "parents-groupes" ||
        ["planning", "commande-prete", "competition"].includes(
            notification.type
        )
    );
}

async function actualiserBadge(profile) {
    const badge = document.getElementById("jdm-global-notification-badge");
    if (!badge) return;

    try {
        const notifications = await listNotificationsFirestore();

        const nonLues = notifications.filter(notification =>
            notificationVisible(notification, profile) &&
            notification.lue !== true
        ).length;

        badge.textContent = nonLues > 9 ? "9+" : String(nonLues);
        badge.hidden = nonLues === 0;
    } catch (error) {
        console.warn("Badge notifications indisponible", error);
        badge.hidden = true;
    }
}

injecterBarre();

watchSession((user, profile) => {
    if (!user || !profile) return;

    const nom = [
        profile.prenom,
        profile.nom
    ].filter(Boolean).join(" ") || profile.email || "Membre";

    const role = String(profile.role || "membre")
        .replaceAll("_", " ");

    const nomZone = document.getElementById("jdm-profile-menu-name");
    const roleZone = document.getElementById("jdm-profile-menu-role");

    if (nomZone) nomZone.textContent = nom;
    if (roleZone) roleZone.textContent = role;

    actualiserBadge({ ...profile, uid: user.uid });
});
