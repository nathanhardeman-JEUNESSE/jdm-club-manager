const contenuSite = JSON.parse(localStorage.getItem("contenuSiteJDM")) || {
    actualites: {
        detail: "Retrouvez prochainement ici toutes les informations importantes du club."
    }
};

const zoneDetail = document.getElementById("actualite-detaillee-public");

if (zoneDetail) {
    zoneDetail.textContent = contenuSite.actualites?.detail || "Aucune actualité pour le moment.";
}