let organisation = JSON.parse(localStorage.getItem("organisationJDM")) || [];

const liste = document.getElementById("liste-organisation");
const boutonAjouter = document.getElementById("ajouter-personne");

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
    const role = document.getElementById("role").value;
    const groupes = document.getElementById("groupes").value
        .split(",")
        .map(groupe => groupe.trim())
        .filter(groupe => groupe !== "");

    if (!prenom || !nom || !email) {
        alert("Merci de compléter prénom, nom et email.");
        return;
    }

    organisation.push({
        prenom,
        nom,
        email,
        roles: [role],
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