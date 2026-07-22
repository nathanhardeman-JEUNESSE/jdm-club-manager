import {
    collection,
    doc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "../firebase/firebase.js";
import { listAdherents, listUsers } from "../firebase/firebase-db.js";

let contenuSite = {};
let club = {};
let equipe = [];

function texte(id, valeur, defaut = "") {
    const element = document.getElementById(id);
    if (element) element.textContent = valeur || defaut;
}

function lien(id, valeur) {
    const element = document.getElementById(id);
    if (!element) return;
    element.href = valeur || "#";
    element.hidden = !valeur;
}

function echapper(valeur) {
    return String(valeur || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function initiales(personne) {
    return `${String(personne.prenom || "").charAt(0)}${String(personne.nom || "").charAt(0)}`.toUpperCase() || "JDM";
}

function cartePersonne(personne) {
    const missions = String(personne.missions || "").split("\n").map(item => item.trim()).filter(Boolean);
    const photo = personne.photo
        ? `<img src="${echapper(personne.photo)}" alt="Photo de ${echapper(`${personne.prenom || ""} ${personne.nom || ""}`.trim())}">`
        : `<span>${echapper(initiales(personne))}</span>`;

    return `<article class="club-personne">
        <div class="club-personne-photo">${photo}</div>
        <h3>${echapper(`${personne.prenom || ""} ${personne.nom || ""}`.trim())}</h3>
        <p class="club-personne-fonction">${echapper(personne.fonction || personne.discipline || "")}</p>
        ${missions.length ? `<ul>${missions.map(mission => `<li>${echapper(mission)}</li>`).join("")}</ul>` : ""}
    </article>`;
}

function afficherEquipe(id, sectionId, type) {
    const conteneur = document.getElementById(id);
    const section = document.getElementById(sectionId);
    if (!conteneur || !section) return;

    const visibles = equipe
        .filter(personne => personne.type === type && personne.visible !== false)
        .sort((a, b) => Number(a.ordre || 0) - Number(b.ordre || 0));

    section.hidden = visibles.length === 0;
    conteneur.innerHTML = visibles.map(cartePersonne).join("");
}

function afficherContenu() {
    club = contenuSite.club || {};
    texte("club-titre", club.titre, "La Jeunesse du Marais");
    texte("club-presentation", club.presentation, "Association sportive dédiée à la pratique de la gymnastique.");
    texte("club-histoire", club.histoire);
    texte("club-valeurs", club.valeurs);
    texte("club-disciplines", club.disciplines);
    texte("club-installations", club.installations);
    texte("club-adresse", club.adresse);
    texte("club-telephone", club.telephone);
    texte("club-email", club.email);
    texte("club-horaires", club.horaires);
    texte("stat-benevoles", club.nombreBenevoles || "0");
    texte("stat-saison", club.saison || "—");
    lien("lien-facebook", club.facebook);
    lien("lien-instagram", club.instagram);
    lien("lien-tiktok", club.tiktok);
    afficherEquipe("trombinoscope-bureau", "section-bureau", "bureau");
    afficherEquipe("trombinoscope-coachs", "section-coachs", "coachs");
}

async function chargerStatistiques() {
    try {
        const [adherents, utilisateurs] = await Promise.all([listAdherents(), listUsers()]);
        texte("stat-adherents", adherents.length);
        const coachsUtilisateurs = utilisateurs.filter(utilisateur => {
            const roles = Array.isArray(utilisateur.roles) ? utilisateur.roles : [utilisateur.role];
            return roles.includes("coach");
        });
        const coachsTrombi = equipe.filter(personne => personne.type === "coachs" && personne.visible !== false).length;
        texte("stat-coachs", coachsUtilisateurs.length || coachsTrombi);
    } catch (erreur) {
        console.error("Impossible de charger les statistiques du club", erreur);
        texte("stat-adherents", "—");
        texte("stat-coachs", equipe.filter(personne => personne.type === "coachs" && personne.visible !== false).length || "—");
    }
}

onSnapshot(doc(db, "siteContent", "main"), snapshot => {
    if (snapshot.exists()) {
        contenuSite = snapshot.data();
    } else {
        contenuSite = JSON.parse(localStorage.getItem("contenuSiteJDM") || "{}");
    }
    afficherContenu();
    chargerStatistiques();
}, erreur => {
    console.error("Impossible de synchroniser le contenu Mon Club", erreur);
    contenuSite = JSON.parse(localStorage.getItem("contenuSiteJDM") || "{}");
    afficherContenu();
    chargerStatistiques();
});

onSnapshot(collection(db, "siteTeam"), snapshot => {
    equipe = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    afficherContenu();
    chargerStatistiques();
}, erreur => {
    console.error("Impossible de synchroniser le trombinoscope", erreur);
});
