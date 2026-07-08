let articlesBoutique = JSON.parse(localStorage.getItem("articlesBoutiqueJDM")) || [];

const champNom = document.getElementById("article-nom");
const champDescription = document.getElementById("article-description");
const champPrix = document.getElementById("article-prix");
const champImage = document.getElementById("article-image");
const champActif = document.getElementById("article-actif");

const champOptionNom = document.getElementById("option-nom");
const champOptionValeurs = document.getElementById("option-valeurs");
const zoneOptionsFormulaire = document.getElementById("options-article-formulaire");
const zoneListeArticles = document.getElementById("liste-articles-boutique-admin");

let articleEnEdition = null;
let optionsFormulaire = [];

function sauvegarderArticles() {
    localStorage.setItem("articlesBoutiqueJDM", JSON.stringify(articlesBoutique));
}

function viderFormulaire() {
    articleEnEdition = null;
    optionsFormulaire = [];

    champNom.value = "";
    champDescription.value = "";
    champPrix.value = "";
    champImage.value = "";
    champActif.checked = true;
    champOptionNom.value = "";
    champOptionValeurs.value = "";

    afficherOptionsFormulaire();
    document.getElementById("enregistrer-article").textContent = "Enregistrer l'article";
}

function afficherOptionsFormulaire() {
    if (optionsFormulaire.length === 0) {
        zoneOptionsFormulaire.innerHTML = `<p>Aucune option ajoutée.</p>`;
        return;
    }

    zoneOptionsFormulaire.innerHTML = optionsFormulaire.map((option, index) => `
        <section class="card">
            <p><strong>${option.nom}</strong></p>
            <p>${option.valeurs}</p>
            <button class="secondary-button" onclick="supprimerOption(${index})">
                Supprimer l'option
            </button>
        </section>
    `).join("");
}

function ajouterOption() {
    const nom = champOptionNom.value.trim();
    const valeurs = champOptionValeurs.value.trim();

    if (!nom || !valeurs) {
        alert("Merci d'indiquer le nom de l'option et ses valeurs.");
        return;
    }

    optionsFormulaire.push({ nom, valeurs });

    champOptionNom.value = "";
    champOptionValeurs.value = "";

    afficherOptionsFormulaire();
}

function supprimerOption(index) {
    optionsFormulaire.splice(index, 1);
    afficherOptionsFormulaire();
}

function lireFormulaire() {
    return {
        id: articleEnEdition || Date.now(),
        nom: champNom.value.trim(),
        description: champDescription.value.trim(),
        prix: Number(champPrix.value || 0),
        image: champImage.value.trim(),
        actif: champActif.checked,
        options: optionsFormulaire,
        dateModification: new Date().toISOString()
    };
}

function enregistrerArticle() {
    const article = lireFormulaire();

    if (!article.nom) {
        alert("Merci d'indiquer le nom de l'article.");
        return;
    }

    if (!article.prix || article.prix <= 0) {
        alert("Merci d'indiquer un prix valide.");
        return;
    }

    const existe = articlesBoutique.some(item => String(item.id) === String(article.id));

    if (existe) {
        articlesBoutique = articlesBoutique.map(item =>
            String(item.id) === String(article.id) ? article : item
        );
    } else {
        articlesBoutique.push(article);
    }

    sauvegarderArticles();
    viderFormulaire();
    afficherArticles();

    alert("Article enregistré ✅");
}

function modifierArticle(id) {
    const article = articlesBoutique.find(item => String(item.id) === String(id));
    if (!article) return;

    articleEnEdition = article.id;

    champNom.value = article.nom || "";
    champDescription.value = article.description || "";
    champPrix.value = article.prix || "";
    champImage.value = article.image || "";
    champActif.checked = article.actif !== false;
    optionsFormulaire = article.options ? JSON.parse(JSON.stringify(article.options)) : [];

    afficherOptionsFormulaire();

    document.getElementById("enregistrer-article").textContent = "Enregistrer les modifications";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function supprimerArticle(id) {
    if (!confirm("Supprimer cet article ?")) return;

    articlesBoutique = articlesBoutique.filter(item => String(item.id) !== String(id));

    sauvegarderArticles();
    afficherArticles();
}

function basculerVisibiliteArticle(id) {
    const article = articlesBoutique.find(item => String(item.id) === String(id));
    if (!article) return;

    article.actif = article.actif === false ? true : false;

    sauvegarderArticles();
    afficherArticles();
}

function afficherArticles() {
    if (articlesBoutique.length === 0) {
        zoneListeArticles.innerHTML = `
            <section class="card">
                <h2>Aucun article ajouté</h2>
                <p>Créez un premier article depuis le formulaire ci-dessus.</p>
            </section>
        `;
        return;
    }

    zoneListeArticles.innerHTML = articlesBoutique.map(article => `
        <section class="card">
            <h2>${article.actif === false ? "⚪" : "🟢"} ${article.nom}</h2>

            ${article.image ? `<img src="${article.image}" class="product-detail-image" alt="${article.nom}">` : ""}

            <p>${article.description || ""}</p>
            <p><strong>Prix :</strong> ${Number(article.prix || 0).toFixed(2)} €</p>
            <p><strong>Visible :</strong> ${article.actif === false ? "Non" : "Oui"}</p>

            ${
                article.options && article.options.length > 0
                    ? `<p><strong>Options :</strong><br>${article.options.map(option => `${option.nom} : ${option.valeurs}`).join("<br>")}</p>`
                    : `<p><strong>Options :</strong> aucune</p>`
            }

            <button class="primary-button order-button" onclick="modifierArticle('${article.id}')">
                Modifier
            </button>

            <button class="secondary-button" onclick="basculerVisibiliteArticle('${article.id}')">
                ${article.actif === false ? "Afficher" : "Masquer"}
            </button>

            <button class="secondary-button" onclick="supprimerArticle('${article.id}')">
                Supprimer
            </button>
        </section>
    `).join("");
}

document.getElementById("ajouter-option-article").addEventListener("click", ajouterOption);
document.getElementById("enregistrer-article").addEventListener("click", enregistrerArticle);
document.getElementById("vider-article").addEventListener("click", viderFormulaire);

afficherOptionsFormulaire();
afficherArticles();
