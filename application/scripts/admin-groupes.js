let groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];

const listeGroupes = document.getElementById("liste-groupes");
const boutonAjouter = document.getElementById("ajouter-groupe");

function afficherGroupes() {
    if (groupes.length === 0) {
        listeGroupes.innerHTML = `
            <section class="card">
                <h2>Aucun groupe</h2>
                <p>Aucun groupe n'a encore été créé.</p>
            </section>
        `;
        return;
    }

    listeGroupes.innerHTML = "";

    groupes.forEach((groupe, index) => {
        listeGroupes.innerHTML += `
            <section class="card">
                <h2>${groupe.nom}</h2>

                <p><strong>Années :</strong> ${groupe.anneeMin} à ${groupe.anneeMax}</p>
                <p><strong>Effectif max :</strong> ${groupe.effectifMax || "Non limité"}</p>

                <button class="secondary-button" onclick="supprimerGroupe(${index})">
                    Supprimer
                </button>
            </section>
        `;
    });
}

boutonAjouter.addEventListener("click", () => {
    const nom = document.getElementById("nom-groupe").value.trim();
    const anneeMin = document.getElementById("annee-min").value.trim();
    const anneeMax = document.getElementById("annee-max").value.trim();
    const effectifMax = document.getElementById("effectif-max").value.trim();

    if (!nom) {
        alert("Merci d'indiquer le nom du groupe.");
        return;
    }

    groupes.push({
        id: Date.now(),
        nom,
        anneeMin,
        anneeMax,
        effectifMax,
        coachs: [],
        horaires: []
    });

    localStorage.setItem("groupesJDM", JSON.stringify(groupes));

    afficherGroupes();
});

function supprimerGroupe(index) {
    groupes.splice(index, 1);
    localStorage.setItem("groupesJDM", JSON.stringify(groupes));
    afficherGroupes();
}

afficherGroupes();