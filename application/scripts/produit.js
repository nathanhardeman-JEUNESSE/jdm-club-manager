async function chargerProduit() {

    const produits = await chargerProduits();

   const params = new URLSearchParams(window.location.search);

const idProduit = params.get("id");

const produit = produits.find(p => p.id === idProduit);

if (!produit) {

    alert("Produit introuvable.");

    return;

}
const premiereImage = produit.images.Blanc || produit.images.principal;

imageProduit.src = premiereImage;

    document.getElementById("product-name").textContent = produit.nom;

    document.getElementById("product-price").textContent =
        "À partir de " + produit.prix + " €";

    document.getElementById("product-description").textContent =
        produit.description;

}


chargerProduit();
const imageProduit = document.querySelector(".product-detail-image");

const boutonBlanc = document.querySelector(".option-button:nth-child(1)");
const boutonNoir = document.querySelector(".option-button:nth-child(2)");

const boutonMoins = document.querySelector(".quantity-button:first-child");
const boutonPlus = document.querySelector(".quantity-button:last-child");
const quantite = document.querySelector(".quantity-row span");

boutonBlanc.addEventListener("click", () => {
    if (!produitActuel.images.Blanc) return;

    imageProduit.src = produitActuel.images.Blanc;

    boutonBlanc.classList.add("active");
    boutonNoir.classList.remove("active");
});

boutonNoir.addEventListener("click", () => {
    if (!produitActuel.images.Noir) return;

    imageProduit.src = produitActuel.images.Noir;

    boutonNoir.classList.add("active");
    boutonBlanc.classList.remove("active");
});

boutonPlus.addEventListener("click", () => {
    quantite.textContent = Number(quantite.textContent) + 1;
});

boutonMoins.addEventListener("click", () => {
    if (Number(quantite.textContent) > 1) {
        quantite.textContent = Number(quantite.textContent) - 1;
    }
});
const boutonsTaille = document.querySelectorAll(".option-row:nth-of-type(2) .option-button");

boutonsTaille.forEach((bouton) => {
    bouton.addEventListener("click", () => {
        boutonsTaille.forEach((b) => b.classList.remove("active"));
        bouton.classList.add("active");
    });
});