let panier = JSON.parse(localStorage.getItem("panierJDM")) || [];

const zonePanier = document.getElementById("panier-content");

function sauvegarderPanier() {
    localStorage.setItem("panierJDM", JSON.stringify(panier));
}

function afficherPanier() {
    if (panier.length === 0) {
        zonePanier.innerHTML = `
            <section class="card">
                <h2>🛒 Votre panier est vide</h2>
                <p>Ajoutez un article depuis la boutique avant de valider une commande.</p>
            </section>
        `;
        return;
    }

    let total = 0;
    zonePanier.innerHTML = "";

    panier.forEach((article, index) => {
        const sousTotal = article.prix * article.quantite;
        total += sousTotal;

        zonePanier.innerHTML += `
            <section class="card">
                <h2>${article.nom}</h2>
                <p><strong>Options :</strong> ${article.options.join(" / ")}</p>
                <p><strong>Prix unitaire :</strong> ${article.prix} €</p>

                <div class="quantity-row">
                    <button class="quantity-button" onclick="modifierQuantite(${index}, -1)">-</button>
                    <span>${article.quantite}</span>
                    <button class="quantity-button" onclick="modifierQuantite(${index}, 1)">+</button>
                </div>

                <p><strong>Sous-total :</strong> ${sousTotal} €</p>

                <button class="secondary-button" onclick="supprimerArticle(${index})">
                    Supprimer cet article
                </button>
            </section>
        `;
    });

    zonePanier.innerHTML += `
        <section class="card">
            <h2>Total</h2>
            <p class="product-price">${total} €</p>

<a href="commande.html" class="primary-button order-button">
    Valider la commande
</a>

            <button class="secondary-button" id="clear-cart-button">
                Vider mon panier
            </button>
        </section>
    `;

    document.getElementById("clear-cart-button").addEventListener("click", () => {
        localStorage.removeItem("panierJDM");
        panier = [];
        afficherPanier();
    });
}

function modifierQuantite(index, changement) {
    panier[index].quantite += changement;

    if (panier[index].quantite <= 0) {
        panier.splice(index, 1);
    }

    sauvegarderPanier();
    afficherPanier();
}

function supprimerArticle(index) {
    panier.splice(index, 1);
    sauvegarderPanier();
    afficherPanier();
}

afficherPanier();