import {
    listGroupesFirestore,
    saveGroupesFirestore,
    listPlanningExceptionsFirestore,
    savePlanningExceptionFirestore
} from "../firebase/firebase-db.js";

let groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
let exceptions = JSON.parse(localStorage.getItem("planningExceptionsJDM")) || [];

const zonePlanning = document.getElementById("planning-admin");
const titreSemaine = document.getElementById("titre-semaine");
const boutonPrecedent = document.getElementById("semaine-precedente");
const boutonSuivant = document.getElementById("semaine-suivante");

const zoneEdition = document.getElementById("edition-planning");
const caseSelectionneeTexte = document.getElementById("case-selectionnee");
const statutCase = document.getElementById("statut-case");
const horaireCase = document.getElementById("horaire-case");
const titreCase = document.getElementById("titre-case");
const messageCase = document.getElementById("message-case");
const notifierParentsCase = document.getElementById("notifier-parents-case");
const boutonEnregistrer = document.getElementById("enregistrer-case");
const boutonAnnuler = document.getElementById("annuler-edition");

let dateReference = new Date();
let selection = null;

async function chargerDonneesPartagees() {
    const groupesLocaux = JSON.parse(localStorage.getItem("groupesJDM")) || [];
    const exceptionsLocales = JSON.parse(localStorage.getItem("planningExceptionsJDM")) || [];

    try {
        let groupesDistants = await listGroupesFirestore();

        if (groupesDistants.length === 0 && groupesLocaux.length > 0) {
            await saveGroupesFirestore(groupesLocaux);
            groupesDistants = await listGroupesFirestore();
        }

        groupes = groupesDistants.length > 0 ? groupesDistants : groupesLocaux;

        const exceptionsDistantes = await listPlanningExceptionsFirestore();
        exceptions = exceptionsDistantes.length > 0 ? exceptionsDistantes : exceptionsLocales;

        localStorage.setItem("groupesJDM", JSON.stringify(groupes));
        localStorage.setItem("planningExceptionsJDM", JSON.stringify(exceptions));
    } catch (error) {
        console.warn("Planning Firestore indisponible, utilisation du cache local.", error);
        groupes = groupesLocaux;
        exceptions = exceptionsLocales;
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
    if (typeof date === "string") {
        const morceaux = date.split("-");
        if (morceaux.length === 3) {
            return `${morceaux[2]}/${morceaux[1]}/${morceaux[0]}`;
        }
    }

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

function trouverException(groupeId, dateISO) {
    return exceptions.find(item =>
        String(item.groupeId) === String(groupeId) &&
        item.date === dateISO
    );
}

function lireHoraireHabituel(groupe, jourCle) {
    if (!groupe.horaires) return "";
    return groupe.horaires[jourCle] || "";
}

function classeStatut(statut, horaire) {
    if (statut === "annule") return "cancel";
    if (statut === "pas-cours") return "off";
    if (statut === "evenement") return "ok";
    if (horaire) return "ok";
    return "off";
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

async function afficherPlanning() {
    mettreAJourTitreSemaine();
    await chargerFermeturesSemaine();

    if (groupes.length === 0) {
        zonePlanning.innerHTML = `
            <section class="card">
                <h2>Aucun groupe</h2>
                <p>Créez d'abord des groupes dans l'administration.</p>
            </section>
        `;
        return;
    }

    zonePlanning.innerHTML = "";

    groupes.forEach((groupe) => {
        zonePlanning.innerHTML += `
            <section class="schedule-card">
                <div class="schedule-info">
                    <h2>${groupe.nom}</h2>
                    <p>${groupe.coachs && groupe.coachs.length > 0 ? groupe.coachs.join(" / ") : "Coach non renseigné"}</p>
                </div>

                <div class="week-grid">
                    ${jours.map((jour, index) => {
                        const date = dateJour(index);
                        const dateISO = formatDateISO(date);

                        const exceptionManuelle = trouverException(groupe.id, dateISO);
                        const exceptionAuto = trouverFermetureAutomatique(dateISO);
                        const exception = exceptionManuelle || exceptionAuto;

                        const horaireHabituel = lireHoraireHabituel(groupe, jour.cle);

                        const statut = exception ? exception.statut : "cours";
                        const horaire = exception ? exception.horaire : horaireHabituel;
                        const texte = horaire || "-";
                        const point = exception && exception.message ? "•" : "";
                        const titre = exception && exception.titre ? exception.titre : "";
                        const infoClass = exception && exception.message ? " has-info" : "";

                        return `
                            <div>
                                ${jour.label}<br>
                                <small>${date.getDate()}</small>

                                <span class="slot ${classeStatut(statut, horaire)}${infoClass}"
                                      title="${titre}"
                                      onclick="ouvrirEdition('${groupe.id}', '${securiserTexte(groupe.nom)}', '${jour.cle}', '${jour.nom}', '${dateISO}')">
                                    ${texte}
                                    ${point ? `<strong style="color:orange;"> ${point}</strong>` : ""}
                                </span>
                            </div>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    });
}

function ouvrirEdition(groupeId, groupeNom, jourCle, jourNom, dateISO) {
    const exception = trouverException(groupeId, dateISO);
    const fermetureAuto = trouverFermetureAutomatique(dateISO);
    const groupe = groupes.find(g => String(g.id) === String(groupeId));
    const horaireHabituel = groupe ? lireHoraireHabituel(groupe, jourCle) : "";

    selection = {
        groupeId,
        groupeNom,
        jourCle,
        jourNom,
        dateISO,
        horaireHabituel
    };

    caseSelectionneeTexte.textContent = `${groupeNom} - ${jourNom} ${formatDateFR(dateISO)}`;

    if (exception) {
        statutCase.value = exception.statut;
        horaireCase.value = exception.horaire || "";
        titreCase.value = exception.titre || "";
        messageCase.value = exception.message || "";
    } else if (fermetureAuto) {
        statutCase.value = fermetureAuto.statut;
        horaireCase.value = fermetureAuto.horaire || "";
        titreCase.value = fermetureAuto.titre || "";
        messageCase.value = fermetureAuto.message || "";
    } else {
        statutCase.value = "cours";
        horaireCase.value = horaireHabituel;
        titreCase.value = "";
        messageCase.value = "";
    }

    mettreAJourCaseNotifier();

    zoneEdition.style.display = "block";
    zoneEdition.scrollIntoView({ behavior: "smooth" });
}

function mettreAJourCaseNotifier() {
    if (!notifierParentsCase) return;

    if (statutCase.value === "annule") {
        notifierParentsCase.checked = true;
    } else {
        notifierParentsCase.checked = false;
    }
}

function notificationsParentsAutorisees(groupeId) {
    const groupe = groupes.find(g => String(g.id) === String(groupeId));

    if (groupe && groupe.notificationsParents === false) {
        return false;
    }

    return true;
}

function creerNotificationPlanning(exception) {
    if (!selection) return;
    if (!notifierParentsCase || !notifierParentsCase.checked) return;
    if (!notificationsParentsAutorisees(selection.groupeId)) return;

    let notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];

    let titre = exception.titre || "Modification du planning";
    let message = exception.message || "Le planning du groupe a été modifié. Consultez votre planning.";
    let priorite = "normale";

    if (exception.statut === "annule") {
        titre = exception.titre || "⚠️ Cours annulé";
        message = exception.message || `Le cours du ${selection.jourNom} ${formatDateFR(selection.dateISO)} est annulé. Consultez votre planning.`;
        priorite = "haute";
    }

    if (exception.statut === "pas-cours") {
        titre = exception.titre || "Pas de cours";
        message = exception.message || `Pas de cours le ${selection.jourNom} ${formatDateFR(selection.dateISO)}.`;
    }

    notifications.push({
        id: Date.now(),
        categorie: "parents-groupes",
        type: "planning",
        titre,
        message,
        groupeId: selection.groupeId,
        groupeNom: selection.groupeNom,
        date: selection.dateISO,
        jour: selection.jourCle,
        horaire: exception.horaire || selection.horaireHabituel || "",
        statut: exception.statut,
        priorite,
        lue: false,
        traitee: false,
        archivee: false,
        auteur: "admin",
        dateCreation: new Date().toISOString()
    });

    localStorage.setItem("notificationsJDM", JSON.stringify(notifications));
}

boutonEnregistrer.addEventListener("click", async () => {
    if (!selection) return;

    exceptions = exceptions.filter(item =>
        !(String(item.groupeId) === String(selection.groupeId) && item.date === selection.dateISO)
    );

    const nouvelleException = {
        groupeId: selection.groupeId,
        date: selection.dateISO,
        jour: selection.jourCle,
        statut: statutCase.value,
        horaire: horaireCase.value.trim(),
        titre: titreCase.value.trim(),
        message: messageCase.value.trim()
    };

    try {
        await savePlanningExceptionFirestore(nouvelleException);
    } catch (error) {
        console.error("Erreur d'enregistrement Firestore :", error);
        alert("Impossible d'enregistrer sur le serveur. Verifiez la connexion.");
        return;
    }

    exceptions.push(nouvelleException);
    localStorage.setItem("planningExceptionsJDM", JSON.stringify(exceptions));

    creerNotificationPlanning(nouvelleException);

    zoneEdition.style.display = "none";
    selection = null;

    await afficherPlanning();
});

boutonAnnuler.addEventListener("click", () => {
    zoneEdition.style.display = "none";
    selection = null;
});

if (statutCase) {
    statutCase.addEventListener("change", mettreAJourCaseNotifier);
}

boutonPrecedent.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() - 7);
    afficherPlanning();
});

boutonSuivant.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() + 7);
    afficherPlanning();
});

chargerDonneesPartagees().then(afficherPlanning);
