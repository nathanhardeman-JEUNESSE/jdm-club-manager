const panier = JSON.parse(localStorage.getItem("panierJDM")) || [];
const recap = document.getElementById("commande-recap");

let total = 0;

if (panier.length === 0) {
    recap.innerHTML = `
        <p>Votre panier est vide.</p>
    `;
} else {
    panier.forEach((article) => {
        const sousTotal = article.prix * article.quantite;
        total += sousTotal;

        recap.innerHTML += `
            <div class="order-line">
                <p><strong>${article.nom}</strong></p>
                <p>${article.options.join(" / ")}</p>
                <p>Quantité : ${article.quantite}</p>
                <p>Sous-total : ${sousTotal} €</p>
            </div>
        `;
    });

    recap.innerHTML += `
        <hr>
        <p class="product-price">Total : ${total} €</p>
    `;
}

const boutonsPaiement = document.querySelectorAll('input[name="paiement"]');
const boutonPaiement = document.getElementById("payment-button");

function mettreAJourBoutonPaiement() {
    if (!boutonPaiement) return;

    const paiementSelectionne = document.querySelector('input[name="paiement"]:checked');

    if (!paiementSelectionne) {
        boutonPaiement.textContent = "Choisir un mode de paiement";
        return;
    }

    const modePaiement = paiementSelectionne.value;

    if (modePaiement === "cb") {
        boutonPaiement.textContent = "💳 Payer ma commande";
    } else {
        boutonPaiement.textContent = "📦 Valider ma commande";
    }
}

boutonsPaiement.forEach((bouton) => {
    bouton.addEventListener("change", mettreAJourBoutonPaiement);
});

mettreAJourBoutonPaiement();

boutonPaiement.addEventListener("click", () => {
    const nom = document.getElementById("client-nom").value.trim();
    const prenom = document.getElementById("client-prenom").value.trim();
    const email = document.getElementById("client-email").value.trim();
    const telephone = document.getElementById("client-telephone").value.trim();

    if (!nom || !prenom || !email || !telephone) {
        alert("Veuillez compléter vos coordonnées.");
        return;
    }

    const paiementSelectionne = document.querySelector('input[name="paiement"]:checked');

    if (!paiementSelectionne) {
        alert("Veuillez choisir un mode de paiement.");
        return;
    }

    const modePaiement = paiementSelectionne.value;
    const acceptReglement = document.getElementById("accept-reglement").checked;

    if (modePaiement === "club" && !acceptReglement) {
        alert("Merci de confirmer que vous avez pris connaissance du fait que votre commande sera préparée uniquement après réception de votre règlement au club.");
        return;
    }

    if (modePaiement === "cb") {
        window.location.href = "paiement.html";
        return;
    }

    const commandes = JSON.parse(localStorage.getItem("commandesJDM")) || [];

const nouvelleCommande = {
    numero: commandes.length + 1,
    date: new Date().toLocaleString("fr-FR"),
    client: {
        nom: nom,
        prenom: prenom,
        email: email,
        telephone: telephone
    },
    articles: panier,
    total: total,
    paiement: modePaiement,
    reglement: modePaiement === "club" ? "Non réglé" : "Réglé",
    statut: "En attente de règlement"
};

    commandes.push(nouvelleCommande);

    localStorage.setItem("commandesJDM", JSON.stringify(commandes));
    localStorage.removeItem("panierJDM");

    alert("Commande enregistrée ✅");

    window.location.href = "confirmation-commande.html";
});