const CODE_SECURITE_DEV = "JDM-admin-0";

let groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const organisation = JSON.parse(localStorage.getItem("organisationJDM")) || [];

const listeGroupes = document.getElementById("liste-groupes");
const boutonAjouter = document.getElementById("ajouter-groupe");
const zoneCoachs = document.getElementById("liste-coachs-groupe");

let groupeEnModification = null;

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
                <p><strong>Fédération :</strong> ${groupe.federation || "Non renseignée"}</p>
                <p><strong>Jours :</strong> ${groupe.jours && groupe.jours.length > 0 ? groupe.jours.join(" / ") : "Non renseignés"}</p>
                <p><strong>Horaire :</strong> ${groupe.horaire || "Non renseigné"}</p>
                <p><strong>Effectif max :</strong> ${groupe.effectifMax || "Non limité"}</p>
                <p><strong>Coachs :</strong> ${groupe.coachs && groupe.coachs.length > 0 ? groupe.coachs.join(" / ") : "Aucun coach"}</p>

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
    const horaire = document.getElementById("horaire-groupe").value.trim();

    const jours = Array.from(document.querySelectorAll('input[name="joursGroupe"]:checked'))
        .map(jour => jour.value);

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
        horaire,
        horaires: groupeEnModification !== null ? groupes[groupeEnModification].horaires || [] : []
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
    

    document.querySelectorAll('input[name="coachsGroupe"]').forEach((checkbox) => {
        checkbox.checked = groupe.coachs && groupe.coachs.includes(checkbox.value);
    });

    document.getElementById("sexe-groupe").value = groupe.sexe || "Mixte";
    document.getElementById("type-groupe").value = groupe.type || "Loisir";
    document.getElementById("federation-groupe").value = groupe.federation || "Libre";
    document.getElementById("horaire-groupe").value = groupe.horaire || "";

    document.querySelectorAll('input[name="joursGroupe"]').forEach((checkbox) => {
        checkbox.checked = groupe.jours && groupe.jours.includes(checkbox.value);
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

    document.getElementById("sexe-groupe").value = "Mixte";
    document.getElementById("type-groupe").value = "Loisir";
    document.getElementById("federation-groupe").value = "FFG";
    document.getElementById("horaire-groupe").value = "";

    document.querySelectorAll('input[name="joursGroupe"]').forEach((checkbox) => {
        checkbox.checked = false;
    });

    document.querySelectorAll('input[name="coachsGroupe"]').forEach((checkbox) => {
        checkbox.checked = false;
    });
}


afficherCoachs();
afficherGroupes();