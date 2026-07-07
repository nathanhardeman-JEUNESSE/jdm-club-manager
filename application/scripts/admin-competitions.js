const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];
let competitions = JSON.parse(localStorage.getItem("competitionsJDM")) || [];
let notifications = JSON.parse(localStorage.getItem("notificationsJDM")) || [];

const champNom = document.getElementById("competition-nom");
const champGroupe = document.getElementById("competition-groupe");
const champCoachs = document.getElementById("competition-coachs");
const champDate = document.getElementById("competition-date");
const champAdresse = document.getElementById("competition-adresse");
const champRendezvous = document.getElementById("competition-rendezvous");
const champTransport = document.getElementById("competition-transport");
const champHeurePassage = document.getElementById("competition-heure-passage");
const champAgres = document.getElementById("competition-agres");
const champMessage = document.getElementById("competition-message");
const rechercheCompetiteur = document.getElementById("recherche-competiteur");

const blocCompetiteursGroupe = document.getElementById("bloc-competiteurs-groupe");
const blocCompetiteursAutres = document.getElementById("bloc-competiteurs-autres");
const historiqueCompetitions = document.getElementById("historique-competitions");

let competitionEnEdition = null;
let convoquesSelectionnes = [];

const messageDefaut = `Rendez-vous en salle d'échauffement 30 min avant le début de la compétition.

N'oubliez pas votre sac, votre tenue complète, CHAUSSETTES BLANCHES ET SLIP BLANC.`;

function nettoyer(texte) {
    return String(texte || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function sauvegarderCompetitions() {
    localStorage.setItem("competitionsJDM", JSON.stringify(competitions));
}

function sauvegarderNotifications() {
    localStorage.setItem("notificationsJDM", JSON.stringify(notifications));
}

function derniereInscription(numeroAdherent) {
    const liste = inscriptions.filter(i => i.numeroAdherent === numeroAdherent);
    return liste[liste.length - 1] || null;
}

function champ(donnees, mots) {
    if (!donnees) return "";
    const cle = Object.keys(donnees).find(cle =>
        mots.every(mot => nettoyer(cle).includes(nettoyer(mot)))
    );
    return cle ? donnees[cle] : "";
}

function groupeAdherent(adherent) {
    if (adherent.groupe) return adherent.groupe;

    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};

    return champ(donnees, ["tarif"]) || "";
}

function remplirGroupes() {
    groupes.forEach(groupe => {
        champGroupe.innerHTML += `<option value="${groupe.nom}">${groupe.nom}</option>`;
    });
}

function adherentTexteRecherche(adherent) {
    return nettoyer(`
        ${adherent.nom}
        ${adherent.prenom}
        ${adherent.numeroAdherent}
        ${groupeAdherent(adherent)}
    `);
}

function adherentCorrespondRecherche(adherent) {
    const recherche = nettoyer(rechercheCompetiteur.value);
    if (!recherche) return true;
    return adherentTexteRecherche(adherent).includes(recherche);
}

function ligneCompetiteur(adherent, autoGroupe = false) {
    const numero = adherent.numeroAdherent;
    const coche = convoquesSelectionnes.includes(numero);

    return `
        <label class="competiteur-row ${autoGroupe ? "competiteur-groupe" : ""}">
            <input type="checkbox"
                   ${coche ? "checked" : ""}
                   onchange="toggleConvoque('${numero}', this.checked)">
            <span>
                <strong>${adherent.prenom || ""} ${adherent.nom || ""}</strong>
                <small>${groupeAdherent(adherent) || "Groupe non renseigné"}</small>
            </span>
        </label>
    `;
}

function afficherCompetiteurs() {
    const groupeChoisi = champGroupe.value;

    const tous = adherents
        .filter(adherentCorrespondRecherche)
        .sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || "")));

    const duGroupe = tous.filter(adherent => groupeAdherent(adherent) === groupeChoisi);
    const autres = tous.filter(adherent => groupeAdherent(adherent) !== groupeChoisi);

    if (groupeChoisi) {
        duGroupe.forEach(adherent => {
            if (!convoquesSelectionnes.includes(adherent.numeroAdherent)) {
                convoquesSelectionnes.push(adherent.numeroAdherent);
            }
        });
    }

    blocCompetiteursGroupe.innerHTML = `
        <section class="competiteurs-section">
            <h3>Gymnastes du groupe sélectionné</h3>
            ${
                !groupeChoisi
                    ? `<p>Sélectionnez un groupe pour afficher ses gymnastes.</p>`
                    : duGroupe.length === 0
                        ? `<p>Aucun gymnaste trouvé dans ce groupe.</p>`
                        : duGroupe.map(adherent => ligneCompetiteur(adherent, true)).join("")
            }
        </section>
    `;

    blocCompetiteursAutres.innerHTML = `
        <section class="competiteurs-section">
            <h3>Ajouter un autre compétiteur</h3>
            ${
                autres.length === 0
                    ? `<p>Aucun autre gymnaste disponible.</p>`
                    : autres.map(adherent => ligneCompetiteur(adherent, false)).join("")
            }
        </section>
    `;
}

function toggleConvoque(numeroAdherent, coche) {
    if (coche) {
        if (!convoquesSelectionnes.includes(numeroAdherent)) {
            convoquesSelectionnes.push(numeroAdherent);
        }
    } else {
        convoquesSelectionnes = convoquesSelectionnes.filter(numero => numero !== numeroAdherent);
    }
}

function viderFormulaire() {
    competitionEnEdition = null;
    convoquesSelectionnes = [];

    champNom.value = "";
    champGroupe.value = "";
    champCoachs.value = "";
    champDate.value = "";
    champAdresse.value = "";
    champRendezvous.value = "Rendez-vous 8h30 sur le parking de la salle de gym, départ en convoi 8h45.";
    champTransport.value = "Covoiturage";
    champHeurePassage.value = "";
    champAgres.value = "Sol";
    champMessage.value = messageDefaut;

    afficherCompetiteurs();
}

function lireFormulaire() {
    return {
        id: competitionEnEdition || Date.now(),
        nom: champNom.value.trim(),
        groupe: champGroupe.value,
        coachs: champCoachs.value.trim(),
        date: champDate.value,
        adresse: champAdresse.value.trim(),
        rendezvous: champRendezvous.value.trim(),
        transport: champTransport.value,
        heurePassage: champHeurePassage.value.trim(),
        agres: champAgres.value,
        message: champMessage.value.trim(),
        convoques: convoquesSelectionnes,
        dateModification: new Date().toISOString()
    };
}

function enregistrerCompetition() {
    const competition = lireFormulaire();

    if (!competition.nom || !competition.groupe || !competition.date) {
        alert("Merci de renseigner le nom, le groupe et la date.");
        return;
    }

    if (competition.convoques.length === 0) {
        alert("Merci de sélectionner au moins un gymnaste.");
        return;
    }

    const existe = competitions.some(c => String(c.id) === String(competition.id));

    if (existe) {
        competitions = competitions.map(c => String(c.id) === String(competition.id) ? {
            ...competition,
            dateCreation: c.dateCreation || new Date().toISOString()
        } : c);
    } else {
        competitions.push({
            ...competition,
            dateCreation: new Date().toISOString()
        });
    }

    sauvegarderCompetitions();
    alert("Compétition enregistrée ✅");

    viderFormulaire();
    afficherHistorique();
}

function chargerCompetition(id) {
    const competition = competitions.find(c => String(c.id) === String(id));
    if (!competition) return;

    competitionEnEdition = competition.id;
    convoquesSelectionnes = competition.convoques || [];

    champNom.value = competition.nom || "";
    champGroupe.value = competition.groupe || "";
    champCoachs.value = competition.coachs || "";
    champDate.value = competition.date || "";
    champAdresse.value = competition.adresse || "";
    champRendezvous.value = competition.rendezvous || "";
    champTransport.value = competition.transport || "Covoiturage";
    champHeurePassage.value = competition.heurePassage || "";
    champAgres.value = competition.agres || "Sol";
    champMessage.value = competition.message || messageDefaut;

    afficherCompetiteurs();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function dupliquerCompetition(id) {
    const competition = competitions.find(c => String(c.id) === String(id));
    if (!competition) return;

    competitionEnEdition = null;
    convoquesSelectionnes = competition.convoques || [];

    champNom.value = `${competition.nom || ""} - copie`;
    champGroupe.value = competition.groupe || "";
    champCoachs.value = competition.coachs || "";
    champDate.value = "";
    champAdresse.value = competition.adresse || "";
    champRendezvous.value = competition.rendezvous || "";
    champTransport.value = competition.transport || "Covoiturage";
    champHeurePassage.value = competition.heurePassage || "";
    champAgres.value = competition.agres || "Sol";
    champMessage.value = competition.message || messageDefaut;

    afficherCompetiteurs();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function supprimerCompetition(id) {
    if (!confirm("Supprimer cette compétition ?")) return;

    competitions = competitions.filter(c => String(c.id) !== String(id));
    sauvegarderCompetitions();
    afficherHistorique();
}

function formatDateFR(dateISO) {
    if (!dateISO) return "Date non renseignée";
    const morceaux = dateISO.split("-");
    if (morceaux.length !== 3) return dateISO;
    return `${morceaux[2]}/${morceaux[1]}/${morceaux[0]}`;
}

function creerNotificationCompetition(id) {
    const competition = competitions.find(c => String(c.id) === String(id));
    if (!competition) return;

    const existe = notifications.some(n =>
        n.type === "competition" &&
        n.donnees &&
        String(n.donnees.competitionId) === String(competition.id)
    );

    if (existe) {
        alert("Une notification existe déjà pour cette compétition.");
        return;
    }

    notifications.push({
        id: Date.now(),
        categorie: "parent",
        type: "competition",
        titre: "Convocation compétition",
        message: `${competition.nom} - ${formatDateFR(competition.date)}. Consultez votre convocation.`,
        priorite: "haute",
        destinataire: "parent",
        lue: false,
        traitee: false,
        archivee: false,
        dateCreation: new Date().toISOString(),
        donnees: {
            competitionId: competition.id,
            groupe: competition.groupe,
            date: competition.date
        }
    });

    sauvegarderNotifications();
    alert("Notification envoyée aux parents ✅");
}

function afficherHistorique() {
    if (competitions.length === 0) {
        historiqueCompetitions.innerHTML = `
            <section class="card">
                <h2>Aucune compétition</h2>
                <p>Aucune compétition enregistrée.</p>
            </section>
        `;
        return;
    }

    historiqueCompetitions.innerHTML = "";

    competitions
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .forEach(competition => {
            historiqueCompetitions.innerHTML += `
                <section class="card competition-history-card">
                    <h2>🏆 ${competition.nom}</h2>
                    <p><strong>Date :</strong> ${formatDateFR(competition.date)}</p>
                    <p><strong>Groupe :</strong> ${competition.groupe}</p>
                    <p><strong>Coach(s) :</strong> ${competition.coachs || "Non renseigné"}</p>
                    <p><strong>Adresse :</strong> ${competition.adresse || "Non renseignée"}</p>
                    <p><strong>Convoqués :</strong> ${(competition.convoques || []).length}</p>

                    <button class="primary-button order-button" onclick="window.open('competition-convocation.html?id=${competition.id}', '_blank')">
                        Générer la convocation PDF
                    </button>

                    <button class="secondary-button" onclick="creerNotificationCompetition('${competition.id}')">
                        Envoyer notification parents
                    </button>

                    <button class="secondary-button" onclick="chargerCompetition('${competition.id}')">
                        Modifier
                    </button>

                    <button class="secondary-button" onclick="dupliquerCompetition('${competition.id}')">
                        Dupliquer
                    </button>

                    <button class="secondary-button" onclick="supprimerCompetition('${competition.id}')">
                        Supprimer
                    </button>
                </section>
            `;
        });
}

champGroupe.addEventListener("change", () => {
    convoquesSelectionnes = [];
    afficherCompetiteurs();
});

rechercheCompetiteur.addEventListener("input", afficherCompetiteurs);
document.getElementById("enregistrer-competition").addEventListener("click", enregistrerCompetition);
document.getElementById("nouvelle-competition").addEventListener("click", viderFormulaire);

remplirGroupes();
viderFormulaire();
afficherHistorique();
