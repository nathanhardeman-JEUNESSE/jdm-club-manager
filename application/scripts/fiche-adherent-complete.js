const params = new URLSearchParams(window.location.search);
const numero = params.get("id");

const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];

const adherent = adherents.find(a => a.numeroAdherent === numero);
const historique = inscriptions.filter(i => i.numeroAdherent === numero);
const derniereInscription = historique[historique.length - 1];
const donnees = derniereInscription ? derniereInscription.donneesHelloAsso || {} : {};

const fiche = document.getElementById("fiche-pdf");

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

    return cle ? donnees[cle] : "";
}

if (!adherent) {
    fiche.innerHTML = `<h1>Adhérent introuvable</h1>`;
} else {
    fiche.innerHTML = `
        <section class="fiche-a4">

            <header class="fiche-header">
                <div class="photo-identite">PHOTO<br>D'IDENTITÉ</div>

                <div class="fiche-title">
                    <h1>FICHE ADHÉRENT</h1>
                    <h2>LA JEUNESSE DU MARAIS</h2>
                    <p>CLUB DE GYMNASTIQUE - LOMME</p>
                </div>

                <img src="../images/logo-jdm.png" class="fiche-logo">
            </header>

            <section class="fiche-section">
                <h3>IDENTITÉ</h3>
                <p><strong>Nom :</strong> ${adherent.nom || ""}</p>
                <p><strong>Prénom :</strong> ${adherent.prenom || ""}</p>
                <p><strong>Date de naissance :</strong> ${adherent.dateNaissance || ""}</p>
                <p><strong>N° adhérent :</strong> ${adherent.numeroAdherent || ""}</p>
            </section>

            <section class="fiche-section">
                <h3>INSCRIPTION</h3>
                <p><strong>Saison :</strong> ${derniereInscription ? derniereInscription.saison : ""}</p>
                <p><strong>Groupe / formule :</strong> ${champ(donnees, ["tarif"])}</p>
                <p><strong>Statut paiement :</strong> ${champ(donnees, ["statut", "commande"])}</p>
                <p><strong>Moyen de paiement :</strong> ${champ(donnees, ["moyen", "paiement"])}</p>
            </section>

            <section class="fiche-section">
                <h3>RESPONSABLES LÉGAUX</h3>
                <p><strong>Parent 1 :</strong> ${champ(donnees, ["parent", "1"])}</p>
                <p><strong>Parent 2 :</strong> ${champ(donnees, ["parent", "2"])}</p>
                <p><strong>Email :</strong> ${champ(donnees, ["email"])}</p>
            </section>

            <section class="fiche-section">
                <h3>URGENCE</h3>
                <p><strong>Personne à contacter :</strong> ${champ(donnees, ["personne", "urgence"])}</p>
                <p><strong>Téléphone :</strong> ${champ(donnees, ["telephone", "urgence"])}</p>
            </section>

            <section class="fiche-section">
                <h3>COORDONNÉES</h3>
                <p><strong>Adresse :</strong> ${champ(donnees, ["adresse"])}</p>
                <p><strong>Code postal :</strong> ${champ(donnees, ["code", "postal"])}</p>
                <p><strong>Ville :</strong> ${champ(donnees, ["ville"])}</p>
            </section>

            <section class="fiche-section">
                <h3>AUTORISATIONS / DOCUMENTS</h3>
                <p><strong>Droit à l'image :</strong> ${champ(donnees, ["droit", "image"])}</p>
                <p><strong>Certificat médical :</strong> ${champ(donnees, ["certificat", "medical"])}</p>
                <p><strong>Photo licence :</strong> ${champ(donnees, ["photo", "licence"])}</p>
                <p><strong>Justificatif domicile :</strong> ${champ(donnees, ["justificatif", "domicile"])}</p>
            </section>

            <section class="fiche-section">
                <h3>HISTORIQUE</h3>
                ${historique.length === 0 ? `
                    <p>Aucune inscription trouvée.</p>
                ` : historique.map(inscription => `
                    <p>
                        <strong>${inscription.saison}</strong> —
                        ${champ(inscription.donneesHelloAsso || {}, ["tarif"])}
                    </p>
                `).join("")}
            </section>

            <div class="decoupe">
                ✂ ------------------------------------------------ PARTIE À DÉCOUPER : CARTE ADHÉRENT ------------------------------------------------
            </div>

            <iframe
                src="carte-adherent.html?id=${encodeURIComponent(adherent.numeroAdherent)}"
                class="fiche-carte-frame">
            </iframe>

        </section>
    `;
}