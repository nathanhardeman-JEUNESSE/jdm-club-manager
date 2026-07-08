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
            const image = produit ? produit.querySelector(".product-detail-image") : null;

            if (!image) return;

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
        mettreAJourCompteurPanier();

        alert("Article ajouté au panier ✅");
    });
});

function mettreAJourCompteurPanier() {
    const compteur = document.getElementById("cart-count");

    if (!compteur) return;

    const panierActuel = JSON.parse(localStorage.getItem("panierJDM")) || [];

    compteur.textContent = "(" + panierActuel.length + ")";
}

function afficherArticlesAdminAccessoires() {
    const zone = document.getElementById("articles-boutique-admin-zone");
    if (!zone) return;

    const articles = JSON.parse(localStorage.getItem("articlesBoutiqueJDM")) || [];
    const articlesActifs = articles.filter(article => article.actif !== false);

    if (articlesActifs.length === 0) {
        zone.innerHTML = `
            <section class="card">
                <p>Aucun article supplémentaire disponible pour le moment.</p>
            </section>
        `;
        return;
    }

    zone.innerHTML = articlesActifs.map(article => `
        <section class="product-detail" data-nom="${article.nom || ""}" data-prix="${Number(article.prix || 0)}" data-id="${article.id || ""}">

            ${article.image ? `<img src="${article.image}" alt="${article.nom || "Article"}" class="product-detail-image">` : ""}

            <h2>${article.nom || "Article sans nom"}</h2>

            <p class="product-price">À partir de ${Number(article.prix || 0).toFixed(2)} €</p>

            <p>${article.description || ""}</p>

            ${(article.options || []).map(option => {
                const valeurs = String(option.valeurs || "")
                    .split(",")
                    .map(v => v.trim())
                    .filter(Boolean);

                if (valeurs.length === 0) return "";

                return `
                    <h3>${option.nom || "Option"}</h3>
                    <div class="option-row">
                        ${valeurs.map((valeur, index) => `
                            <button class="option-button ${index === 0 ? "active" : ""}" data-option="${option.nom || "Option"}">${valeur}</button>
                        `).join("")}
                    </div>
                `;
            }).join("")}

            <button class="primary-button order-button add-cart-button-admin">
                Ajouter au panier
            </button>

        </section>
    `).join("");

    zone.querySelectorAll(".option-row").forEach((ligne) => {
        const boutons = ligne.querySelectorAll(".option-button");

        boutons.forEach((bouton) => {
            bouton.addEventListener("click", () => {
                boutons.forEach((b) => b.classList.remove("active"));
                bouton.classList.add("active");
            });
        });
    });

    zone.querySelectorAll(".add-cart-button-admin").forEach((bouton) => {
        bouton.addEventListener("click", () => {
            const produit = bouton.closest(".product-detail");

            const nom = produit.dataset.nom;
            const prix = Number(produit.dataset.prix);

            const optionsActives = produit.querySelectorAll(".option-button.active");

            const options = Array.from(optionsActives).map((option) => {
                const nomOption = option.dataset.option || "Option";
                return `${nomOption} : ${option.textContent.trim()}`;
            });

            panier.push({
                nom: nom,
                prix: prix,
                options: options,
                quantite: 1,
                articleAdmin: true,
                articleId: produit.dataset.id || ""
            });

            localStorage.setItem("panierJDM", JSON.stringify(panier));
            mettreAJourCompteurPanier();

            alert("Article ajouté au panier ✅");
        });
    });
}

mettreAJourCompteurPanier();
afficherArticlesAdminAccessoires();
