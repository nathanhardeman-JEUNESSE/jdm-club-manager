const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const exceptions = JSON.parse(localStorage.getItem("planningExceptionsJDM")) || [];

const zonePlanning = document.getElementById("planning-public");
const titreSemaine = document.getElementById("titre-semaine");
const boutonPrecedent = document.getElementById("semaine-precedente");
const boutonSuivant = document.getElementById("semaine-suivante");

let dateReference = new Date();

const jours = [
    { cle: "lundi", label: "Lun" },
    { cle: "mardi", label: "Mar" },
    { cle: "mercredi", label: "Mer" },
    { cle: "jeudi", label: "Jeu" },
    { cle: "vendredi", label: "Ven" },
    { cle: "samedi", label: "Sam" },
    { cle: "dimanche", label: "Dim" }
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

function chargerCacheFermetures() {
    const cache = JSON.parse(localStorage.getItem("fermeturesAutoJDM")) || null;

    if (!cache) return;

    fermeturesAutoJDM.joursFeries = cache.joursFeries || {};
    fermeturesAutoJDM.vacances = cache.vacances || [];
    fermeturesAutoJDM.anneesChargees = cache.anneesChargees || [];
}

function sauverCacheFermetures() {
    localStorage.setItem("fermeturesAutoJDM", JSON.stringify(fermeturesAutoJDM));
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
        console.warn("Fermetures automatiques indisponibles :", erreur);
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

function classeStatut(statut, horaire) {
    if (statut === "annule") return "cancel";
    if (statut === "pas-cours") return "off";
    if (statut === "evenement") return "ok";
    if (horaire) return "ok";
    return "off";
}

async function afficherPlanning() {
    mettreAJourTitreSemaine();
    await chargerFermeturesSemaine();

    if (groupes.length === 0) {
        zonePlanning.innerHTML = `
            <section class="card">
                <h2>Aucun planning disponible</h2>
                <p>Aucun groupe n'a encore été paramétré.</p>
            </section>
        `;
        return;
    }

    zonePlanning.innerHTML = "";

    groupes.forEach(groupe => {
        zonePlanning.innerHTML += `
            <section class="schedule-card">
                <div class="schedule-info">
                    <h2>${groupe.nom}</h2>
                    <p>${groupe.sexe || "Mixte"} · ${groupe.type || "Loisir"} · ${groupe.federation || "-"}</p>
                    <p><strong>Années :</strong> ${groupe.anneeMin || "?"} à ${groupe.anneeMax || "?"}</p>
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
                        const infoClass = messageInfo ? " has-info" : "";

                        return `
                            <div>
                                ${jour.label}
                                <span class="slot ${classeStatut(statut, horaire)}${infoClass}"
                                      title="${titre}"
                                      onclick="afficherMessage('${securiserTexte(messageInfo)}')">
                                    ${horaire || "-"}
                                </span>
                            </div>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    });
}

function afficherMessage(message) {
    if (!message) return;
    alert(message);
}

boutonPrecedent.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() - 7);
    afficherPlanning();
});

boutonSuivant.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() + 7);
    afficherPlanning();
});

afficherPlanning();