const demoOrganisationJDM = [
    {
        prenom: "Nathan",
        nom: "Hardeman",
        email: "",
        roles: ["Admin principal", "Vice-président", "Coach", "Gymnaste"],
        groupes: ["Compétiteurs 11/15"],
        photo: "../images/logo-jdm.png"
    }
];

const demoGroupesJDM = [
    {
        id: 1001,
        nom: "Compétiteurs 11/15",
        sexe: "Mixte",
        type: "Compétition",
        federation: "FFG",
        anneeMin: "2011",
        anneeMax: "2015",
        effectifMax: "20",
        coachs: ["Nathan Hardeman"],
        horaires: {
            lundi: "18h00 - 19h30",
            mercredi: "18h00 - 19h30",
            vendredi: "18h00 - 19h30"
        }
    },
    {
        id: 1002,
        nom: "Baby Gym",
        sexe: "Mixte",
        type: "Loisir",
        federation: "Libre",
        anneeMin: "2020",
        anneeMax: "2021",
        effectifMax: "16",
        coachs: ["Nathan Hardeman"],
        horaires: {
            samedi: "9h00 - 9h45"
        }
    }
];

const demoPlanningExceptionsJDM = [];

function chargerDonneesDemoSiVide() {
    if (!localStorage.getItem("organisationJDM")) {
        localStorage.setItem("organisationJDM", JSON.stringify(demoOrganisationJDM));
    }

    if (!localStorage.getItem("groupesJDM")) {
        localStorage.setItem("groupesJDM", JSON.stringify(demoGroupesJDM));
    }

    if (!localStorage.getItem("planningExceptionsJDM")) {
        localStorage.setItem("planningExceptionsJDM", JSON.stringify(demoPlanningExceptionsJDM));
    }
}

chargerDonneesDemoSiVide();