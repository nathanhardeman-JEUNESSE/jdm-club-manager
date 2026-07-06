const contenuSite = JSON.parse(localStorage.getItem("contenuSiteJDM")) || {
    accueil: {
        actualite: "Les inscriptions pour la saison sont ouvertes."
    },
    actualites: {
        detail: "Retrouvez prochainement ici toutes les informations importantes du club."
    },
    club: {
        facebook: "https://www.facebook.com/groups/255772491691570/?ref=share",
        instagram: "https://www.instagram.com/jeunesse.du.marais",
        tiktok: "https://www.tiktok.com/@jeunesse.du.marais"
    }
};

const zoneActualite = document.getElementById("actualite-accueil-public");
const lienFacebook = document.getElementById("lien-facebook");
const lienInstagram = document.getElementById("lien-instagram");
const lienTiktok = document.getElementById("lien-tiktok");

if (zoneActualite) {
    zoneActualite.textContent = contenuSite.accueil?.actualite || "Aucune actualité pour le moment.";
}

if (lienFacebook) {
    lienFacebook.href = contenuSite.club?.facebook || "#";
}

if (lienInstagram) {
    lienInstagram.href = contenuSite.club?.instagram || "#";
}

if (lienTiktok) {
    lienTiktok.href = contenuSite.club?.tiktok || "#";
}