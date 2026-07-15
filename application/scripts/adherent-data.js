export function nettoyer(texte) {
    return String(texte || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

export function champ(donnees, mots, valeurParDefaut = "", motsExclus = []) {
    if (!donnees) return valeurParDefaut;

    const termes = (Array.isArray(mots) ? mots : [mots]).map(nettoyer);
    const exclusions = (Array.isArray(motsExclus) ? motsExclus : [motsExclus])
        .map(nettoyer)
        .filter(Boolean);

    const cleDirecte = Object.keys(donnees).find(cle => {
        const cleNormalisee = nettoyer(cle);
        const contientTermes = termes.every(terme => cleNormalisee.includes(terme));
        const contientExclusion = exclusions.some(exclusion =>
            cleNormalisee.includes(exclusion)
        );

        return contientTermes && !contientExclusion;
    });

    if (cleDirecte) {
        const valeur = donnees[cleDirecte];
        if (valeur !== undefined && valeur !== null && String(valeur).trim() !== "") {
            return valeur;
        }
    }

    const champs = Array.isArray(donnees.customFields) ? donnees.customFields : [];
    const trouve = champs.find(item => {
        const nom = nettoyer(item?.name);
        const contientTermes = termes.every(terme => nom.includes(terme));
        const contientExclusion = exclusions.some(exclusion =>
            nom.includes(exclusion)
        );

        return contientTermes && !contientExclusion;
    });

    const reponse = trouve?.answer;
    return reponse !== undefined && reponse !== null && String(reponse).trim() !== ""
        ? reponse
        : valeurParDefaut;
}

export function premiereValeur(...valeurs) {
    return valeurs.find(valeur =>
        valeur !== undefined &&
        valeur !== null &&
        String(valeur).trim() !== ""
    ) || "";
}

export function calculerAge(dateNaissance) {
    if (!dateNaissance) return null;

    let naissance;
    const texte = String(dateNaissance).trim();

    if (texte.includes("/")) {
        const [jour, mois, annee] = texte.split("/").map(Number);
        naissance = new Date(annee, mois - 1, jour);
    } else {
        naissance = new Date(texte);
    }

    if (Number.isNaN(naissance.getTime())) return null;

    const maintenant = new Date();
    let age = maintenant.getFullYear() - naissance.getFullYear();
    const mois = maintenant.getMonth() - naissance.getMonth();

    if (mois < 0 || (mois === 0 && maintenant.getDate() < naissance.getDate())) {
        age -= 1;
    }

    return age;
}

export function inscriptionsPour(inscriptions, numeroAdherent) {
    return (Array.isArray(inscriptions) ? inscriptions : [])
        .filter(item => String(item.numeroAdherent) === String(numeroAdherent))
        .sort((a, b) => {
            const dateA = String(a.dateInscription || a.updatedAt?.seconds || "");
            const dateB = String(b.dateInscription || b.updatedAt?.seconds || "");
            return dateA.localeCompare(dateB);
        });
}

export function derniereInscriptionPour(inscriptions, numeroAdherent) {
    const liste = inscriptionsPour(inscriptions, numeroAdherent);
    return liste[liste.length - 1] || null;
}

export function donneesInscription(inscription) {
    return inscription?.donneesHelloAsso || inscription?.donnees || {};
}

export function groupeAdherent(adherent, inscription) {
    const donnees = donneesInscription(inscription);
    const groupeAdherentBrut = adherent?.groupe;

    return premiereValeur(
        donnees?.name,
        inscription?.groupe,
        adherent?.groupeNom,
        groupeAdherentBrut && nettoyer(groupeAdherentBrut) !== "fixed"
            ? groupeAdherentBrut
            : "",
        "Non renseigné"
    );
}

export function telephoneAdherent(adherent, inscription) {
    const donnees = donneesInscription(inscription);

    return premiereValeur(
        adherent?.telephone,
        adherent?.telephoneUrgence,
        champ(donnees, ["numero", "telephone", "contact", "urgence"]),
        champ(donnees, ["numero", "telephone", "appeler", "urgence"]),
        champ(donnees, ["telephone", "contact", "urgence"]),
        champ(donnees, ["telephone", "urgence"])
    );
}

export function parent1Adherent(adherent, inscription) {
    const donnees = donneesInscription(inscription);

    return premiereValeur(
        adherent?.parent1,
        champ(donnees, ["parent", "1"], "", ["email"]),
        champ(donnees, ["representant", "legal"], "", ["email"]),
        champ(donnees, ["representant"], "", ["email"])
    );
}

export function parent2Adherent(adherent, inscription) {
    const donnees = donneesInscription(inscription);

    return premiereValeur(
        adherent?.parent2,
        champ(donnees, ["parent", "2"], "", ["email"])
    );
}

export function emailAdherent(adherent, inscription) {
    const donnees = donneesInscription(inscription);

    return premiereValeur(
        adherent?.email,
        adherent?.emailAdherent,
        adherent?.emailParent1,
        champ(donnees, ["email", "adherent"]),
        champ(donnees, ["email"])
    );
}

export function dateNaissanceAdherent(adherent, inscription) {
    const donnees = donneesInscription(inscription);

    return premiereValeur(
        adherent?.dateNaissance,
        champ(donnees, ["date", "naissance"]),
        champ(donnees, ["naissance"])
    );
}

export function verifierDossier(adherent, inscription, options = {}) {
    const donnees = donneesInscription(inscription);
    const manquants = [];
    const validation = options.validation || null;
    const aide = options.aide || null;

    if (validation?.valideManuellement === true) {
        return { complet: true, manuel: true, manquants: [] };
    }

    const groupe = groupeAdherent(adherent, inscription);
    const telephone = telephoneAdherent(adherent, inscription);
    const parent1 = parent1Adherent(adherent, inscription);
    const email = emailAdherent(adherent, inscription);
    const dateNaissance = dateNaissanceAdherent(adherent, inscription);
    const age = calculerAge(dateNaissance);

    if (!email) manquants.push("Email");
    if (!telephone) manquants.push("Téléphone");
    if (!groupe || groupe === "Non renseigné") manquants.push("Groupe");
    if (age === null) manquants.push("Date de naissance");
    if (age !== null && age < 18 && !parent1) manquants.push("Représentant légal");

    const statutPaiement = nettoyer(
        inscription?.statutPaiement || adherent?.statutPaiement || ""
    );

    const paiementOK =
        adherent?.cotisationAJour === true ||
        inscription?.cotisationAJour === true ||
        ["paye", "payee", "processed"].includes(statutPaiement) ||
        nettoyer(donnees?.state) === "processed" ||
        nettoyer(aide?.statutCotisation) === "regle";

    if (!paiementOK) manquants.push("Cotisation");

    const texte = nettoyer(JSON.stringify(donnees));
    const competition = nettoyer(groupe).includes("compet");

    if (competition) {
        const photoOK =
            texte.includes("photo d'identite") ||
            texte.includes("photo identite") ||
            texte.includes("photo licence");

        const certificatOK =
            texte.includes("certificat medical") ||
            texte.includes("absence de contre-indication") ||
            texte.includes("competition");

        if (!photoOK) manquants.push("Photo licence");
        if (!certificatOK) manquants.push("Certificat compétition");
    } else {
        const santeOK =
            texte.includes("questionnaire de sante") ||
            texte.includes("attestation de reponse negative") ||
            texte.includes("certificat medical") ||
            texte.includes("transmettre l'attestation") ||
            texte.includes("transmettre l’attestation");

        if (!santeOK) manquants.push("Questionnaire santé / certificat");
    }

    const ville = nettoyer(champ(donnees, ["ville"]));
    const codePostal = String(champ(donnees, ["code", "postal"]) || "").trim();

    if (ville.includes("lomme") || codePostal === "59160") {
        const justificatifOK =
            texte.includes("justificatif domicile") ||
            texte.includes("justificatif de domicile");

        if (!justificatifOK) manquants.push("Justificatif domicile");
    }

    return {
        complet: manquants.length === 0,
        manuel: false,
        manquants
    };
}
