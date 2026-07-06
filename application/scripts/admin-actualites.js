let actualites = JSON.parse(localStorage.getItem("actualitesJDM")) || {
    accueil: "Les inscriptions pour la saison sont ouvertes.",
    detail: "Retrouvez prochainement ici toutes les informations importantes du club."
};

const champAccueil = document.getElementById("actualite-accueil-admin");
const champDetail = document.getElementById("actualite-detail-admin");
const boutonEnregistrer = document.getElementById("enregistrer-actualites");

champAccueil.value = actualites.accueil || "";
champDetail.value = actualites.detail || "";

boutonEnregistrer.addEventListener("click", () => {
    actualites = {
        accueil: champAccueil.value.trim(),
        detail: champDetail.value.trim()
    };

    localStorage.setItem("actualitesJDM", JSON.stringify(actualites));

    alert("Actualités enregistrées ✅");
});