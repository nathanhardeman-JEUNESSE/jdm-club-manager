const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
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
const boutonEnregistrer = document.getElementById("enregistrer-case");
const boutonAnnuler = document.getElementById("annuler-edition");

let dateReference = new Date();
let selection = null;

const jours = [
    { cle: "lundi", label: "Lun", nom: "Lundi" },
    { cle: "mardi", label: "Mar", nom: "Mardi" },
    { cle: "mercredi", label: "Mer", nom: "Mercredi" },
    { cle: "jeudi", label: "Jeu", nom: "Jeudi" },
    { cle: "vendredi", label: "Ven", nom: "Vendredi" },
    { cle: "samedi", label: "Sam", nom: "Samedi" },
    { cle: "dimanche", label: "Dim", nom: "Dimanche" }
];

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
    return date.toISOString().split("T")[0];
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

function afficherPlanning() {
    mettreAJourTitreSemaine();

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
                        const exception = trouverException(groupe.id, dateISO);
                        const horaireHabituel = lireHoraireHabituel(groupe, jour.cle);

                        const statut = exception ? exception.statut : "cours";
                        const horaire = exception ? exception.horaire : horaireHabituel;
                        const texte = horaire || "-";
                        const point = exception && exception.message ? "•" : "";

                        return `
                            <div>
                                ${jour.label}<br>
                                <small>${date.getDate()}</small>

                                <span class="slot ${classeStatut(statut, horaire)}"
                                      onclick="ouvrirEdition('${groupe.id}', '${groupe.nom}', '${jour.cle}', '${jour.nom}', '${dateISO}')">
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
    const groupe = groupes.find(g => String(g.id) === String(groupeId));
    const horaireHabituel = groupe ? lireHoraireHabituel(groupe, jourCle) : "";

    selection = {
        groupeId,
        groupeNom,
        jourCle,
        jourNom,
        dateISO
    };

    caseSelectionneeTexte.textContent = `${groupeNom} - ${jourNom} ${dateISO}`;

    statutCase.value = exception ? exception.statut : "cours";
    horaireCase.value = exception ? exception.horaire : horaireHabituel;
    titreCase.value = exception ? exception.titre || "" : "";
    messageCase.value = exception ? exception.message || "" : "";

    zoneEdition.style.display = "block";

    zoneEdition.scrollIntoView({
        behavior: "smooth"
    });
}

boutonEnregistrer.addEventListener("click", () => {
    if (!selection) return;

    exceptions = exceptions.filter(item =>
        !(String(item.groupeId) === String(selection.groupeId) && item.date === selection.dateISO)
    );

    exceptions.push({
        groupeId: selection.groupeId,
        date: selection.dateISO,
        jour: selection.jourCle,
        statut: statutCase.value,
        horaire: horaireCase.value.trim(),
        titre: titreCase.value.trim(),
        message: messageCase.value.trim()
    });

    localStorage.setItem("planningExceptionsJDM", JSON.stringify(exceptions));

    zoneEdition.style.display = "none";
    selection = null;

    afficherPlanning();
});

boutonAnnuler.addEventListener("click", () => {
    zoneEdition.style.display = "none";
    selection = null;
});

boutonPrecedent.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() - 7);
    afficherPlanning();
});

boutonSuivant.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() + 7);
    afficherPlanning();
});

afficherPlanning();