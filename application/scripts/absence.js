const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
let absences = JSON.parse(localStorage.getItem("absencesJDM")) || [];

const selectGroupe = document.getElementById("absence-groupe");
const boutonEnvoyer = document.getElementById("envoyer-absence");
const listeAbsences = document.getElementById("liste-absences-parent");

groupes.forEach(groupe => {
    selectGroupe.innerHTML += `
        <option value="${groupe.nom}">${groupe.nom}</option>
    `;
});

boutonEnvoyer.addEventListener("click", () => {
    const nom = document.getElementById("absence-nom").value.trim();
    const prenom = document.getElementById("absence-prenom").value.trim();
    const groupe = document.getElementById("absence-groupe").value;
    const date = document.getElementById("absence-date").value;
    const motif = document.getElementById("absence-motif").value;
    const message = document.getElementById("absence-message").value.trim();

    if (!nom || !prenom || !groupe || !date || !motif) {
        alert("Merci de compléter le nom, prénom, groupe, date et motif.");
        return;
    }

    absences.push({
        id: Date.now(),
        nom,
        prenom,
        groupe,
        date,
        motif,
        message,
        dateDeclaration: new Date().toISOString(),
        statut: "déclarée"
    });

    localStorage.setItem("absencesJDM", JSON.stringify(absences));

    alert("Absence signalée ✅");

    document.getElementById("absence-nom").value = "";
    document.getElementById("absence-prenom").value = "";
    document.getElementById("absence-groupe").value = "";
    document.getElementById("absence-date").value = "";
    document.getElementById("absence-motif").value = "";
    document.getElementById("absence-message").value = "";

    afficherAbsences();
});

function afficherAbsences() {
    if (absences.length === 0) {
        listeAbsences.innerHTML = `
            <section class="card">
                <h2>Aucune absence</h2>
                <p>Aucune absence n'a encore été signalée.</p>
            </section>
        `;
        return;
    }

    listeAbsences.innerHTML = "";

    absences
        .slice()
        .reverse()
        .forEach(absence => {
            listeAbsences.innerHTML += `
                <section class="card">
                    <h2>${absence.prenom} ${absence.nom}</h2>
                    <p><strong>Groupe :</strong> ${absence.groupe}</p>
                    <p><strong>Date :</strong> ${absence.date}</p>
                    <p><strong>Motif :</strong> ${absence.motif}</p>
                    ${absence.message ? `<p><strong>Message :</strong> ${absence.message}</p>` : ""}
                    <p><strong>Déclarée le :</strong> ${new Date(absence.dateDeclaration).toLocaleString("fr-FR")}</p>
                </section>
            `;
        });
}

afficherAbsences();