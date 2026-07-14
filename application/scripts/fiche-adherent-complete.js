import {
    listAdherents,
    listInscriptions
} from "../firebase/firebase-db.js";

const params = new URLSearchParams(window.location.search);
const numero = params.get("id");

let adherents = [];
let inscriptions = [];

let adherent = null;
let historique = [];
let derniereInscription = null;
let donnees = {};

const fiche = document.getElementById("fiche-pdf");

function nettoyer(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function champ(donneesSource, mots) {
    if (!donneesSource) return "";

    const cle = Object.keys(donneesSource).find(cle =>
        mots.every(mot =>
            nettoyer(cle).includes(nettoyer(mot))
        )
    );

    return cle ? donneesSource[cle] : "";
}

function valeur(texte) {
    return texte || "";
}

function extraireUrlPhoto(valeurChamp) {
    const texte = String(valeurChamp || "").trim();

    if (!texte) return "";

    const match = texte.match(/https?:\/\/[^\s"'<>]+/i);

    if (match) {
        return match[0];
    }

    if (
        texte.startsWith("http://") ||
        texte.startsWith("https://")
    ) {
        return texte;
    }

    return "";
}

function photoIdentiteHTML(donneesSource) {
    const photoLicence =
        champ(donneesSource, ["photo", "identite", "licence"]) ||
        champ(donneesSource, ["photo", "identité", "licence"]) ||
        champ(donneesSource, ["photo", "licence"]) ||
        champ(donneesSource, ["photo"]);

    const urlPhoto = extraireUrlPhoto(photoLicence);

    if (urlPhoto) {
        return `
            <div class="fiche-photo-box">
                <img
                    src="${urlPhoto}"
                    class="fiche-photo-identite"
                    alt="Photo d'identité"
                    onerror="afficherPhotoManquante(this)"
                >
            </div>
        `;
    }

    return `
        <div class="fiche-photo-box">
            <div class="fiche-photo-icon">👤</div>
            <div class="fiche-photo-label">
                PHOTO D'IDENTITÉ
            </div>
        </div>
    `;
}

function afficherPhotoManquante(image) {
    const parent = image.parentElement;

    if (!parent) return;

    parent.innerHTML = `
        <div class="fiche-photo-icon">👤</div>
        <div class="fiche-photo-label">
            PHOTO MANQUANTE
        </div>
    `;
}

function afficherFicheComplete() {
    if (!fiche) return;

    if (!adherent) {
        fiche.innerHTML = `
            <section class="fiche-pdf-page">
                <h1>Adhérent introuvable</h1>
            </section>
        `;
        return;
    }

    const photoHTML = photoIdentiteHTML(donnees);

    fiche.innerHTML = `
        <section class="fiche-pdf-page">

            <header class="fiche-pdf-header">
                ${photoHTML}

                <div class="fiche-pdf-title">
                    <h1>FICHE ADHÉRENT</h1>
                    <h2>LA JEUNESSE DU MARAIS</h2>
                    <p>CLUB DE GYMNASTIQUE - LOMME</p>
                </div>

                <img
                    src="../images/logo-jdm-noir.png"
                    class="fiche-pdf-logo"
                    alt="Logo Jeunesse du Marais"
                >
            </header>

            <div class="fiche-grid-2">
                <section class="fiche-block">
                    <h3>IDENTITÉ</h3>

                    <p>
                        <strong>Nom :</strong>
                        ${valeur(adherent.nom)}
                    </p>

                    <p>
                        <strong>Prénom :</strong>
                        ${valeur(adherent.prenom)}
                    </p>

                    <p>
                        <strong>Date de naissance :</strong>
                        ${valeur(adherent.dateNaissance)}
                    </p>

                    <p>
                        <strong>N° adhérent :</strong>
                        ${valeur(adherent.numeroAdherent)}
                    </p>
                </section>

                <section class="fiche-block">
                    <h3>INSCRIPTION</h3>

                    <p>
                        <strong>Saison :</strong>
                        ${
                            derniereInscription
                                ? derniereInscription.saison || ""
                                : ""
                        }
                    </p>

                    <p>
                        <strong>Groupe / formule :</strong>
                        ${
                            adherent.groupe ||
                            champ(donnees, ["tarif"])
                        }
                    </p>

                    <p>
                        <strong>Statut paiement :</strong>
                        ${champ(donnees, ["statut", "commande"])}
                    </p>

                    <p>
                        <strong>Moyen de paiement :</strong>
                        ${champ(donnees, ["moyen", "paiement"])}
                    </p>
                </section>
            </div>

            <div class="fiche-grid-2">
                <section class="fiche-block">
                    <h3>RESPONSABLE LÉGAL 1</h3>

                    <p>
                        <strong>Nom / prénom :</strong>
                        ${champ(donnees, ["parent", "1"])}
                    </p>

                    <p>
                        <strong>Téléphone :</strong>
                        ${champ(donnees, ["telephone", "parent", "1"])}
                    </p>

                    <p>
                        <strong>Email :</strong>
                        ${
                            adherent.emailParent1 ||
                            adherent.email ||
                            champ(donnees, ["email", "adherent"])
                        }
                    </p>
                </section>

                <section class="fiche-block">
                    <h3>RESPONSABLE LÉGAL 2</h3>

                    <p>
                        <strong>Nom / prénom :</strong>
                        ${champ(donnees, ["parent", "2"])}
                    </p>

                    <p>
                        <strong>Téléphone :</strong>
                        ${champ(donnees, ["telephone", "parent", "2"])}
                    </p>

                    <p>
                        <strong>Email :</strong>
                        ${
                            adherent.emailParent2 ||
                            champ(donnees, ["email", "parent", "2"])
                        }
                    </p>
                </section>
            </div>

            <div class="fiche-grid-2">
                <section class="fiche-block">
                    <h3>URGENCE</h3>

                    <p>
                        <strong>Personne à contacter :</strong>
                        ${champ(donnees, ["personne", "urgence"])}
                    </p>

                    <p>
                        <strong>Téléphone :</strong>
                        ${
                            adherent.telephone ||
                            champ(donnees, ["telephone", "urgence"])
                        }
                    </p>
                </section>

                <section class="fiche-block">
                    <h3>DROIT À L'IMAGE</h3>

                    <p>
                        ${
                            champ(donnees, ["droit", "image"]) ||
                            "Non renseigné"
                        }
                    </p>
                </section>
            </div>

            <section class="fiche-block">
                <h3>COORDONNÉES</h3>

                <div class="fiche-grid-2">
                    <p>
                        <strong>Adresse :</strong>
                        ${
                            adherent.adresse ||
                            champ(donnees, ["adresse"])
                        }
                    </p>

                    <p>
                        <strong>Contact mail :</strong>
                        ${
                            adherent.email ||
                            champ(donnees, ["email"])
                        }
                    </p>

                    <p>
                        <strong>Code postal :</strong>
                        ${
                            adherent.codePostal ||
                            champ(donnees, ["code", "postal"])
                        }
                    </p>

                    <p>
                        <strong>Ville :</strong>
                        ${
                            adherent.ville ||
                            champ(donnees, ["ville"])
                        }
                    </p>
                </div>
            </section>

            <section class="fiche-block">
                <h3>INFORMATIONS SPORTIVES</h3>

                <div class="fiche-grid-3">
                    <p>
                        <strong>Compétition :</strong>
                        ${champ(donnees, ["competition"])}
                    </p>

                    <p>
                        <strong>Groupe / catégorie :</strong>
                        ${
                            adherent.groupe ||
                            champ(donnees, ["tarif"])
                        }
                    </p>

                    <p>
                        <strong>Fédération :</strong>
                        ${champ(donnees, ["federation"])}
                    </p>
                </div>
            </section>

            <section class="fiche-block">
                <h3>DOCUMENTS FOURNIS</h3>

                <div class="fiche-grid-3">
                    <p>
                        <strong>Certificat médical :</strong>
                        ${champ(donnees, ["certificat", "medical"])}
                    </p>

                    <p>
                        <strong>Photo licence :</strong>
                        ${
                            champ(
                                donnees,
                                ["photo", "identite", "licence"]
                            ) ||
                            champ(donnees, ["photo", "licence"])
                        }
                    </p>

                    <p>
                        <strong>Justificatif domicile :</strong>
                        ${champ(donnees, ["justificatif", "domicile"])}
                    </p>
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
                        ${
                            historique.length === 0
                                ? `
                                    <tr>
                                        <td colspan="3">
                                            Aucune inscription trouvée.
                                        </td>
                                    </tr>
                                `
                                : historique.map(inscription => {
                                    const donneesInscription =
                                        inscription.donneesHelloAsso ||
                                        inscription.donnees ||
                                        {};

                                    return `
                                        <tr>
                                            <td>
                                                ${inscription.saison || ""}
                                            </td>

                                            <td>
                                                ${
                                                    inscription.groupe ||
                                                    champ(
                                                        donneesInscription,
                                                        ["tarif"]
                                                    )
                                                }
                                            </td>

                                            <td>
                                                ${
                                                    inscription.statutPaiement ||
                                                    champ(
                                                        donneesInscription,
                                                        ["statut", "commande"]
                                                    )
                                                }
                                            </td>
                                        </tr>
                                    `;
                                }).join("")
                        }
                    </tbody>
                </table>
            </section>

            <section class="fiche-signature">
                <p>
                    <strong>Date :</strong>
                    ____ / ____ / ______
                </p>

                <p>
                    <strong>Signature :</strong>
                    ______________________________
                </p>
            </section>

        </section>
    `;
}

async function initialiserFicheComplete() {
    if (!fiche) return;

    fiche.innerHTML = `
        <section class="fiche-pdf-page">
            <p>Chargement de la fiche...</p>
        </section>
    `;

    try {
        [adherents, inscriptions] = await Promise.all([
            listAdherents(),
            listInscriptions()
        ]);

        adherent = adherents.find(item =>
            String(item.numeroAdherent) === String(numero) ||
            String(item.id) === String(numero)
        ) || null;

        historique = inscriptions.filter(item =>
            String(item.numeroAdherent) === String(numero)
        );

        derniereInscription =
            historique[historique.length - 1] || null;

        donnees =
            derniereInscription?.donneesHelloAsso ||
            derniereInscription?.donnees ||
            {};

        afficherFicheComplete();
    } catch (error) {
        console.error(
            "Impossible de charger la fiche complète :",
            error
        );

        fiche.innerHTML = `
            <section class="fiche-pdf-page">
                <h1>Impossible de charger la fiche.</h1>
                <p>${error.message || ""}</p>
            </section>
        `;
    }
}

window.afficherPhotoManquante = afficherPhotoManquante;

initialiserFicheComplete();