const imageProduit = document.querySelector(".product-detail-image");

const boutonBlanc = document.querySelector(".option-button:nth-child(1)");
const boutonNoir = document.querySelector(".option-button:nth-child(2)");

const boutonMoins = document.querySelector(".quantity-button:first-child");
const boutonPlus = document.querySelector(".quantity-button:last-child");
const quantite = document.querySelector(".quantity-row span");

boutonBlanc.addEventListener("click", () => {
    imageProduit.src = "../images/produits/teeshirt jeunesse blanc 2.jpg";

    boutonBlanc.classList.add("active");
    boutonNoir.classList.remove("active");
});

boutonNoir.addEventListener("click", () => {
    imageProduit.src = "../images/produits/teeshirt jeunesse noir 2.jpg";

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