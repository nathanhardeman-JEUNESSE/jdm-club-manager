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
                <h2>Aucun planning disponible</h2>
                <p>Aucun groupe n'a encore été paramétré.</p>
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
                    <p>${groupe.sexe || "Mixte"} · ${groupe.type || "Loisir"} · ${groupe.federation || "-"}</p>
                    <p><strong>Années :</strong> ${groupe.anneeMin || "?"} à ${groupe.anneeMax || "?"}</p>
                    <p><strong>Coach(s) :</strong> ${groupe.coachs && groupe.coachs.length > 0 ? groupe.coachs.join(" / ") : "Non renseigné"}</p>
                    ${groupe.whatsapp ? `
    <a href="${groupe.whatsapp}" class="primary-button order-button" target="_blank" rel="noopener noreferrer">
        💬 Groupe WhatsApp
    </a>
` : ""}
                </div>

                <div class="week-grid">
                    ${jours.map((jour, index) => {
                        const date = dateJour(index);
                        const dateISO = formatDateISO(date);
                        const exception = trouverException(groupe.id, dateISO);

                        const horaireHabituel = groupe.horaires ? groupe.horaires[jour.cle] : "";
                        const statut = exception ? exception.statut : "cours";
                        const horaire = exception ? exception.horaire : horaireHabituel;
                        const titre = exception && exception.titre ? exception.titre : "";
                        const infoClass = exception && exception.message ? " has-info" : "";
                        const messageInfo = exception && exception.message ? exception.message : "";

                        return `
                            <div>
                                ${jour.label}
                                <span class="slot ${classeStatut(statut, horaire)}${infoClass}"
                                onclick="afficherMessage('${messageInfo.replace(/'/g, "\\'")}')">
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

boutonPrecedent.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() - 7);
    afficherPlanning();
});

boutonSuivant.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() + 7);
    afficherPlanning();
});

afficherPlanning();

function afficherMessage(message) {
    if (!message) return;
    alert(message);
}