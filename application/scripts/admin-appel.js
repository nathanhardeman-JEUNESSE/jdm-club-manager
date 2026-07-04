const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const absences = JSON.parse(localStorage.getItem("absencesJDM")) || [];
let appels = JSON.parse(localStorage.getItem("appelsJDM")) || [];

const titreSemaine = document.getElementById("titre-semaine");
const boutonPrecedent = document.getElementById("semaine-precedente");
const boutonSuivant = document.getElementById("semaine-suivante");
const selectGroupe = document.getElementById("groupe-appel");
const selectSeance = document.getElementById("seance-appel");
const zoneAppel = document.getElementById("zone-appel");

let dateReference = new Date();

const jours = [
    { cle: "lundi", nom: "Lundi" },
    { cle: "mardi", nom: "Mardi" },
    { cle: "mercredi", nom: "Mercredi" },
    { cle: "jeudi", nom: "Jeudi" },
    { cle: "vendredi", nom: "Vendredi" },
    { cle: "samedi", nom: "Samedi" },
    { cle: "dimanche", nom: "Dimanche" }
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

function remplirGroupes() {
    selectGroupe.innerHTML = `<option value="">Choisir un groupe</option>`;

    groupes.forEach(groupe => {
        selectGroupe.innerHTML += `
            <option value="${groupe.id}">${groupe.nom}</option>
        `;
    });
}

function remplirSeances() {
    const groupe = groupes.find(g => String(g.id) === String(selectGroupe.value));

    selectSeance.innerHTML = `<option value="">Choisir une séance</option>`;
    zoneAppel.innerHTML = "";

    if (!groupe || !groupe.horaires) return;

    jours.forEach((jour, index) => {
        const horaire = groupe.horaires[jour.cle];

        if (!horaire) return;

        const date = dateJour(index);
        const dateISO = formatDateISO(date);

        selectSeance.innerHTML += `
            <option value="${jour.cle}|${dateISO}|${horaire}|${jour.nom}">
            ${jour.nom} ${formatDateFR(date)} — ${horaire}${groupeAvecAbsence(groupe.nom, dateISO) ? " 🔴 Absence signalée" : ""}
            </option>
        `;
    });
}
function groupeAvecAbsence(groupeNom, dateISO) {
    return absences.some(absence =>
        absence.groupeNom === groupeNom &&
        absence.date === dateISO
    );
}
function adherentsDuGroupe(nomGroupe) {
    return adherents.filter(adherent => adherent.groupe === nomGroupe);
}

function absenceDeclaree(numeroAdherent, groupeNom, dateISO) {
    const adherent = adherents.find(a => a.numeroAdherent === numeroAdherent);

    if (!adherent) return null;

    return absences.find(absence =>
        absence.groupeNom === groupeNom &&
        absence.date === dateISO &&
        (
            !absence.numeroAdherent ||
            absence.numeroAdherent === numeroAdherent ||
            (
                absence.nom &&
                absence.prenom &&
                absence.nom.toLowerCase() === String(adherent.nom || "").toLowerCase() &&
                absence.prenom.toLowerCase() === String(adherent.prenom || "").toLowerCase()
            )
        )
    );
}

function trouverAppel(numeroAdherent, groupeId, dateISO, jourCle) {
    return appels.find(appel =>
        appel.numeroAdherent === numeroAdherent &&
        String(appel.groupeId) === String(groupeId) &&
        appel.date === dateISO &&
        appel.jour === jourCle
    );
}

function afficherAppel() {
    const groupe = groupes.find(g => String(g.id) === String(selectGroupe.value));
    const valeurSeance = selectSeance.value;

    if (!groupe || !valeurSeance) {
        zoneAppel.innerHTML = "";
        return;
    }

    const [jourCle, dateISO, horaire, jourNom] = valeurSeance.split("|");
    const membres = adherentsDuGroupe(groupe.nom);

    if (membres.length === 0) {
        zoneAppel.innerHTML = `
            <section class="card">
                <h2>Aucun adhérent</h2>
                <p>Aucun adhérent n'est rattaché à ce groupe.</p>
            </section>
        `;
        return;
    }

    zoneAppel.innerHTML = `
        <section class="card">
            <h2>${groupe.nom}</h2>
            <p><strong>Séance :</strong> ${jourNom} ${dateISO} — ${horaire}</p>
        </section>
    `;

    membres.forEach(adherent => {
        const absence = absenceDeclaree(adherent.numeroAdherent, groupe.nom, dateISO);
        const appelExistant = trouverAppel(adherent.numeroAdherent, groupe.id, dateISO, jourCle);

        let statut = "present";

        if (absence) statut = "absent";
        if (appelExistant) statut = appelExistant.statut;

        zoneAppel.innerHTML += `
            <section class="card">
                <h2>${adherent.prenom} ${adherent.nom}</h2>

                ${absence ? `
    <div class="absence-admin-info">
        <p class="absence-admin-title">🙋 ABSENCE DÉCLARÉE</p>
        <p><strong>Motif :</strong> ${absence.motif || "Non renseigné"}</p>
        ${absence.message ? `<p><strong>Message :</strong> ${absence.message}</p>` : ""}
    </div>
` : ""}

                <label class="checkbox-row">
                    <input type="radio" name="appel-${adherent.numeroAdherent}" value="present"
                           ${statut === "present" ? "checked" : ""}
                           onchange="enregistrerAppel('${adherent.numeroAdherent}', '${groupe.id}', '${groupe.nom}', '${jourCle}', '${jourNom}', '${dateISO}', '${horaire}', 'present')">
                    Présent
                </label>

                <label class="checkbox-row">
                    <input type="radio" name="appel-${adherent.numeroAdherent}" value="absent"
                           ${statut === "absent" ? "checked" : ""}
                           onchange="enregistrerAppel('${adherent.numeroAdherent}', '${groupe.id}', '${groupe.nom}', '${jourCle}', '${jourNom}', '${dateISO}', '${horaire}', 'absent')">
                    Absent
                </label>
            </section>
        `;
    });
}

function enregistrerAppel(numeroAdherent, groupeId, groupeNom, jourCle, jourNom, dateISO, horaire, statut) {
    appels = appels.filter(appel =>
        !(
            appel.numeroAdherent === numeroAdherent &&
            String(appel.groupeId) === String(groupeId) &&
            appel.date === dateISO &&
            appel.jour === jourCle
        )
    );

    appels.push({
        id: Date.now(),
        numeroAdherent,
        groupeId,
        groupeNom,
        jour: jourCle,
        jourNom,
        date: dateISO,
        horaire,
        statut,
        dateSaisie: new Date().toISOString()
    });

    localStorage.setItem("appelsJDM", JSON.stringify(appels));
}

selectGroupe.addEventListener("change", remplirSeances);
selectSeance.addEventListener("change", afficherAppel);

boutonPrecedent.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() - 7);
    mettreAJourTitreSemaine();
    remplirSeances();
});

boutonSuivant.addEventListener("click", () => {
    dateReference.setDate(dateReference.getDate() + 7);
    mettreAJourTitreSemaine();
    remplirSeances();
});

mettreAJourTitreSemaine();
remplirGroupes();