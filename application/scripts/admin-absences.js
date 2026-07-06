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

function sauvegarderAbsences() {
    localStorage.setItem("absencesJDM", JSON.stringify(absences));
}

function remplirGroupes() {
    if (!filtreGroupeAbsence) return;

    const valeurActuelle = filtreGroupeAbsence.value;
    filtreGroupeAbsence.innerHTML = `<option value="">Tous les groupes</option>`;

    groupes.forEach(groupe => {
        filtreGroupeAbsence.innerHTML += `
            <option value="${groupe.nom}">${groupe.nom}</option>
        `;
    });

    filtreGroupeAbsence.value = valeurActuelle;
}

function absenceVisible(absence) {
    const recherche = rechercheAbsence ? nettoyer(rechercheAbsence.value) : "";
    const filtreGroupe = filtreGroupeAbsence ? filtreGroupeAbsence.value : "";
    const filtreStatut = filtreStatutAbsence ? filtreStatutAbsence.value : "";

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

function marquerAbsenceLue(id) {
    absences = absences.map(absence => {
        if (String(absence.id) === String(id)) {
            return {
                ...absence,
                lueAdmin: true,
                dateLectureAdmin: new Date().toISOString()
            };
        }

        return absence;
    });

    sauvegarderAbsences();
    afficherAbsences();
}

function marquerToutesAbsencesLues() {
    absences = absences.map(absence => ({
        ...absence,
        lueAdmin: true,
        dateLectureAdmin: absence.dateLectureAdmin || new Date().toISOString()
    }));

    sauvegarderAbsences();
    afficherAbsences();
}

function marquerAbsenceTraitee(id) {
    absences = absences.map(absence => {
        if (String(absence.id) === String(id)) {
            return {
                ...absence,
                lueAdmin: true,
                statut: "traitée",
                dateTraitement: new Date().toISOString()
            };
        }

        return absence;
    });

    sauvegarderAbsences();
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

    sauvegarderAbsences();
    afficherAbsences();
}

function supprimerAbsence(id) {
    if (!confirm("Supprimer cette absence ?")) return;

    absences = absences.filter(absence => String(absence.id) !== String(id));

    sauvegarderAbsences();
    afficherAbsences();
}

function afficherAbsences() {
    if (!listeAbsences) return;

    const totalNonLues = absences.filter(absence => !absence.lueAdmin && absence.statut !== "traitée").length;

    const absencesFiltrees = absences
        .filter(absenceVisible)
        .sort((a, b) => String(b.dateDeclaration).localeCompare(String(a.dateDeclaration)));

    listeAbsences.innerHTML = `
        <section class="card">
            <h2>🙋 Suivi des absences</h2>
            <p><strong>Absences non lues :</strong> ${totalNonLues}</p>
            ${totalNonLues > 0 ? `
                <button class="primary-button order-button" onclick="marquerToutesAbsencesLues()">
                    Tout marquer comme lu
                </button>
            ` : ""}
        </section>
    `;

    if (absencesFiltrees.length === 0) {
        listeAbsences.innerHTML += `
            <section class="card">
                <h2>Aucune absence</h2>
                <p>Aucune absence ne correspond aux filtres.</p>
            </section>
        `;
        return;
    }

    absencesFiltrees.forEach(absence => {
        const traitee = absence.statut === "traitée";
        const nonLue = !absence.lueAdmin && !traitee;
        const statutClasse = traitee ? "absence-traitee" : "absence-declaree";

        listeAbsences.innerHTML += `
            <section class="card absence-card-admin ${statutClasse} ${nonLue ? "notification-non-lue" : ""}">
                <h2>${nonLue ? "🔴 " : ""}🙋 ${absence.prenom || ""} ${absence.nom || ""}</h2>

                <p><strong>Groupe :</strong> ${absence.groupeNom || "Non renseigné"}</p>
                <p><strong>Date :</strong> ${absence.date || "Non renseignée"}</p>
                <p><strong>Séance :</strong> ${absence.jour || ""} ${absence.horaire || ""}</p>
                <p><strong>Motif :</strong> ${absence.motif || "Non renseigné"}</p>

                ${absence.message ? `
                    <p><strong>Message parent :</strong> ${absence.message}</p>
                ` : ""}

                <p><strong>Statut :</strong> ${absence.statut || "déclarée"}</p>
                <p><strong>Lecture admin :</strong> ${absence.lueAdmin ? "Lue" : "Non lue"}</p>

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

                ${nonLue ? `
                    <button class="primary-button order-button" onclick="marquerAbsenceLue('${absence.id}')">
                        Marquer comme lu
                    </button>
                ` : ""}

                ${traitee ? `
                    <button class="secondary-button" onclick="remettreAbsenceDeclaree('${absence.id}')">
                        Remettre en déclarée
                    </button>
                ` : `
                    <button class="secondary-button" onclick="marquerAbsenceTraitee('${absence.id}')">
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

if (rechercheAbsence) rechercheAbsence.addEventListener("input", afficherAbsences);
if (filtreGroupeAbsence) filtreGroupeAbsence.addEventListener("change", afficherAbsences);
if (filtreStatutAbsence) filtreStatutAbsence.addEventListener("change", afficherAbsences);

remplirGroupes();
afficherAbsences();
