import {
    connexionEmail,
    envoyerResetMotDePasse,
    creerCompteEmail,
    envoyerVerificationEmail
} from "../firebase/firebase-auth.js";

import { ensureUserProfile, initAppSettings, updateUserPresence } from "../firebase/firebase-db.js";
import { routeForRole } from "./session.js";

const emailInput = document.getElementById("connexion-email");
const passwordInput = document.getElementById("connexion-password");
const boutonConnexion = document.getElementById("connexion-button");
const boutonCreation = document.getElementById("creation-button");
const boutonReset = document.getElementById("reset-password-button");
const messageZone = document.getElementById("connexion-message");

function message(texte, type = "") {
    if (!messageZone) return;
    messageZone.textContent = texte;
    messageZone.className = type;
}

function messageErreurFirebase(error) {
    const code = error && error.code ? error.code : "";

    if (code.includes("auth/email-already-in-use")) {
        return "Ce compte existe déjà. Utilise le bouton Se connecter.";
    }

    if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) {
        return "Email ou mot de passe incorrect.";
    }

    if (code.includes("auth/user-not-found")) {
        return "Compte introuvable. Utilise Première connexion pour créer ton compte.";
    }

    if (code.includes("permission-denied")) {
        return "Connexion OK, mais Firestore refuse l'accès. Il faut mettre les règles de démarrage.";
    }

    return "Erreur : " + (error.message || "action impossible");
}

async function entrerDansApplication(user) {
    const profile = await ensureUserProfile(user);
    await updateUserPresence(user.uid, true);
    await initAppSettings();
    window.location.href = routeForRole(profile.role);
}

if (boutonConnexion) {
    boutonConnexion.addEventListener("click", async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            message("Merci d'indiquer votre email et votre mot de passe.", "error");
            return;
        }

        try {
            message("Connexion en cours...", "info");
            const result = await connexionEmail(email, password);
            await entrerDansApplication(result.user);
        } catch (error) {
            console.error(error);
            message(messageErreurFirebase(error), "error");
        }
    });
}

if (boutonCreation) {
    boutonCreation.addEventListener("click", async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            message("Merci d'indiquer votre email et un mot de passe.", "error");
            return;
        }

        if (password.length < 6) {
            message("Le mot de passe doit contenir au moins 6 caractères.", "error");
            return;
        }

        try {
            message("Création du compte...", "info");
            const result = await creerCompteEmail(email, password);

            try {
                await envoyerVerificationEmail(result.user);
            } catch (erreurVerification) {
                console.warn("Email de vérification non envoyé :", erreurVerification);
            }

            await entrerDansApplication(result.user);
        } catch (error) {
            console.error(error);
            message(messageErreurFirebase(error), "error");
        }
    });
}

if (boutonReset) {
    boutonReset.addEventListener("click", async () => {
        const email = emailInput.value.trim();

        if (!email) {
            message("Indiquez votre email pour recevoir un lien de réinitialisation.", "error");
            return;
        }

        try {
            await envoyerResetMotDePasse(email);
            message("Email de réinitialisation envoyé.", "success");
        } catch (error) {
            console.error(error);
            message(messageErreurFirebase(error), "error");
        }
    });
}
