const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];
let aidesLicence = JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];

const zoneStats = document.getElementById("stats-aide-licence");
const zoneListe = document.getElementById("liste-aide-licence");
const rechercheAide = document.getElementById("recherche-aide");
const filtreStatut = document.getElementById("filtre-aide-statut");

function nettoyer(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
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

    return champ(donnees, ["tarif"]) || "Non renseigné";
}

function paiementAdherent(donnees) {
    return champ(donnees, ["moyen", "paiement"]) ||
           champ(donnees, ["paiement"]) ||
           "Non renseigné";
}

function villeAdherent(donnees) {
    return champ(donnees, ["ville"]);
}

function codePostalAdherent(donnees) {
    return champ(donnees, ["code", "postal"]);
}

function estLomme(donnees) {
    const ville = nettoyer(villeAdherent(donnees));
    const codePostal = String(codePostalAdherent(donnees) || "").trim();

    return ville.includes("lomme") || codePostal === "59160";
}

function aidePour(numeroAdherent) {
    let aide = aidesLicence.find(a => a.numeroAdherent === numeroAdherent);

    if (!aide) {
        aide = {
            numeroAdherent,
            aideLomme: "non",
            codeLomme: "",
            montantAideLomme: "",
            passSport: "non",
            montantPassSport: "",
            codePassSport: "",
            statut: "a-traiter",
            remboursementFamille: "",
            commentaire: ""
        };

        aidesLicence.push(aide);
        sauvegarderAides();
    }

    return aide;
}

function sauvegarderAides() {
    localStorage.setItem("aidesLicenceLommeJDM", JSON.stringify(aidesLicence));
}

function adherentsEligibles() {
    return adherents.filter(adherent => {
        const age = calculerAge(adherent.dateNaissance);
        return age !== "" && age >= 2 && age <= 18;
    });
}

function modifierAide(numeroAdherent, champ, valeur) {
    const aide = aidePour(numeroAdherent);
    aide[champ] = valeur;

    sauvegarderAides();
    afficherStats();
}

function totalNombre(champNom) {
    return aidesLicence.reduce((total, aide) => {
        return total + Number(aide[champNom] || 0);
    }, 0);
}

function afficherStats() {
    const eligibles = adherentsEligibles();

    let lomme = 0;
    let horsLomme = 0;
    let cb = 0;
    let cheque = 0;
    let espece = 0;
    let passSportOui = 0;

    const parAge = {};

    eligibles.forEach(adherent => {
        const inscription = derniereInscription(adherent.numeroAdherent);
        const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
        const aide = aidePour(adherent.numeroAdherent);
        const age = calculerAge(adherent.dateNaissance);
        const modePaiement = nettoyer(paiementAdherent(donnees));

        parAge[age] = (parAge[age] || 0) + 1;

        if (estLomme(donnees)) {
            lomme++;
        } else {
            horsLomme++;
        }

        if (modePaiement.includes("carte") || modePaiement.includes("cb")) cb++;
        if (modePaiement.includes("cheque") || modePaiement.includes("chèque")) cheque++;
        if (modePaiement.includes("espece") || modePaiement.includes("espèce")) espece++;

        if (aide.passSport === "oui") passSportOui++;
    });

    zoneStats.innerHTML = `
        <p><strong>Adhérents éligibles 2 à 18 ans :</strong> ${eligibles.length}</p>
        <p><strong>Résidents Lomme repérés :</strong> ${lomme}</p>
        <p><strong>Hors Lomme :</strong> ${horsLomme}</p>

        <hr>

        <p><strong>Paiements CB :</strong> ${cb}</p>
        <p><strong>Paiements chèque :</strong> ${cheque}</p>
        <p><strong>Paiements espèces :</strong> ${espece}</p>

        <hr>

        <p><strong>Pass’Sport déclarés :</strong> ${passSportOui}</p>
        <p><strong>Total aides Lomme prévues :</strong> ${totalNombre("montantAideLomme")} €</p>
        <p><strong>Total Pass’Sport :</strong> ${totalNombre("montantPassSport")} €</p>
        <p><strong>Total remboursé aux familles :</strong> ${totalNombre("remboursementFamille")} €</p>

        <h3>Répartition par âge</h3>
        ${Object.keys(parAge)
            .sort((a, b) => Number(a) - Number(b))
            .map(age => `<p>${age} ans : ${parAge[age]}</p>`)
            .join("")}
    `;
}

function adherentVisible(adherent) {
    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
    const aide = aidePour(adherent.numeroAdherent);

    const recherche = nettoyer(rechercheAide.value);
    const filtre = filtreStatut.value;

    if (filtre && aide.statut !== filtre) return false;

    if (!recherche) return true;

    const texte = nettoyer(`
        ${adherent.nom}
        ${adherent.prenom}
        ${groupeAdherent(adherent)}
        ${villeAdherent(donnees)}
        ${codePostalAdherent(donnees)}
        ${aide.codeLomme}
        ${aide.codePassSport}
    `);

    return texte.includes(recherche);
}

function afficherListe() {
    const eligibles = adherentsEligibles()
        .filter(adherentVisible)
        .sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || "")));

    if (eligibles.length === 0) {
        zoneListe.innerHTML = `
            <section class="card">
                <h2>Aucun adhérent</h2>
                <p>Aucun adhérent ne correspond aux filtres.</p>
            </section>
        `;
        return;
    }

    zoneListe.innerHTML = "";

    eligibles.forEach(adherent => {
        const inscription = derniereInscription(adherent.numeroAdherent);
        const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
        const aide = aidePour(adherent.numeroAdherent);
        const age = calculerAge(adherent.dateNaissance);
        const residentLomme = estLomme(donnees);

        zoneListe.innerHTML += `
            <section class="card aide-licence-card">
                <h2>${adherent.prenom || ""} ${adherent.nom || ""}</h2>

                <p><strong>Âge :</strong> ${age} ans</p>
                <p><strong>Groupe :</strong> ${groupeAdherent(adherent)}</p>
                <p><strong>Ville :</strong> ${villeAdherent(donnees) || "Non renseignée"}</p>
                <p><strong>Code postal :</strong> ${codePostalAdherent(donnees) || "Non renseigné"}</p>
                <p><strong>Résident Lomme :</strong> ${residentLomme ? "Oui" : "Non / à vérifier"}</p>
                <p><strong>Paiement :</strong> ${paiementAdherent(donnees)}</p>

                <hr>

                <h3>💶 Aide licence Lomme</h3>

                <select class="form-input"
                        onchange="modifierAide('${adherent.numeroAdherent}', 'aideLomme', this.value)">
                    <option value="non" ${aide.aideLomme === "non" ? "selected" : ""}>Non</option>
                    <option value="oui" ${aide.aideLomme === "oui" ? "selected" : ""}>Oui</option>
                </select>

                <input class="form-input"
                       placeholder="Code aide licence ex : C26-10-01"
                       value="${aide.codeLomme || ""}"
                       onchange="modifierAide('${adherent.numeroAdherent}', 'codeLomme', this.value)">

                <select class="form-input"
                        onchange="modifierAide('${adherent.numeroAdherent}', 'montantAideLomme', this.value)">
                    <option value="" ${aide.montantAideLomme === "" ? "selected" : ""}>Montant aide Lomme</option>
                    <option value="80" ${aide.montantAideLomme === "80" ? "selected" : ""}>80 €</option>
                    <option value="60" ${aide.montantAideLomme === "60" ? "selected" : ""}>60 €</option>
                    <option value="30" ${aide.montantAideLomme === "30" ? "selected" : ""}>30 €</option>
                    <option value="10" ${aide.montantAideLomme === "10" ? "selected" : ""}>10 €</option>
                </select>

                <hr>

                <h3>🎫 Pass’Sport</h3>

                <select class="form-input"
                        onchange="modifierAide('${adherent.numeroAdherent}', 'passSport', this.value)">
                    <option value="non" ${aide.passSport === "non" ? "selected" : ""}>Non</option>
                    <option value="oui" ${aide.passSport === "oui" ? "selected" : ""}>Oui</option>
                </select>

                <input class="form-input"
                       placeholder="Code / référence Pass’Sport"
                       value="${aide.codePassSport || ""}"
                       onchange="modifierAide('${adherent.numeroAdherent}', 'codePassSport', this.value)">

                <input class="form-input"
                       type="number"
                       placeholder="Montant Pass’Sport"
                       value="${aide.montantPassSport || ""}"
                       onchange="modifierAide('${adherent.numeroAdherent}', 'montantPassSport', this.value)">

                <hr>

                <h3>🔁 Suivi remboursement</h3>

                <input class="form-input"
                       type="number"
                       placeholder="Montant remboursé à la famille"
                       value="${aide.remboursementFamille || ""}"
                       onchange="modifierAide('${adherent.numeroAdherent}', 'remboursementFamille', this.value)">

                <select class="form-input"
                        onchange="modifierAide('${adherent.numeroAdherent}', 'statut', this.value)">
                    <option value="a-traiter" ${aide.statut === "a-traiter" ? "selected" : ""}>À traiter</option>
                    <option value="code-recu" ${aide.statut === "code-recu" ? "selected" : ""}>Code reçu</option>
                    <option value="transmis-ville" ${aide.statut === "transmis-ville" ? "selected" : ""}>Transmis à la Ville</option>
                    <option value="rembourse-ville" ${aide.statut === "rembourse-ville" ? "selected" : ""}>Remboursé par la Ville</option>
                    <option value="rembourse-famille" ${aide.statut === "rembourse-famille" ? "selected" : ""}>Famille remboursée</option>
                </select>

                <textarea class="form-input"
                          placeholder="Commentaire trésorier"
                          onchange="modifierAide('${adherent.numeroAdherent}', 'commentaire', this.value)">${aide.commentaire || ""}</textarea>
            </section>
        `;
    });
}

rechercheAide.addEventListener("input", afficherListe);
filtreStatut.addEventListener("change", afficherListe);

afficherStats();
afficherListe();