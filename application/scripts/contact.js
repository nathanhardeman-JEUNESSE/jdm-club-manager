const contenuSite = JSON.parse(localStorage.getItem("contenuSiteJDM")) || {};

const club = contenuSite.club || {};
const contact = contenuSite.contact || {};

function texte(id, valeur, defaut = "Non renseigné") {
    const element = document.getElementById(id);
    if (element) element.textContent = valeur || defaut;
}

function lien(id, valeur) {
    const element = document.getElementById(id);
    if (element) element.href = valeur || "#";
}

texte("contact-introduction", contact.introduction || "Retrouvez ici les informations utiles pour contacter le club.");
texte("contact-adresse", contact.adresse || club.adresse || "Adresse non renseignée");
texte("contact-telephone", contact.telephone || club.telephone || "Non renseigné");
texte("contact-email", contact.email || club.email || "Non renseigné");
texte("contact-horaires", contact.horaires || club.horaires || "Horaires non renseignés");
texte("contact-responsables", contact.responsables || "Contacts non renseignés");

lien("contact-facebook", club.facebook);
lien("contact-instagram", club.instagram);
lien("contact-tiktok", club.tiktok);
