import {
    listGroupesFirestore,
    listPlanningExceptionsFirestore,
    listAdherents,
    listInscriptions,
    saveAbsenceFirestore,
    saveNotificationFirestore
} from "../firebase/firebase-db.js";

import { watchSession } from "./session.js";

let groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
let exceptions = JSON.parse(localStorage.getItem("planningExceptionsJDM")) || [];
let utilisateurConnecte = null;
let adherents = [];
let adherentSelectionne = null;

let absences = JSON.parse(localStorage.getItem("absencesJDM")) || [];
let notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];

const zonePlanning = document.getElementById("planning-membre");
const titreSemaine = document.getElementById("titre-semaine");
const boutonPrecedent = document.getElementById("semaine-precedente");
const boutonSuivant = document.getElementById("semaine-suivante");

const absenceCard = document.getElementById("absence-card");
const absenceSeance = document.getElementById("absence-seance");
const motifAbsence = document.getElementById("motif-absence");
const messageAbsence = document.getElementById("message-absence");
const boutonEnvoyerAbsence = document.getElementById("envoyer-absence");

let dateReference = new Date();
let seanceSelectionnee = null;

async function chargerDonneesPartagees() {
    try {
        const [groupesDistants, exceptionsDistantes] = await Promise.all([
            listGroupesFirestore(),
            listPlanningExceptionsFirestore()
        ]);

        if (groupesDistants.length > 0) {
            groupes = groupesDistants;
            localStorage.setItem("groupesJDM", JSON.stringify(groupes));
        }

        exceptions = exceptionsDistantes;
        localStorage.setItem("planningExceptionsJDM", JSON.stringify(exceptions));
    } catch (error) {
        console.warn("Planning Firestore indisponible, utilisation du cache local.", error);
    }
}

const jours = [
    { cle: "lundi", label: "Lun", nom: "Lundi" },
    { cle: "mardi", label: "Mar", nom: "Mardi" },
    { cle: "mercredi", label: "Mer", nom: "Mercredi" },
    { cle: "jeudi", label: "Jeu", nom: "Jeudi" },
    { cle: "vendredi", label: "Ven", nom: "Vendredi" },
    { cle: "samedi", label: "Sam", nom: "Samedi" },
    { cle: "dimanche", label: "Dim", nom: "Dimanche" }
];

const fermeturesAutoJDM = {
    joursFeries: {},
    vacances: [],
    anneesChargees: []
};

function securiserTexte(texte) {
    return String(texte || "").replace(/'/g, "\\'");
}

function nettoyer(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function debutSemaine(date) {
    const copie = new Date(date);
    const jour = copie.getDay();
    const difference = jour === 0 ? -6 : 1 - jour;

    copie.setDate(copie.getDate() + difference);
    copie.setHours(0, 0, 0, 0);

    return copie;
}

function dateJour(index) {
    const debut = debutSemaine(dateReference);
    const date = new Date(debut);
    date.setDate(debut.getDate() + index);
    return date;
}

function formatDateISO(date) {
    const annee = date.getFullYear();
    const mois = String(date.getMonth() + 1).padStart(2, "0");
    const jour = String(date.getDate()).padStart(2, "0");
    return `${annee}-${mois}-${jour}`;
}

function formatDateFR(date) {
    return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function mettreAJourTitreSemaine() {
    const debut = debutSemaine(dateReference);
    const fin = new Date(debut);
    fin.setDate(debut.getDate() + 6);

    titreSemaine.textContent = `Semaine du ${formatDateFR(debut)} au ${formatDateFR(fin)}`;
}

function chargerCacheFermetures() {
    const cache = JSON.parse(localStorage.getItem("fermeturesAutoJDM")) || null;

    if (!cache) return;

    fermeturesAutoJDM.joursFeries = cache.joursFeries || {};
    fermeturesAutoJDM.vacances = cache.vacances || [];
    fermeturesAutoJDM.anneesChargees = cache.anneesChargees || [];
}

function sauverCacheFermetures() {
    localStorage.setItem("fermeturesAutoJDM", JSON.stringify({
        joursFeries: fermeturesAutoJDM.joursFeries,
        vacances: fermeturesAutoJDM.vacances,
        anneesChargees: fermeturesAutoJDM.anneesChargees
    }));
}

async function chargerFermeturesAnnee(annee) {
    if (fermeturesAutoJDM.anneesChargees.includes(annee)) return;

    try {
        const joursFeriesUrl = `https://calendrier.api.gouv.fr/jours-feries/metropole/${annee}.json`;

        const vacancesUrl =
            "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records" +
            `?limit=100` +
            `&where=start_date%20%3E%3D%20%22${annee}-01-01%22%20AND%20start_date%20%3C%3D%20%22${annee + 1}-12-31%22` +
            `&refine=zones%3A%22Zone%20B%22`;

        const [joursFeriesReponse, vacancesReponse] = await Promise.all([
            fetch(joursFeriesUrl),
            fetch(vacancesUrl)
        ]);

        if (joursFeriesReponse.ok) {
            const joursFeries = await joursFeriesReponse.json();
            Object.assign(fermeturesAutoJDM.joursFeries, joursFeries);
        }

        if (vacancesReponse.ok) {
            const vacancesData = await vacancesReponse.json();

            const vacances = (vacancesData.results || [])
                .filter(v => v.start_date && v.end_date)
                .map(v => ({
                    debut: v.start_date.split("T")[0],
                    fin: v.end_date.split("T")[0],
                    nom: v.description || "Vacances scolaires"
                }));

            vacances.forEach(vacance => {
                const existeDeja = fermeturesAutoJDM.vacances.some(v =>
                    v.debut === vacance.debut &&
                    v.fin === vacance.fin &&
                    v.nom === vacance.nom
                );

                if (!existeDeja) {
                    fermeturesAutoJDM.vacances.push(vacance);
                }
            });
        }

        fermeturesAutoJDM.anneesChargees.push(annee);
        sauverCacheFermetures();

    } catch (erreur) {
        console.warn("Impossible de charger les fermetures automatiques :", erreur);
    }
}

async function chargerFermeturesSemaine() {
    chargerCacheFermetures();

    const debut = debutSemaine(dateReference);
    const fin = new Date(debut);
    fin.setDate(debut.getDate() + 6);

    const annees = [...new Set([
        debut.getFullYear() - 1,
        debut.getFullYear(),
        fin.getFullYear(),
        fin.getFullYear() + 1
    ])];

    await Promise.all(annees.map(annee => chargerFermeturesAnnee(annee)));
}

function trouverFermetureAutomatique(dateISO) {
    if (fermeturesAutoJDM.joursFeries[dateISO]) {
        return {
            statut: "pas-cours",
            horaire: "",
            titre: fermeturesAutoJDM.joursFeries[dateISO],
            message: `Pas de cours : ${fermeturesAutoJDM.joursFeries[dateISO]}`
        };
    }

    const vacances = fermeturesAutoJDM.vacances.find(v =>
        dateISO >= v.debut && dateISO < v.fin
    );

    if (vacances) {
        return {
            statut: "pas-cours",
            horaire: "",
            titre: vacances.nom,
            message: `Pas de cours : ${vacances.nom}`
        };
    }

    return null;
}

function champ(donnees, mots) {
    if (!donnees) return "";

    const cle = Object.keys(donnees).find(cle =>
        mots.every(mot => nettoyer(cle).includes(nettoyer(mot)))
    );

    return cle ? donnees[cle] : "";
}

let inscriptionsPartagees = [];

function derniereInscription(numeroAdherent) {
    const liste = inscriptionsPartagees.filter(i =>
        String(i.numeroAdherent) === String(numeroAdherent)
    );
    return liste[liste.length - 1] || null;
}

function groupeAdherent(adherent) {
    if (adherent.groupe) return adherent.groupe;

    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};

    return champ(donnees, ["tarif"]);
}

function groupesDuMembre() {
    if (!adherentSelectionne) return [];

    const nomsGroupes = [
        ...(Array.isArray(adherentSelectionne.groupes)
            ? adherentSelectionne.groupes
            : []),
        adherentSelectionne.groupe,
        ...inscriptionsPartagees
            .filter(item =>
                String(item.numeroAdherent) ===
                String(adherentSelectionne.numeroAdherent)
            )
            .map(item =>
                item.groupe ||
                item.donneesHelloAsso?.name ||
                ""
            )
    ].filter(Boolean);

    return groupes.filter(groupe =>
        nomsGroupes.some(nomGroupe =>
            nettoyer(nomGroupe) === nettoyer(groupe.nom)
        )
    );
}

function enfantConnecte() {
    return adherentSelectionne;
}

function trouverException(groupeId, dateISO) {
    return exceptions.find(item =>
        String(item.groupeId) === String(groupeId) &&
        item.date === dateISO
    );
}

function absenceDejaSignalee(groupeId, dateISO) {
    const enfant = enfantConnecte();

    if (!enfant) return null;

    return absences.find(absence =>
        absence.numeroAdherent === enfant.numeroAdherent &&
        String(absence.groupeId) === String(groupeId) &&
        absence.date === dateISO
    );
}

function classeStatut(statut, horaire, typeException) {
    if (typeException === "competition" || typeException === "competition-annulation") return "cancel";
    if (statut === "annule") return "cancel";
    if (statut === "pas-cours") return "off";
    if (statut === "evenement") return "ok";
    if (horaire) return "ok";
    return "off";
}

async function afficherPlanning() {
    mettreAJourTitreSemaine();
    await chargerFermeturesSemaine();

    const groupesAffiches = groupesDuMembre();

    if (groupesAffiches.length === 0) {
        zonePlanning.innerHTML = `
            <section class="card">
                <h2>Aucun planning personnel</h2>
                <p>Aucun enfant n'est rattaché à ce compte pour le moment.</p>
                <p>En mode test, créez une connexion parent/enfant depuis la page Dev.</p>
            </section>
        `;
        return;
    }

    zonePlanning.innerHTML = "";

    groupesAffiches.forEach(groupe => {
        zonePlanning.innerHTML += `
            <section class="schedule-card">
                <div class="schedule-info">
                    <h2>${groupe.nom}</h2>
                    <p>${groupe.sexe || "Mixte"} · ${groupe.type || "Loisir"} · ${groupe.federation || "-"}</p>
                    <p><strong>Coach(s) :</strong> ${groupe.coachs && groupe.coachs.length > 0 ? groupe.coachs.join(" / ") : "Non renseigné"}</p>
                </div>

                <div class="week-grid">
                    ${jours.map((jour, index) => {
                        const date = dateJour(index);
                        const dateISO = formatDateISO(date);

                        const exceptionManuelle = trouverException(groupe.id, dateISO);
                        const exceptionAuto = trouverFermetureAutomatique(dateISO);
                        const exception = exceptionManuelle || exceptionAuto;

                        const horaireHabituel = groupe.horaires ? groupe.horaires[jour.cle] : "";
                        const statut = exception ? exception.statut : "cours";
                        const horaire = exception ? exception.horaire : horaireHabituel;
                        const titre = exception && exception.titre ? exception.titre : "";
                        const messageInfo = exception && exception.message ? exception.message : "";
                        const typeException = exception && exception.type ? exception.type : "";
                        const absence = absenceDejaSignalee(groupe.id, dateISO);
                        const infoClass = messageInfo || absence ? " has-info" : "";
                        const texteCase = typeException === "competition"
                            ? "🏆 Compétition"
                            : typeException === "competition-annulation"
                                ? "Cours annulé"
                                : (horaire || "-");

                        return `
                            <div>
                                ${jour.label}<br>
                                <small>${date.getDate()}</small>

                                <span class="slot ${classeStatut(statut, horaire, typeException)}${infoClass}"
                                      title="${securiserTexte(titre)}"
                                      onclick="ouvrirSeance(
                                          '${groupe.id}',
                                          '${securiserTexte(groupe.nom)}',
                                          '${dateISO}',
                                          '${jour.nom}',
                                          '${securiserTexte(horaire)}',
                                          '${statut}',
                                          '${securiserTexte(messageInfo)}',
                                          '${typeException}'
                                      )">
                                    ${texteCase}
                                </span>

                                ${absence ? `<small>🙋 Absence signalée</small>` : ""}
                            </div>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    });
}

function ouvrirSeance(groupeId, groupeNom, dateISO, jourNom, horaire, statut, messageInfo, typeException = "") {
    const estCompetition = typeException === "competition";

    if (messageInfo && !estCompetition) {
        alert(messageInfo);
    }

    if (!estCompetition && (!horaire || statut === "annule" || statut === "pas-cours")) {
        return;
    }

    if (estCompetition) {
        horaire = horaire || "Compétition";
    }

    seanceSelectionnee = {
        groupeId,
        groupeNom,
        dateISO,
        jourNom,
        horaire
    };

    absenceSeance.innerHTML = `
        <strong>Groupe :</strong> ${groupeNom}<br>
        <strong>Date :</strong> ${jourNom} ${dateISO}<br>
        <strong>Horaire :</strong> ${horaire}
        ${
            messageInfo
                ? `<hr><strong>Information :</strong><br>${messageInfo.replace(/\n/g, "<br>")}`
                : ""
        }
    `;

    motifAbsence.value = "";
    messageAbsence.value = "";

    absenceCard.style.display = "block";
    absenceCard.scrollIntoView({ behavior: "smooth" });
}

boutonEnvoyerAbsence.addEventListener("click", async () => {
    if (!seanceSelectionnee) return;

    const motif = motifAbsence.value;
    const message = messageAbsence.value.trim();
    const enfant = enfantConnecte();

    if (!enfant) {
        alert("Aucun enfant n'est rattaché à ce compte.");
        return;
    }

    if (!motif) {
        alert("Merci d'indiquer le motif de l'absence.");
        return;
    }

    const dejaSignalee = absenceDejaSignalee(seanceSelectionnee.groupeId, seanceSelectionnee.dateISO);

    if (dejaSignalee) {
        alert("Une absence est déjà signalée pour cette séance.");
        return;
    }

    const absence = {
        id: Date.now(),
        groupeId: seanceSelectionnee.groupeId,
        groupeNom: seanceSelectionnee.groupeNom,
        date: seanceSelectionnee.dateISO,
        jour: seanceSelectionnee.jourNom,
        horaire: seanceSelectionnee.horaire,
        motif,
        message,
        numeroAdherent: enfant.numeroAdherent,
        nom: enfant.nom || "",
        prenom: enfant.prenom || "",
        dateDeclaration: new Date().toISOString(),
        statut: "déclarée",
        lueAdmin: false,
        traiteeAdmin: false
    };

    absences.push(absence);

    notifications.push({
        id: Date.now() + 1,
        categorie: "parents-groupes",
        type: "absence",
        titre: "Absence signalée",
        message: `${absence.prenom || "Un adhérent"} ${absence.nom || ""} sera absent(e). Motif : ${absence.motif}`,
        groupeId: absence.groupeId,
        groupeNom: absence.groupeNom,
        date: absence.date,
        priorite: "normale",
        lue: false,
        traitee: false,
        archivee: false,
        auteur: "parent",
        destinataire: "admin",
        dateCreation: new Date().toISOString()
    });

    localStorage.setItem("absencesJDM", JSON.stringify(absences));
    localStorage.setItem("notificationsJDM", JSON.stringify(notifications));

    try {
        await Promise.all([
            saveAbsenceFirestore(absence),
            saveNotificationFirestore(
                notifications[notifications.length - 1]
            )
        ]);
    } catch (error) {
        console.warn(
            "Absence enregistrée localement, synchronisation distante impossible",
            error
        );
    }

    alert("Absence signalée ✅");

    absenceCard.style.display = "none";
    seanceSelectionnee = null;

    afficherPlanning();
});

boutonPrecedent.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() - 7);
    afficherPlanning();
});

boutonSuivant.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() + 7);
    afficherPlanning();
});

window.addEventListener("jdm:member-changed", event => {
    adherentSelectionne = event.detail?.adherent || null;
    afficherPlanning();
});

watchSession(async (user, profile) => {
    if (!user || !profile) return;

    utilisateurConnecte = profile;

    try {
        [adherents, inscriptionsPartagees] = await Promise.all([
            listAdherents(),
            listInscriptions()
        ]);

        const numeroSelectionne =
            document.body.dataset.numeroAdherentSelectionne ||
            profile.numeroAdherent ||
            profile.numeroAdherents?.[0] ||
            "";

        adherentSelectionne = adherents.find(adherent =>
            String(adherent.numeroAdherent) ===
            String(numeroSelectionne)
        ) || null;

        await chargerDonneesPartagees();
        afficherPlanning();
    } catch (error) {
        console.error(
            "Impossible de charger le planning membre",
            error
        );
    }
});
