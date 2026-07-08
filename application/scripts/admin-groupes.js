const CODE_SECURITE_DEV = "JDM-admin-0";

let groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
let adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
let inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];
const organisation = JSON.parse(localStorage.getItem("organisationJDM")) || [];

const listeGroupes = document.getElementById("liste-groupes");
const boutonAjouter = document.getElementById("ajouter-groupe");
const zoneCoachs = document.getElementById("liste-coachs-groupe");
const rechercheAdherent = document.getElementById("recherche-adherent");
const filtreGroupeAdherent = document.getElementById("filtre-groupe-adherent");

const cellulesPlanningGroupe = document.querySelectorAll(".admin-day-cell");
const zoneEditionHoraire = document.getElementById("edition-horaire-groupe");
const titreEditionHoraire = document.getElementById("titre-edition-horaire");
const champHoraireSelectionne = document.getElementById("horaire-selectionne");
const boutonEnregistrerHoraire = document.getElementById("enregistrer-horaire-groupe");
const boutonSupprimerHoraire = document.getElementById("supprimer-horaire-groupe");

let groupeEnModification = null;
let horairesFormulaire = {};
let jourEnEdition = null;

const joursConfig = [
    { jour: "Lundi", cle: "lundi" },
    { jour: "Mardi", cle: "mardi" },
    { jour: "Mercredi", cle: "mercredi" },
    { jour: "Jeudi", cle: "jeudi" },
    { jour: "Vendredi", cle: "vendredi" },
    { jour: "Samedi", cle: "samedi" }
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

function nettoyer(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function champ(donnees, mots) {
    if (!donnees) return "";

    const cle = Object.keys(donnees).find(cle =>
        mots.every(mot => nettoyer(cle).includes(nettoyer(mot)))
    );

    return cle ? donnees[cle] : "";
}

function calculerAge(dateNaissance) {
    if (!dateNaissance) return "";

    const morceaux = String(dateNaissance).split("/");
    if (morceaux.length !== 3) return "";

    const naissance = new Date(
        Number(morceaux[2]),
        Number(morceaux[1]) - 1,
        Number(morceaux[0])
    );

    const aujourdHui = new Date();

    let age = aujourdHui.getFullYear() - naissance.getFullYear();
    const moisDiff = aujourdHui.getMonth() - naissance.getMonth();

    if (moisDiff < 0 || (moisDiff === 0 && aujourdHui.getDate() < naissance.getDate())) {
        age--;
    }

    return age;
}

function trouverInscriptionAdherent(numeroAdherent) {
    const inscriptionsAdherent = inscriptions.filter(i => i.numeroAdherent === numeroAdherent);
    return inscriptionsAdherent[inscriptionsAdherent.length - 1];
}

function trouverGroupeDepuisInscription(adherent) {
    if (adherent.groupe) return adherent.groupe;

    const inscription = trouverInscriptionAdherent(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};

    return champ(donnees, ["tarif"]) || "";
}

function analyserGroupeDepuisTarif(tarif) {
    const texte = String(tarif || "");
    const texteNettoye = nettoyer(texte);

    let sexe = "Mixte";
    if (texteNettoye.includes("feminin") || texteNettoye.includes("fille")) sexe = "Filles";
    if (texteNettoye.includes("masculin") || texteNettoye.includes("garcon")) sexe = "Garçons";

    const type = texteNettoye.includes("compet") ? "Compétition" : "Loisir";

    let federation = "-";
    if (texteNettoye.includes("ffg")) federation = "FFG";
    if (texteNettoye.includes("uffolep")) federation = "UFOLEP";

    const annees = texte.match(/\b(19|20)\d{2}\b/g) || [];

    return {
        nom: texte.trim(),
        sexe,
        type,
        federation,
        anneeMin: annees[0] || "",
        anneeMax: annees[1] || annees[0] || "",
        effectifMax: "",
        coachs: [],
        horaires: {},
        whatsapp: "",
        notificationsParents: true,
        equipes: []
    };
}

function synchroniserGroupesDepuisInscriptions() {
    let modification = false;

    adherents.forEach(adherent => {
        const groupeInscription = trouverGroupeDepuisInscription(adherent);

        if (groupeInscription && !adherent.groupe) {
            adherent.groupe = groupeInscription;
            modification = true;
        }

        if (groupeInscription && !groupes.some(g => g.nom === groupeInscription)) {
            groupes.push({
                id: Date.now() + Math.floor(Math.random() * 100000),
                ...analyserGroupeDepuisTarif(groupeInscription),
                creeDepuisHelloAsso: true
            });

            modification = true;
        }
    });

    if (modification) {
        localStorage.setItem("adherentsJDM", JSON.stringify(adherents));
        localStorage.setItem("groupesJDM", JSON.stringify(groupes));
    }
}

function afficherCoachs() {
    if (!zoneCoachs) return;

    zoneCoachs.innerHTML = "";

    if (coachs.length === 0) {
        zoneCoachs.innerHTML = `<p>Aucun coach créé pour le moment.</p>`;
        return;
    }

    coachs.forEach(coach => {
        zoneCoachs.innerHTML += `
            <label class="checkbox-row">
                <input type="checkbox" name="coachsGroupe" value="${coach.prenom} ${coach.nom}">
                ${coach.prenom} ${coach.nom}
            </label>
        `;
    });
}

function rafraichirPlanningFormulaire() {
    cellulesPlanningGroupe.forEach(cellule => {
        const jourCle = cellule.dataset.jour.toLowerCase();
        const horaire = horairesFormulaire[jourCle] || "";
        const span = cellule.querySelector("span");

        if (span) {
            span.textContent = horaire || "-";
        }

        cellule.classList.toggle("ok", Boolean(horaire));
        cellule.classList.toggle("off", !horaire);
    });
}

function lireHoraires() {
    return { ...horairesFormulaire };
}

function afficherHoraires(horaires) {
    if (!horaires) return "Non renseignés";

    const lignes = Object.entries(horaires).map(([jour, horaire]) =>
        `${jour.charAt(0).toUpperCase() + jour.slice(1)} : ${horaire}`
    );

    return lignes.length > 0 ? lignes.join("<br>") : "Non renseignés";
}

function adherentsDuGroupe(nomGroupe) {
    return adherents.filter(adherent => trouverGroupeDepuisInscription(adherent) === nomGroupe);
}

function normaliserEquipesGroupe(groupe) {
    if (!groupe.equipes) groupe.equipes = [];
    return groupe.equipes;
}

function ajouterEquipeGroupe(index) {
    const groupe = groupes[index];
    if (!groupe) return;

    normaliserEquipesGroupe(groupe);

    const nomEquipe = prompt("Nom de l'équipe :", `Équipe ${groupe.equipes.length + 1}`);
    if (!nomEquipe) return;

    groupe.equipes.push({
        id: Date.now() + Math.floor(Math.random() * 100000),
        nom: nomEquipe.trim(),
        adherents: []
    });

    localStorage.setItem("groupesJDM", JSON.stringify(groupes));
    afficherGroupes();
}

function renommerEquipeGroupe(indexGroupe, indexEquipe) {
    const groupe = groupes[indexGroupe];
    if (!groupe || !groupe.equipes || !groupe.equipes[indexEquipe]) return;

    const equipe = groupe.equipes[indexEquipe];
    const nouveauNom = prompt("Nouveau nom de l'équipe :", equipe.nom);
    if (!nouveauNom) return;

    equipe.nom = nouveauNom.trim();

    localStorage.setItem("groupesJDM", JSON.stringify(groupes));
    afficherGroupes();
}

function supprimerEquipeGroupe(indexGroupe, indexEquipe) {
    const groupe = groupes[indexGroupe];
    if (!groupe || !groupe.equipes || !groupe.equipes[indexEquipe]) return;

    if (!confirm("Supprimer cette équipe ? Les adhérents resteront dans le groupe.")) return;

    groupe.equipes.splice(indexEquipe, 1);

    localStorage.setItem("groupesJDM", JSON.stringify(groupes));
    afficherGroupes();
}

function toggleAdherentEquipe(indexGroupe, indexEquipe, numeroAdherent, coche) {
    const groupe = groupes[indexGroupe];
    if (!groupe || !groupe.equipes || !groupe.equipes[indexEquipe]) return;

    const equipe = groupe.equipes[indexEquipe];
    equipe.adherents = equipe.adherents || [];

    if (coche) {
        if (!equipe.adherents.includes(numeroAdherent)) {
            equipe.adherents.push(numeroAdherent);
        }
    } else {
        equipe.adherents = equipe.adherents.filter(numero => String(numero) !== String(numeroAdherent));
    }

    localStorage.setItem("groupesJDM", JSON.stringify(groupes));
}

function afficherEquipesGroupe(groupe, indexGroupe) {
    if (groupe.type !== "Compétition") return "";

    normaliserEquipesGroupe(groupe);

    const membres = adherentsDuGroupe(groupe.nom)
        .slice()
        .sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || "")));

    return `
        <hr>
        <h3>🏆 Équipes compétition</h3>
        <p>Créez des sous-équipes pour préparer plus rapidement les convocations.</p>

        <button class="secondary-button" onclick="ajouterEquipeGroupe(${indexGroupe})">
            Ajouter une équipe
        </button>

        ${
            groupe.equipes.length === 0
                ? `<p>Aucune équipe créée pour ce groupe.</p>`
                : groupe.equipes.map((equipe, indexEquipe) => `
                    <section class="card">
                        <h3>${equipe.nom || "Équipe sans nom"}</h3>

                        <button class="secondary-button" onclick="renommerEquipeGroupe(${indexGroupe}, ${indexEquipe})">
                            Renommer
                        </button>

                        <button class="secondary-button" onclick="supprimerEquipeGroupe(${indexGroupe}, ${indexEquipe})">
                            Supprimer
                        </button>

                        ${
                            membres.length === 0
                                ? `<p>Aucun adhérent dans ce groupe.</p>`
                                : membres.map(adherent => {
                                    const coche = (equipe.adherents || []).includes(adherent.numeroAdherent);
                                    return `
                                        <label class="checkbox-row">
                                            <input type="checkbox"
                                                   ${coche ? "checked" : ""}
                                                   onchange="toggleAdherentEquipe(${indexGroupe}, ${indexEquipe}, '${adherent.numeroAdherent}', this.checked)">
                                            ${adherent.prenom || ""} ${adherent.nom || ""}
                                        </label>
                                    `;
                                }).join("")
                        }
                    </section>
                `).join("")
        }
    `;
}

function passerAdherentDansGroupe(numeroAdherent, nouveauGroupe) {
    const adherent = adherents.find(a => a.numeroAdherent === numeroAdherent);
    if (!adherent) return;

    adherent.groupe = nouveauGroupe;

    const inscription = trouverInscriptionAdherent(numeroAdherent);

    if (inscription) {
        if (!inscription.donneesHelloAsso) {
            inscription.donneesHelloAsso = {};
        }

        inscription.donneesHelloAsso["Tarif"] = nouveauGroupe;
        inscription.groupeFinal = nouveauGroupe;
    }

    localStorage.setItem("adherentsJDM", JSON.stringify(adherents));
    localStorage.setItem("inscriptionsJDM", JSON.stringify(inscriptions));

    afficherGroupes();
}

function remplirFiltreGroupes() {
    if (!filtreGroupeAdherent) return;

    const valeurActuelle = filtreGroupeAdherent.value;

    filtreGroupeAdherent.innerHTML = `<option value="">Tous les groupes</option>`;

    groupes.forEach(groupe => {
        filtreGroupeAdherent.innerHTML += `
            <option value="${groupe.nom}">${groupe.nom}</option>
        `;
    });

    filtreGroupeAdherent.value = valeurActuelle;
}

function adherentVisible(adherent) {
    const recherche = rechercheAdherent ? nettoyer(rechercheAdherent.value) : "";
    const filtreGroupe = filtreGroupeAdherent ? filtreGroupeAdherent.value : "";
    const groupe = trouverGroupeDepuisInscription(adherent);
    const age = calculerAge(adherent.dateNaissance);

    if (filtreGroupe && groupe !== filtreGroupe) return false;
    if (!recherche) return true;

    const texte = nettoyer(`${adherent.nom} ${adherent.prenom} ${age} ${groupe}`);
    return texte.includes(recherche);
}

function afficherListeAdherents(groupe) {
    const membres = adherentsDuGroupe(groupe.nom).filter(adherent => adherentVisible(adherent));

    if (membres.length === 0) {
        return `<p>Aucun adhérent affiché pour ce groupe.</p>`;
    }

    return membres.map(adherent => {
        const age = calculerAge(adherent.dateNaissance);

        return `
            <div class="order-line">
                <p>
                    <strong>${adherent.prenom} ${adherent.nom}</strong><br>
                    ${adherent.dateNaissance || "Date inconnue"} ${age !== "" ? `— ${age} ans` : ""}
                </p>

                <select class="form-input" onchange="passerAdherentDansGroupe('${adherent.numeroAdherent}', this.value)">
                    ${groupes.map(g => `
                        <option value="${g.nom}" ${g.nom === groupe.nom ? "selected" : ""}>
                            ${g.nom}
                        </option>
                    `).join("")}
                </select>
            </div>
        `;
    }).join("");
}

function afficherGroupes() {
    remplirFiltreGroupes();

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
        const effectif = adherentsDuGroupe(groupe.nom).length;
        const quota = groupe.effectifMax || "∞";
        const notificationsParents = groupe.notificationsParents !== false;

        listeGroupes.innerHTML += `
            <section class="card groupe-card">
                <div class="groupe-header" onclick="basculerGroupe(${index})">
                    <div>
                        <h2>${groupe.nom}</h2>
                        <p><strong>Effectif :</strong> ${effectif} / ${quota}</p>
                    </div>

                    <div class="groupe-actions">
                        <label class="switch-row" onclick="event.stopPropagation()">
                            <input type="checkbox"
                                   ${notificationsParents ? "checked" : ""}
                                   onchange="changerNotificationGroupe(${index}, this.checked)">
                            🔔
                        </label>

                        <span id="fleche-groupe-${index}" class="groupe-fleche">▼</span>
                    </div>
                </div>

                <div id="contenu-groupe-${index}" class="groupe-contenu" style="display:none;">
                    <p><strong>Années :</strong> ${groupe.anneeMin || "Non renseigné"} à ${groupe.anneeMax || "Non renseigné"}</p>
                    <p><strong>Public :</strong> ${groupe.sexe || "Mixte"}</p>
                    <p><strong>Type :</strong> ${groupe.type || "Non renseigné"}</p>
                    <p><strong>Fédération :</strong> ${groupe.federation || "-"}</p>
                    <p><strong>Effectif max :</strong> ${groupe.effectifMax || "Non limité"}</p>
                    <p><strong>Horaires :</strong><br>${afficherHoraires(groupe.horaires)}</p>
                    <p><strong>Coachs :</strong> ${groupe.coachs && groupe.coachs.length > 0 ? groupe.coachs.join(" / ") : "Aucun coach"}</p>
                    <p><strong>WhatsApp :</strong> ${groupe.whatsapp ? "Lien renseigné" : "Non renseigné"}</p>
                    <p><strong>Notifications parents :</strong> ${notificationsParents ? "Activées" : "Désactivées"}</p>

                    <button class="primary-button order-button" onclick="modifierGroupe(${index})">
                        Modifier
                    </button>

                    <button class="secondary-button" onclick="supprimerGroupe(${index})">
                        Supprimer
                    </button>

                    <h3>👥 Adhérents du groupe</h3>
                    ${afficherListeAdherents(groupe)}

                    ${afficherEquipesGroupe(groupe, index)}
                </div>
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
        whatsapp,
        notificationsParents: groupeEnModification !== null
            ? groupes[groupeEnModification].notificationsParents !== false
            : true,
        equipes: groupeEnModification !== null && groupes[groupeEnModification].equipes
            ? groupes[groupeEnModification].equipes
            : []
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

    document.querySelectorAll('input[name="coachsGroupe"]').forEach(checkbox => {
        checkbox.checked = groupe.coachs && groupe.coachs.includes(checkbox.value);
    });

    horairesFormulaire = groupe.horaires ? { ...groupe.horaires } : {};
    rafraichirPlanningFormulaire();

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

    document.querySelectorAll('input[name="coachsGroupe"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    horairesFormulaire = {};
    jourEnEdition = null;

    if (zoneEditionHoraire) {
        zoneEditionHoraire.style.display = "none";
    }

    rafraichirPlanningFormulaire();
}

function basculerGroupe(index) {
    const contenu = document.getElementById(`contenu-groupe-${index}`);
    const fleche = document.getElementById(`fleche-groupe-${index}`);

    if (!contenu || !fleche) return;

    const ouvert = contenu.style.display === "block";

    contenu.style.display = ouvert ? "none" : "block";
    fleche.textContent = ouvert ? "▼" : "▲";
}

function changerNotificationGroupe(index, actif) {
    groupes[index].notificationsParents = actif;

    localStorage.setItem("groupesJDM", JSON.stringify(groupes));

    afficherGroupes();
}

cellulesPlanningGroupe.forEach(cellule => {
    cellule.addEventListener("click", () => {
        const jour = cellule.dataset.jour;
        const jourCle = jour.toLowerCase();

        jourEnEdition = jourCle;

        titreEditionHoraire.textContent = `Horaire du ${jour}`;
        champHoraireSelectionne.value = horairesFormulaire[jourCle] || "";

        zoneEditionHoraire.style.display = "block";

        zoneEditionHoraire.scrollIntoView({
            behavior: "smooth"
        });
    });
});

if (boutonEnregistrerHoraire) {
    boutonEnregistrerHoraire.addEventListener("click", () => {
        if (!jourEnEdition) return;

        const horaire = champHoraireSelectionne.value.trim();

        if (horaire) {
            horairesFormulaire[jourEnEdition] = horaire;
        }

        zoneEditionHoraire.style.display = "none";
        jourEnEdition = null;

        rafraichirPlanningFormulaire();
    });
}

if (boutonSupprimerHoraire) {
    boutonSupprimerHoraire.addEventListener("click", () => {
        if (!jourEnEdition) return;

        delete horairesFormulaire[jourEnEdition];

        champHoraireSelectionne.value = "";
        zoneEditionHoraire.style.display = "none";
        jourEnEdition = null;

        rafraichirPlanningFormulaire();
    });
}

if (rechercheAdherent) {
    rechercheAdherent.addEventListener("input", afficherGroupes);
}

if (filtreGroupeAdherent) {
    filtreGroupeAdherent.addEventListener("change", afficherGroupes);
}

synchroniserGroupesDepuisInscriptions();
afficherCoachs();
rafraichirPlanningFormulaire();
afficherGroupes();