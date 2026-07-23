import {
    collection,
    doc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "../firebase/firebase.js";

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

function chargerStatistiques() {
    // Cette page est publique : elle ne doit jamais lister les collections
    // privées "adherents" et "users". Les compteurs publics sont saisis
    // dans Contenu du site ; le nombre de coachs peut être déduit du trombinoscope.
    const nombreAdherents = club.nombreAdherents ?? club.adherents ?? "—";
    const nombreCoachsSaisi = club.nombreCoachs ?? club.coachs;
    const nombreCoachsTrombi = equipe.filter(
        personne => personne.type === "coachs" && personne.visible !== false
    ).length;

    texte("stat-adherents", nombreAdherents);
    texte(
        "stat-coachs",
        nombreCoachsSaisi ?? (nombreCoachsTrombi || "—")
    );
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
