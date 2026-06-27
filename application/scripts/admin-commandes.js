let commandes = JSON.parse(localStorage.getItem("commandesJDM")) || [];

const zoneCommandes = document.getElementById("admin-commandes-list");

function afficherCommandes() {
    if (commandes.length === 0) {
        zoneCommandes.innerHTML = `
            <section class="card">
                <h2>Aucune commande</h2>
                <p>Aucune commande boutique n'a encore été enregistrée.</p>
            </section>
        `;
        return;
    }

    const totalCommandes = commandes.length;
    const enAttente = commandes.filter(c => c.statut === "En attente de règlement").length;
    const enPreparation = commandes.filter(c => c.statut === "En cours de préparation").length;
    const pretes = commandes.filter(c => c.statut === "Commande prête").length;
    const livrees = commandes.filter(c => c.statut === "Livrée").length;

    zoneCommandes.innerHTML = `
        <section class="card">
            <h2>📊 Suivi rapide</h2>
            <p><strong>Total :</strong> ${totalCommandes}</p>
            <p><strong>À régler :</strong> ${enAttente}</p>
            <p><strong>En préparation :</strong> ${enPreparation}</p>
            <p><strong>Prêtes :</strong> ${pretes}</p>
            <p><strong>Livrées :</strong> ${livrees}</p>
        </section>
    `;

    commandes
        .slice()
        .reverse()
        .forEach((commande) => {
                    const reglementCommande = commande.reglement || (commande.paiement === "cb" ? "Réglé" : "Non réglé");

let badge = "🟡 En préparation";

if (commande.statut === "Annulée") {
    badge = "🔴 Annulée";
} else if (commande.statut === "Livrée") {
    badge = "🟢 Livrée";
} else if (commande.statut === "Commande prête") {
    badge = "🔵 Commande prête";
} else if (reglementCommande === "Non réglé") {
    badge = "🟠 Paiement à recevoir";
}
            zoneCommandes.innerHTML += `
                <section class="card">
                    <h2>Commande n°${commande.numero}</h2>

<p class="status-badge">
    ${badge}
</p>

                    <p><strong>Client :</strong> ${commande.client.prenom} ${commande.client.nom}</p>
                    <p><strong>Email :</strong> ${commande.client.email}</p>
                    <p><strong>Téléphone :</strong> ${commande.client.telephone}</p>

                    <hr>

                    <h3>🛍️ Articles commandés</h3>

                    <div class="commande-articles">
                        ${commande.articles.map(article => `
                            <div class="commande-article">
                                <strong>${article.nom}</strong><br>
                                Options : ${article.options.join(" / ")}<br>
                                Quantité : ${article.quantite}<br>
                                Sous-total : ${article.prix * article.quantite} €
                            </div>
                            <br>
                        `).join("")}
                    </div>

                    <hr>

                    <p><strong>Total :</strong> ${commande.total} €</p>
                    <p><strong>Paiement :</strong> ${commande.paiement === "cb" ? "Carte bancaire" : "Au club"}</p>
                    <label class="admin-label">
    Règlement :
</label>

<select class="admin-reglement-select" data-numero="${commande.numero}">
    <option ${commande.reglement === "Non réglé" ? "selected" : ""}>Non réglé</option>
    <option ${commande.reglement === "Réglé" ? "selected" : ""}>Réglé</option>
</select>

                    <label class="admin-label">
                        Statut :
                    </label>

                    <select class="admin-select" data-numero="${commande.numero}">
                        <option ${commande.statut === "En attente de règlement" ? "selected" : ""}>En attente de règlement</option>
                        <option ${commande.statut === "En cours de préparation" ? "selected" : ""}>En cours de préparation</option>
                        <option ${commande.statut === "Commande prête" ? "selected" : ""}>Commande prête</option>
                        <option ${commande.statut === "Livrée" ? "selected" : ""}>Livrée</option>
                        <option ${commande.statut === "Annulée" ? "selected" : ""}>Annulée</option>
                    </select>
                </section>
            `;
        });

    activerChangementStatut();
    activerChangementReglement();
}

function activerChangementStatut() {
    const statuts = document.querySelectorAll(".admin-select");

    statuts.forEach((select) => {
        select.addEventListener("change", () => {
            const numero = Number(select.dataset.numero);
            const commande = commandes.find((c) => c.numero === numero);

            commande.statut = select.value;

            const reglement = commande.reglement || (commande.paiement === "cb" ? "Réglé" : "Non réglé");

            if (select.value === "Annulée" && reglement === "Réglé") {
                const notifications = JSON.parse(localStorage.getItem("notificationsTresorierJDM")) || [];

                notifications.push({
                    date: new Date().toLocaleString("fr-FR"),
                    type: "Remboursement à prévoir",
                    commande: commande.numero,
                    client: commande.client.prenom + " " + commande.client.nom,
                    email: commande.client.email,
                    telephone: commande.client.telephone,
                    total: commande.total,
                    paiement: commande.paiement === "cb" ? "Carte bancaire" : "Au club",
                    articles: commande.articles
                });

                localStorage.setItem("notificationsTresorierJDM", JSON.stringify(notifications));

                alert("Commande annulée. Notification remboursement créée pour le trésorier.");
            }

            localStorage.setItem("commandesJDM", JSON.stringify(commandes));

            afficherCommandes();
        });
    });
}

function activerChangementReglement() {
    const reglements = document.querySelectorAll(".admin-reglement-select");

    reglements.forEach((select) => {
        select.addEventListener("change", () => {
            const numero = Number(select.dataset.numero);
            const commande = commandes.find((c) => c.numero === numero);

            commande.reglement = select.value;

            localStorage.setItem("commandesJDM", JSON.stringify(commandes));

            afficherCommandes();
        });
    });
}

afficherCommandes();

function exporterCommandesExcel() {
    const commandes = JSON.parse(localStorage.getItem("commandesJDM")) || [];

    if (commandes.length === 0) {
        alert("Aucune commande à exporter.");
        return;
    }

    let lignes = [];

    lignes.push([
        "Numéro",
        "Date",
        "Nom",
        "Prénom",
        "Email",
        "Téléphone",
        "Produit",
        "Options",
        "Quantité",
        "Prix unitaire",
        "Sous-total",
        "Paiement",
        "Règlement",
        "Statut"
    ]);

    commandes.forEach((commande) => {

        commande.articles.forEach((article) => {
            lignes.push([
                commande.numero,
                commande.date,
                commande.client.nom,
                commande.client.prenom,
                commande.client.email,
                commande.client.telephone,
                article.nom,
                article.options.join(" / "),
                article.quantite,
                article.prix,
                article.prix * article.quantite,
                commande.paiement === "cb" ? "Carte bancaire" : "Au club",
                commande.reglement || (commande.paiement === "cb" ? "Réglé" : "Non réglé"),
                commande.statut
            ]);
        });
    });

    const contenuCSV = lignes
        .map(ligne => ligne.map(valeur => `"${valeur}"`).join(";"))
        .join("\n");

    const fichier = new Blob([contenuCSV], {
        type: "text/csv;charset=utf-8;"
    });

    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(fichier);
    lien.download = "commandes-boutique-jdm.csv";
    lien.click();
}