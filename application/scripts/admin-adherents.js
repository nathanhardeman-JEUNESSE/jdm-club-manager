import {
    listAdherents,
    listInscriptions,
    listTresorerieCotisations
} from "../firebase/firebase-db.js";

import {
    derniereInscriptionPour,
    verifierDossier
} from "./adherent-data.js";

let adherents = [];
let inscriptions = [];
let dossiersTresorerie = [];

const aidesLicence =
    JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];

const validationsDossiers =
    JSON.parse(localStorage.getItem("validationsDossiersJDM")) || [];

const liste = document.getElementById("liste-adherents");
const zoneStats = document.getElementById("stats-dossiers-adherents");
const zoneResume = document.getElementById(
    "resume-resultats-adherents"
);

const recherche = document.getElementById("recherche-adherent");
const filtreGroupe = document.getElementById("filtre-groupe");
const filtreDossier = document.getElementById("filtre-dossier");
const filtreCotisation = document.getElementById("filtre-cotisation");
const filtreAffichage = document.getElementById("filtre-affichage");
const boutonReset = document.getElementById("reinitialiser-filtres");

function nettoyer(texte) {
    return String(texte || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
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

function inscriptionsPour(numeroAdherent) {
    return inscriptions.filter(item =>
        String(item.numeroAdherent) === String(numeroAdherent)
    );
}

function groupesAdherent(adherent) {
    const depuisAdherent = Array.isArray(adherent.groupes)
        ? adherent.groupes
        : [];

    const depuisInscriptions = inscriptionsPour(
        adherent.numeroAdherent
    ).map(item =>
        item.groupe ||
        item.donneesHelloAsso?.name ||
        ""
    );

    return unique([
        ...depuisAdherent,
        adherent.groupe,
        ...depuisInscriptions
    ]).filter(groupe => nettoyer(groupe) !== "fixed");
}

function dossierAdministratif(adherent) {
    const inscription = derniereInscriptionPour(
        inscriptions,
        adherent.numeroAdherent
    );

    return verifierDossier(adherent, inscription, {
        aide: aidePour(adherent.numeroAdherent),
        validation: validationPour(adherent.numeroAdherent)
    });
}

function cotisationAJour(adherent) {
    const dossier = dossiersTresorerie.find(item =>
        String(item.numeroAdherent) ===
        String(adherent.numeroAdherent)
    );

    /*
     * La liste admin ne considère la cotisation comme OK
     * qu'après une validation humaine explicite du trésorier.
     *
     * On ignore volontairement :
     * - adherent.cotisationAJour
     * - statut == "regle" calculé automatiquement
     * - le montant payé en ligne
     *
     * car ces éléments peuvent provenir d'anciens imports
     * ou d'un calcul automatique sans contrôle humain.
     */
    return (
        dossier?.licenceValidee === true ||
        dossier?.cotisationRegularisee === true
    );
}

function numeroAffiche(adherent) {
    return adherent.numeroMembre ||
        adherent.numeroAdherent ||
        adherent.id ||
        "";
}

function emailFamille(adherent) {
    return nettoyer(
        adherent.emailParent1 ||
        adherent.email ||
        adherent.emailParent2 ||
        ""
    );
}

function cleFamille(adherent) {
    const email = emailFamille(adherent);

    if (email) return `email:${email}`;

    const parent = nettoyer(
        adherent.parent1 ||
        adherent.parent2 ||
        adherent.nom ||
        ""
    );

    return `fallback:${parent}`;
}

function texteRecherche(adherent) {
    return nettoyer([
        adherent.nom,
        adherent.prenom,
        adherent.email,
        adherent.emailParent1,
        adherent.emailParent2,
        adherent.telephone,
        adherent.numeroAdherent,
        adherent.numeroMembre,
        ...groupesAdherent(adherent)
    ].join(" "));
}

function tousLesGroupes() {
    return unique(
        adherents.flatMap(groupesAdherent)
    ).sort((a, b) =>
        a.localeCompare(b, "fr", { sensitivity: "base" })
    );
}

function remplirFiltreGroupes() {
    if (!filtreGroupe) return;

    filtreGroupe.innerHTML = `
        <option value="">Tous les groupes</option>
        ${tousLesGroupes().map(groupe => `
            <option value="${groupe}">
                ${groupe}
            </option>
        `).join("")}
    `;
}

function adherentsFiltres() {
    const terme = nettoyer(recherche?.value);
    const groupeRecherche = nettoyer(filtreGroupe?.value);
    const dossierRecherche = filtreDossier?.value || "";
    const cotisationRecherche = filtreCotisation?.value || "";

    return adherents.filter(adherent => {
        const dossier = dossierAdministratif(adherent);
        const groupes = groupesAdherent(adherent)
            .map(nettoyer);

        if (terme && !texteRecherche(adherent).includes(terme)) {
            return false;
        }

        if (
            groupeRecherche &&
            !groupes.includes(groupeRecherche)
        ) {
            return false;
        }

        if (
            dossierRecherche === "complet" &&
            dossier.complet !== true
        ) {
            return false;
        }

        if (
            dossierRecherche === "incomplet" &&
            dossier.complet === true
        ) {
            return false;
        }

        if (
            cotisationRecherche === "ok" &&
            !cotisationAJour(adherent)
        ) {
            return false;
        }

        if (
            cotisationRecherche === "retard" &&
            cotisationAJour(adherent)
        ) {
            return false;
        }

        return true;
    });
}

function afficherStats(listeSource = adherents) {
    if (!zoneStats) return;

    const total = listeSource.length;
    const complets = listeSource.filter(
        adherent => dossierAdministratif(adherent).complet
    ).length;

    const incomplets = total - complets;
    const cotisationsOk = listeSource.filter(
        cotisationAJour
    ).length;

    zoneStats.innerHTML = `
        <section class="card admin-adherents-stats">
            <div>
                <strong>${total}</strong>
                <span>Adhérents</span>
            </div>

            <div class="admin-stat-success">
                <strong>${complets}</strong>
                <span>Dossiers complets</span>
            </div>

            <div class="admin-stat-danger">
                <strong>${incomplets}</strong>
                <span>Dossiers incomplets</span>
            </div>

            <div class="admin-stat-info">
                <strong>${cotisationsOk}</strong>
                <span>Cotisations à jour</span>
            </div>
        </section>
    `;
}

function carteAdherent(adherent) {
    const dossier = dossierAdministratif(adherent);
    const groupes = groupesAdherent(adherent);
    const cotisation = cotisationAJour(adherent);
    const numero = numeroAffiche(adherent);

    return `
        <section class="card admin-adherent-card">
            <div class="admin-adherent-card-header">
                <div>
                    <h2>
                        ${adherent.prenom || ""}
                        ${adherent.nom || ""}
                    </h2>

                    <p class="admin-adherent-number">
                        ${numero || "Numéro non renseigné"}
                    </p>
                </div>

                <div class="admin-adherent-statuses">
                    <span class="admin-mini-badge ${
                        dossier.complet
                            ? "admin-mini-badge-success"
                            : "admin-mini-badge-danger"
                    }">
                        ${dossier.complet ? "Dossier complet" : "Dossier incomplet"}
                    </span>

                    <span class="admin-mini-badge ${
                        cotisation
                            ? "admin-mini-badge-success"
                            : "admin-mini-badge-warning"
                    }">
                        ${cotisation ? "Cotisation OK" : "Cotisation à vérifier"}
                    </span>
                </div>
            </div>

            <div class="admin-adherent-meta">
                <p>
                    <strong>Date de naissance :</strong>
                    ${adherent.dateNaissance || "Non renseignée"}
                </p>

                <p>
                    <strong>Email :</strong>
                    ${
                        adherent.emailParent1 ||
                        adherent.email ||
                        "Non renseigné"
                    }
                </p>

                <p>
                    <strong>Téléphone :</strong>
                    ${adherent.telephone || "Non renseigné"}
                </p>
            </div>

            <div class="admin-adherent-groups">
                ${
                    groupes.length > 0
                        ? groupes.map(groupe => `
                            <span class="member-group-chip">
                                ${groupe}
                            </span>
                        `).join("")
                        : `<span class="admin-empty-value">Aucun groupe</span>`
                }
            </div>

            ${
                dossier.complet
                    ? ""
                    : `
                        <p class="admin-adherent-missing">
                            <strong>Manquant :</strong>
                            ${dossier.manquants.join(" · ")}
                        </p>
                    `
            }

            <a
                href="admin-fiche-adherent.html?id=${
                    encodeURIComponent(
                        adherent.numeroAdherent ||
                        adherent.id ||
                        ""
                    )
                }"
                class="primary-button order-button">
                👤 Voir la fiche
            </a>
        </section>
    `;
}

function regrouperFamilles(listeAdherents) {
    const familles = new Map();

    listeAdherents.forEach(adherent => {
        const cle = cleFamille(adherent);

        if (!familles.has(cle)) {
            familles.set(cle, []);
        }

        familles.get(cle).push(adherent);
    });

    return [...familles.entries()]
        .map(([cle, membres]) => ({
            cle,
            membres: membres.sort((a, b) =>
                `${a.prenom || ""} ${a.nom || ""}`.localeCompare(
                    `${b.prenom || ""} ${b.nom || ""}`,
                    "fr",
                    { sensitivity: "base" }
                )
            )
        }))
        .sort((a, b) => {
            const nomA = emailFamille(a.membres[0]) ||
                a.membres[0]?.nom ||
                "";

            const nomB = emailFamille(b.membres[0]) ||
                b.membres[0]?.nom ||
                "";

            return nomA.localeCompare(
                nomB,
                "fr",
                { sensitivity: "base" }
            );
        });
}

function carteFamille(famille) {
    const premier = famille.membres[0];
    const email =
        premier.emailParent1 ||
        premier.email ||
        premier.emailParent2 ||
        "Email non renseigné";

    return `
        <section class="card admin-family-card">
            <div class="admin-family-header">
                <div>
                    <h2>👨‍👩‍👧‍👦 Famille</h2>
                    <p>${email}</p>
                </div>

                <span class="admin-mini-badge admin-mini-badge-info">
                    ${famille.membres.length}
                    membre${famille.membres.length > 1 ? "s" : ""}
                </span>
            </div>

            <div class="admin-family-members">
                ${famille.membres.map(carteAdherent).join("")}
            </div>
        </section>
    `;
}

function afficherAdherents() {
    if (!liste) return;

    const filtres = adherentsFiltres();

    afficherStats(filtres);

    if (zoneResume) {
        zoneResume.textContent = `
            ${filtres.length} résultat${
                filtres.length > 1 ? "s" : ""
            }
        `;
    }

    if (filtres.length === 0) {
        liste.innerHTML = `
            <section class="card">
                <h2>Aucun résultat</h2>
                <p>
                    Aucun adhérent ne correspond aux filtres sélectionnés.
                </p>
            </section>
        `;
        return;
    }

    const affichageFamilles =
        filtreAffichage?.value === "familles";

    if (affichageFamilles) {
        liste.innerHTML = regrouperFamilles(filtres)
            .map(carteFamille)
            .join("");

        return;
    }

    liste.innerHTML = filtres
        .slice()
        .sort((a, b) =>
            `${a.nom || ""} ${a.prenom || ""}`.localeCompare(
                `${b.nom || ""} ${b.prenom || ""}`,
                "fr",
                { sensitivity: "base" }
            )
        )
        .map(carteAdherent)
        .join("");
}

function reinitialiserFiltres() {
    if (recherche) recherche.value = "";
    if (filtreGroupe) filtreGroupe.value = "";
    if (filtreDossier) filtreDossier.value = "";
    if (filtreCotisation) filtreCotisation.value = "";
    if (filtreAffichage) filtreAffichage.value = "adherents";

    afficherAdherents();
}

[
    recherche,
    filtreGroupe,
    filtreDossier,
    filtreCotisation,
    filtreAffichage
].forEach(element => {
    element?.addEventListener(
        element === recherche ? "input" : "change",
        afficherAdherents
    );
});

boutonReset?.addEventListener(
    "click",
    reinitialiserFiltres
);

async function initialiserAdherents() {
    if (liste) {
        liste.innerHTML = `
            <section class="card">
                <p>Chargement des adhérents...</p>
            </section>
        `;
    }

    try {
        [
            adherents,
            inscriptions,
            dossiersTresorerie
        ] = await Promise.all([
            listAdherents(),
            listInscriptions(),
            listTresorerieCotisations()
        ]);

        remplirFiltreGroupes();
        afficherAdherents();
    } catch (error) {
        console.error(
            "Impossible de charger les adhérents :",
            error
        );

        if (liste) {
            liste.innerHTML = `
                <section class="card">
                    <h2>Erreur</h2>
                    <p>
                        Impossible de charger les adhérents.
                    </p>
                    <p>
                        <small>${error.message || ""}</small>
                    </p>
                </section>
            `;
        }
    }
}

initialiserAdherents();
