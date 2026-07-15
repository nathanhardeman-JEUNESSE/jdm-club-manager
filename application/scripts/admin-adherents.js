import {
    listAdherents,
    listInscriptions
} from "../firebase/firebase-db.js";

import {
    derniereInscriptionPour,
    groupeAdherent,
    verifierDossier
} from "./adherent-data.js";

let adherents = [];
let inscriptions = [];

const aidesLicence = JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];
const validationsDossiers = JSON.parse(localStorage.getItem("validationsDossiersJDM")) || [];

const liste = document.getElementById("liste-adherents");
const zoneStats = document.getElementById("stats-dossiers-adherents");

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

function dossierAdministratif(adherent) {
    const inscription = derniereInscriptionPour(inscriptions, adherent.numeroAdherent);

    return verifierDossier(adherent, inscription, {
        aide: aidePour(adherent.numeroAdherent),
        validation: validationPour(adherent.numeroAdherent)
    });
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
    if (!liste) return;

    if (adherents.length === 0) {
        liste.innerHTML = `
            <section class="card">
                <h2>Aucun adhérent</h2>
                <p>Aucun adhérent n'a encore été importé.</p>
            </section>
        `;
        return;
    }

    liste.innerHTML = adherents
        .slice()
        .sort((a, b) =>
            `${a.nom || ""} ${a.prenom || ""}`.localeCompare(
                `${b.nom || ""} ${b.prenom || ""}`,
                "fr",
                { sensitivity: "base" }
            )
        )
        .map(adherent => {
            const inscription = derniereInscriptionPour(inscriptions, adherent.numeroAdherent);
            const dossier = dossierAdministratif(adherent);
            const groupe = groupeAdherent(adherent, inscription);

            return `
                <section class="card">
                    <h2>${adherent.prenom || ""} ${adherent.nom || ""}</h2>

                    <p><strong>N° adhérent :</strong> ${adherent.numeroAdherent || ""}</p>
                    <p><strong>Date de naissance :</strong> ${adherent.dateNaissance || "Non renseignée"}</p>
                    <p><strong>Groupe :</strong> ${groupe}</p>

                    <p>
                        <strong>Dossier :</strong>
                        ${dossier.complet ? "🟢 Complet" : "🔴 Incomplet"}
                        ${dossier.manuel ? " · validé manuellement" : ""}
                    </p>

                    ${dossier.complet
                        ? ""
                        : `<p><strong>Manquant :</strong> ${dossier.manquants.join(" · ")}</p>`
                    }

                    <a
                        href="admin-fiche-adherent.html?id=${encodeURIComponent(adherent.numeroAdherent || adherent.id || "")}"
                        class="primary-button order-button">
                        👤 Voir la fiche
                    </a>
                </section>
            `;
        })
        .join("");
}

async function initialiserAdherents() {
    if (liste) {
        liste.innerHTML = `<section class="card"><p>Chargement des adhérents...</p></section>`;
    }

    try {
        [adherents, inscriptions] = await Promise.all([
            listAdherents(),
            listInscriptions()
        ]);

        afficherStats();
        afficherAdherents();
    } catch (error) {
        console.error("Impossible de charger les adhérents :", error);

        if (liste) {
            liste.innerHTML = `
                <section class="card">
                    <h2>Erreur</h2>
                    <p>Impossible de charger les adhérents.</p>
                    <p><small>${error.message || ""}</small></p>
                </section>
            `;
        }
    }
}

initialiserAdherents();
