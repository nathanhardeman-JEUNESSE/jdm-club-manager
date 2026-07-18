import { watchSession } from "./session.js";

import {
    findAdherentsByEmail,
    getAdherentsByNumbers,
    updateMemberProfile
} from "../firebase/firebase-db.js";

const selecteurZone = document.getElementById(
    "profil-family-selector-zone"
);

const formulaire = document.getElementById(
    "member-profile-form"
);

const message = document.getElementById("profile-message");
const personalDocumentsZone = document.getElementById("profile-personal-documents");
const clubDocumentsZone = document.getElementById("profile-club-documents");

const champs = {
    nom: document.getElementById("profile-nom"),
    prenom: document.getElementById("profile-prenom"),
    dateNaissance: document.getElementById(
        "profile-date-naissance"
    ),
    email: document.getElementById("profile-email"),
    emailParent1: document.getElementById(
        "profile-email-parent1"
    ),
    emailParent2: document.getElementById(
        "profile-email-parent2"
    ),
    parent1: document.getElementById("profile-parent1"),
    parent2: document.getElementById("profile-parent2"),
    telephone: document.getElementById("profile-telephone"),
    telephoneUrgence: document.getElementById(
        "profile-telephone-urgence"
    )
};

const numeroZone = document.getElementById(
    "profile-numero-membre"
);

const groupesZone = document.getElementById(
    "profile-groupes"
);

let adherentsCompte = [];
let adherentSelectionne = null;


function documentLink(href, label, external = false) {
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a class="profile-document-link" href="${href}"${attrs}>${label}<span>➜</span></a>`;
}

function afficherDocumentsPersonnels() {
    if (!personalDocumentsZone || !adherentSelectionne) return;

    const numero = adherentSelectionne.numeroAdherent || adherentSelectionne.id || "";
    const documents = [];

    if (numero) {
        documents.push(documentLink(
            `fiche-adherent-complete.html?id=${encodeURIComponent(numero)}`,
            "Fiche adhérent complète"
        ));
        documents.push(documentLink(
            `carte-adherent.html?id=${encodeURIComponent(numero)}`,
            "Carte adhérent"
        ));
    }

    const certificat = adherentSelectionne.certificatMedical || adherentSelectionne.profil?.certificatMedical;
    const photo = adherentSelectionne.photoLicence || adherentSelectionne.profil?.photoLicence;

    if (certificat) documents.push(documentLink(certificat, "Certificat médical", true));
    if (photo) documents.push(documentLink(photo, "Photo licence", true));

    personalDocumentsZone.innerHTML = documents.length
        ? documents.join("")
        : "<p><small>Aucun document personnel disponible pour le moment.</small></p>";
}

function afficherDocumentsClub() {
    if (!clubDocumentsZone) return;

    let documents = [];
    try {
        const contenuSite = JSON.parse(localStorage.getItem("contenuSiteJDM")) || {};
        documents = Array.isArray(contenuSite.documents) ? contenuSite.documents : [];
    } catch (error) {
        console.warn("Documents du club illisibles", error);
    }

    clubDocumentsZone.innerHTML = documents.length
        ? documents.map(documentClub => documentClub.lien
            ? documentLink(documentClub.lien, documentClub.titre || "Document", true)
            : `<div class="profile-document-note"><strong>${documentClub.titre || "Document"}</strong><small>${documentClub.description || ""}</small></div>`
        ).join("")
        : "<p><small>Aucun document public supplémentaire pour le moment.</small></p>";
}

function identite(adherent) {
    return [
        adherent?.prenom,
        adherent?.nom
    ].filter(Boolean).join(" ") || "Adhérent";
}

function groupesPour(adherent) {
    return [
        ...(Array.isArray(adherent?.groupes)
            ? adherent.groupes
            : []),
        adherent?.groupe
    ].filter(Boolean);
}

function valeurEffective(adherent, champ) {
    if (
        adherent?.champsModifiesParMembre?.[champ] === true &&
        Object.prototype.hasOwnProperty.call(
            adherent?.profil || {},
            champ
        )
    ) {
        return adherent.profil[champ] ?? "";
    }

    return adherent?.[champ] ??
        adherent?.sourceHelloAsso?.[champ] ??
        "";
}

function remplirFormulaire() {
    if (!adherentSelectionne) return;

    Object.entries(champs).forEach(([nomChamp, input]) => {
        if (!input) return;
        input.value = valeurEffective(
            adherentSelectionne,
            nomChamp
        );
    });

    if (numeroZone) {
        numeroZone.textContent =
            adherentSelectionne.numeroMembre ||
            adherentSelectionne.numeroAdherent ||
            "Non renseigné";
    }

    if (groupesZone) {
        const groupes = groupesPour(adherentSelectionne);
        groupesZone.textContent =
            groupes.length > 0
                ? groupes.join(" · ")
                : "Non renseigné";
    }

    if (message) {
        message.textContent = "";
        message.className = "profile-message";
    }
}

function afficherSelecteur() {
    if (!selecteurZone) return;

    if (adherentsCompte.length <= 1) {
        selecteurZone.innerHTML = `
            <p class="profile-selected-member">
                <strong>Membre :</strong>
                ${identite(adherentSelectionne)}
            </p>
        `;
        return;
    }

    selecteurZone.innerHTML = `
        <label class="profile-family-selector-label">
            Membre de la famille

            <select id="profile-family-selector">
                ${adherentsCompte.map(adherent => `
                    <option
                        value="${adherent.id}"
                        ${
                            adherent.id ===
                            adherentSelectionne?.id
                                ? "selected"
                                : ""
                        }>
                        ${identite(adherent)}
                        ${
                            adherent.numeroMembre
                                ? ` · ${adherent.numeroMembre}`
                                : ""
                        }
                    </option>
                `).join("")}
            </select>
        </label>
    `;

    document.getElementById("profile-family-selector")
        ?.addEventListener("change", event => {
            const suivant = adherentsCompte.find(
                adherent =>
                    adherent.id === event.target.value
            );

            if (!suivant) return;

            adherentSelectionne = suivant;

            sessionStorage.setItem(
                "jdmAdherentSelectionne",
                suivant.numeroAdherent || suivant.id
            );

            remplirFormulaire();
            afficherDocumentsPersonnels();
        });
}

async function chargerAdherentsCompte(user, profile) {
    const numeros = [
        ...(Array.isArray(profile.numeroAdherents)
            ? profile.numeroAdherents
            : []),
        profile.numeroAdherent
    ].filter(Boolean);

    let adherents = numeros.length > 0
        ? await getAdherentsByNumbers(numeros)
        : [];

    if (adherents.length === 0) {
        adherents = await findAdherentsByEmail(
            profile.email || user.email
        );
    }

    return adherents
        .filter(adherent => adherent.actif !== false)
        .sort((a, b) =>
            identite(a).localeCompare(
                identite(b),
                "fr"
            )
        );
}

formulaire?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!adherentSelectionne) return;

    const modifications = {};

    Object.entries(champs).forEach(([nomChamp, input]) => {
        if (!input) return;
        modifications[nomChamp] = input.value.trim();
    });

    try {
        if (message) {
            message.textContent = "Enregistrement...";
            message.className = "profile-message";
        }

        await updateMemberProfile(
            adherentSelectionne.id,
            modifications
        );

        adherentSelectionne = {
            ...adherentSelectionne,
            ...modifications,
            profil: {
                ...(adherentSelectionne.profil || {}),
                ...modifications
            },
            champsModifiesParMembre: {
                ...(
                    adherentSelectionne
                        .champsModifiesParMembre || {}
                ),
                ...Object.fromEntries(
                    Object.keys(modifications)
                        .map(champ => [champ, true])
                )
            }
        };

        adherentsCompte = adherentsCompte.map(adherent =>
            adherent.id === adherentSelectionne.id
                ? adherentSelectionne
                : adherent
        );

        if (message) {
            message.textContent =
                "Modifications enregistrées ✅";

            message.className =
                "profile-message profile-message-success";
        }

        afficherSelecteur();
        remplirFormulaire();
        afficherDocumentsPersonnels();
        afficherDocumentsClub();
    } catch (error) {
        console.error(
            "Impossible d'enregistrer le profil",
            error
        );

        if (message) {
            message.textContent =
                "Impossible d'enregistrer les modifications.";

            message.className =
                "profile-message profile-message-error";
        }
    }
});

watchSession(async (user, profile) => {
    if (!user || !profile) return;

    try {
        adherentsCompte = await chargerAdherentsCompte(
            user,
            profile
        );

        if (adherentsCompte.length === 0) {
            if (selecteurZone) {
                selecteurZone.innerHTML = `
                    <p>
                        Aucune fiche adhérent n'est rattachée
                        à ce compte.
                    </p>
                `;
            }

            if (formulaire) {
                formulaire.hidden = true;
            }

            return;
        }

        const selectionSauvee =
            sessionStorage.getItem(
                "jdmAdherentSelectionne"
            );

        adherentSelectionne =
            adherentsCompte.find(adherent =>
                String(adherent.numeroAdherent) ===
                String(selectionSauvee)
            ) ||
            adherentsCompte[0];

        afficherSelecteur();
        remplirFormulaire();
        afficherDocumentsPersonnels();
        afficherDocumentsClub();
    } catch (error) {
        console.error(
            "Impossible de charger le profil membre",
            error
        );

        if (selecteurZone) {
            selecteurZone.innerHTML = `
                <p>
                    Impossible de charger les informations
                    personnelles.
                </p>
            `;
        }
    }
});
