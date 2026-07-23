import {
    collection,
    doc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "../firebase/firebase.js";

let contenuSite = {};
let club = {};
let equipe = [];

function valeurTexte(valeur, defaut = "") {
    if (valeur === null || valeur === undefined || valeur === "") return defaut;

    if (Array.isArray(valeur)) {
        return valeur
            .map(item => valeurTexte(item))
            .filter(Boolean)
            .join(" · ");
    }

    if (typeof valeur === "object") {
        const champsPrioritaires = [
            "nom",
            "titre",
            "libelle",
            "label",
            "valeur",
            "value",
            "discipline",
            "fonction",
            "texte"
        ];

        for (const champ of champsPrioritaires) {
            const resultat = valeurTexte(valeur[champ]);
            if (resultat) return resultat;
        }

        return Object.values(valeur)
            .map(item => valeurTexte(item))
            .filter(Boolean)
            .join(" · ") || defaut;
    }

    return String(valeur).trim() || defaut;
}

function texte(id, valeur, defaut = "") {
    const element = document.getElementById(id);
    if (element) element.textContent = valeurTexte(valeur, defaut);
}

function lien(id, valeur) {
    const element = document.getElementById(id);
    if (!element) return;

    const url = valeurTexte(valeur);
    element.href = url || "#";
    element.hidden = !url;
}

function echapper(valeur) {
    return valeurTexte(valeur)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normaliser(valeur) {
    return valeurTexte(valeur)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function typePersonne(personne = {}) {
    const type = normaliser(personne.type);
    if (type === "coach" || type === "coachs" || type === "entraineur" || type === "entraineurs") {
        return "coachs";
    }
    return type;
}

function clePersonne(personne = {}) {
    const identifiant = normaliser(
        personne.uid || personne.userId || personne.email || personne.idAdherent
    );
    if (identifiant) return `id:${identifiant}`;

    const prenom = normaliser(personne.prenom);
    const nom = normaliser(personne.nom);
    return prenom || nom ? `nom:${prenom}|${nom}` : "";
}

function personnesUniques(types) {
    const typesAcceptes = new Set(types);
    const personnes = new Map();

    equipe.forEach(personne => {
        if (personne.visible === false || !typesAcceptes.has(typePersonne(personne))) return;

        const cle = clePersonne(personne);
        if (cle && !personnes.has(cle)) personnes.set(cle, personne);
    });

    return [...personnes.values()];
}

function compterBenevoles() {
    return personnesUniques(["bureau", "coachs"]).length;
}

function compterCoachs() {
    return personnesUniques(["coachs"]).length;
}

function initiales(personne) {
    const prenom = valeurTexte(personne.prenom);
    const nom = valeurTexte(personne.nom);
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || "JDM";
}

function listeMissions(valeur) {
    if (Array.isArray(valeur)) {
        return valeur.map(item => valeurTexte(item)).filter(Boolean);
    }

    if (valeur && typeof valeur === "object") {
        return Object.values(valeur).map(item => valeurTexte(item)).filter(Boolean);
    }

    return valeurTexte(valeur)
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);
}

function cartePersonne(personne) {
    const missions = listeMissions(personne.missions);
    const nomComplet = `${valeurTexte(personne.prenom)} ${valeurTexte(personne.nom)}`.trim();
    const fonction = valeurTexte(personne.fonction || personne.discipline);
    const photoUrl = valeurTexte(personne.photo);
    const photo = photoUrl
        ? `<img src="${echapper(photoUrl)}" alt="Photo de ${echapper(nomComplet)}">`
        : `<span>${echapper(initiales(personne))}</span>`;

    return `<article class="club-personne">
        <div class="club-personne-photo">${photo}</div>
        <h3>${echapper(nomComplet || "Membre du club")}</h3>
        ${fonction ? `<p class="club-personne-fonction">${echapper(fonction)}</p>` : ""}
        ${missions.length ? `<ul>${missions.map(mission => `<li>${echapper(mission)}</li>`).join("")}</ul>` : ""}
    </article>`;
}

function afficherEquipe(id, sectionId, type) {
    const conteneur = document.getElementById(id);
    const section = document.getElementById(sectionId);
    if (!conteneur || !section) return;

    const visibles = equipe
        .filter(personne => typePersonne(personne) === type && personne.visible !== false)
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
    texte("stat-benevoles", compterBenevoles());
    texte("stat-saison", club.saison, "—");
    lien("lien-facebook", club.facebook);
    lien("lien-instagram", club.instagram);
    lien("lien-tiktok", club.tiktok);
    afficherEquipe("trombinoscope-bureau", "section-bureau", "bureau");
    afficherEquipe("trombinoscope-coachs", "section-coachs", "coachs");
}

function valeurCompteur(valeur, defaut = "—") {
    if (typeof valeur === "number" && Number.isFinite(valeur)) return valeur;

    const texteValeur = valeurTexte(valeur);
    if (!texteValeur) return defaut;

    const nombre = Number(texteValeur.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(nombre) ? nombre : texteValeur;
}

function chargerStatistiques() {
    // La page Mon Club est publique : le nombre d'adhérents reste une donnée
    // publique saisie dans le contenu du site. Les coachs et bénévoles sont
    // calculés automatiquement à partir du trombinoscope visible.
    const nombreAdherents = club.nombreAdherents ?? club.adherents;

    texte("stat-adherents", valeurCompteur(nombreAdherents));
    texte("stat-coachs", compterCoachs() || "—");
    texte("stat-benevoles", compterBenevoles());
}

function contenuLocal() {
    try {
        return JSON.parse(localStorage.getItem("contenuSiteJDM") || "{}");
    } catch (erreur) {
        console.warn("Contenu local Mon Club invalide", erreur);
        return {};
    }
}

onSnapshot(doc(db, "siteContent", "main"), snapshot => {
    contenuSite = snapshot.exists() ? snapshot.data() : contenuLocal();
    afficherContenu();
    chargerStatistiques();
}, erreur => {
    console.error("Impossible de synchroniser le contenu Mon Club", erreur);
    contenuSite = contenuLocal();
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
