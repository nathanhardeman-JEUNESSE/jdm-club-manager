let commandes = JSON.parse(localStorage.getItem("commandesJDM")) || [];

const zoneCommandes = document.getElementById("admin-commandes-list");

function sauvegarderCommandes() {
    localStorage.setItem("commandesJDM", JSON.stringify(commandes));
}

function lireNotifications() {
    return JSON.parse(localStorage.getItem("notificationsJDM")) || [];
}

function sauvegarderNotifications(notifications) {
    localStorage.setItem("notificationsJDM", JSON.stringify(notifications));
}

function lireNotificationsTresorier() {
    return JSON.parse(localStorage.getItem("notificationsTresorierJDM")) || [];
}

function sauvegarderNotificationsTresorier(notifications) {
    localStorage.setItem("notificationsTresorierJDM", JSON.stringify(notifications));
}

function clientCommande(commande) {
    if (!commande || !commande.client) return "Client non renseigné";
    return `${commande.client.prenom || ""} ${commande.client.nom || ""}`.trim();
}

function paiementCommande(commande) {
    return commande.paiement === "cb" ? "Carte bancaire" : "Au club";
}

function reglementCommande(commande) {
    return commande.reglement || (commande.paiement === "cb" ? "Réglé" : "Non réglé");
}

function statutNormalise(statut) {
    if (statut === "Livrée") return "Distribuée";
    return statut || "En cours de préparation";
}

function badgeCommande(commande) {
    const statut = statutNormalise(commande.statut);
    const reglement = reglementCommande(commande);

    if (!commande.vueAdmin && statut !== "Annulée" && statut !== "Distribuée") return "🔴 Nouvelle commande";
    if (statut === "Annulée") return "🔴 Annulée";
    if (statut === "Distribuée") return "🟢 Distribuée";
    if (statut === "Commande prête") return "🔵 Commande prête";
    if (reglement === "Non réglé") return "🟠 Paiement à recevoir";
    return "🟡 En préparation";
}

function articlesCommandeTexte(commande) {
    if (!commande.articles || commande.articles.length === 0) return "Aucun article renseigné";

    return commande.articles.map(article => {
        const options = article.options ? article.options.join(" / ") : "";
        return `${article.nom || "Article"} ${options} x${article.quantite || 1}`;
    }).join(" | ");
}

function creerNotificationParentCommandePrete(commande) {
    const notifications = lireNotifications();

    const existe = notifications.some(notification =>
        notification.type === "commande-prete" &&
        notification.donnees &&
        String(notification.donnees.numeroCommande) === String(commande.numero)
    );

    if (existe) return;

    notifications.push({
        id: Date.now() + Math.floor(Math.random() * 100000),
        categorie: "parent",
        type: "commande-prete",
        titre: "Commande prête",
        message: `Votre commande n°${commande.numero} est disponible à la salle.`,
        priorite: "haute",
        destinataire: "parent",
        lue: false,
        traitee: false,
        archivee: false,
        dateCreation: new Date().toISOString(),
        donnees: {
            numeroCommande: commande.numero,
            client: clientCommande(commande),
            total: commande.total,
            articles: articlesCommandeTexte(commande)
        }
    });

    sauvegarderNotifications(notifications);
}

function creerNotificationTresorierRemboursement(commande) {
    const anciennesNotifications = lireNotificationsTresorier();

    const existeAncienne = anciennesNotifications.some(notification =>
        String(notification.commande) === String(commande.numero) &&
        notification.type === "Remboursement à prévoir"
    );

    if (!existeAncienne) {
        anciennesNotifications.push({
            date: new Date().toLocaleString("fr-FR"),
            type: "Remboursement à prévoir",
            commande: commande.numero,
            client: clientCommande(commande),
            email: commande.client ? commande.client.email || "" : "",
            telephone: commande.client ? commande.client.telephone || "" : "",
            total: commande.total,
            paiement: paiementCommande(commande),
            articles: commande.articles || []
        });

        sauvegarderNotificationsTresorier(anciennesNotifications);
    }

    const notifications = lireNotifications();

    const existe = notifications.some(notification =>
        notification.categorie === "tresorier" &&
        notification.type === "remboursement" &&
        notification.donnees &&
        String(notification.donnees.commande) === String(commande.numero)
    );

    if (existe) return;

    notifications.push({
        id: Date.now() + Math.floor(Math.random() * 100000),
        categorie: "tresorier",
        type: "remboursement",
        titre: "Remboursement à prévoir",
        message: `Commande n°${commande.numero} annulée - ${clientCommande(commande)} - ${commande.total} €`,
        priorite: "haute",
        lue: false,
        traitee: false,
        archivee: false,
        dateCreation: new Date().toISOString(),
        donnees: {
            commande: commande.numero,
            client: clientCommande(commande),
            email: commande.client ? commande.client.email || "" : "",
            telephone: commande.client ? commande.client.telephone || "" : "",
            total: commande.total,
            paiement: paiementCommande(commande),
            articles: commande.articles || []
        }
    });

    sauvegarderNotifications(notifications);
}

function commandeNouvelle(commande) {
    const statut = statutNormalise(commande.statut);
    return !commande.vueAdmin && statut !== "Annulée" && statut !== "Distribuée";
}

function afficherCommandes() {
    if (!zoneCommandes) return;

    commandes = commandes.map(commande => ({
        ...commande,
        statut: statutNormalise(commande.statut)
    }));

    sauvegarderCommandes();

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
    const nouvelles = commandes.filter(commandeNouvelle).length;
    const enAttente = commandes.filter(c => c.statut === "En attente de règlement").length;
    const enPreparation = commandes.filter(c => c.statut === "En cours de préparation").length;
    const pretes = commandes.filter(c => c.statut === "Commande prête").length;
    const distribuees = commandes.filter(c => c.statut === "Distribuée").length;
    const annulees = commandes.filter(c => c.statut === "Annulée").length;

    zoneCommandes.innerHTML = `
        <section class="card">
            <h2>📊 Suivi rapide</h2>
            <p><strong>Nouvelles à consulter :</strong> ${nouvelles}</p>
            <p><strong>Total :</strong> ${totalCommandes}</p>
            <p><strong>À régler :</strong> ${enAttente}</p>
            <p><strong>En préparation :</strong> ${enPreparation}</p>
            <p><strong>Prêtes :</strong> ${pretes}</p>
            <p><strong>Distribuées :</strong> ${distribuees}</p>
            <p><strong>Annulées :</strong> ${annulees}</p>
        </section>
    `;

    commandes
        .slice()
        .reverse()
        .forEach((commande) => {
            zoneCommandes.innerHTML += `
                <section class="card ${commandeNouvelle(commande) ? "notification-non-lue" : ""}">
                    <h2>Commande n°${commande.numero}</h2>

                    <p class="status-badge">${badgeCommande(commande)}</p>

                    <p><strong>Client :</strong> ${clientCommande(commande)}</p>
                    <p><strong>Email :</strong> ${commande.client ? commande.client.email || "" : ""}</p>
                    <p><strong>Téléphone :</strong> ${commande.client ? commande.client.telephone || "" : ""}</p>

                    <hr>

                    <h3>🛍️ Articles commandés</h3>

                    <div class="commande-articles">
                        ${(commande.articles || []).map(article => `
                            <div class="commande-article">
                                <strong>${article.nom || "Article"}</strong><br>
                                Options : ${article.options ? article.options.join(" / ") : ""}<br>
                                Quantité : ${article.quantite || 1}<br>
                                Sous-total : ${(article.prix || 0) * (article.quantite || 1)} €
                            </div>
                            <br>
                        `).join("")}
                    </div>

                    <hr>

                    <p><strong>Total :</strong> ${commande.total || 0} €</p>
                    <p><strong>Paiement :</strong> ${paiementCommande(commande)}</p>

                    ${commandeNouvelle(commande) ? `
                        <button class="primary-button order-button" onclick="marquerCommandeVue('${commande.numero}')">
                            Marquer la commande comme vue
                        </button>
                    ` : ""}

                    <label class="admin-label">Règlement :</label>
                    <select class="admin-reglement-select admin-select" data-numero="${commande.numero}">
                        <option ${reglementCommande(commande) === "Non réglé" ? "selected" : ""}>Non réglé</option>
                        <option ${reglementCommande(commande) === "Réglé" ? "selected" : ""}>Réglé</option>
                    </select>

                    <label class="admin-label">Statut :</label>
                    <select class="admin-statut-select admin-select" data-numero="${commande.numero}">
                        <option ${commande.statut === "En attente de règlement" ? "selected" : ""}>En attente de règlement</option>
                        <option ${commande.statut === "En cours de préparation" ? "selected" : ""}>En cours de préparation</option>
                        <option ${commande.statut === "Commande prête" ? "selected" : ""}>Commande prête</option>
                        <option ${commande.statut === "Distribuée" ? "selected" : ""}>Distribuée</option>
                        <option ${commande.statut === "Annulée" ? "selected" : ""}>Annulée</option>
                    </select>
                </section>
            `;
        });

    activerChangementStatut();
    activerChangementReglement();
}

function marquerCommandeVue(numeroCommande) {
    commandes = commandes.map(commande => {
        if (String(commande.numero) === String(numeroCommande)) {
            return {
                ...commande,
                vueAdmin: true,
                dateVueAdmin: new Date().toISOString()
            };
        }

        return commande;
    });

    sauvegarderCommandes();
    afficherCommandes();
}

function activerChangementStatut() {
    const statuts = document.querySelectorAll(".admin-statut-select");

    statuts.forEach((select) => {
        select.addEventListener("change", () => {
            const numero = Number(select.dataset.numero);
            const commande = commandes.find((c) => Number(c.numero) === numero);

            if (!commande) return;

            const ancienStatut = statutNormalise(commande.statut);
            const nouveauStatut = statutNormalise(select.value);
            const reglement = reglementCommande(commande);

            commande.statut = nouveauStatut;
            commande.vueAdmin = true;

            if (nouveauStatut === "Commande prête" && ancienStatut !== "Commande prête") {
                creerNotificationParentCommandePrete(commande);
                alert("Commande prête. Notification envoyée au parent.");
            }

            if (nouveauStatut === "Annulée" && reglement === "Réglé") {
                creerNotificationTresorierRemboursement(commande);
                alert("Commande annulée. Notification remboursement créée pour le trésorier.");
            }

            sauvegarderCommandes();
            afficherCommandes();
        });
    });
}

function activerChangementReglement() {
    const reglements = document.querySelectorAll(".admin-reglement-select");

    reglements.forEach((select) => {
        select.addEventListener("change", () => {
            const numero = Number(select.dataset.numero);
            const commande = commandes.find((c) => Number(c.numero) === numero);

            if (!commande) return;

            commande.reglement = select.value;
            commande.vueAdmin = true;
            sauvegarderCommandes();
            afficherCommandes();
        });
    });
}

function exporterCommandesExcel() {
    const commandesExport = JSON.parse(localStorage.getItem("commandesJDM")) || [];

    if (commandesExport.length === 0) {
        alert("Aucune commande à exporter.");
        return;
    }

    const lignes = [[
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
        "Statut",
        "Vue admin"
    ]];

    commandesExport.forEach((commande) => {
        (commande.articles || []).forEach((article) => {
            lignes.push([
                commande.numero,
                commande.date,
                commande.client ? commande.client.nom : "",
                commande.client ? commande.client.prenom : "",
                commande.client ? commande.client.email : "",
                commande.client ? commande.client.telephone : "",
                article.nom,
                article.options ? article.options.join(" / ") : "",
                article.quantite,
                article.prix,
                (article.prix || 0) * (article.quantite || 1),
                paiementCommande(commande),
                reglementCommande(commande),
                statutNormalise(commande.statut),
                commande.vueAdmin ? "Oui" : "Non"
            ]);
        });
    });

    const contenuCSV = lignes
        .map(ligne => ligne.map(valeur => `"${String(valeur || "").replace(/"/g, '""')}"`).join(";"))
        .join("\n");

    const fichier = new Blob(["\uFEFF" + contenuCSV], {
        type: "text/csv;charset=utf-8;"
    });

    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(fichier);
    lien.download = "commandes-boutique-jdm.csv";
    lien.click();
}

afficherCommandes();
