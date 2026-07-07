const params = new URLSearchParams(window.location.search);
const numero = params.get("id");

const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];
const aidesLicence = JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];
let validationsDossiers = JSON.parse(localStorage.getItem("validationsDossiersJDM")) || [];

const adherent = adherents.find(a => String(a.numeroAdherent) === String(numero));
const inscriptionsAdherent = inscriptions.filter(i => String(i.numeroAdherent) === String(numero));

const fiche = document.getElementById("fiche-adherent");

function nettoyer(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function champ(donnees, mots) {
    if (!donnees) return "Non renseigné";

    const cle = Object.keys(donnees).find(cle =>
        mots.every(mot => nettoyer(cle).includes(nettoyer(mot)))
    );

    return cle ? donnees[cle] : "Non renseigné";
}

function champBrut(donnees, mots) {
    const valeur = champ(donnees, mots);
    return valeur === "Non renseigné" ? "" : valeur;
}

function sauvegarderValidations() {
    localStorage.setItem("validationsDossiersJDM", JSON.stringify(validationsDossiers));
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

    sauvegarderValidations();
    afficherFiche();
}

function aidePour(numeroAdherent) {
    return aidesLicence.find(aide =>
        String(aide.numeroAdherent) === String(numeroAdherent)
    ) || null;
}

function calculerAge(dateNaissance) {
    if (!dateNaissance) return null;

    let naissance = null;

    if (String(dateNaissance).includes("/")) {
        const morceaux = String(dateNaissance).split("/");
        if (morceaux.length === 3) {
            naissance = new Date(Number(morceaux[2]), Number(morceaux[1]) - 1, Number(morceaux[0]));
        }
    } else {
        naissance = new Date(dateNaissance);
    }

    if (!naissance || Number.isNaN(naissance.getTime())) return null;

    const aujourdHui = new Date();
    let age = aujourdHui.getFullYear() - naissance.getFullYear();
    const mois = aujourdHui.getMonth() - naissance.getMonth();

    if (mois < 0 || (mois === 0 && aujourdHui.getDate() < naissance.getDate())) {
        age--;
    }

    return age;
}

function groupeAdherent(donnees) {
    return adherent.groupe || champBrut(donnees, ["tarif"]) || "Non renseigné";
}

function estCompetition(donnees) {
    const groupe = nettoyer(groupeAdherent(donnees));
    return groupe.includes("compet") || groupe.includes("compét");
}

function estLomme(donnees) {
    const ville = nettoyer(champBrut(donnees, ["ville"]));
    const codePostal = String(champBrut(donnees, ["code", "postal"]) || "").trim();

    return ville.includes("lomme") || codePostal === "59160";
}

function dossierAdministratif(donnees) {
    const validation = validationPour(adherent.numeroAdherent);

    if (validation && validation.valideManuellement === true) {
        return {
            complet: true,
            manuel: true,
            manquants: []
        };
    }

    const texte = nettoyer(JSON.stringify(donnees));
    const aide = aidePour(adherent.numeroAdherent);
    const age = calculerAge(adherent.dateNaissance || champBrut(donnees, ["date", "naissance"]) || champBrut(donnees, ["naissance"]));
    const competition = estCompetition(donnees);

    const manquants = [];

    const email = champBrut(donnees, ["email"]) || champBrut(donnees, ["email", "adherent"]) || champBrut(donnees, ["email", "parent"]);
    if (!email && !adherent.email) {
        manquants.push("Email");
    }

    const telephone = adherent.telephone || champBrut(donnees, ["telephone"]) || champBrut(donnees, ["téléphone"]) || champBrut(donnees, ["urgence"]);
    if (!telephone) {
        manquants.push("Téléphone");
    }

    if (!groupeAdherent(donnees) || groupeAdherent(donnees) === "Non renseigné") {
        manquants.push("Groupe");
    }

    if (age === null) {
        manquants.push("Date de naissance");
    }

    if (age !== null && age < 18) {
        const parent1 = champBrut(donnees, ["parent", "1"]) || champBrut(donnees, ["representant"]) || champBrut(donnees, ["représentant"]);
        if (!parent1) {
            manquants.push("Représentant légal");
        }
    }

    const paiementOK =
        aide && aide.statutCotisation === "regle" ||
        texte.includes("cb") ||
        texte.includes("carte bancaire") ||
        texte.includes("regle") ||
        texte.includes("réglé") ||
        texte.includes("paye") ||
        texte.includes("payé");

    if (!paiementOK) {
        manquants.push("Cotisation");
    }

    if (competition) {
        const photoOK =
            texte.includes("photo d'identite") ||
            texte.includes("photo d’identité") ||
            texte.includes("photo identite") ||
            texte.includes("photo licence");

        if (!photoOK) {
            manquants.push("Photo licence");
        }

        const certificatCompetitionOK =
            texte.includes("certificat medical") ||
            texte.includes("certificat médical") ||
            texte.includes("competition") ||
            texte.includes("compétition");

        if (!certificatCompetitionOK) {
            manquants.push("Certificat compétition");
        }
    } else {
        const certificatLoisirOK =
            texte.includes("questionnaire de sante") ||
            texte.includes("questionnaire de santé") ||
            texte.includes("certificat medical") ||
            texte.includes("certificat médical");

        if (!certificatLoisirOK) {
            manquants.push("Questionnaire santé / certificat");
        }
    }

    if (estLomme(donnees)) {
        const justificatifOK =
            texte.includes("justificatif domicile") ||
            texte.includes("justificatif de domicile");

        if (!justificatifOK) {
            manquants.push("Justificatif domicile");
        }
    }

    return {
        complet: manquants.length === 0,
        manuel: false,
        manquants
    };
}

function afficherFiche() {
    if (!adherent) {
        fiche.innerHTML = `
            <section class="card">
                <h2>Erreur</h2>
                <p>Adhérent introuvable.</p>
            </section>
        `;
        return;
    }

    const derniereInscription = inscriptionsAdherent[inscriptionsAdherent.length - 1];
    const donnees = derniereInscription ? derniereInscription.donneesHelloAsso : {};
    const dossier = dossierAdministratif(donnees);
    const validation = validationPour(adherent.numeroAdherent);

    fiche.innerHTML = `
        <section class="card">
            <h2>${adherent.prenom} ${adherent.nom}</h2>
            <p><strong>Numéro adhérent :</strong> ${adherent.numeroAdherent}</p>
            <p><strong>Date de naissance :</strong> ${adherent.dateNaissance}</p>
        </section>

        <section class="card">
            <h2>📋 Contrôle administratif</h2>

            <p>
                <strong>Dossier :</strong>
                ${dossier.complet ? "🟢 Complet" : "🔴 Incomplet"}
                ${dossier.manuel ? " · validé manuellement" : ""}
            </p>

            ${
                dossier.complet
                    ? ""
                    : `<p><strong>Éléments à vérifier :</strong> ${dossier.manquants.join(" · ")}</p>`
            }

            <label>
                <input type="checkbox"
                       ${validation && validation.valideManuellement ? "checked" : ""}
                       onchange="definirValidationManuelle('${adherent.numeroAdherent}', this.checked)">
                Dossier validé manuellement
            </label>

            ${
                validation && validation.dateValidation
                    ? `<p><strong>Date validation :</strong> ${new Date(validation.dateValidation).toLocaleString("fr-FR")}</p>`
                    : ""
            }
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

        <a href="fiche-adherent-complete.html?id=${adherent.numeroAdherent}" class="navigation-link">
            <section class="navigation-card">
                <div class="navigation-icon">📄</div>
                <div class="navigation-content">
                    <h2>Fiche adhérent</h2>
                    <p>Générer la fiche administrative complète de l'adhérent.</p>
                </div>
                <div class="navigation-arrow">➜</div>
            </section>
        </a>

        <a href="carte-adherent.html?id=${adherent.numeroAdherent}" class="navigation-link">
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

afficherFiche();
