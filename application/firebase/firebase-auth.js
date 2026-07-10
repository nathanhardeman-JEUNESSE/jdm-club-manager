import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    sendEmailVerification,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { auth } from "./firebase.js";

export function creerCompteEmail(email, motDePasse) {
    return createUserWithEmailAndPassword(auth, email, motDePasse);
}

export function connexionEmail(email, motDePasse) {
    return signInWithEmailAndPassword(auth, email, motDePasse);
}

export function deconnexion() {
    return signOut(auth);
}

export function envoyerResetMotDePasse(email) {
    return sendPasswordResetEmail(auth, email);
}

export function envoyerVerificationEmail(user) {
    return sendEmailVerification(user);
}

export function observerConnexion(callback) {
    return onAuthStateChanged(auth, callback);
}

export function utilisateurActuel() {
    return auth.currentUser;
}
