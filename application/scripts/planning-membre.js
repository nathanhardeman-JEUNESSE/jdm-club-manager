const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const exceptions = JSON.parse(localStorage.getItem("planningExceptionsJDM")) || [];
const utilisateurConnecte = JSON.parse(localStorage.getItem("utilisateurConnecteJDM")) || null;
const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];

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

const jours = [
    { cle: "lundi", label: "Lun", nom: "Lundi" },
    { cle: "mardi", label: "Mar", nom: "Mardi" },
    { cle: "mercredi", label: "Mer", nom: "Mercredi" },
    { cle: "jeudi", label: "Jeu", nom: "Jeudi" },
    { cle: "vendredi", label: "Ven", nom: "Vendredi" },
    { cle: "samedi", label: "Sam", nom: "Samedi" },
    { cle: "dimanche", label: "Dim", nom: "Dimanche" }
];

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

function groupesDuMembre() {
    if (!utilisateurConnecte || !utilisateurConnecte.enfants) {
        return groupes;
    }

    const enfants = adherents.filter(adherent =>
        utilisateurConnecte.enfants.includes(adherent.numeroAdherent)
    );

    const nomsGroupes = enfants
        .map(enfant => enfant.groupe)
        .filter(Boolean);

    return groupes.filter(groupe => nomsGroupes.includes(groupe.nom));
}

function enfantConnecte() {
    if (!utilisateurConnecte || !utilisateurConnecte.enfants) {
        return null;
    }

    return adherents.find(adherent =>
        utilisateurConnecte.enfants.includes(adherent.numeroAdherent)
    ) || null;
}

function trouverException(groupeId, dateISO) {
    return exceptions.find(item =>
        String(item.groupeId) === String(groupeId) &&
        item.date === dateISO
    );
}

function absenceDejaDeclaree(groupeId, dateISO) {
    const enfant = enfantConnecte();

    return absences.find(absence =>
        String(absence.groupeId) === String(groupeId) &&
        absence.date === dateISO &&
        (
            !enfant ||
            !absence.numeroAdherent ||
            absence.numeroAdherent === enfant.numeroAdherent
        )
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

    const groupesAffiches = groupesDuMembre();

    if (groupesAffiches.length === 0) {
        zonePlanning.innerHTML = `
            <section class="card">
                <h2>Aucun planning disponible</h2>
                <p>Aucun groupe n'est rattaché à ce compte pour le moment.</p>
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
                        const exception = trouverException(groupe.id, dateISO);

                        const horaireHabituel = groupe.horaires ? groupe.horaires[jour.cle] : "";
                        const statut = exception ? exception.statut : "cours";
                        const horaire = exception ? exception.horaire : horaireHabituel;
                        const messageInfo = exception && exception.message ? exception.message : "";
                        const absence = absenceDejaDeclaree(groupe.id, dateISO);

                        const infoClass = messageInfo || absence ? " has-info" : "";

                        return `
                            <div>
                                ${jour.label}
                                <span class="slot ${classeStatut(statut, horaire)}${infoClass}"
                                      onclick="ouvrirSeance(
                                          '${groupe.id}',
                                          '${securiserTexte(groupe.nom)}',
                                          '${dateISO}',
                                          '${jour.nom}',
                                          '${securiserTexte(horaire)}',
                                          '${statut}',
                                          '${securiserTexte(messageInfo)}'
                                      )">
                                    ${horaire || "-"}
                                </span>
                                ${absence ? `<small>🙋 Absence déclarée</small>` : ""}
                            </div>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    });
}

function ouvrirSeance(groupeId, groupeNom, dateISO, jourNom, horaire, statut, messageInfo) {
    if (messageInfo) {
        alert(messageInfo);
    }

    if (!horaire || statut === "annule" || statut === "pas-cours") {
        return;
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
    `;

    motifAbsence.value = "";
    messageAbsence.value = "";

    absenceCard.style.display = "block";
    absenceCard.scrollIntoView({ behavior: "smooth" });
}

boutonEnvoyerAbsence.addEventListener("click", () => {
    if (!seanceSelectionnee) return;

    const motif = motifAbsence.value;
    const message = messageAbsence.value.trim();
    const enfant = enfantConnecte();

    if (!motif) {
        alert("Merci d'indiquer le motif de l'absence.");
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
        numeroAdherent: enfant ? enfant.numeroAdherent : "",
        nom: enfant ? enfant.nom : "",
        prenom: enfant ? enfant.prenom : "",
        dateDeclaration: new Date().toISOString(),
        statut: "déclarée"
    };

    absences.push(absence);

    notifications.push({
        id: Date.now() + 1,
        type: "absence",
        titre: "Absence déclarée",
        message: `${absence.prenom || "Un adhérent"} ${absence.nom || ""} sera absent(e). Motif : ${absence.motif}`,
        groupeId: absence.groupeId,
        groupeNom: absence.groupeNom,
        date: absence.date,
        dateCreation: new Date().toISOString(),
        lue: false
    });

    localStorage.setItem("absencesJDM", JSON.stringify(absences));
    localStorage.setItem("notificationsJDM", JSON.stringify(notifications));

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

afficherPlanning();