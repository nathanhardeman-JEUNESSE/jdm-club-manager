import { observerConnexion, deconnexion } from "../firebase/firebase-auth.js";

import {
    ensureUserProfile,
    enregistrerConsentementRGPD
} from "../firebase/firebase-db.js";

import { routeForRole } from "./session.js";

const caseInformation = document.getElementById("accept-information");
const caseUtilisation = document.getElementById("accept-utilisation");
const signatureInput = document.getElementById("signature-nom");
const boutonValider = document.getElementById("valider-consentement");
const messageZone = document.getElementById("consentement-message");

let utilisateurConnecte = null;
let profilConnecte = null;

function message(texte, type = "") {
    if (!messageZone) return;
    messageZone.textContent = texte;
    messageZone.className = type;
}

observerConnexion(async (user) => {
    if (!user) {
        window.location.href = "connexion.html";
        return;
    }

    try {
        utilisateurConnecte = user;
        profilConnecte = await ensureUserProfile(user);

        signatureInput.value = [
            profilConnecte.prenom || "",
            profilConnecte.nom || ""
        ].join(" ").trim();
    } catch (error) {
        console.error(error);
        await deconnexion().catch(() => {});
        window.location.href = "connexion.html";
    }
});

boutonValider.addEventListener("click", async () => {
    if (!utilisateurConnecte || !profilConnecte) {
        message("Session utilisateur indisponible.", "error");
        return;
    }

    if (!caseInformation.checked || !caseUtilisation.checked) {
        message("Merci de cocher les deux confirmations.", "error");
        return;
    }

    const signatureNom = signatureInput.value.trim();

    if (signatureNom.length < 3) {
        message("Merci d'indiquer votre nom et votre prénom.", "error");
        return;
    }

    try {
        boutonValider.disabled = true;
        message("Enregistrement en cours...", "info");

        await enregistrerConsentementRGPD(
            utilisateurConnecte.uid,
            signatureNom
        );

        message("Consentement enregistré.", "success");
        window.location.href = routeForRole(profilConnecte.role);
    } catch (error) {
        console.error(error);
        boutonValider.disabled = false;
        message(error.message || "Enregistrement impossible.", "error");
    }
});
