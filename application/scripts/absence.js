import { watchSession } from "./session.js";

import {
    findAdherentByEmail,
    listGroupesFirestore,
    listAbsencesFirestore,
    saveAbsenceFirestore,
    saveNotificationFirestore
} from "../firebase/firebase-db.js";

let groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
let absences = JSON.parse(localStorage.getItem("absencesJDM")) || [];

const champNom = document.getElementById("absence-nom");
const champPrenom = document.getElementById("absence-prenom");
const selectGroupe = document.getElementById("absence-groupe");
const champDate = document.getElementById("absence-date");
const selectMotif = document.getElementById("absence-motif");
const champMessage = document.getElementById("absence-message");
const boutonEnvoyer = document.getElementById("envoyer-absence");
const listeAbsences = document.getElementById("liste-absences-parent");

let profilConnecte = null;
let adherentConnecte = null;

async function chargerDonneesPartagees() {
    try {
        const [groupesFirestore, absencesFirestore] = await Promise.all([
            listGroupesFirestore(),
            listAbsencesFirestore()
        ]);

        if (groupesFirestore.length > 0) {
            groupes = groupesFirestore;
            localStorage.setItem("groupesJDM", JSON.stringify(groupes));
        }

        absences = absencesFirestore;
        localStorage.setItem("absencesJDM", JSON.stringify(absences));
    } catch (error) {
        console.warn(
            "Données Firestore indisponibles, utilisation du cache local.",
            error
        );
    }
}

function normaliser(texte) {
    return String(texte || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function groupeAdherent(adherent) {
    return adherent ? (adherent.groupe || adherent.groupeNom || "") : "";
}

function trouverAdherentLocalParEmail(email) {
    const cible = normaliser(email);

    if (!cible) return null;

    return adherents.find(adherent => {
        const emails = [
            adherent.email,
            adherent.emailAdherent,
            adherent.emailParent1,
            adherent.emailParent2,
            adherent.emailPayeur
        ].map(normaliser);

        return emails.includes(cible);
    }) || null;
}

function trouverAdherentLocalParNumero(numeroAdherent) {
    if (!numeroAdherent) return null;

    return adherents.find(adherent =>
        String(adherent.numeroAdherent) === String(numeroAdherent)
    ) || null;
}

function remplirGroupes(groupeUnique = "") {
    selectGroupe.innerHTML = `<option value="">Choisir le groupe</option>`;

    const groupesAffiches = groupeUnique
        ? groupes.filter(groupe => normaliser(groupe.nom) === normaliser(groupeUnique))
        : groupes;

    groupesAffiches.forEach(groupe => {
        selectGroupe.innerHTML += `
            <option value="${groupe.nom}">${groupe.nom}</option>
        `;
    });

    if (groupeUnique) {
        selectGroupe.value = groupeUnique;
    }
}

function preRemplirFormulaire() {
    if (!profilConnecte && !adherentConnecte) return;

    const nom = (adherentConnecte && adherentConnecte.nom) || (profilConnecte && profilConnecte.nom) || "";
    const prenom = (adherentConnecte && adherentConnecte.prenom) || (profilConnecte && profilConnecte.prenom) || "";
    const groupe = groupeAdherent(adherentConnecte) || (profilConnecte && profilConnecte.groupe) || "";

    if (nom) champNom.value = nom;
    if (prenom) champPrenom.value = prenom;

    if (groupe) remplirGroupes(groupe);
    else remplirGroupes();

    if (adherentConnecte) {
        champNom.readOnly = true;
        champPrenom.readOnly = true;

        if (groupe) {
            selectGroupe.disabled = true;
        }
    }
}

function absenceAppartientAuCompte(absence) {
    if (!adherentConnecte && !profilConnecte) return true;

    if (adherentConnecte && absence.numeroAdherent) {
        return String(absence.numeroAdherent) === String(adherentConnecte.numeroAdherent);
    }

    const nom = normaliser((adherentConnecte && adherentConnecte.nom) || (profilConnecte && profilConnecte.nom));
    const prenom = normaliser((adherentConnecte && adherentConnecte.prenom) || (profilConnecte && profilConnecte.prenom));

    if (!nom && !prenom) return true;

    return normaliser(absence.nom) === nom && normaliser(absence.prenom) === prenom;
}

function afficherAbsences() {
    const absencesAffichees = absences.filter(absenceAppartientAuCompte);

    if (absencesAffichees.length === 0) {
        listeAbsences.innerHTML = `
            <section class="card">
                <h2>Aucune absence</h2>
                <p>Aucune absence n'a encore été signalée.</p>
            </section>
        `;
        return;
    }

    listeAbsences.innerHTML = "";

    absencesAffichees
        .slice()
        .reverse()
        .forEach(absence => {
            listeAbsences.innerHTML += `
                <section class="card">
                    <h2>${absence.prenom} ${absence.nom}</h2>
                    <p><strong>Groupe :</strong> ${absence.groupeNom || absence.groupe || ""}</p>
                    <p><strong>Date :</strong> ${absence.date}</p>
                    <p><strong>Motif :</strong> ${absence.motif}</p>
                    ${absence.message ? `<p><strong>Message :</strong> ${absence.message}</p>` : ""}
                    <p><strong>Déclarée le :</strong> ${new Date(absence.dateDeclaration).toLocaleString("fr-FR")}</p>
                </section>
            `;
        });
}

function absenceDejaSignalee(numeroAdherent, groupe, date) {
    return absences.some(absence => {
        if (numeroAdherent && absence.numeroAdherent) {
            return String(absence.numeroAdherent) === String(numeroAdherent) &&
                (absence.groupeNom === groupe || absence.groupe === groupe) &&
                absence.date === date;
        }

        return normaliser(absence.nom) === normaliser(champNom.value) &&
            normaliser(absence.prenom) === normaliser(champPrenom.value) &&
            (absence.groupeNom === groupe || absence.groupe === groupe) &&
            absence.date === date;
    });
}

boutonEnvoyer.addEventListener("click", async () => {
    const nom = adherentConnecte
        ? adherentConnecte.nom
        : champNom.value.trim();

    const prenom = adherentConnecte
        ? adherentConnecte.prenom
        : champPrenom.value.trim();

    const groupe =
        groupeAdherent(adherentConnecte) ||
        selectGroupe.value;

    const date = champDate.value;
    const motif = selectMotif.value;
    const message = champMessage.value.trim();

    if (!nom || !prenom || !groupe || !date || !motif) {
        alert(
            "Merci de compléter le nom, prénom, groupe, date et motif."
        );
        return;
    }

    const numeroAdherent = adherentConnecte
        ? adherentConnecte.numeroAdherent
        : "";

    if (absenceDejaSignalee(numeroAdherent, groupe, date)) {
        alert("Une absence est déjà signalée pour cette date.");
        return;
    }

    const id = String(Date.now());

    const absence = {
        id,
        numeroAdherent,
        nom,
        prenom,
        groupe,
        groupeNom: groupe,
        date,
        motif,
        message,
        dateDeclaration: new Date().toISOString(),
        statut: "déclarée",
        lueAdmin: false,
        traiteeAdmin: false
    };

    const notification = {
        id: `${id}-notification`,
        categorie: "parents-groupes",
        type: "absence",
        titre: "Absence signalée",
        message: `${prenom} ${nom} sera absent(e). Motif : ${motif}`,
        groupeNom: groupe,
        date,
        priorite: "normale",
        lue: false,
        traitee: false,
        archivee: false,
        auteur: "parent",
        destinataire: "admin",
        dateCreation: new Date().toISOString()
    };

    try {
        await saveAbsenceFirestore(absence);
        await saveNotificationFirestore(notification);
    } catch (error) {
        console.error(
            "Erreur d'enregistrement de l'absence :",
            error
        );

        alert(
            "Impossible d'enregistrer l'absence sur le serveur."
        );

        return;
    }

    absences.push(absence);
    localStorage.setItem(
        "absencesJDM",
        JSON.stringify(absences)
    );

    alert("Absence signalée ✅");

    champDate.value = "";
    selectMotif.value = "";
    champMessage.value = "";

    afficherAbsences();
});

watchSession(async (user, profile) => {
    if (!user || !profile) return;

    profilConnecte = profile;

    try {
        adherentConnecte =
            await findAdherentByEmail(profile.email || user.email) ||
            trouverAdherentLocalParNumero(profile.numeroAdherent) ||
            trouverAdherentLocalParEmail(profile.email || user.email);
    } catch (error) {
        console.warn("Recherche adhérent Firebase impossible, fallback localStorage", error);
        adherentConnecte =
            trouverAdherentLocalParNumero(profile.numeroAdherent) ||
            trouverAdherentLocalParEmail(profile.email || user.email);
    }

    preRemplirFormulaire();
    afficherAbsences();
});

chargerDonneesPartagees().then(() => {
    remplirGroupes();
    afficherAbsences();
});
