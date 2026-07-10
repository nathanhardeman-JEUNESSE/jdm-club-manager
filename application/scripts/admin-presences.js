const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const appels = JSON.parse(localStorage.getItem("appelsJDM")) || [];

const filtreGroupe = document.getElementById("filtre-groupe");
const filtrePeriode = document.getElementById("filtre-periode");
const filtreDate = document.getElementById("filtre-date");
const boutonActualiser = document.getElementById("actualiser-presences");
const zoneResume = document.getElementById("resume-presences");
const zoneDetail = document.getElementById("detail-presences");

const jours = [
    { cle: "lundi", nom: "Lundi" },
    { cle: "mardi", nom: "Mardi" },
    { cle: "mercredi", nom: "Mercredi" },
    { cle: "jeudi", nom: "Jeudi" },
    { cle: "vendredi", nom: "Vendredi" },
    { cle: "samedi", nom: "Samedi" },
    { cle: "dimanche", nom: "Dimanche" }
];

function formatDateISO(date) {
    const annee = date.getFullYear();
    const mois = String(date.getMonth() + 1).padStart(2, "0");
    const jour = String(date.getDate()).padStart(2, "0");
    return `${annee}-${mois}-${jour}`;
}

function debutSemaine(date) {
    const copie = new Date(date);
    const jour = copie.getDay();
    const difference = jour === 0 ? -6 : 1 - jour;

    copie.setDate(copie.getDate() + difference);
    copie.setHours(0, 0, 0, 0);

    return copie;
}

function finSemaine(date) {
    const debut = debutSemaine(date);
    const fin = new Date(debut);
    fin.setDate(debut.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    return fin;
}

function debutMois(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function finMois(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function dateDepuisISO(dateISO) {
    const morceaux = String(dateISO || "").split("-");
    if (morceaux.length !== 3) return null;

    return new Date(Number(morceaux[0]), Number(morceaux[1]) - 1, Number(morceaux[2]));
}

function estDansPeriode(dateISO, debut, fin) {
    const date = dateDepuisISO(dateISO);
    if (!date) return false;

    return date >= debut && date <= fin;
}

function remplirGroupes() {
    groupes.forEach(groupe => {
        filtreGroupe.innerHTML += `<option value="${groupe.id}">${groupe.nom}</option>`;
    });
}

function adherentsDuGroupe(groupe) {
    if (!groupe) return adherents;

    return adherents.filter(adherent => adherent.groupe === groupe.nom);
}

function datesSeancesTheoriques(groupe, debut, fin) {
    if (!groupe || !groupe.horaires) return [];

    const dates = [];
    const date = new Date(debut);

    while (date <= fin) {
        const jourIndex = date.getDay();
        const jourCle = jourIndex === 0 ? "dimanche" : jours[jourIndex - 1].cle;

        if (groupe.horaires[jourCle]) {
            dates.push({
                dateISO: formatDateISO(date),
                jour: jourCle,
                horaire: groupe.horaires[jourCle]
            });
        }

        date.setDate(date.getDate() + 1);
    }

    return dates;
}

function appelsDansPeriode(debut, fin, groupe) {
    return appels.filter(appel => {
        if (!estDansPeriode(appel.date, debut, fin)) return false;

        if (groupe && String(appel.groupeId) !== String(groupe.id)) return false;

        return true;
    });
}

function taux(presents, total) {
    if (!total) return 0;
    return Math.round((presents / total) * 100);
}

function classeTaux(valeur) {
    if (valeur >= 85) return "presence-good";
    if (valeur >= 65) return "presence-medium";
    return "presence-low";
}

function periodeSelectionnee() {
    const date = filtreDate.value ? dateDepuisISO(filtreDate.value) : new Date();

    if (filtrePeriode.value === "mois") {
        return {
            debut: debutMois(date),
            fin: finMois(date),
            label: date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        };
    }

    const debut = debutSemaine(date);
    const fin = finSemaine(date);

    return {
        debut,
        fin,
        label: `semaine du ${debut.toLocaleDateString("fr-FR")} au ${fin.toLocaleDateString("fr-FR")}`
    };
}

function calculer() {
    const groupe = groupes.find(g => String(g.id) === String(filtreGroupe.value)) || null;
    const periode = periodeSelectionnee();
    const appelsFiltres = appelsDansPeriode(periode.debut, periode.fin, groupe);
    const membres = adherentsDuGroupe(groupe);

    let totalPresents = 0;
    let totalAbsents = 0;
    let totalPointages = 0;
    let totalTheorique = 0;

    const lignes = membres.map(adherent => {
        const appelsAdherent = appelsFiltres.filter(appel =>
            appel.numeroAdherent === adherent.numeroAdherent
        );

        const presents = appelsAdherent.filter(appel => appel.statut === "present").length;
        const absents = appelsAdherent.filter(appel => appel.statut === "absent").length;
        const pointages = presents + absents;

        let theorique = pointages;

        if (groupe) {
            theorique = datesSeancesTheoriques(groupe, periode.debut, periode.fin).length;
        }

        const nonPointes = Math.max(theorique - pointages, 0);
        const tauxPresence = taux(presents, pointages || theorique);

        totalPresents += presents;
        totalAbsents += absents;
        totalPointages += pointages;
        totalTheorique += theorique;

        return {
            adherent,
            presents,
            absents,
            nonPointes,
            pointages,
            theorique,
            tauxPresence
        };
    });

    const totalNonPointes = Math.max(totalTheorique - totalPointages, 0);
    const tauxGlobal = taux(totalPresents, totalPointages || totalTheorique);

    return {
        groupe,
        periode,
        lignes,
        totalPresents,
        totalAbsents,
        totalNonPointes,
        totalPointages,
        totalTheorique,
        tauxGlobal
    };
}

function afficherResume(data) {
    zoneResume.innerHTML = `
        <section class="card">
            <h2>${data.groupe ? data.groupe.nom : "Tous les groupes"}</h2>
            <p><strong>Période :</strong> ${data.periode.label}</p>
        </section>

        <section class="presence-stats-grid">
            <section class="card presence-stat-card">
                <h3>Présents</h3>
                <strong>${data.totalPresents}</strong>
            </section>

            <section class="card presence-stat-card">
                <h3>Absents</h3>
                <strong>${data.totalAbsents}</strong>
            </section>

            <section class="card presence-stat-card">
                <h3>Non pointés</h3>
                <strong>${data.totalNonPointes}</strong>
            </section>

            <section class="card presence-stat-card">
                <h3>Taux</h3>
                <strong class="${classeTaux(data.tauxGlobal)}">${data.tauxGlobal} %</strong>
            </section>
        </section>
    `;
}

function afficherDetail(data) {
    if (data.lignes.length === 0) {
        zoneDetail.innerHTML = `<p>Aucun adhérent trouvé pour cette sélection.</p>`;
        return;
    }

    zoneDetail.innerHTML = `
        <table class="presence-table">
            <thead>
                <tr>
                    <th>Adhérent</th>
                    <th>Présent</th>
                    <th>Absent</th>
                    <th>Non pointé</th>
                    <th>Taux</th>
                </tr>
            </thead>
            <tbody>
                ${data.lignes.map(ligne => `
                    <tr>
                        <td>
                            <strong>${ligne.adherent.prenom || ""} ${ligne.adherent.nom || ""}</strong><br>
                            <span class="presence-small">${ligne.adherent.numeroAdherent || ""}</span>
                        </td>
                        <td>${ligne.presents}</td>
                        <td>${ligne.absents}</td>
                        <td>${ligne.nonPointes}</td>
                        <td class="${classeTaux(ligne.tauxPresence)}">${ligne.tauxPresence} %</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

function actualiser() {
    const data = calculer();
    afficherResume(data);
    afficherDetail(data);
}

filtreDate.value = formatDateISO(new Date());

remplirGroupes();
actualiser();

boutonActualiser.addEventListener("click", actualiser);
filtreGroupe.addEventListener("change", actualiser);
filtrePeriode.addEventListener("change", actualiser);
filtreDate.addEventListener("change", actualiser);
