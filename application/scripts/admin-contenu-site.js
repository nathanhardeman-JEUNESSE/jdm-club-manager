import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { auth, db, firebaseConfig } from "./firebase.js";

const CONTENU_REF = doc(db, "siteContent", "main");
const EQUIPE_COLLECTION = "siteTeam";

function messageErreurFirestore(erreur, action = "opération") {
    const code = erreur?.code || "erreur-inconnue";
    const message = erreur?.message || String(erreur || "Erreur inconnue");
    const utilisateur = auth.currentUser;
    return [
        `Échec de l’${action}.`,
        `Code Firebase : ${code}`,
        `Message : ${message}`,
        `Projet : ${firebaseConfig?.projectId || "inconnu"}`,
        `Compte : ${utilisateur?.email || "non connecté"}`,
        `UID : ${utilisateur?.uid || "absent"}`
    ].join("\n");
}

function afficherErreurFirestore(erreur, action) {
    const detail = messageErreurFirestore(erreur, action);
    console.error(detail, erreur);
    alert(detail);
}

let contenuSite = {};
let bureau = [];
let coachs = [];

const valeursParDefaut = {
    accueil: { actualite: "Les inscriptions pour la saison sont ouvertes." },
    actualites: { detail: "Retrouvez prochainement ici toutes les informations importantes du club." },
    club: {
        titre: "La Jeunesse du Marais",
        presentation: "Association sportive dédiée à la pratique de la gymnastique.",
        histoire: "Le club accompagne les gymnastes dans un cadre familial, sportif et associatif.",
        valeurs: "Respect, engagement, esprit d'équipe, progression et plaisir de pratiquer.",
        disciplines: "Baby Gym, loisirs, compétition, gymnastique artistique.",
        installations: "Les entraînements se déroulent dans les installations sportives de Lomme.",
        adresse: "Lomme", telephone: "", email: "", horaires: "",
        facebook: "https://www.facebook.com/groups/255772491691570/?ref=share",
        instagram: "https://www.instagram.com/jeunesse.du.marais",
        tiktok: "https://www.tiktok.com/@jeunesse.du.marais",
        saison: "2026-2027", nombreBenevoles: 0
    },
    contact: { introduction: "Retrouvez ici les informations utiles pour contacter le club.", adresse: "", telephone: "", email: "", horaires: "", responsables: "" },
    documents: []
};

function valeur(id) { const e = document.getElementById(id); return e ? e.value.trim() : ""; }
function remplir(id, v) { const e = document.getElementById(id); if (e) e.value = v ?? ""; }
function idPersonne() { return `personne-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function nouvellePersonne(type) { return { id: idPersonne(), type, prenom: "", nom: "", fonction: "", missions: "", photo: "", ordre: 0, visible: true }; }
function echapper(v) { return String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

function structure() {
    contenuSite.accueil = { ...valeursParDefaut.accueil, ...(contenuSite.accueil || {}) };
    contenuSite.actualites = { ...valeursParDefaut.actualites, ...(contenuSite.actualites || {}) };
    contenuSite.club = { ...valeursParDefaut.club, ...(contenuSite.club || {}) };
    contenuSite.contact = { ...valeursParDefaut.contact, ...(contenuSite.contact || {}) };
    contenuSite.documents = Array.isArray(contenuSite.documents) ? contenuSite.documents : [];
}

function carteEdition(personne, type, index) {
    const libelle = type === "bureau" ? "Fonction" : "Discipline / fonction";
    return `<article class="club-admin-personne" data-type="${type}" data-index="${index}" data-id="${echapper(personne.id)}">
        <div class="club-admin-photo-preview">${personne.photo ? `<img src="${echapper(personne.photo)}" alt="">` : "Photo"}</div>
        <div class="club-admin-fields">
            <div class="club-admin-grid">
                <input class="form-input personne-prenom" value="${echapper(personne.prenom)}" placeholder="Prénom">
                <input class="form-input personne-nom" value="${echapper(personne.nom)}" placeholder="Nom">
            </div>
            <input class="form-input personne-fonction" value="${echapper(personne.fonction)}" placeholder="${libelle}">
            <textarea class="form-input personne-missions" placeholder="Missions, une par ligne">${echapper(personne.missions)}</textarea>
            <div class="club-admin-grid">
                <input class="form-input personne-ordre" type="number" value="${Number(personne.ordre || 0)}" placeholder="Ordre">
                <label class="club-visible"><input class="personne-visible" type="checkbox" ${personne.visible !== false ? "checked" : ""}> Visible</label>
            </div>
            <input class="form-input personne-photo" type="file" accept="image/*">
            <div class="club-admin-grid">
                <button type="button" class="primary-button enregistrer-personne">Enregistrer</button>
                <button type="button" class="danger-button supprimer-personne">Supprimer</button>
            </div>
        </div>
    </article>`;
}

function rendreListes() {
    document.getElementById("liste-bureau").innerHTML = bureau.map((p, i) => carteEdition(p, "bureau", i)).join("");
    document.getElementById("liste-coachs").innerHTML = coachs.map((p, i) => carteEdition(p, "coachs", i)).join("");
}

function lireCarte(carte) {
    const liste = carte.dataset.type === "bureau" ? bureau : coachs;
    const ancienne = liste[Number(carte.dataset.index)] || {};
    return {
        ...ancienne,
        id: carte.dataset.id || ancienne.id || idPersonne(),
        type: carte.dataset.type,
        prenom: carte.querySelector(".personne-prenom").value.trim(),
        nom: carte.querySelector(".personne-nom").value.trim(),
        fonction: carte.querySelector(".personne-fonction").value.trim(),
        missions: carte.querySelector(".personne-missions").value.trim(),
        ordre: Number(carte.querySelector(".personne-ordre").value || 0),
        visible: carte.querySelector(".personne-visible").checked
    };
}

function synchroniserListes() {
    document.querySelectorAll(".club-admin-personne").forEach(carte => {
        const liste = carte.dataset.type === "bureau" ? bureau : coachs;
        liste[Number(carte.dataset.index)] = lireCarte(carte);
    });
}

function reduirePhoto(fichier) {
    return new Promise((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onerror = reject;
        lecteur.onload = () => {
            const image = new Image();
            image.onerror = reject;
            image.onload = () => {
                const taille = 420;
                const ratio = Math.min(1, taille / Math.max(image.width, image.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(image.width * ratio);
                canvas.height = Math.round(image.height * ratio);
                canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.72));
            };
            image.src = lecteur.result;
        };
        lecteur.readAsDataURL(fichier);
    });
}

async function chargerDonnees() {
    const [contenuSnap, equipeSnap] = await Promise.all([
        getDoc(CONTENU_REF),
        getDocs(collection(db, EQUIPE_COLLECTION))
    ]);

    if (contenuSnap.exists()) {
        contenuSite = contenuSnap.data();
    } else {
        const local = JSON.parse(localStorage.getItem("contenuSiteJDM") || "null");
        contenuSite = local || {};
    }

    const equipeDistante = equipeSnap.docs.map(item => ({ id: item.id, ...item.data() }));
    if (equipeDistante.length) {
        bureau = equipeDistante.filter(p => p.type === "bureau");
        coachs = equipeDistante.filter(p => p.type === "coachs");
    } else {
        const clubLocal = contenuSite.club || {};
        bureau = (Array.isArray(clubLocal.bureau) ? clubLocal.bureau : []).map(p => ({ ...p, id: p.id || idPersonne(), type: "bureau" }));
        coachs = (Array.isArray(clubLocal.coachs) ? clubLocal.coachs : []).map(p => ({ ...p, id: p.id || idPersonne(), type: "coachs" }));
    }

    structure();
    chargerFormulaire();
}

function chargerFormulaire() {
    const c = contenuSite.club;
    remplir("contenu-actualite-accueil", contenuSite.accueil.actualite);
    remplir("contenu-actualite-detail", contenuSite.actualites.detail);
    ["titre","presentation","histoire","valeurs","disciplines","installations","adresse","telephone","email","horaires","facebook","instagram","tiktok"].forEach(champ => remplir(`contenu-club-${champ}`, c[champ]));
    remplir("contenu-club-saison", c.saison);
    remplir("contenu-club-benevoles", c.nombreBenevoles);
    ["introduction","adresse","telephone","email","horaires","responsables"].forEach(champ => remplir(`contenu-contact-${champ}`, contenuSite.contact[champ] || c[champ]));
    for (let i = 1; i <= 3; i++) {
        const d = contenuSite.documents[i - 1] || {};
        remplir(`document-${i}-titre`, d.titre);
        remplir(`document-${i}-description`, d.description);
        remplir(`document-${i}-lien`, d.lien);
    }
    rendreListes();
}

function construireContenu() {
    const ancienClub = contenuSite.club || {};
    return {
        accueil: { actualite: valeur("contenu-actualite-accueil") },
        actualites: { detail: valeur("contenu-actualite-detail") },
        club: {
            ...ancienClub,
            titre: valeur("contenu-club-titre"), presentation: valeur("contenu-club-presentation"), histoire: valeur("contenu-club-histoire"), valeurs: valeur("contenu-club-valeurs"), disciplines: valeur("contenu-club-disciplines"), installations: valeur("contenu-club-installations"),
            adresse: valeur("contenu-club-adresse"), telephone: valeur("contenu-club-telephone"), email: valeur("contenu-club-email"), horaires: valeur("contenu-club-horaires"), facebook: valeur("contenu-club-facebook"), instagram: valeur("contenu-club-instagram"), tiktok: valeur("contenu-club-tiktok"),
            saison: valeur("contenu-club-saison"), nombreBenevoles: Number(valeur("contenu-club-benevoles") || 0)
        },
        contact: { introduction: valeur("contenu-contact-introduction"), adresse: valeur("contenu-contact-adresse"), telephone: valeur("contenu-contact-telephone"), email: valeur("contenu-contact-email"), horaires: valeur("contenu-contact-horaires"), responsables: valeur("contenu-contact-responsables") },
        documents: [1,2,3].map(i => ({ titre: valeur(`document-${i}-titre`), description: valeur(`document-${i}-description`), lien: valeur(`document-${i}-lien`) })).filter(d => d.titre || d.description || d.lien),
        updatedAt: serverTimestamp()
    };
}

async function enregistrerContenu(afficherConfirmation = true) {
    contenuSite = construireContenu();
    await setDoc(CONTENU_REF, contenuSite, { merge: true });
    const verification = await getDoc(CONTENU_REF);
    if (!verification.exists()) {
        throw new Error("L’écriture a été envoyée mais le document siteContent/main est introuvable lors de la vérification.");
    }
    localStorage.setItem("contenuSiteJDM", JSON.stringify({ ...contenuSite, updatedAt: Date.now() }));
    if (afficherConfirmation) alert("Contenu du site enregistré et vérifié dans Firestore ✅");
}

async function enregistrerPersonne(carte, bouton) {
    const personne = lireCarte(carte);
    if (!personne.prenom && !personne.nom) {
        alert("Renseigne au moins le prénom ou le nom.");
        return;
    }

    bouton.disabled = true;
    bouton.textContent = "Enregistrement…";
    const personneRef = doc(db, EQUIPE_COLLECTION, personne.id);
    await setDoc(personneRef, {
        ...personne,
        updatedAt: serverTimestamp()
    }, { merge: true });

    const verification = await getDoc(personneRef);
    if (!verification.exists()) {
        throw new Error(`La fiche ${personne.id} n’a pas été retrouvée dans Firestore après l’enregistrement.`);
    }

    const liste = personne.type === "bureau" ? bureau : coachs;
    liste[Number(carte.dataset.index)] = personne;
    bouton.textContent = "Enregistré ✓";
    window.setTimeout(() => {
        bouton.textContent = "Enregistrer";
        bouton.disabled = false;
    }, 1400);
}

document.getElementById("ajouter-bureau")?.addEventListener("click", () => { synchroniserListes(); bureau.push(nouvellePersonne("bureau")); rendreListes(); });
document.getElementById("ajouter-coach")?.addEventListener("click", () => { synchroniserListes(); coachs.push(nouvellePersonne("coachs")); rendreListes(); });

document.addEventListener("click", async event => {
    const boutonEnregistrer = event.target.closest(".enregistrer-personne");
    if (boutonEnregistrer) {
        try {
            await enregistrerPersonne(boutonEnregistrer.closest(".club-admin-personne"), boutonEnregistrer);
        } catch (erreur) {
            boutonEnregistrer.disabled = false;
            boutonEnregistrer.textContent = "Enregistrer";
            afficherErreurFirestore(erreur, "enregistrement de la personne");
        }
        return;
    }

    const boutonSupprimer = event.target.closest(".supprimer-personne");
    if (!boutonSupprimer) return;
    const carte = boutonSupprimer.closest(".club-admin-personne");
    if (!confirm("Supprimer cette personne du trombinoscope ?")) return;
    try {
        await deleteDoc(doc(db, EQUIPE_COLLECTION, carte.dataset.id));
        const liste = carte.dataset.type === "bureau" ? bureau : coachs;
        liste.splice(Number(carte.dataset.index), 1);
        rendreListes();
    } catch (erreur) {
        afficherErreurFirestore(erreur, "suppression de la personne");
    }
});

document.addEventListener("change", async event => {
    if (!event.target.matches(".personne-photo")) return;
    const fichier = event.target.files?.[0];
    if (!fichier) return;
    try {
        const carte = event.target.closest(".club-admin-personne");
        synchroniserListes();
        const liste = carte.dataset.type === "bureau" ? bureau : coachs;
        liste[Number(carte.dataset.index)].photo = await reduirePhoto(fichier);
        rendreListes();
    } catch (erreur) {
        console.error(erreur);
        alert("Impossible de préparer cette photo.");
    }
});

document.getElementById("enregistrer-contenu-site")?.addEventListener("click", async () => {
    try {
        await enregistrerContenu(true);
    } catch (erreur) {
        afficherErreurFirestore(erreur, "enregistrement du contenu du site");
    }
});

chargerDonnees().catch(erreur => {
    afficherErreurFirestore(erreur, "chargement des données partagées du site");
});
