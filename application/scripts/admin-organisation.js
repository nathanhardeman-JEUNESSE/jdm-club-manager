let organisation = JSON.parse(localStorage.getItem("organisationJDM")) || [];
const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];

const liste = document.getElementById("liste-organisation");
const boutonAjouter = document.getElementById("ajouter-personne");
const selectAdherent = document.getElementById("adherent-select");

adherents.forEach((adherent) => {
    selectAdherent.innerHTML += `
        <option value="${adherent.numeroAdherent}">
            ${adherent.prenom} ${adherent.nom}
        </option>
    `;
});

selectAdherent.addEventListener("change", () => {
    const adherent = adherents.find(a => a.numeroAdherent === selectAdherent.value);

    if (!adherent) return;

    document.getElementById("prenom").value = adherent.prenom;
    document.getElementById("nom").value = adherent.nom;
});

function afficherOrganisation() {
    if (organisation.length === 0) {
        liste.innerHTML = `
            <section class="card">
                <h2>Aucune personne</h2>
                <p>Aucun membre de l'organisation n'a encore été ajouté.</p>
            </section>
        `;
        return;
    }

    liste.innerHTML = "";

    organisation.forEach((personne, index) => {
        liste.innerHTML += `
            <section class="card">
                <h2>${personne.prenom} ${personne.nom}</h2>
                <p><strong>Email :</strong> ${personne.email}</p>
                <p><strong>Rôles :</strong> ${personne.roles.join(" / ")}</p>

                ${personne.groupes.length > 0 ? `
                    <p><strong>Groupes :</strong> ${personne.groupes.join(" / ")}</p>
                ` : ""}

                <button class="secondary-button" onclick="supprimerPersonne(${index})">
                    Supprimer
                </button>
            </section>
        `;
    });
}

boutonAjouter.addEventListener("click", () => {
    const prenom = document.getElementById("prenom").value.trim();
    const nom = document.getElementById("nom").value.trim();
    const email = document.getElementById("email").value.trim();

    const roles = Array.from(document.querySelectorAll('input[name="roles"]:checked'))
        .map(role => role.value);

    const groupes = document.getElementById("groupes").value
        .split(",")
        .map(groupe => groupe.trim())
        .filter(groupe => groupe !== "");

    if (!prenom || !nom || roles.length === 0) {
        alert("Merci de compléter prénom, nom et au moins un rôle.");
        return;
    }

    organisation.push({
        prenom,
        nom,
        email,
        roles,
        groupes,
        photo: "../images/logo-jdm.png"
    });

    localStorage.setItem("organisationJDM", JSON.stringify(organisation));
    afficherOrganisation();
});

function supprimerPersonne(index) {
    organisation.splice(index, 1);
    localStorage.setItem("organisationJDM", JSON.stringify(organisation));
    afficherOrganisation();
}

afficherOrganisation();