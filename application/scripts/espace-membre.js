import { watchSession } from "./session.js";
import { findAdherentByEmail } from "../firebase/firebase-db.js";

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

const zoneProfilMembre = document.getElementById("profil-membre-connecte");
const zoneDocumentsMembre = document.getElementById("documents-membre");

function afficherProfil(profile, adherent) {
    if (!zoneProfilMembre) return;

    const nom = profile.nom || (adherent ? adherent.nom : "") || "";
    const prenom = profile.prenom || (adherent ? adherent.prenom : "") || "";
    const numero = profile.numeroAdherent || (adherent ? adherent.numeroAdherent : "") || "Non renseigné";
    const groupe = (adherent ? adherent.groupe : "") || profile.groupe || "Non renseigné";
    const role = profile.role || "membre";

    zoneProfilMembre.innerHTML = `
        <p><strong>Nom :</strong> ${nom || "Non renseigné"}</p>
        <p><strong>Prénom :</strong> ${prenom || "Non renseigné"}</p>
        <p><strong>Email :</strong> ${profile.email || "Non renseigné"}</p>
        <p><strong>N° adhérent :</strong> ${numero}</p>
        <p><strong>Groupe :</strong> ${groupe}</p>
        <p><strong>Rôle :</strong> ${role}</p>
    `;
}

function afficherDocuments(adherent) {
    if (!zoneDocumentsMembre) return;

    if (!adherent) {
        zoneDocumentsMembre.innerHTML = `<p><small>Documents liés à votre fiche adhérent disponibles prochainement.</small></p>`;
        return;
    }

    const numero = adherent.numeroAdherent || "";
    const liens = [];

    if (numero) {
        liens.push(`<a href="fiche-adherent-complete.html?id=${encodeURIComponent(numero)}">Fiche adhérent complète</a>`);
        liens.push(`<a href="carte-adherent.html?id=${encodeURIComponent(numero)}">Carte adhérent</a>`);
    }

    if (adherent.certificatMedical) {
        liens.push(`<a href="${adherent.certificatMedical}" target="_blank" rel="noopener noreferrer">Certificat médical</a>`);
    }

    if (adherent.photoLicence) {
        liens.push(`<a href="${adherent.photoLicence}" target="_blank" rel="noopener noreferrer">Photo licence</a>`);
    }

    if (liens.length === 0) {
        zoneDocumentsMembre.innerHTML = `<p><small>Aucun document disponible pour le moment.</small></p>`;
        return;
    }

    zoneDocumentsMembre.innerHTML = `
        <ul>
            ${liens.map(lien => `<li>${lien}</li>`).join("")}
        </ul>
    `;
}

watchSession(async (user, profile) => {
    if (!user || !profile) return;

    let adherent = null;

    try {
        adherent = await findAdherentByEmail(profile.email || user.email);
    } catch (error) {
        console.warn("Fiche adhérent non trouvée", error);
    }

    afficherProfil(profile, adherent);
    afficherDocuments(adherent);
});
