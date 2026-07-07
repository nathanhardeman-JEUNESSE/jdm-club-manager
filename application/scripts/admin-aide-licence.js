const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];
let aidesLicence = JSON.parse(localStorage.getItem("aidesLicenceLommeJDM")) || [];

const zoneStats = document.getElementById("stats-cotisations");
const zoneListe = document.getElementById("liste-aide-licence");
const zoneAlertes = document.getElementById("liste-alertes-cotisations");

const rechercheAide = document.getElementById("recherche-aide");
const filtreStatut = document.getElementById("filtre-aide-statut");
const filtreModePaiement = document.getElementById("filtre-mode-paiement");
const filtreDossiers = document.getElementById("filtre-dossiers");

function nettoyer(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function toggleSectionCotisation(section) {
    const bloc = document.getElementById("section-" + section);
    const fleche = document.getElementById("arrow-" + section);
    if (!bloc || !fleche) return;
    if (bloc.style.display === "none") {
        bloc.style.display = "block";
        fleche.textContent = "▼";
    } else {
        bloc.style.display = "none";
        fleche.textContent = "▶";
    }
}

function sauvegarderAides() {
    localStorage.setItem("aidesLicenceLommeJDM", JSON.stringify(aidesLicence));
}

function calculerAge(dateNaissance) {
    if (!dateNaissance) return "";
    let naissance = null;
    if (String(dateNaissance).includes("/")) {
        const m = String(dateNaissance).split("/");
        if (m.length === 3) naissance = new Date(Number(m[2]), Number(m[1]) - 1, Number(m[0]));
    } else {
        naissance = new Date(dateNaissance);
    }
    if (!naissance || Number.isNaN(naissance.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - naissance.getFullYear();
    const diff = today.getMonth() - naissance.getMonth();
    if (diff < 0 || (diff === 0 && today.getDate() < naissance.getDate())) age--;
    return age;
}

function derniereInscription(numeroAdherent) {
    const liste = inscriptions.filter(i => String(i.numeroAdherent) === String(numeroAdherent));
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

function paiementImporte(donnees) {
    return champ(donnees, ["moyen", "paiement"]) || champ(donnees, ["mode", "paiement"]) || champ(donnees, ["paiement"]) || "";
}

function normaliserMontant(valeur) {
    if (valeur === null || valeur === undefined) return "";

    const texte = String(valeur)
        .replace(/\s/g, "")
        .replace("€", "")
        .replace(",", ".");

    const nombre = Number(texte.replace(/[^\d.-]/g, ""));

    if (Number.isNaN(nombre)) return "";

    return String(nombre);
}

function valeurExacte(donnees, nomsPossibles) {
    if (!donnees) return "";

    const cles = Object.keys(donnees);

    for (const nom of nomsPossibles) {
        const nomNettoye = nettoyer(nom);
        const cle = cles.find(cle => nettoyer(cle) === nomNettoye);

        if (cle && donnees[cle] !== undefined && donnees[cle] !== null && donnees[cle] !== "") {
            return donnees[cle];
        }
    }

    return "";
}

function montantExact(donnees, nomsPossibles) {
    return normaliserMontant(valeurExacte(donnees, nomsPossibles));
}

function analyserMontantsHelloAsso(donnees) {
    const montantTarif = montantExact(donnees, [
        "Montant tarif",
        "Montant du tarif"
    ]);

    const montantRegleCB = montantExact(donnees, [
        "Montant réglé en CB",
        "Montant regle en CB",
        "Montant payé en CB",
        "Montant paye en CB",
        "Montant CB",
        "Montant de la commande",
        "Montant commande"
    ]);

    const montantCodePromo = montantExact(donnees, [
        "Montant code promo",
        "Montant Code Promo"
    ]);

    const montantReductionResident = montantExact(donnees, [
        "Montant Résident communes Lille Lomme Hellemmes",
        "Montant Resident communes Lille Lomme Hellemmes",
        "Montant résident communes Lille Lomme Hellemmes"
    ]);

    const montantPassSportImport = montantExact(donnees, [
        "Montant Payement PASS'SPORT",
        "Montant Paiement PASS'SPORT",
        "Montant PASS'SPORT",
        "Montant Pass'Sport",
        "Montant PassSport"
    ]);

    const montantTshirt = montantExact(donnees, [
        "Montant T-shirt du club (taille et visuel dans notre boutique)"
    ]);

    const montantSac = montantExact(donnees, [
        "Montant Sac du club compétition (visuel dans notre boutique)"
    ]);

    const montantRegleCalcule = [
        montantTarif,
        montantTshirt,
        montantSac,
        montantCodePromo,
        montantReductionResident,
        montantPassSportImport
    ].reduce((total, montant) => total + Number(montant || 0), 0);

    return {
        montantTarif,
        montantRegleCB,
        montantCodePromo,
        montantReductionResident,
        montantPassSportImport,
        montantTshirt,
        montantSac,
        montantRegleCalcule: montantRegleCalcule ? String(montantRegleCalcule) : ""
    };
}

function montantImporteHelloAsso(donnees) {
    const montants = analyserMontantsHelloAsso(donnees);

    return montants.montantTarif ||
        montants.montantRegleCB ||
        montants.montantRegleCalcule ||
        "";
}

function montantAttenduDepuisGroupe(adherent) {
    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
    const montants = analyserMontantsHelloAsso(donnees);

    return montants.montantTarif || montantImporteHelloAsso(donnees);
}

function villeAdherent(donnees) { return champ(donnees, ["ville"]); }
function codePostalAdherent(donnees) { return champ(donnees, ["code", "postal"]); }

function estLomme(donnees) {
    const ville = nettoyer(villeAdherent(donnees));
    const cp = String(codePostalAdherent(donnees) || "").trim();
    return ville.includes("lomme") || cp === "59160";
}

function detecterModePaiement(donnees) {
    const texte = nettoyer(JSON.stringify(donnees || {}));
    if (texte.includes("carte") || texte.includes("cb") || texte.includes("helloasso")) return "cb-helloasso";
    if (texte.includes("cheque sport") || texte.includes("chèque sport")) return "cheque-sport";
    if (texte.includes("cheque") || texte.includes("chèque")) return "cheque";
    if (texte.includes("espece") || texte.includes("espèce")) return "especes";
    return "inconnu";
}

function modePaiementLabel(mode) {
    return {
        "cb-helloasso": "CB HelloAsso",
        "cheque": "Chèque",
        "especes": "Espèces",
        "cheque-sport": "Chèque sport",
        "aide-lomme": "Aide Ville de Lomme",
        "passsport": "Pass’Sport",
        "mixte": "Paiement mixte",
        "inconnu": "Non renseigné"
    }[mode] || "Non renseigné";
}

function statutLabel(statut) {
    return {
        "a-controler": "À contrôler",
        "a-relancer": "À relancer",
        "partiel": "Partiellement réglé",
        "regle": "Réglé",
        "attente-aide": "En attente aide"
    }[statut] || "À contrôler";
}

function aidePour(adherent) {
    let aide = aidesLicence.find(a => String(a.numeroAdherent) === String(adherent.numeroAdherent));
    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
    const modeDetecte = detecterModePaiement(donnees);
    const montantsImport = analyserMontantsHelloAsso(donnees);
    const montantDetecte = montantsImport.montantTarif || montantImporteHelloAsso(donnees);
    const montantRegleDetecte = montantsImport.montantRegleCB ||
        (modeDetecte === "cb-helloasso" ? montantsImport.montantRegleCalcule : "");

    if (!aide) {
        aide = {
            numeroAdherent: adherent.numeroAdherent,
            typeLicence: "loisir",
            montantLicence: montantDetecte,
            montantRegle: modeDetecte === "cb-helloasso" ? montantRegleDetecte : "",
            montantImportHelloAsso: montantDetecte,
            montantTarifHelloAsso: montantsImport.montantTarif,
            montantRegleCB: montantsImport.montantRegleCB,
            montantCodePromo: montantsImport.montantCodePromo,
            montantReductionResident: montantsImport.montantReductionResident,
            montantPassSportImport: montantsImport.montantPassSportImport,
            montantTshirt: montantsImport.montantTshirt,
            montantSac: montantsImport.montantSac,
            statutCotisation: modeDetecte === "cb-helloasso" ? "regle" : "a-controler",
            modePaiement: modeDetecte,
            dateReglement: modeDetecte === "cb-helloasso" ? new Date().toISOString().split("T")[0] : "",
            referencePaiement: "",
            relance: "non",
            aideLomme: "non",
            codeLomme: "",
            montantAideLomme: "",
            passSport: "non",
            montantPassSport: "",
            codePassSport: "",
            remboursementFamille: "",
            commentaire: ""
        };
        aidesLicence.push(aide);
        sauvegarderAides();
    }
    if (!aide.statutCotisation) aide.statutCotisation = aide.statut === "rembourse-famille" ? "regle" : "a-controler";
    if (!aide.modePaiement) aide.modePaiement = modeDetecte;
    if (!("dateReglement" in aide)) aide.dateReglement = "";
    if (!("referencePaiement" in aide)) aide.referencePaiement = "";
    if (!("relance" in aide)) aide.relance = "non";
    if (!aide.typeLicence) aide.typeLicence = "loisir";
    if (!("montantImportHelloAsso" in aide)) aide.montantImportHelloAsso = montantDetecte;
    if (!("montantTarifHelloAsso" in aide)) aide.montantTarifHelloAsso = montantsImport.montantTarif;
    if (!("montantRegleCB" in aide)) aide.montantRegleCB = montantsImport.montantRegleCB;
    if (!("montantCodePromo" in aide)) aide.montantCodePromo = montantsImport.montantCodePromo;
    if (!("montantReductionResident" in aide)) aide.montantReductionResident = montantsImport.montantReductionResident;
    if (!("montantPassSportImport" in aide)) aide.montantPassSportImport = montantsImport.montantPassSportImport;
    if (!("montantTshirt" in aide)) aide.montantTshirt = montantsImport.montantTshirt;
    if (!("montantSac" in aide)) aide.montantSac = montantsImport.montantSac;

    if (!aide.montantTarifHelloAsso && montantsImport.montantTarif) aide.montantTarifHelloAsso = montantsImport.montantTarif;
    if (!aide.montantRegleCB && montantsImport.montantRegleCB) aide.montantRegleCB = montantsImport.montantRegleCB;
    if (!aide.montantCodePromo && montantsImport.montantCodePromo) aide.montantCodePromo = montantsImport.montantCodePromo;
    if (!aide.montantReductionResident && montantsImport.montantReductionResident) aide.montantReductionResident = montantsImport.montantReductionResident;
    if (!aide.montantPassSportImport && montantsImport.montantPassSportImport) aide.montantPassSportImport = montantsImport.montantPassSportImport;

    if (!("montantLicence" in aide)) aide.montantLicence = montantDetecte;
    if (!("montantRegle" in aide)) aide.montantRegle = aide.modePaiement === "cb-helloasso" ? (montantRegleDetecte || aide.montantLicence || montantDetecte) : "";
    if (!aide.montantLicence && montantDetecte) aide.montantLicence = montantDetecte;
    if (!aide.montantImportHelloAsso && montantDetecte) aide.montantImportHelloAsso = montantDetecte;
    if (!aide.montantRegle && aide.modePaiement === "cb-helloasso" && (montantRegleDetecte || aide.montantLicence || montantDetecte)) {
        aide.montantRegle = montantRegleDetecte || aide.montantLicence || montantDetecte;
    }
    if (!("aideLomme" in aide)) aide.aideLomme = "non";
    if (!("passSport" in aide)) aide.passSport = "non";
    return aide;
}

function adherentsTous() {
    return adherents.slice().sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || "")));
}

function modifierAide(numeroAdherent, champNom, valeur) {
    const adherent = adherents.find(a => String(a.numeroAdherent) === String(numeroAdherent));
    if (!adherent) return;
    const aide = aidePour(adherent);
    aide[champNom] = valeur;
    if (champNom === "statutCotisation" && valeur === "regle" && !aide.dateReglement) {
        aide.dateReglement = new Date().toISOString().split("T")[0];
    }

    if (champNom === "statutCotisation" && valeur === "regle" && !aide.montantRegle) {
        aide.montantRegle = aide.montantLicence || aide.montantImportHelloAsso || montantAttenduDepuisGroupe(adherent);
    }

    if (champNom === "montantLicence" && aide.statutCotisation === "regle" && !aide.montantRegle) {
        aide.montantRegle = valeur;
    }
    sauvegarderAides();
    rafraichir();
}

function totalNombre(champNom) {
    return aidesLicence.reduce((total, aide) => total + Number(aide[champNom] || 0), 0);
}

function estAlerte(adherent) {
    const aide = aidePour(adherent);
    return aide.statutCotisation !== "regle" ||
        aide.relance === "oui" ||
        (aide.aideLomme === "oui" && !aide.montantAideLomme) ||
        (aide.passSport === "oui" && !aide.montantPassSport);
}

function adherentVisible(adherent) {
    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
    const aide = aidePour(adherent);
    const recherche = nettoyer(rechercheAide.value);
    if (filtreStatut.value && aide.statutCotisation !== filtreStatut.value) return false;
    if (filtreModePaiement.value && aide.modePaiement !== filtreModePaiement.value) return false;
    if (filtreDossiers.value === "alertes" && !estAlerte(adherent)) return false;
    if (filtreDossiers.value === "lomme" && !estLomme(donnees)) return false;
    if (filtreDossiers.value === "passsport" && aide.passSport !== "oui") return false;
    if (filtreDossiers.value === "commentaire" && !aide.commentaire) return false;
    if (!recherche) return true;
    const texte = nettoyer(`${adherent.nom} ${adherent.prenom} ${groupeAdherent(adherent)} ${villeAdherent(donnees)} ${codePostalAdherent(donnees)} ${paiementImporte(donnees)} ${aide.codeLomme} ${aide.codePassSport} ${aide.referencePaiement} ${aide.commentaire} ${aide.typeLicence} ${aide.statutCotisation} ${aide.modePaiement}`);
    return texte.includes(recherche);
}

function afficherStats() {
    const tous = adherentsTous();
    const count = statut => tous.filter(a => aidePour(a).statutCotisation === statut).length;
    zoneStats.innerHTML = `
        <p><strong>Total adhérents :</strong> ${tous.length}</p>
        <p><strong>Cotisations réglées :</strong> ${count("regle")}</p>
        <p><strong>À contrôler :</strong> ${count("a-controler")}</p>
        <p><strong>Partiellement réglées :</strong> ${count("partiel")}</p>
        <p><strong>À relancer :</strong> ${count("a-relancer") + tous.filter(a => aidePour(a).relance === "oui").length}</p>
        <p><strong>En attente aide :</strong> ${count("attente-aide")}</p>
        <hr>
        <p><strong>CB HelloAsso :</strong> ${tous.filter(a => aidePour(a).modePaiement === "cb-helloasso").length}</p>
        <p><strong>Chèques :</strong> ${tous.filter(a => aidePour(a).modePaiement === "cheque").length}</p>
        <p><strong>Espèces :</strong> ${tous.filter(a => aidePour(a).modePaiement === "especes").length}</p>
        <p><strong>Chèques sport :</strong> ${tous.filter(a => aidePour(a).modePaiement === "cheque-sport").length}</p>
        <p><strong>Paiements mixtes :</strong> ${tous.filter(a => aidePour(a).modePaiement === "mixte").length}</p>
        <p><strong>Pass’Sport :</strong> ${tous.filter(a => aidePour(a).passSport === "oui").length}</p>
        <hr>
        <p><strong>Total licences / cotisations attendues :</strong> ${totalNombre("montantLicence")} €</p>
        <p><strong>Total réglé saisi :</strong> ${totalNombre("montantRegle")} €</p>
        <p><strong>Total CB HelloAsso importé :</strong> ${totalNombre("montantRegleCB")} €</p>
        <p><strong>Total codes promo :</strong> ${totalNombre("montantCodePromo")} €</p>
        <p><strong>Total réductions résidents :</strong> ${totalNombre("montantReductionResident")} €</p>
        <p><strong>Total aides Lomme prévues :</strong> ${totalNombre("montantAideLomme")} €</p>
        <p><strong>Total Pass’Sport :</strong> ${totalNombre("montantPassSport")} €</p>
        <p><strong>Total remboursé familles :</strong> ${totalNombre("remboursementFamille")} €</p>
    `;
}

function carteAdherent(adherent) {
    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
    const aide = aidePour(adherent);
    const age = calculerAge(adherent.dateNaissance);
    const residentLomme = estLomme(donnees);
    return `
        <section class="card aide-licence-card ${aide.statutCotisation !== "regle" ? "notification-non-lue" : ""}">
            <h2>${aide.statutCotisation !== "regle" ? "🔴 " : "✅ "}${adherent.prenom || ""} ${adherent.nom || ""}</h2>
            <p><strong>Statut :</strong> ${statutLabel(aide.statutCotisation)}</p>
            <p><strong>Groupe :</strong> ${groupeAdherent(adherent)}</p>
            <p><strong>Âge :</strong> ${age || "Non renseigné"}</p>
            <p><strong>Ville :</strong> ${villeAdherent(donnees) || "Non renseignée"} ${residentLomme ? "· Lomme" : ""}</p>
            <p><strong>Mode :</strong> ${modePaiementLabel(aide.modePaiement)}</p>
            <p><strong>Montant tarif HelloAsso :</strong> ${aide.montantTarifHelloAsso || aide.montantImportHelloAsso || "Non renseigné"} ${aide.montantTarifHelloAsso || aide.montantImportHelloAsso ? "€" : ""}</p>
            <p><strong>Montant réglé en CB :</strong> ${aide.montantRegleCB || "Non renseigné"} ${aide.montantRegleCB ? "€" : ""}</p>
            <p><strong>Code promo :</strong> ${aide.montantCodePromo || "0"} €</p>
            <p><strong>Réduction résident :</strong> ${aide.montantReductionResident || "0"} €</p>
            <p><strong>Pass’Sport importé :</strong> ${aide.montantPassSportImport || "0"} €</p>
            <p><strong>Montant réglé retenu :</strong> ${aide.montantRegle || "Non renseigné"} ${aide.montantRegle ? "€" : ""}</p>
            <hr>
            <h3>🧾 Cotisation</h3>
            <select class="form-input" onchange="modifierAide('${adherent.numeroAdherent}', 'statutCotisation', this.value)">
                <option value="a-controler" ${aide.statutCotisation === "a-controler" ? "selected" : ""}>À contrôler</option>
                <option value="a-relancer" ${aide.statutCotisation === "a-relancer" ? "selected" : ""}>À relancer</option>
                <option value="partiel" ${aide.statutCotisation === "partiel" ? "selected" : ""}>Partiellement réglé</option>
                <option value="attente-aide" ${aide.statutCotisation === "attente-aide" ? "selected" : ""}>En attente aide</option>
                <option value="regle" ${aide.statutCotisation === "regle" ? "selected" : ""}>Réglé</option>
            </select>
            <select class="form-input" onchange="modifierAide('${adherent.numeroAdherent}', 'modePaiement', this.value)">
                <option value="inconnu" ${aide.modePaiement === "inconnu" ? "selected" : ""}>Non renseigné</option>
                <option value="cb-helloasso" ${aide.modePaiement === "cb-helloasso" ? "selected" : ""}>CB HelloAsso</option>
                <option value="cheque" ${aide.modePaiement === "cheque" ? "selected" : ""}>Chèque</option>
                <option value="especes" ${aide.modePaiement === "especes" ? "selected" : ""}>Espèces</option>
                <option value="cheque-sport" ${aide.modePaiement === "cheque-sport" ? "selected" : ""}>Chèque sport</option>
                <option value="aide-lomme" ${aide.modePaiement === "aide-lomme" ? "selected" : ""}>Aide Ville de Lomme</option>
                <option value="passsport" ${aide.modePaiement === "passsport" ? "selected" : ""}>Pass’Sport</option>
                <option value="mixte" ${aide.modePaiement === "mixte" ? "selected" : ""}>Paiement mixte</option>
            </select>
            <input class="form-input" type="date" value="${aide.dateReglement || ""}" onchange="modifierAide('${adherent.numeroAdherent}', 'dateReglement', this.value)">
            <input class="form-input" placeholder="Référence : chèque n°, espèces reçues, note..." value="${aide.referencePaiement || ""}" onchange="modifierAide('${adherent.numeroAdherent}', 'referencePaiement', this.value)">
            <select class="form-input" onchange="modifierAide('${adherent.numeroAdherent}', 'relance', this.value)">
                <option value="non" ${aide.relance === "non" ? "selected" : ""}>Pas de relance</option>
                <option value="oui" ${aide.relance === "oui" ? "selected" : ""}>À relancer</option>
            </select>
            <input class="form-input" type="number" placeholder="Montant licence / cotisation attendue" value="${aide.montantLicence || ""}" onchange="modifierAide('${adherent.numeroAdherent}', 'montantLicence', this.value)">
            <input class="form-input" type="number" placeholder="Montant réellement réglé" value="${aide.montantRegle || ""}" onchange="modifierAide('${adherent.numeroAdherent}', 'montantRegle', this.value)">
            <input class="form-input" type="number" placeholder="Montant réglé en CB importé" value="${aide.montantRegleCB || ""}" onchange="modifierAide('${adherent.numeroAdherent}', 'montantRegleCB', this.value)">
            <input class="form-input" type="number" placeholder="Montant code promo importé" value="${aide.montantCodePromo || ""}" onchange="modifierAide('${adherent.numeroAdherent}', 'montantCodePromo', this.value)">
            <hr>
            <h3>💶 Aides</h3>

            ${residentLomme ? `
                <select class="form-input" onchange="modifierAide('${adherent.numeroAdherent}', 'aideLomme', this.value)">
                    <option value="non" ${aide.aideLomme === "non" ? "selected" : ""}>Aide Lomme : non</option>
                    <option value="oui" ${aide.aideLomme === "oui" ? "selected" : ""}>Aide Lomme : oui</option>
                </select>
                <input class="form-input" placeholder="Code aide licence Lomme" value="${aide.codeLomme || ""}" onchange="modifierAide('${adherent.numeroAdherent}', 'codeLomme', this.value)">
                <select class="form-input" onchange="modifierAide('${adherent.numeroAdherent}', 'montantAideLomme', this.value)">
                    <option value="" ${aide.montantAideLomme === "" ? "selected" : ""}>Montant aide Lomme</option>
                    <option value="80" ${aide.montantAideLomme === "80" ? "selected" : ""}>80 €</option>
                    <option value="60" ${aide.montantAideLomme === "60" ? "selected" : ""}>60 €</option>
                    <option value="30" ${aide.montantAideLomme === "30" ? "selected" : ""}>30 €</option>
                    <option value="10" ${aide.montantAideLomme === "10" ? "selected" : ""}>10 €</option>
                </select>
            ` : `
                <p><strong>Aide Ville de Lomme :</strong> non proposée, adhérent hors Lomme / à vérifier.</p>
            `}
            <select class="form-input" onchange="modifierAide('${adherent.numeroAdherent}', 'passSport', this.value)">
                <option value="non" ${aide.passSport === "non" ? "selected" : ""}>Pass’Sport : non</option>
                <option value="oui" ${aide.passSport === "oui" ? "selected" : ""}>Pass’Sport : oui</option>
            </select>
            <input class="form-input" placeholder="Code Pass’Sport" value="${aide.codePassSport || ""}" onchange="modifierAide('${adherent.numeroAdherent}', 'codePassSport', this.value)">
            <input class="form-input" type="number" placeholder="Montant Pass’Sport" value="${aide.montantPassSport || ""}" onchange="modifierAide('${adherent.numeroAdherent}', 'montantPassSport', this.value)">
            <input class="form-input" type="number" placeholder="Montant remboursé à la famille" value="${aide.remboursementFamille || ""}" onchange="modifierAide('${adherent.numeroAdherent}', 'remboursementFamille', this.value)">
            <div style="display:flex;gap:8px;margin:10px 0;">
<button type="button" class="form-input" onclick="modifierAide('${adherent.numeroAdherent}','statutCotisation','regle')">✅ Marquer réglé</button>
<button type="button" class="form-input" onclick="modifierAide('${adherent.numeroAdherent}','statutCotisation','a-relancer');modifierAide('${adherent.numeroAdherent}','relance','oui')">🔔 Relancer</button>
</div>
<textarea class="form-input" placeholder="Commentaire trésorier" onchange="modifierAide('${adherent.numeroAdherent}', 'commentaire', this.value)">${aide.commentaire || ""}</textarea>
        </section>
    `;
}

function afficherAlertes() {
    const alertes = adherentsTous().filter(estAlerte).filter(adherentVisible);
    zoneAlertes.innerHTML = alertes.length ? alertes.map(carteAdherent).join("") : `<section class="card"><h2>✅ Aucune alerte</h2><p>Aucun dossier ne nécessite d'action avec les filtres actuels.</p></section>`;
}

function afficherListe() {
    const liste = adherentsTous().filter(adherentVisible);
    zoneListe.innerHTML = liste.length ? liste.map(carteAdherent).join("") : `<section class="card"><h2>Aucun adhérent</h2><p>Aucun adhérent ne correspond aux filtres.</p></section>`;
}

function telechargerCSV(nomFichier, lignes) {
    const contenu = lignes.map(ligne => ligne.map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + contenu], { type: "text/csv;charset=utf-8;" });
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(blob);
    lien.download = nomFichier;
    lien.click();
}

function ligneExport(adherent) {
    const inscription = derniereInscription(adherent.numeroAdherent);
    const donnees = inscription ? inscription.donneesHelloAsso || {} : {};
    const aide = aidePour(adherent);
    return [adherent.nom, adherent.prenom, calculerAge(adherent.dateNaissance), groupeAdherent(adherent), villeAdherent(donnees), codePostalAdherent(donnees), estLomme(donnees) ? "Oui" : "Non / à vérifier", statutLabel(aide.statutCotisation), modePaiementLabel(aide.modePaiement), aide.dateReglement, aide.referencePaiement, aide.relance === "oui" ? "Oui" : "Non", aide.montantImportHelloAsso, aide.montantTarifHelloAsso, aide.montantRegleCB, aide.montantCodePromo, aide.montantReductionResident, aide.montantPassSportImport, aide.montantLicence, aide.montantRegle, aide.aideLomme, aide.codeLomme, aide.montantAideLomme, aide.passSport, aide.codePassSport, aide.montantPassSport, aide.remboursementFamille, aide.commentaire];
}

function exporterBordereauAide() {
    const lignes = [["Nom", "Prénom", "Âge", "Groupe", "Ville", "Code postal", "Résident Lomme", "Statut cotisation", "Mode règlement", "Date règlement", "Référence", "Relance", "Montant import HelloAsso", "Montant tarif HelloAsso", "Montant réglé CB", "Montant code promo", "Montant réduction résident", "Montant PassSport importé", "Montant licence attendu", "Montant réglé retenu", "Aide Lomme", "Code aide Lomme", "Montant aide Lomme", "PassSport", "Code PassSport", "Montant PassSport saisi", "Remboursé famille", "Commentaire"]];
    adherentsTous().forEach(a => lignes.push(ligneExport(a)));
    telechargerCSV("suivi-cotisations-jdm.csv", lignes);
}

function exporterRapportAide() {
    const lignes = [["Nom", "Prénom", "Groupe", "Statut cotisation", "Mode règlement", "Référence", "Relance", "Commentaire"]];
    adherentsTous().filter(estAlerte).forEach(a => {
        const aide = aidePour(a);
        lignes.push([a.nom, a.prenom, groupeAdherent(a), statutLabel(aide.statutCotisation), modePaiementLabel(aide.modePaiement), aide.referencePaiement, aide.relance === "oui" ? "Oui" : "Non", aide.commentaire]);
    });
    telechargerCSV("alertes-cotisations-jdm.csv", lignes);
}

function rafraichir() {
    afficherStats();
    afficherAlertes();
    afficherListe();
}

[rechercheAide, filtreStatut, filtreModePaiement, filtreDossiers].forEach(element => {
    if (element) {
        element.addEventListener("input", rafraichir);
        element.addEventListener("change", rafraichir);
    }
});

const boutonBordereau = document.getElementById("exporter-bordereau-aide");
const boutonRapport = document.getElementById("exporter-rapport-aide");
if (boutonBordereau) boutonBordereau.addEventListener("click", exporterBordereauAide);
if (boutonRapport) boutonRapport.addEventListener("click", exporterRapportAide);

rafraichir();
