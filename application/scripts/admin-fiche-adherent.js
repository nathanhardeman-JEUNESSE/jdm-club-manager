import {
    listAdherents,
    listInscriptions
} from "../firebase/firebase-db.js";

const params = new URLSearchParams(window.location.search);
const numero = params.get("id");

let adherents = [];
let inscriptions = [];
let adherent = null;
let inscriptionsAdherent = [];

const aidesLicence =
    JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];

let validationsDossiers =
    JSON.parse(localStorage.getItem("validationsDossiersJDM")) || [];

const fiche = document.getElementById("fiche-adherent");

function nettoyer(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function champ(donnees, mots) {
    if (!donnees) return "Non renseigné";

    const motsNormalises = mots.map(nettoyer);

    const cleDirecte = Object.keys(donnees).find(cle =>
        motsNormalises.every(mot =>
            nettoyer(cle).includes(mot)
        )
    );

    if (
        cleDirecte &&
        donnees[cleDirecte] !== undefined &&
        donnees[cleDirecte] !== null &&
        String(donnees[cleDirecte]).trim() !== ""
    ) {
        return donnees[cleDirecte];
    }

    const customFields = Array.isArray(donnees.customFields)
        ? donnees.customFields
        : [];

    const champTrouve = customFields.find(item => {
        const nom = nettoyer(item?.name);

        return motsNormalises.every(mot =>
            nom.includes(mot)
        );
    });

    if (
        champTrouve &&
        champTrouve.answer !== undefined &&
        champTrouve.answer !== null &&
        String(champTrouve.answer).trim() !== ""
    ) {
        return champTrouve.answer;
    }

    return "Non renseigné";
}

function champBrut(donnees, mots) {
    const resultat = champ(donnees, mots);

    return resultat === "Non renseigné"
        ? ""
        : resultat;
}

function sauvegarderValidations() {
    localStorage.setItem(
        "validationsDossiersJDM",
        JSON.stringify(validationsDossiers)
    );
}

function validationPour(numeroAdherent) {
    return validationsDossiers.find(validation =>
        String(validation.numeroAdherent) ===
        String(numeroAdherent)
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
    validation.dateValidation =
        valeur ? new Date().toISOString() : "";

    sauvegarderValidations();
    afficherFiche();
}

function aidePour(numeroAdherent) {
    return aidesLicence.find(aide =>
        String(aide.numeroAdherent) ===
        String(numeroAdherent)
    ) || null;
}

function calculerAge(dateNaissance) {
    if (!dateNaissance) return null;

    let naissance = null;

    if (String(dateNaissance).includes("/")) {
        const morceaux = String(dateNaissance).split("/");

        if (morceaux.length === 3) {
            naissance = new Date(
                Number(morceaux[2]),
                Number(morceaux[1]) - 1,
                Number(morceaux[0])
            );
        }
    } else {
        naissance = new Date(dateNaissance);
    }

    if (!naissance || Number.isNaN(naissance.getTime())) {
        return null;
    }

    const aujourdHui = new Date();

    let age =
        aujourdHui.getFullYear() -
        naissance.getFullYear();

    const mois =
        aujourdHui.getMonth() -
        naissance.getMonth();

    if (
        mois < 0 ||
        (
            mois === 0 &&
            aujourdHui.getDate() < naissance.getDate()
        )
    ) {
        age--;
    }

    return age;
}

function derniereInscription() {
    return inscriptionsAdherent[
        inscriptionsAdherent.length - 1
    ] || null;
}

function donneesDerniereInscription() {
    const inscription = derniereInscription();

    return (
        inscription?.donneesHelloAsso ||
        inscription?.donnees ||
        {}
    );
}

function groupeAdherent(donnees) {
    const inscription = derniereInscription();

    return (
        adherent?.groupe ||
        adherent?.groupeNom ||
        inscription?.groupe ||
        inscription?.donneesHelloAsso?.name ||
        donnees?.name ||
        champBrut(donnees, ["tarif"]) ||
        "Non renseigné"
    );
}

function estCompetition(donnees) {
    const groupe = nettoyer(
        groupeAdherent(donnees)
    );

    return (
        groupe.includes("compet") ||
        groupe.includes("compét")
    );
}

function estLomme(donnees) {
    const ville = nettoyer(
        champBrut(donnees, ["ville"])
    );

    const codePostal = String(
        champBrut(donnees, ["code", "postal"]) || ""
    ).trim();

    return (
        ville.includes("lomme") ||
        codePostal === "59160"
    );
}

function dossierAdministratif(donnees) {
    const validation =
        validationPour(adherent.numeroAdherent);

    if (
        validation &&
        validation.valideManuellement === true
    ) {
        return {
            complet: true,
            manuel: true,
            manquants: []
        };
    }

    const inscription = derniereInscription();
    const aide = aidePour(adherent.numeroAdherent);

    const dateNaissance =
        adherent.dateNaissance ||
        champBrut(donnees, ["date", "naissance"]) ||
        champBrut(donnees, ["naissance"]);

    const age = calculerAge(dateNaissance);
    const competition = estCompetition(donnees);
    const manquants = [];

    const email =
        adherent.email ||
        adherent.emailAdherent ||
        adherent.emailParent1 ||
        champBrut(donnees, ["email", "adherent"]) ||
        champBrut(donnees, ["email"]);

    if (!email) {
        manquants.push("Email");
    }

    const telephone =
        adherent.telephone ||
        champBrut(donnees, ["telephone", "urgence"]) ||
        champBrut(donnees, ["numero", "telephone"]) ||
        champBrut(donnees, ["téléphone"]);

    if (!telephone) {
        manquants.push("Téléphone");
    }

    if (
        !groupeAdherent(donnees) ||
        groupeAdherent(donnees) === "Non renseigné"
    ) {
        manquants.push("Groupe");
    }

    if (age === null) {
        manquants.push("Date de naissance");
    }

    if (age !== null && age < 18) {
        const parent1 =
            champBrut(donnees, ["parent", "1"]) ||
            champBrut(donnees, ["representant"]) ||
            champBrut(donnees, ["représentant"]);

        if (!parent1) {
            manquants.push("Représentant légal");
        }
    }

    const paiementOK =
        adherent.cotisationAJour === true ||
        inscription?.cotisationAJour === true ||
        inscription?.statutPaiement === "payé" ||
        inscription?.statutPaiement === "paye" ||
        aide?.statutCotisation === "regle";

    if (!paiementOK) {
        manquants.push("Cotisation");
    }

    const texte = nettoyer(
        JSON.stringify(donnees)
    );

    if (competition) {
        const photoOK =
            texte.includes("photo d'identite") ||
            texte.includes("photo identite") ||
            texte.includes("photo licence");

        if (!photoOK) {
            manquants.push("Photo licence");
        }

        const certificatOK =
            texte.includes("certificat medical") ||
            texte.includes("competition");

        if (!certificatOK) {
            manquants.push("Certificat compétition");
        }
    } else {
        const santeOK =
            texte.includes("questionnaire de sante") ||
            texte.includes("attestation de reponse negative") ||
            texte.includes("certificat medical");

        if (!santeOK) {
            manquants.push(
                "Questionnaire santé / certificat"
            );
        }
    }

    if (estLomme(donnees)) {
        const justificatifOK =
            texte.includes("justificatif domicile") ||
            texte.includes("justificatif de domicile");

        if (!justificatifOK) {
            manquants.push(
                "Justificatif domicile"
            );
        }
    }

    return {
        complet: manquants.length === 0,
        manuel: false,
        manquants
    };
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

    const inscription = derniereInscription();
    const donnees = donneesDerniereInscription();
    const dossier = dossierAdministratif(donnees);

    const validation =
        validationPour(adherent.numeroAdherent);

    const dateNaissance =
        adherent.dateNaissance ||
        champ(donnees, ["date", "naissance"]);

    const groupe = groupeAdherent(donnees);

    const statutPaiement =
        inscription?.statutPaiement ||
        (
            adherent.cotisationAJour === true
                ? "payé"
                : "Non renseigné"
        );

    const montant =
        inscription?.montant ??
        (
            donnees.amount
                ? Number(donnees.amount) / 100
                : "Non renseigné"
        );

    fiche.innerHTML = `
        <section class="card">
            <h2>
                ${adherent.prenom || ""}
                ${adherent.nom || ""}
            </h2>

            <p>
                <strong>Numéro adhérent :</strong>
                ${adherent.numeroAdherent || numero}
            </p>

            <p>
                <strong>Date de naissance :</strong>
                ${dateNaissance || "Non renseignée"}
            </p>

            <p>
                <strong>Groupe :</strong>
                ${groupe}
            </p>
        </section>

        <section class="card">
            <h2>📋 Contrôle administratif</h2>

            <p>
                <strong>Dossier :</strong>
                ${
                    dossier.complet
                        ? "🟢 Complet"
                        : "🔴 Incomplet"
                }

                ${
                    dossier.manuel
                        ? " · validé manuellement"
                        : ""
                }
            </p>

            ${
                dossier.complet
                    ? ""
                    : `
                        <p>
                            <strong>Éléments à vérifier :</strong>
                            ${dossier.manquants.join(" · ")}
                        </p>
                    `
            }

            <label>
                <input
                    type="checkbox"
                    ${
                        validation?.valideManuellement
                            ? "checked"
                            : ""
                    }
                    onchange="definirValidationManuelle(
                        '${adherent.numeroAdherent}',
                        this.checked
                    )"
                >

                Dossier validé manuellement
            </label>

            ${
                validation?.dateValidation
                    ? `
                        <p>
                            <strong>Date validation :</strong>
                            ${
                                new Date(
                                    validation.dateValidation
                                ).toLocaleString("fr-FR")
                            }
                        </p>
                    `
                    : ""
            }
        </section>

        <section class="card">
            <h2>📅 Inscription</h2>

            <p>
                <strong>Saison :</strong>
                ${inscription?.saison || "Non renseignée"}
            </p>

            <p>
                <strong>Formule / groupe :</strong>
                ${groupe}
            </p>

            <p>
                <strong>Statut paiement :</strong>
                ${statutPaiement}
            </p>

            <p>
                <strong>Montant :</strong>
                ${montant} €
            </p>

            <p>
                <strong>Type :</strong>
                ${donnees.type || "Non renseigné"}
            </p>
        </section>

        <section class="card">
            <h2>👨‍👩‍👧 Famille / contacts</h2>

            <p>
                <strong>Email :</strong>
                ${
                    adherent.email ||
                    adherent.emailAdherent ||
                    champ(donnees, ["email", "adherent"])
                }
            </p>

            <p>
                <strong>Email parent 2 :</strong>
                ${
                    adherent.emailParent2 ||
                    champ(donnees, ["email", "parent", "2"])
                }
            </p>

            <p>
                <strong>Parent 1 :</strong>
                ${champ(donnees, ["parent", "1"])}
            </p>

            <p>
                <strong>Parent 2 :</strong>
                ${champ(donnees, ["parent", "2"])}
            </p>

            <p>
                <strong>Adresse :</strong>
                ${champ(donnees, ["adresse", "postale"])}
            </p>

            <p>
                <strong>Code postal :</strong>
                ${champ(donnees, ["code", "postal"])}
            </p>

            <p>
                <strong>Ville :</strong>
                ${champ(donnees, ["ville"])}
            </p>
        </section>

        <section class="card">
            <h2>🚑 Urgence</h2>

            <p>
                <strong>Personne à prévenir :</strong>
                ${
                    champ(
                        donnees,
                        ["personne", "urgence"]
                    ) !== "Non renseigné"
                        ? champ(
                            donnees,
                            ["personne", "urgence"]
                        )
                        : champ(
                            donnees,
                            ["parent", "1"]
                        )
                }
            </p>

            <p>
                <strong>Téléphone urgence :</strong>
                ${champ(donnees, ["telephone", "urgence"])}
            </p>
        </section>

        <section class="card">
            <h2>📸 Autorisations</h2>

            <p>
                <strong>Droit à l'image :</strong>
                ${champ(donnees, ["droit", "image"])}
            </p>
        </section>

        <section class="card">
            <h2>📚 Historique</h2>

            ${
                inscriptionsAdherent.length === 0
                    ? `
                        <p>
                            Aucune inscription trouvée.
                        </p>
                    `
                    : inscriptionsAdherent.map(item => {
                        const donneesItem =
                            item.donneesHelloAsso ||
                            item.donnees ||
                            {};

                        const groupeItem =
                            item.groupe ||
                            donneesItem.name ||
                            champ(
                                donneesItem,
                                ["tarif"]
                            );

                        return `
                            <p>
                                <strong>Saison :</strong>
                                ${item.saison || "Non renseignée"}
                                <br>

                                <strong>Groupe :</strong>
                                ${groupeItem}
                                <br>

                                <strong>Paiement :</strong>
                                ${
                                    item.statutPaiement ||
                                    "Non renseigné"
                                }
                            </p>

                            <hr>
                        `;
                    }).join("")
            }
        </section>

        <section class="card">
            <h2>📄 Documents</h2>

            <p>
                <strong>Questionnaire santé :</strong>
                ${
                    champ(
                        donnees,
                        ["questionnaire", "sante"]
                    ) !== "Non renseigné"
                        ? champ(
                            donnees,
                            ["questionnaire", "sante"]
                        )
                        : champ(
                            donnees,
                            ["attestation", "reponse", "negative"]
                        )
                }
            </p>

            <p>
                <strong>Certificat médical :</strong>
                ${champ(donnees, ["certificat", "medical"])}
            </p>

            <p>
                <strong>Photo licence :</strong>
                ${champ(donnees, ["photo", "licence"])}
            </p>

            <p>
                <strong>Justificatif domicile :</strong>
                ${
                    champ(
                        donnees,
                        ["justificatif", "domicile"]
                    )
                }
            </p>
        </section>

        <a
            href="fiche-adherent-complete.html?id=${encodeURIComponent(
                adherent.numeroAdherent
            )}"
            class="navigation-link"
        >
            <section class="navigation-card">
                <div class="navigation-icon">📄</div>

                <div class="navigation-content">
                    <h2>Fiche adhérent</h2>

                    <p>
                        Générer la fiche administrative
                        complète de l'adhérent.
                    </p>
                </div>

                <div class="navigation-arrow">➜</div>
            </section>
        </a>

        <a
            href="carte-adherent.html?id=${encodeURIComponent(
                adherent.numeroAdherent
            )}"
            class="navigation-link"
        >
            <section class="navigation-card">
                <div class="navigation-icon">🪪</div>

                <div class="navigation-content">
                    <h2>Carte adhérent</h2>

                    <p>
                        Générer la carte membre individuelle.
                    </p>
                </div>

                <div class="navigation-arrow">➜</div>
            </section>
        </a>
    `;
}

async function initialiserFiche() {
    if (!fiche) return;

    fiche.innerHTML = `
        <section class="card">
            <p>Chargement de la fiche...</p>
        </section>
    `;

    try {
        [adherents, inscriptions] = await Promise.all([
            listAdherents(),
            listInscriptions()
        ]);

        adherent = adherents.find(item =>
            String(item.numeroAdherent) ===
                String(numero) ||
            String(item.id) ===
                String(numero)
        ) || null;

        inscriptionsAdherent =
            inscriptions.filter(item =>
                String(item.numeroAdherent) ===
                String(
                    adherent?.numeroAdherent ||
                    numero
                )
            );

        inscriptionsAdherent.sort((a, b) =>
            String(a.dateInscription || "")
                .localeCompare(
                    String(b.dateInscription || "")
                )
        );

        afficherFiche();
    } catch (error) {
        console.error(
            "Impossible de charger la fiche adhérent :",
            error
        );

        fiche.innerHTML = `
            <section class="card">
                <h2>Erreur</h2>

                <p>
                    Impossible de charger la fiche
                    depuis le serveur.
                </p>

                <p>
                    <small>
                        ${error.message || ""}
                    </small>
                </p>
            </section>
        `;
    }
}

window.definirValidationManuelle =
    definirValidationManuelle;

initialiserFiche();