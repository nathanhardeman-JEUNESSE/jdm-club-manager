let contenuSite = JSON.parse(localStorage.getItem("contenuSiteJDM")) || {
    accueil: {
        actualite: "Les inscriptions pour la saison sont ouvertes."
    },
    actualites: {
        detail: "Retrouvez prochainement ici toutes les informations importantes du club."
    },
    club: {
        titre: "La Jeunesse du Marais",
        presentation: "Association sportive dédiée à la pratique de la gymnastique.",
        histoire: "Le club accompagne les gymnastes dans un cadre familial, sportif et associatif.",
        valeurs: "Respect, engagement, esprit d'équipe, progression et plaisir de pratiquer.",
        disciplines: "Baby Gym, loisirs, compétition, gymnastique artistique.",
        installations: "Les entraînements se déroulent dans les installations sportives de Lomme.",
        adresse: "Lomme",
        telephone: "",
        email: "",
        horaires: "",
        facebook: "https://www.facebook.com/groups/255772491691570/?ref=share",
        instagram: "https://www.instagram.com/jeunesse.du.marais",
        tiktok: "https://www.tiktok.com/@jeunesse.du.marais"
    },
    contact: {
        introduction: "Retrouvez ici les informations utiles pour contacter le club.",
        adresse: "",
        telephone: "",
        email: "",
        horaires: "",
        responsables: ""
    }
};

function valeur(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
}

function remplir(id, valeur) {
    const element = document.getElementById(id);
    if (element) element.value = valeur || "";
}

function completerStructure() {
    contenuSite.accueil = contenuSite.accueil || {};
    contenuSite.actualites = contenuSite.actualites || {};
    contenuSite.club = contenuSite.club || {};
    contenuSite.contact = contenuSite.contact || {};
}

function chargerFormulaire() {
    completerStructure();

    remplir("contenu-actualite-accueil", contenuSite.accueil.actualite);
    remplir("contenu-actualite-detail", contenuSite.actualites.detail);

    remplir("contenu-club-titre", contenuSite.club.titre);
    remplir("contenu-club-presentation", contenuSite.club.presentation);
    remplir("contenu-club-histoire", contenuSite.club.histoire);
    remplir("contenu-club-valeurs", contenuSite.club.valeurs);
    remplir("contenu-club-disciplines", contenuSite.club.disciplines);
    remplir("contenu-club-installations", contenuSite.club.installations);

    remplir("contenu-club-adresse", contenuSite.club.adresse);
    remplir("contenu-club-telephone", contenuSite.club.telephone);
    remplir("contenu-club-email", contenuSite.club.email);
    remplir("contenu-club-horaires", contenuSite.club.horaires);

    remplir("contenu-contact-introduction", contenuSite.contact.introduction);
    remplir("contenu-contact-adresse", contenuSite.contact.adresse || contenuSite.club.adresse);
    remplir("contenu-contact-telephone", contenuSite.contact.telephone || contenuSite.club.telephone);
    remplir("contenu-contact-email", contenuSite.contact.email || contenuSite.club.email);
    remplir("contenu-contact-horaires", contenuSite.contact.horaires || contenuSite.club.horaires);
    remplir("contenu-contact-responsables", contenuSite.contact.responsables);

    remplir("contenu-club-facebook", contenuSite.club.facebook);
    remplir("contenu-club-instagram", contenuSite.club.instagram);
    remplir("contenu-club-tiktok", contenuSite.club.tiktok);

    const documents = contenuSite.documents || [];

for (let i = 1; i <= 3; i++) {
    const documentClub = documents[i - 1] || {};

    remplir(`document-${i}-titre`, documentClub.titre || "");
    remplir(`document-${i}-description`, documentClub.description || "");
    remplir(`document-${i}-lien`, documentClub.lien || "");
}
}

function enregistrerContenu() {
    contenuSite = {
        accueil: {
            actualite: valeur("contenu-actualite-accueil")
        },
        actualites: {
            detail: valeur("contenu-actualite-detail")
        },
        club: {
            titre: valeur("contenu-club-titre"),
            presentation: valeur("contenu-club-presentation"),
            histoire: valeur("contenu-club-histoire"),
            valeurs: valeur("contenu-club-valeurs"),
            disciplines: valeur("contenu-club-disciplines"),
            installations: valeur("contenu-club-installations"),
            adresse: valeur("contenu-club-adresse"),
            telephone: valeur("contenu-club-telephone"),
            email: valeur("contenu-club-email"),
            horaires: valeur("contenu-club-horaires"),
            facebook: valeur("contenu-club-facebook"),
            instagram: valeur("contenu-club-instagram"),
            tiktok: valeur("contenu-club-tiktok")
        },
         contact: {
            introduction: valeur("contenu-contact-introduction"),
            adresse: valeur("contenu-contact-adresse"),
            telephone: valeur("contenu-contact-telephone"),
            email: valeur("contenu-contact-email"),
            horaires: valeur("contenu-contact-horaires"),
            responsables: valeur("contenu-contact-responsables")
        },

        documents: [1, 2, 3].map(i => ({
            titre: valeur(`document-${i}-titre`),
            description: valeur(`document-${i}-description`),
            lien: valeur(`document-${i}-lien`)
        })).filter(documentClub =>
            documentClub.titre ||
            documentClub.description ||
            documentClub.lien
        )
    
    };

    localStorage.setItem("contenuSiteJDM", JSON.stringify(contenuSite));
    alert("Contenu du site enregistré ✅");
}

const bouton = document.getElementById("enregistrer-contenu-site");
if (bouton) bouton.addEventListener("click", enregistrerContenu);

chargerFormulaire();
