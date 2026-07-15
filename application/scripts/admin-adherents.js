import {
    listAdherents,
    listInscriptions
} from "../firebase/firebase-db.js";

let adherents = [];
let inscriptions = [];
const aidesLicence = JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];
const validationsDossiers = JSON.parse(localStorage.getItem("validationsDossiersJDM")) || [];

const liste = document.getElementById("liste-adherents");
const zoneStats = document.getElementById("stats-dossiers-adherents");

function nettoyer(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
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

function derniereInscription(numeroAdherent) {
    const resultats = inscriptions.filter(inscription =>
        String(inscription.numeroAdherent) === String(numeroAdherent)
    );

    return resultats[resultats.length - 1] || null;
}

function champ(donnees, mots) {
    if (!donnees) return "";

    const motsNormalises = mots.map(nettoyer);
    const cleDirecte = Object.keys(donnees).find(cle =>
        motsNormalises.every(mot => nettoyer(cle).includes(mot))
    );

    if (cleDirecte && donnees[cleDirecte] !== undefined && donnees[cleDirecte] !== null) {
        return donnees[cleDirecte];
    }

    const customFields = Array.isArray(donnees.customFields) ? donnees.customFields : [];
    const trouve = customFields.find(item => {
        const nom = nettoyer(item?.name);
        return motsNormalises.every(mot => nom.includes(mot));
    });

    return trouve?.answer ?? "";
}

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

function groupeAdherent(adherent) {
    const inscription = derniereInscription(adherent.numeroAdherent);

    return (
        inscription?.donneesHelloAsso?.name ||
        inscription?.groupe ||
        adherent.groupeNom ||
        (adherent.groupe && adherent.groupe !== "Fixed" ? adherent.groupe : "") ||
        "Non renseigné"
    );
}

function emailAdherent(adherent) {
    if (adherent.email) return adherent.email;

    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};

    return champ(donnees, ["email"]) ||
        champ(donnees, ["email", "adherent"]) ||
        champ(donnees, ["email", "parent"]) ||
        "";
}

function telephoneAdherent(adherent) {
    if (adherent.telephone) return adherent.telephone;

    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};

    return champ(donnees, ["telephone"]) ||
        champ(donnees, ["téléphone"]) ||
        champ(donnees, ["urgence"]);
}

function estCompetition(adherent) {
    const groupe = nettoyer(groupeAdherent(adherent));
    return groupe.includes("compet") || groupe.includes("compét");
}

function estLomme(donnees) {
    const ville = nettoyer(champ(donnees, ["ville"]));
    const codePostal = String(champ(donnees, ["code", "postal"]) || "").trim();

    return ville.includes("lomme") || codePostal === "59160";
}

function dossierAdministratif(adherent) {
    const validation = validationPour(adherent.numeroAdherent);
    if (validation?.valideManuellement === true) {
        return { complet: true, manuel: true, manquants: [] };
    }

    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription?.donneesHelloAsso || inscription?.donnees || {};
    const aide = aidePour(adherent.numeroAdherent);
    const groupe = groupeAdherent(adherent);
    const dateNaissance = adherent.dateNaissance || champ(donnees, ["date", "naissance"]);
    const age = calculerAge(dateNaissance);
    const manquants = [];

    const email = adherent.email || adherent.emailAdherent || adherent.emailParent1 || champ(donnees, ["email"]);
    if (!email) manquants.push("Email");

    const telephone =
        adherent.telephone ||
        adherent.telephoneUrgence ||
        champ(donnees, ["telephone", "contact", "urgence"]) ||
        champ(donnees, ["telephone", "appeler", "urgence"]) ||
        champ(donnees, ["numero", "telephone"]);
    if (!telephone) manquants.push("Téléphone");

    if (!groupe || groupe === "Non renseigné" || groupe === "Fixed") manquants.push("Groupe");
    if (age === null) manquants.push("Date de naissance");

    if (age !== null && age < 18) {
        const parent1 = adherent.parent1 || champ(donnees, ["parent", "1"]) || champ(donnees, ["representant", "legal"]);
        if (!parent1) manquants.push("Représentant légal");
    }

    const statutPaiement = nettoyer(inscription?.statutPaiement || adherent?.statutPaiement || "");
    const paiementOK =
        adherent.cotisationAJour === true ||
        inscription?.cotisationAJour === true ||
        ["paye", "payee", "processed"].includes(statutPaiement) ||
        donnees?.state === "Processed" ||
        aide?.statutCotisation === "regle";
    if (!paiementOK) manquants.push("Cotisation");

    const texte = nettoyer(JSON.stringify(donnees));
    const competition = nettoyer(groupe).includes("compet");
    if (competition) {
        if (!(texte.includes("photo d'identite") || texte.includes("photo identite") || texte.includes("photo licence"))) {
            manquants.push("Photo licence");
        }
        if (!(texte.includes("certificat medical") || texte.includes("competition"))) {
            manquants.push("Certificat compétition");
        }
    } else if (!(texte.includes("questionnaire de sante") || texte.includes("attestation de reponse negative") || texte.includes("certificat medical"))) {
        manquants.push("Questionnaire santé / certificat");
    }

    const ville = nettoyer(champ(donnees, ["ville"]));
    const cp = String(champ(donnees, ["code", "postal"]) || "").trim();
    if ((ville.includes("lomme") || cp === "59160") && !(texte.includes("justificatif domicile") || texte.includes("justificatif de domicile"))) {
        manquants.push("Justificatif domicile");
    }

    return { complet: manquants.length === 0, manuel: false, manquants };
}

function afficherStats() {
    if (!zoneStats) return;

    const total = adherents.length;
    const complets = adherents.filter(adherent => dossierAdministratif(adherent).complet).length;
    const incomplets = total - complets;

    zoneStats.innerHTML = `
        <section class="card">
            <h2>📊 Suivi des dossiers</h2>
            <p><strong>Adhérents :</strong> ${total}</p>
            <p><strong>Dossiers complets :</strong> 🟢 ${complets}</p>
            <p><strong>Dossiers incomplets :</strong> 🔴 ${incomplets}</p>
        </section>
    `;
}

function afficherAdherents() {
    if (adherents.length === 0) {
        liste.innerHTML = `
            <section class="card">
                <h2>Aucun adhérent</h2>

                <p>
                    Aucun adhérent n'a encore été importé.
                </p>
            </section>
        `;

        return;
    }

    liste.innerHTML = "";

    adherents
        .slice()
        .sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || "")))
        .forEach((adherent) => {
            const dossier = dossierAdministratif(adherent);

            liste.innerHTML += `
                <section class="card">

                    <h2>${adherent.prenom || ""} ${adherent.nom || ""}</h2>

                    <p>
                        <strong>N° adhérent :</strong>
                        ${adherent.numeroAdherent || ""}
                    </p>

                    <p>
                        <strong>Date de naissance :</strong>
                        ${adherent.dateNaissance || "Non renseignée"}
                    </p>

                    <p>
                        <strong>Groupe :</strong>
                        ${groupeAdherent(adherent)}
                    </p>

                    <p>
                        <strong>Dossier :</strong>
                        ${dossier.complet ? "🟢 Complet" : "🔴 Incomplet"}
                        ${dossier.manuel ? " · validé manuellement" : ""}
                    </p>

                    ${
                        dossier.complet
                            ? ""
                            : `<p><strong>Manquant :</strong> ${dossier.manquants.join(" · ")}</p>`
                    }

                    <a
                        href="admin-fiche-adherent.html?id=${adherent.numeroAdherent}"
                        class="primary-button order-button">

                        👤 Voir la fiche

                    </a>

                </section>
            `;
        });
}

async function initialiserAdherents() {
    try {
        [adherents, inscriptions] = await Promise.all([
            listAdherents(),
            listInscriptions()
        ]);
        afficherStats();
        afficherAdherents();
    } catch (error) {
        console.error("Impossible de charger les adhérents :", error);
        liste.innerHTML = `<section class="card"><h2>Erreur</h2><p>Impossible de charger les adhérents.</p></section>`;
    }
}

initialiserAdherents();
