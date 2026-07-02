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

function valeur(texte) {
    return texte || "";
}

if (!adherent) {
    fiche.innerHTML = `<h1>Adhérent introuvable</h1>`;
} else {
    fiche.innerHTML = `
        <section class="fiche-pdf-page">

            <header class="fiche-pdf-header">
                <div class="fiche-photo-box">
                    <div class="fiche-photo-icon">👤</div>
                    <div class="fiche-photo-label">PHOTO D'IDENTITÉ</div>
                </div>

                <div class="fiche-pdf-title">
                    <h1>FICHE ADHÉRENT</h1>
                    <h2>LA JEUNESSE DU MARAIS</h2>
                    <p>CLUB DE GYMNASTIQUE - LOMME</p>
                </div>

                <img src="../images/logo-j-noir.png" class="fiche-pdf-logo">
            </header>

            <div class="fiche-grid-2">
                <section class="fiche-block">
                    <h3>IDENTITÉ</h3>
                    <p><strong>Nom :</strong> ${valeur(adherent.nom)}</p>
                    <p><strong>Prénom :</strong> ${valeur(adherent.prenom)}</p>
                    <p><strong>Date de naissance :</strong> ${valeur(adherent.dateNaissance)}</p>
                    <p><strong>N° adhérent :</strong> ${valeur(adherent.numeroAdherent)}</p>
                </section>

                <section class="fiche-block">
                    <h3>INSCRIPTION</h3>
                    <p><strong>Saison :</strong> ${derniereInscription ? derniereInscription.saison : ""}</p>
                    <p><strong>Groupe / formule :</strong> ${champ(donnees, ["tarif"])}</p>
                    <p><strong>Statut paiement :</strong> ${champ(donnees, ["statut", "commande"])}</p>
                    <p><strong>Moyen de paiement :</strong> ${champ(donnees, ["moyen", "paiement"])}</p>
                </section>
            </div>

            <div class="fiche-grid-2">
                <section class="fiche-block">
                    <h3>RESPONSABLE LÉGAL 1</h3>
                    <p><strong>Nom / prénom :</strong> ${champ(donnees, ["parent", "1"])}</p>
                    <p><strong>Téléphone :</strong> ${champ(donnees, ["telephone", "parent", "1"])}</p>
                    <p><strong>Email :</strong> ${champ(donnees, ["email", "adherent"])}</p>
                </section>

                <section class="fiche-block">
                    <h3>RESPONSABLE LÉGAL 2</h3>
                    <p><strong>Nom / prénom :</strong> ${champ(donnees, ["parent", "2"])}</p>
                    <p><strong>Téléphone :</strong> ${champ(donnees, ["telephone", "parent", "2"])}</p>
                    <p><strong>Email :</strong> ${champ(donnees, ["email", "parent", "2"])}</p>
                </section>
            </div>

            <div class="fiche-grid-2">
                <section class="fiche-block">
                    <h3>URGENCE</h3>
                    <p><strong>Personne à contacter :</strong> ${champ(donnees, ["personne", "urgence"])}</p>
                    <p><strong>Téléphone :</strong> ${champ(donnees, ["telephone", "urgence"])}</p>
                </section>

                <section class="fiche-block">
                    <h3>DROIT À L'IMAGE</h3>
                    <p>${champ(donnees, ["droit", "image"]) || "Non renseigné"}</p>
                </section>
            </div>

            <section class="fiche-block">
                <h3>COORDONNÉES</h3>
                <div class="fiche-grid-2">
                    <p><strong>Adresse :</strong> ${champ(donnees, ["adresse"])}</p>
                    <p><strong>Contact mail :</strong> ${champ(donnees, ["email"])}</p>
                    <p><strong>Code postal :</strong> ${champ(donnees, ["code", "postal"])}</p>
                    <p><strong>Ville :</strong> ${champ(donnees, ["ville"])}</p>
                </div>
            </section>

            <section class="fiche-block">
                <h3>INFORMATIONS SPORTIVES</h3>
                <div class="fiche-grid-3">
                    <p><strong>Compétition :</strong> ${champ(donnees, ["competition"])}</p>
                    <p><strong>Groupe / catégorie :</strong> ${champ(donnees, ["tarif"])}</p>
                    <p><strong>Fédération :</strong> ${champ(donnees, ["federation"])}</p>
                </div>
            </section>

            <section class="fiche-block">
                <h3>DOCUMENTS FOURNIS</h3>
                <div class="fiche-grid-3">
                    <p><strong>Certificat médical :</strong> ${champ(donnees, ["certificat", "medical"])}</p>
                    <p><strong>Photo licence :</strong> ${champ(donnees, ["photo", "licence"])}</p>
                    <p><strong>Justificatif domicile :</strong> ${champ(donnees, ["justificatif", "domicile"])}</p>
                </div>
            </section>

            <section class="fiche-block">
                <h3>HISTORIQUE DES INSCRIPTIONS</h3>

                <table class="fiche-table">
                    <thead>
                        <tr>
                            <th>Saison</th>
                            <th>Groupe / catégorie</th>
                            <th>Statut paiement</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${historique.length === 0 ? `
                            <tr>
                                <td colspan="3">Aucune inscription trouvée.</td>
                            </tr>
                        ` : historique.map(inscription => `
                            <tr>
                                <td>${inscription.saison || ""}</td>
                                <td>${champ(inscription.donneesHelloAsso || {}, ["tarif"])}</td>
                                <td>${champ(inscription.donneesHelloAsso || {}, ["statut", "commande"])}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </section>

            <section class="fiche-signature">
                <p><strong>Date :</strong> ____ / ____ / ______</p>
                <p><strong>Signature :</strong> ______________________________</p>
            </section>

        </section>
    `;
}