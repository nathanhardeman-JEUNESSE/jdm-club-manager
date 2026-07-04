let absences = JSON.parse(localStorage.getItem("absencesJDM")) || [];
const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];

const listeAbsences = document.getElementById("liste-absences-admin");
const rechercheAbsence = document.getElementById("recherche-absence");
const filtreGroupeAbsence = document.getElementById("filtre-groupe-absence");
const filtreStatutAbsence = document.getElementById("filtre-statut-absence");

function nettoyer(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function remplirGroupes() {
    groupes.forEach(groupe => {
        filtreGroupeAbsence.innerHTML += `
            <option value="${groupe.nom}">${groupe.nom}</option>
        `;
    });
}

function absenceVisible(absence) {
    const recherche = nettoyer(rechercheAbsence.value);
    const filtreGroupe = filtreGroupeAbsence.value;
    const filtreStatut = filtreStatutAbsence.value;

    if (filtreGroupe && absence.groupeNom !== filtreGroupe) return false;
    if (filtreStatut && absence.statut !== filtreStatut) return false;

    if (!recherche) return true;

    const texte = nettoyer(`
        ${absence.nom}
        ${absence.prenom}
        ${absence.groupeNom}
        ${absence.motif}
        ${absence.message}
        ${absence.date}
    `);

    return texte.includes(recherche);
}

function marquerAbsenceTraitee(id) {
    absences = absences.map(absence => {
        if (String(absence.id) === String(id)) {
            return {
                ...absence,
                statut: "traitée",
                dateTraitement: new Date().toISOString()
            };
        }

        return absence;
    });

    localStorage.setItem("absencesJDM", JSON.stringify(absences));
    afficherAbsences();
}

function remettreAbsenceDeclaree(id) {
    absences = absences.map(absence => {
        if (String(absence.id) === String(id)) {
            return {
                ...absence,
                statut: "déclarée",
                dateTraitement: ""
            };
        }

        return absence;
    });

    localStorage.setItem("absencesJDM", JSON.stringify(absences));
    afficherAbsences();
}

function supprimerAbsence(id) {
    if (!confirm("Supprimer cette absence ?")) return;

    absences = absences.filter(absence => String(absence.id) !== String(id));

    localStorage.setItem("absencesJDM", JSON.stringify(absences));
    afficherAbsences();
}

function afficherAbsences() {
    const absencesFiltrees = absences
        .filter(absenceVisible)
        .sort((a, b) => String(b.dateDeclaration).localeCompare(String(a.dateDeclaration)));

    if (absencesFiltrees.length === 0) {
        listeAbsences.innerHTML = `
            <section class="card">
                <h2>Aucune absence</h2>
                <p>Aucune absence ne correspond aux filtres.</p>
            </section>
        `;
        return;
    }

    listeAbsences.innerHTML = "";

    absencesFiltrees.forEach(absence => {
        const statutClasse = absence.statut === "traitée" ? "absence-traitee" : "absence-declaree";

        listeAbsences.innerHTML += `
            <section class="card absence-card-admin ${statutClasse}">
                <h2>🙋 ${absence.prenom || ""} ${absence.nom || ""}</h2>

                <p><strong>Groupe :</strong> ${absence.groupeNom || "Non renseigné"}</p>
                <p><strong>Date :</strong> ${absence.date || "Non renseignée"}</p>
                <p><strong>Séance :</strong> ${absence.jour || ""} ${absence.horaire || ""}</p>
                <p><strong>Motif :</strong> ${absence.motif || "Non renseigné"}</p>

                ${absence.message ? `
                    <p><strong>Message parent :</strong> ${absence.message}</p>
                ` : ""}

                <p><strong>Statut :</strong> ${absence.statut || "déclarée"}</p>

                <p>
                    <strong>Déclarée le :</strong>
                    ${absence.dateDeclaration ? new Date(absence.dateDeclaration).toLocaleString("fr-FR") : "Non renseigné"}
                </p>

                ${absence.dateTraitement ? `
                    <p>
                        <strong>Traitée le :</strong>
                        ${new Date(absence.dateTraitement).toLocaleString("fr-FR")}
                    </p>
                ` : ""}

                ${absence.statut === "traitée" ? `
                    <button class="secondary-button" onclick="remettreAbsenceDeclaree('${absence.id}')">
                        Remettre en déclarée
                    </button>
                ` : `
                    <button class="primary-button order-button" onclick="marquerAbsenceTraitee('${absence.id}')">
                        Marquer comme traitée
                    </button>
                `}

                <button class="secondary-button" onclick="supprimerAbsence('${absence.id}')">
                    Supprimer
                </button>
            </section>
        `;
    });
}

rechercheAbsence.addEventListener("input", afficherAbsences);
filtreGroupeAbsence.addEventListener("change", afficherAbsences);
filtreStatutAbsence.addEventListener("change", afficherAbsences);

remplirGroupes();
afficherAbsences();