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
