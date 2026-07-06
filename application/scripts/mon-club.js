const contenuSite = JSON.parse(localStorage.getItem("contenuSiteJDM")) || {
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
    }
};

const club = contenuSite.club || {};

function remplirTexte(id, valeur, defaut = "") {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = valeur || defaut;
    }
}

function remplirLien(id, valeur) {
    const element = document.getElementById(id);

    if (element) {
        element.href = valeur || "#";
    }
}

remplirTexte("club-titre", club.titre, "La Jeunesse du Marais");
remplirTexte("club-presentation", club.presentation);
remplirTexte("club-histoire", club.histoire);
remplirTexte("club-valeurs", club.valeurs);
remplirTexte("club-disciplines", club.disciplines);
remplirTexte("club-installations", club.installations);
remplirTexte("club-adresse", club.adresse);
remplirTexte("club-telephone", club.telephone);
remplirTexte("club-email", club.email);
remplirTexte("club-horaires", club.horaires);

remplirLien("club-facebook", club.facebook);
remplirLien("club-instagram", club.instagram);
remplirLien("club-tiktok", club.tiktok);