import {
    listAdherents,
    listInscriptions
} from "../firebase/firebase-db.js";

let adherents = [];
let inscriptions = [];

const aidesLicence =
    JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];

const validationsDossiers =
    JSON.parse(localStorage.getItem("validationsDossiersJDM")) || [];

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

    const cle = Object.keys(donnees).find(cle =>
        mots.every(mot => nettoyer(cle).includes(nettoyer(mot)))
    );

    return cle ? donnees[cle] : "";
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
    if (adherent.groupe) return adherent.groupe;

    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};

    return champ(donnees, ["tarif"]) || "Non renseigné";
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

    if (validation && validation.valideManuellement === true) {
        return {
            complet: true,
            manuel: true,
            manquants: []
        };
    }

    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
    const texte = nettoyer(JSON.stringify(donnees));
    const aide = aidePour(adherent.numeroAdherent);
    const age = calculerAge(adherent.dateNaissance || champ(donnees, ["date", "naissance"]) || champ(donnees, ["naissance"]));
    const competition = estCompetition(adherent);

    const manquants = [];

    if (!emailAdherent(adherent)) {
        manquants.push("Email");
    }

    if (!telephoneAdherent(adherent)) {
        manquants.push("Téléphone");
    }

    if (!groupeAdherent(adherent) || groupeAdherent(adherent) === "Non renseigné") {
        manquants.push("Groupe");
    }

    if (age === null) {
        manquants.push("Date de naissance");
    }

    if (age !== null && age < 18) {
        const parent1 = champ(donnees, ["parent", "1"]) || champ(donnees, ["representant"]) || champ(donnees, ["représentant"]);
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

(async () => {

    adherents = await listAdherents();
    inscriptions = await listInscriptions();

    afficherStats();
    afficherAdherents();

})();
