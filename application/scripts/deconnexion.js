import { utilisateurActuel } from "../firebase/firebase-auth.js";
import { updateUserPresence } from "../firebase/firebase-db.js";
import { logoutAndRedirect } from "./session.js";

const bouton = document.getElementById("deconnexion-button");

async function deconnecter() {
    const user = utilisateurActuel();

    if (user) {
        try {
            await updateUserPresence(user.uid, false);
        } catch (error) {
            console.warn("Statut hors ligne non mis à jour", error);
        }
    }

    await logoutAndRedirect();
}

if (bouton) {
    bouton.addEventListener("click", deconnecter);
}
