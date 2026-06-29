const params = new URLSearchParams(window.location.search);
const numero = params.get("id");

const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];

const adherent = adherents.find(a => a.numeroAdherent === numero);
const inscriptionsAdherent = inscriptions.filter(i => i.numeroAdherent === numero);

const fiche = document.getElementById("fiche-adherent");

function nettoyer(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function champ(donnees, mots) {
    const cle = Object.keys(donnees).find(cle =>
        mots.every(mot => nettoyer(cle).includes(nettoyer(mot)))
    );

    return cle ? donnees[cle] : "Non renseigné";
}

if (!adherent) {
    fiche.innerHTML = `
        <section class="card">
            <h2>Erreur</h2>
            <p>Adhérent introuvable.</p>
        </section>
    `;
} else {
    const derniereInscription = inscriptionsAdherent[inscriptionsAdherent.length - 1];
    const donnees = derniereInscription ? derniereInscription.donneesHelloAsso : {};

    fiche.innerHTML = `
        <section class="card">
            <h2>${adherent.prenom} ${adherent.nom}</h2>
            <p><strong>Numéro adhérent :</strong> ${adherent.numeroAdherent}</p>
            <p><strong>Date de naissance :</strong> ${adherent.dateNaissance}</p>
        </section>

        <section class="card">
            <h2>📅 Inscription</h2>
            <p><strong>Saison :</strong> ${derniereInscription ? derniereInscription.saison : "Non renseignée"}</p>
            <p><strong>Formule / groupe :</strong> ${champ(donnees, ["tarif"])}</p>
            <p><strong>Statut paiement :</strong> ${champ(donnees, ["statut", "commande"])}</p>
            <p><strong>Moyen de paiement :</strong> ${champ(donnees, ["moyen", "paiement"])}</p>
        </section>

        <section class="card">
            <h2>👨‍👩‍👧 Famille / contacts</h2>
            <p><strong>Email :</strong> ${champ(donnees, ["email", "adherent"])}</p>
            <p><strong>Email parent 2 :</strong> ${champ(donnees, ["email", "parent", "2"])}</p>
            <p><strong>Parent 1 :</strong> ${champ(donnees, ["parent", "1"])}</p>
            <p><strong>Parent 2 :</strong> ${champ(donnees, ["parent", "2"])}</p>
            <p><strong>Adresse :</strong> ${champ(donnees, ["adresse", "postale"])}</p>
            <p><strong>Code postal :</strong> ${champ(donnees, ["code", "postal"])}</p>
            <p><strong>Ville :</strong> ${champ(donnees, ["ville"])}</p>
        </section>

        <section class="card">
            <h2>🚑 Urgence</h2>
            <p><strong>Personne à prévenir :</strong> ${champ(donnees, ["personne", "urgence"])}</p>
            <p><strong>Téléphone urgence :</strong> ${champ(donnees, ["telephone", "urgence"])}</p>
        </section>

        <section class="card">
            <h2>📸 Autorisations</h2>
            <p><strong>Droit à l'image :</strong> ${champ(donnees, ["droit", "image"])}</p>
        </section>

        <section class="card">
            <h2>📚 Historique</h2>

            ${inscriptionsAdherent.length === 0 ? `
            <p>Aucune inscription trouvée.</p>
    `: inscriptionsAdherent.map(inscription => `
            <p>
            <strong>Saison :</strong> ${inscription.saison}<br>
            <strong>Groupe :</strong> ${champ(inscription.donneesHelloAsso, ["tarif"])}
            </p>
            <hr>
            `).join("")}
        </section>

        <section class="card">
            <h2>📄 Documents</h2>
            <p><strong>Certificat médical :</strong> ${champ(donnees, ["certificat", "medical"])}</p>
            <p><strong>Photo licence :</strong> ${champ(donnees, ["photo", "licence"])}</p>
            <p><strong>Justificatif domicile :</strong> ${champ(donnees, ["justificatif", "domicile"])}</p>
        </section>
        <section class="card">
    <h2>🪪 Carte adhérent</h2>

    <p>
        Carte membre liée au numéro permanent :
        <strong>${adherent.numeroAdherent}</strong>
    </p>

        <button class="primary-button order-button" onclick="window.open('carte-adherent.html?id=${adherent.numeroAdherent}', '_blank')">
        🪪 Générer la carte
    </button>
    `;
}