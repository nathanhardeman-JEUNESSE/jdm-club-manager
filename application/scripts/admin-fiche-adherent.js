import {
    listAdherents,
    listInscriptions
} from "../firebase/firebase-db.js";

import {
    champ,
    donneesInscription,
    groupeAdherent,
    inscriptionsPour,
    telephoneAdherent,
    parent1Adherent,
    parent2Adherent,
    emailAdherent,
    dateNaissanceAdherent,
    verifierDossier
} from "./adherent-data.js";

const params = new URLSearchParams(window.location.search);
const numero = params.get("id");

let adherents = [];
let inscriptions = [];
let adherent = null;
let inscriptionsAdherent = [];

const aidesLicence = JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];
let validationsDossiers = JSON.parse(localStorage.getItem("validationsDossiersJDM")) || [];

const fiche = document.getElementById("fiche-adherent");

function aidePour(numeroAdherent) {
    return aidesLicence.find(aide =>
        String(aide.numeroAdherent) === String(numeroAdherent)
    ) || null;
}

function validationPour(numeroAdherent) {
    return validationsDossiers.find(validation =>
        String(validation.numeroAdherent) === String(numeroAdherent)
    ) || null;
}

function definirValidationManuelle(numeroAdherent, valeur) {
    let validation = validationPour(numeroAdherent);

    if (!validation) {
        validation = {
            numeroAdherent,
            valideManuellement: false,
            dateValidation: "",
            commentaire: ""
        };
        validationsDossiers.push(validation);
    }

    validation.valideManuellement = valeur;
    validation.dateValidation = valeur ? new Date().toISOString() : "";

    localStorage.setItem("validationsDossiersJDM", JSON.stringify(validationsDossiers));
    afficherFiche();
}

function afficherFiche() {
    if (!fiche) return;

    if (!adherent) {
        fiche.innerHTML = `
            <section class="card">
                <h2>Erreur</h2>
                <p>Adhérent introuvable.</p>
            </section>
        `;
        return;
    }

    const derniereInscription = inscriptionsAdherent[inscriptionsAdherent.length - 1] || null;
    const donnees = donneesInscription(derniereInscription);
    const validation = validationPour(adherent.numeroAdherent);
    const dossier = verifierDossier(adherent, derniereInscription, {
        aide: aidePour(adherent.numeroAdherent),
        validation
    });

    const groupe = groupeAdherent(adherent, derniereInscription);
    const telephone = telephoneAdherent(adherent, derniereInscription) || "Non renseigné";
    const parent1 = parent1Adherent(adherent, derniereInscription) || "Non renseigné";
    const parent2 = parent2Adherent(adherent, derniereInscription) || "Non renseigné";
    const email = emailAdherent(adherent, derniereInscription) || "Non renseigné";
    const dateNaissance = dateNaissanceAdherent(adherent, derniereInscription) || "Non renseignée";
    const montant = derniereInscription?.montant ?? (donnees.amount ? Number(donnees.amount) / 100 : "Non renseigné");

    fiche.innerHTML = `
        <section class="card">
            <h2>${adherent.prenom || ""} ${adherent.nom || ""}</h2>
            <p><strong>Numéro adhérent :</strong> ${adherent.numeroAdherent || numero}</p>
            <p><strong>Date de naissance :</strong> ${dateNaissance}</p>
            <p><strong>Groupe :</strong> ${groupe}</p>
        </section>

        <section class="card">
            <h2>📋 Contrôle administratif</h2>
            <p>
                <strong>Dossier :</strong>
                ${dossier.complet ? "🟢 Complet" : "🔴 Incomplet"}
                ${dossier.manuel ? " · validé manuellement" : ""}
            </p>

            ${dossier.complet
                ? ""
                : `<p><strong>Éléments à vérifier :</strong> ${dossier.manquants.join(" · ")}</p>`
            }

            <label>
                <input
                    type="checkbox"
                    ${validation?.valideManuellement ? "checked" : ""}
                    onchange="definirValidationManuelle('${adherent.numeroAdherent}', this.checked)">
                Dossier validé manuellement
            </label>

            ${validation?.dateValidation
                ? `<p><strong>Date validation :</strong> ${new Date(validation.dateValidation).toLocaleString("fr-FR")}</p>`
                : ""
            }
        </section>

        <section class="card">
            <h2>📅 Inscription</h2>
            <p><strong>Saison :</strong> ${derniereInscription?.saison || "Non renseignée"}</p>
            <p><strong>Formule / groupe :</strong> ${groupe}</p>
            <p><strong>Statut paiement :</strong> ${derniereInscription?.statutPaiement || "Non renseigné"}</p>
            <p><strong>Montant :</strong> ${montant} €</p>
            <p><strong>Type :</strong> ${donnees.type || "Non renseigné"}</p>
        </section>

        <section class="card">
            <h2>👨‍👩‍👧 Famille / contacts</h2>
            <p><strong>Email :</strong> ${email}</p>
            <p><strong>Email parent 2 :</strong> ${adherent.emailParent2 || champ(donnees, ["email", "parent", "2"], "Non renseigné")}</p>
            <p><strong>Parent 1 :</strong> ${parent1}</p>
            <p><strong>Parent 2 :</strong> ${parent2}</p>
            <p><strong>Adresse :</strong> ${champ(donnees, ["adresse", "postale"], "Non renseignée")}</p>
            <p><strong>Code postal :</strong> ${champ(donnees, ["code", "postal"], "Non renseigné")}</p>
            <p><strong>Ville :</strong> ${champ(donnees, ["ville"], "Non renseignée")}</p>
        </section>

        <section class="card">
            <h2>🚑 Urgence</h2>
            <p><strong>Personne à prévenir :</strong> ${champ(donnees, ["personne", "urgence"], parent1)}</p>
            <p><strong>Téléphone urgence :</strong> ${telephone}</p>
        </section>

        <section class="card">
            <h2>📸 Autorisations</h2>
            <p><strong>Droit à l'image :</strong> ${champ(donnees, ["droit", "image"], "Non renseigné")}</p>
        </section>

        <section class="card">
            <h2>📚 Historique</h2>
            ${inscriptionsAdherent.length === 0
                ? "<p>Aucune inscription trouvée.</p>"
                : inscriptionsAdherent.map(inscription => {
                    const groupeHistorique = groupeAdherent(adherent, inscription);
                    return `
                        <p>
                            <strong>Saison :</strong> ${inscription.saison || "Non renseignée"}<br>
                            <strong>Groupe :</strong> ${groupeHistorique}<br>
                            <strong>Paiement :</strong> ${inscription.statutPaiement || "Non renseigné"}
                        </p>
                        <hr>
                    `;
                }).join("")
            }
        </section>

        <section class="card">
            <h2>📄 Documents</h2>
            <p><strong>Certificat médical :</strong> ${champ(donnees, ["certificat", "medical"], "Non renseigné")}</p>
            <p><strong>Photo licence :</strong> ${champ(donnees, ["photo", "licence"], "Non renseigné")}</p>
            <p><strong>Justificatif domicile :</strong> ${champ(donnees, ["justificatif", "domicile"], "Non renseigné")}</p>
        </section>

        <a href="fiche-adherent-complete.html?id=${encodeURIComponent(adherent.numeroAdherent)}" class="navigation-link">
            <section class="navigation-card">
                <div class="navigation-icon">📄</div>
                <div class="navigation-content">
                    <h2>Fiche adhérent</h2>
                    <p>Générer la fiche administrative complète de l'adhérent.</p>
                </div>
                <div class="navigation-arrow">➜</div>
            </section>
        </a>

        <a href="carte-adherent.html?id=${encodeURIComponent(adherent.numeroAdherent)}" class="navigation-link">
            <section class="navigation-card">
                <div class="navigation-icon">🪪</div>
                <div class="navigation-content">
                    <h2>Carte adhérent</h2>
                    <p>Générer la carte membre individuelle.</p>
                </div>
                <div class="navigation-arrow">➜</div>
            </section>
        </a>
    `;
}

async function initialiserFiche() {
    if (!fiche) return;

    fiche.innerHTML = `<section class="card"><p>Chargement de la fiche...</p></section>`;

    try {
        [adherents, inscriptions] = await Promise.all([
            listAdherents(),
            listInscriptions()
        ]);

        adherent = adherents.find(item =>
            String(item.numeroAdherent) === String(numero) ||
            String(item.id) === String(numero)
        ) || null;

        inscriptionsAdherent = inscriptionsPour(
            inscriptions,
            adherent?.numeroAdherent || numero
        );

        afficherFiche();
    } catch (error) {
        console.error("Impossible de charger la fiche adhérent :", error);
        fiche.innerHTML = `
            <section class="card">
                <h2>Erreur</h2>
                <p>Impossible de charger la fiche depuis le serveur.</p>
                <p><small>${error.message || ""}</small></p>
            </section>
        `;
    }
}

window.definirValidationManuelle = definirValidationManuelle;
initialiserFiche();
