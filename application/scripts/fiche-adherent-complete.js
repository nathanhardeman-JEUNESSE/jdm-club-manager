import {
    listAdherents,
    listInscriptions
} from "../firebase/firebase-db.js";

import {
    champ,
    donneesInscription,
    emailAdherent,
    groupeAdherent,
    inscriptionsPour,
    parent1Adherent,
    parent2Adherent,
    telephoneAdherent,
    dateNaissanceAdherent
} from "./adherent-data.js";

const params = new URLSearchParams(window.location.search);
const numero = params.get("id");
const fiche = document.getElementById("fiche-pdf");

let adherent = null;
let historique = [];
let derniereInscription = null;
let donnees = {};

function extraireUrlPhoto(valeurChamp) {
    const texte = String(valeurChamp || "").trim();
    const match = texte.match(/https?:\/\/[^\s"'<>]+/i);
    return match ? match[0] : "";
}

function photoIdentiteHTML() {
    const photo = champ(donnees, ["photo", "licence"]);
    const url = extraireUrlPhoto(photo);

    if (url) {
        return `
            <div class="fiche-photo-box">
                <img
                    src="${url}"
                    class="fiche-photo-identite"
                    alt="Photo d'identité"
                    onerror="afficherPhotoManquante(this)">
            </div>
        `;
    }

    return `
        <div class="fiche-photo-box">
            <div class="fiche-photo-icon">👤</div>
            <div class="fiche-photo-label">PHOTO D'IDENTITÉ</div>
        </div>
    `;
}

function afficherPhotoManquante(image) {
    const parent = image.parentElement;
    if (!parent) return;

    parent.innerHTML = `
        <div class="fiche-photo-icon">👤</div>
        <div class="fiche-photo-label">PHOTO MANQUANTE</div>
    `;
}

function afficherFicheComplete() {
    if (!fiche) return;

    if (!adherent) {
        fiche.innerHTML = `<h1>Adhérent introuvable</h1>`;
        return;
    }

    const groupe = groupeAdherent(adherent, derniereInscription);
    const telephone = telephoneAdherent(adherent, derniereInscription);
    const parent1 = parent1Adherent(adherent, derniereInscription);
    const parent2 = parent2Adherent(adherent, derniereInscription);
    const email = emailAdherent(adherent, derniereInscription);
    const dateNaissance = dateNaissanceAdherent(adherent, derniereInscription);

    fiche.innerHTML = `
        <section class="fiche-pdf-page">
            <header class="fiche-pdf-header">
                ${photoIdentiteHTML()}

                <div class="fiche-pdf-title">
                    <h1>FICHE ADHÉRENT</h1>
                    <h2>LA JEUNESSE DU MARAIS</h2>
                    <p>CLUB DE GYMNASTIQUE - LOMME</p>
                </div>

                <img src="../images/logo-jdm-noir.png" class="fiche-pdf-logo" alt="Logo JDM">
            </header>

            <div class="fiche-grid-2">
                <section class="fiche-block">
                    <h3>IDENTITÉ</h3>
                    <p><strong>Nom :</strong> ${adherent.nom || ""}</p>
                    <p><strong>Prénom :</strong> ${adherent.prenom || ""}</p>
                    <p><strong>Date de naissance :</strong> ${dateNaissance || ""}</p>
                    <p><strong>N° adhérent :</strong> ${adherent.numeroAdherent || ""}</p>
                </section>

                <section class="fiche-block">
                    <h3>INSCRIPTION</h3>
                    <p><strong>Saison :</strong> ${derniereInscription?.saison || ""}</p>
                    <p><strong>Groupe / formule :</strong> ${groupe}</p>
                    <p><strong>Statut paiement :</strong> ${derniereInscription?.statutPaiement || ""}</p>
                    <p><strong>Montant :</strong> ${derniereInscription?.montant ?? ""} €</p>
                </section>
            </div>

            <div class="fiche-grid-2">
                <section class="fiche-block">
                    <h3>RESPONSABLE LÉGAL 1</h3>
                    <p><strong>Nom / prénom :</strong> ${parent1}</p>
                    <p><strong>Téléphone :</strong> ${telephone}</p>
                    <p><strong>Email :</strong> ${email}</p>
                </section>

                <section class="fiche-block">
                    <h3>RESPONSABLE LÉGAL 2</h3>
                    <p><strong>Nom / prénom :</strong> ${parent2}</p>
                    <p><strong>Email :</strong> ${adherent.emailParent2 || champ(donnees, ["email", "parent", "2"])}</p>
                </section>
            </div>

            <div class="fiche-grid-2">
                <section class="fiche-block">
                    <h3>URGENCE</h3>
                    <p><strong>Personne à contacter :</strong> ${champ(donnees, ["personne", "urgence"], parent1)}</p>
                    <p><strong>Téléphone :</strong> ${telephone}</p>
                </section>

                <section class="fiche-block">
                    <h3>DROIT À L'IMAGE</h3>
                    <p>${champ(donnees, ["droit", "image"], "Non renseigné")}</p>
                </section>
            </div>

            <section class="fiche-block">
                <h3>COORDONNÉES</h3>
                <div class="fiche-grid-2">
                    <p><strong>Adresse :</strong> ${champ(donnees, ["adresse", "postale"])}</p>
                    <p><strong>Contact mail :</strong> ${email}</p>
                    <p><strong>Code postal :</strong> ${champ(donnees, ["code", "postal"])}</p>
                    <p><strong>Ville :</strong> ${champ(donnees, ["ville"])}</p>
                </div>
            </section>

            <section class="fiche-block">
                <h3>INFORMATIONS SPORTIVES</h3>
                <div class="fiche-grid-3">
                    <p><strong>Compétition :</strong> ${groupe.toLowerCase().includes("compét") || groupe.toLowerCase().includes("compet") ? "Oui" : "Non"}</p>
                    <p><strong>Groupe / catégorie :</strong> ${groupe}</p>
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
                        ${historique.length === 0
                            ? `<tr><td colspan="3">Aucune inscription trouvée.</td></tr>`
                            : historique.map(inscription => `
                                <tr>
                                    <td>${inscription.saison || ""}</td>
                                    <td>${groupeAdherent(adherent, inscription)}</td>
                                    <td>${inscription.statutPaiement || ""}</td>
                                </tr>
                            `).join("")
                        }
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

async function initialiserFicheComplete() {
    if (!fiche) return;
    fiche.innerHTML = `<p>Chargement de la fiche...</p>`;

    try {
        const [adherents, inscriptions] = await Promise.all([
            listAdherents(),
            listInscriptions()
        ]);

        adherent = adherents.find(item =>
            String(item.numeroAdherent) === String(numero) ||
            String(item.id) === String(numero)
        ) || null;

        historique = inscriptionsPour(inscriptions, adherent?.numeroAdherent || numero);
        derniereInscription = historique[historique.length - 1] || null;
        donnees = donneesInscription(derniereInscription);

        afficherFicheComplete();
    } catch (error) {
        console.error("Impossible de charger la fiche complète :", error);
        fiche.innerHTML = `<h1>Impossible de charger la fiche.</h1><p>${error.message || ""}</p>`;
    }
}

window.afficherPhotoManquante = afficherPhotoManquante;
initialiserFicheComplete();
