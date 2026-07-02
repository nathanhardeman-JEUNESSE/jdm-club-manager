const CODE_SECURITE_DEV = "JDM-admin-0";

let groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const organisation = JSON.parse(localStorage.getItem("organisationJDM")) || [];

const listeGroupes = document.getElementById("liste-groupes");
const boutonAjouter = document.getElementById("ajouter-groupe");
const zoneCoachs = document.getElementById("liste-coachs-groupe");

let groupeEnModification = null;

const joursConfig = [
    { jour: "Lundi", champ: "horaireLundi" },
    { jour: "Mardi", champ: "horaireMardi" },
    { jour: "Mercredi", champ: "horaireMercredi" },
    { jour: "Jeudi", champ: "horaireJeudi" },
    { jour: "Vendredi", champ: "horaireVendredi" },
    { jour: "Samedi", champ: "horaireSamedi" }
];

const coachs = organisation.filter(personne =>
    personne.roles && personne.roles.includes("Coach")
);

function demanderCodeSecurite() {
    const code = prompt("Code de sécurité administrateur principal :");

    if (code !== CODE_SECURITE_DEV) {
        alert("Code incorrect. Action annulée.");
        return false;
    }

    return true;
}

function afficherCoachs() {
    if (!zoneCoachs) return;

    zoneCoachs.innerHTML = "";

    if (coachs.length === 0) {
        zoneCoachs.innerHTML = `<p>Aucun coach créé pour le moment.</p>`;
        return;
    }

    coachs.forEach((coach) => {
        zoneCoachs.innerHTML += `
            <label class="checkbox-row">
                <input type="checkbox" name="coachsGroupe" value="${coach.prenom} ${coach.nom}">
                ${coach.prenom} ${coach.nom}
            </label>
        `;
    });
}

function lireHoraires() {
    const horaires = {};

    joursConfig.forEach(config => {
        const jourCoche = document.querySelector(`input[name="joursGroupe"][value="${config.jour}"]`);
        const champHoraire = document.querySelector(`input[name="${config.champ}"]`);

        if (jourCoche && jourCoche.checked && champHoraire && champHoraire.value.trim()) {
            horaires[config.jour.toLowerCase()] = champHoraire.value.trim();
        }
    });

    return horaires;
}

function afficherHoraires(horaires) {
    if (!horaires) return "Non renseignés";

    const lignes = Object.entries(horaires).map(([jour, horaire]) => {
        return `${jour.charAt(0).toUpperCase() + jour.slice(1)} : ${horaire}`;
    });

    return lignes.length > 0 ? lignes.join("<br>") : "Non renseignés";
}

function afficherGroupes() {
    if (groupes.length === 0) {
        listeGroupes.innerHTML = `
            <section class="card">
                <h2>Aucun groupe</h2>
                <p>Aucun groupe n'a encore été créé.</p>
            </section>
        `;
        return;
    }

    listeGroupes.innerHTML = "";

    groupes.forEach((groupe, index) => {
        listeGroupes.innerHTML += `
            <section class="card">
                <h2>${groupe.nom}</h2>

                <p><strong>Années :</strong> ${groupe.anneeMin || "Non renseigné"} à ${groupe.anneeMax || "Non renseigné"}</p>
                <p><strong>Public :</strong> ${groupe.sexe || "Mixte"}</p>
                <p><strong>Type :</strong> ${groupe.type || "Non renseigné"}</p>
                <p><strong>Fédération :</strong> ${groupe.federation || "-"}</p>
                <p><strong>Effectif max :</strong> ${groupe.effectifMax || "Non limité"}</p>
                <p><strong>Horaires :</strong><br>${afficherHoraires(groupe.horaires)}</p>
                <p><strong>Coachs :</strong> ${groupe.coachs && groupe.coachs.length > 0 ? groupe.coachs.join(" / ") : "Aucun coach"}</p>
                <p><strong>WhatsApp :</strong> ${groupe.whatsapp ? "Lien renseigné" : "Non renseigné"}</p>

                <button class="primary-button order-button" onclick="modifierGroupe(${index})">
                    Modifier
                </button>

                <button class="secondary-button" onclick="supprimerGroupe(${index})">
                    Supprimer
                </button>
            </section>
        `;
    });
}

boutonAjouter.addEventListener("click", () => {
    const nom = document.getElementById("nom-groupe").value.trim();
    const anneeMin = document.getElementById("annee-min").value.trim();
    const anneeMax = document.getElementById("annee-max").value.trim();
    const effectifMax = document.getElementById("effectif-max").value.trim();
    const sexe = document.getElementById("sexe-groupe").value;
    const type = document.getElementById("type-groupe").value;
    const federation = document.getElementById("federation-groupe").value;
    const whatsapp = document.getElementById("whatsapp-groupe").value.trim();

    const horaires = lireHoraires();

    const jours = Object.keys(horaires).map(jour =>
        jour.charAt(0).toUpperCase() + jour.slice(1)
    );

    const coachsSelectionnes = Array.from(document.querySelectorAll('input[name="coachsGroupe"]:checked'))
        .map(coach => coach.value);

    if (!nom) {
        alert("Merci d'indiquer le nom du groupe.");
        return;
    }

    const groupe = {
        id: groupeEnModification !== null ? groupes[groupeEnModification].id : Date.now(),
        nom,
        anneeMin,
        anneeMax,
        effectifMax,
        coachs: coachsSelectionnes,
        sexe,
        type,
        federation,
        jours,
        horaires,
        whatsapp
    };

    if (groupeEnModification !== null) {
        groupes[groupeEnModification] = groupe;
        groupeEnModification = null;
        boutonAjouter.textContent = "Ajouter le groupe";
    } else {
        groupes.push(groupe);
    }

    localStorage.setItem("groupesJDM", JSON.stringify(groupes));

    viderFormulaire();
    afficherGroupes();
});

function modifierGroupe(index) {
    const groupe = groupes[index];

    groupeEnModification = index;

    document.getElementById("nom-groupe").value = groupe.nom || "";
    document.getElementById("annee-min").value = groupe.anneeMin || "";
    document.getElementById("annee-max").value = groupe.anneeMax || "";
    document.getElementById("effectif-max").value = groupe.effectifMax || "";
    document.getElementById("sexe-groupe").value = groupe.sexe || "Mixte";
    document.getElementById("type-groupe").value = groupe.type || "Loisir";
    document.getElementById("federation-groupe").value = groupe.federation || "Libre";
    document.getElementById("whatsapp-groupe").value = groupe.whatsapp || "";

    document.querySelectorAll('input[name="coachsGroupe"]').forEach((checkbox) => {
        checkbox.checked = groupe.coachs && groupe.coachs.includes(checkbox.value);
    });

    document.querySelectorAll('input[name="joursGroupe"]').forEach((checkbox) => {
        checkbox.checked = groupe.jours && groupe.jours.includes(checkbox.value);
    });

    joursConfig.forEach(config => {
        const champHoraire = document.querySelector(`input[name="${config.champ}"]`);
        const cle = config.jour.toLowerCase();

        if (champHoraire) {
            champHoraire.value = groupe.horaires && groupe.horaires[cle] ? groupe.horaires[cle] : "";
        }
    });

    boutonAjouter.textContent = "Enregistrer les modifications";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function supprimerGroupe(index) {
    if (!demanderCodeSecurite()) return;

    groupes.splice(index, 1);
    localStorage.setItem("groupesJDM", JSON.stringify(groupes));

    afficherGroupes();
}

function viderFormulaire() {
    document.getElementById("nom-groupe").value = "";
    document.getElementById("annee-min").value = "";
    document.getElementById("annee-max").value = "";
    document.getElementById("effectif-max").value = "";
    document.getElementById("whatsapp-groupe").value = "";

    document.getElementById("sexe-groupe").value = "Mixte";
    document.getElementById("type-groupe").value = "Loisir";
    document.getElementById("federation-groupe").value = "FFG";

    document.querySelectorAll('input[name="joursGroupe"]').forEach((checkbox) => {
        checkbox.checked = false;
    });

    joursConfig.forEach(config => {
        const champHoraire = document.querySelector(`input[name="${config.champ}"]`);

        if (champHoraire) {
            champHoraire.value = "";
        }
    });

    document.querySelectorAll('input[name="coachsGroupe"]').forEach((checkbox) => {
        checkbox.checked = false;
    });
}

afficherCoachs();
afficherGroupes();