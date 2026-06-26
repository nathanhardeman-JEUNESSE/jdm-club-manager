let panier = JSON.parse(localStorage.getItem("panierJDM")) || [];

/* Choix des options : couleur, taille, contenance */
const lignesOptions = document.querySelectorAll(".option-row");

lignesOptions.forEach((ligne) => {
    const boutons = ligne.querySelectorAll(".option-button");

    boutons.forEach((bouton) => {
        bouton.addEventListener("click", () => {
            boutons.forEach((b) => b.classList.remove("active"));
            bouton.classList.add("active");

            const produit = bouton.closest(".product-detail");
            const image = produit.querySelector(".product-detail-image");

            if (bouton.textContent.trim() === "Blanc") {
                image.src = "../images/produits/teeshirt jeunesse blanc 2.jpg";
            }

            if (bouton.textContent.trim() === "Noir") {
                image.src = "../images/produits/teeshirt jeunesse noir 2.jpg";
            }
        });
    });
});

/* Ajouter au panier */
const boutonsAjout = document.querySelectorAll(".add-cart-button");

boutonsAjout.forEach((bouton) => {
    bouton.addEventListener("click", () => {
        const produit = bouton.closest(".product-detail");

        const nom = produit.dataset.nom;
        const prix = Number(produit.dataset.prix);

        const optionsActives = produit.querySelectorAll(".option-button.active");

        const options = Array.from(optionsActives).map((option) =>
            option.textContent.trim()
        );

        panier.push({
            nom: nom,
            prix: prix,
            options: options,
            quantite: 1
        });

        localStorage.setItem("panierJDM", JSON.stringify(panier));

        alert("Article ajouté au panier ✅");
    });
});