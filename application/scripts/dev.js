const CODE_SECURITE_DEV = "JDM-admin-0";

function demanderCodeSecurite() {
    const code = prompt("Code de sécurité administrateur principal :");

    if (code !== CODE_SECURITE_DEV) {
        alert("Code incorrect. Action annulée.");
        return false;
    }

    return true;
}

function creerDonneesDemo() {
    const adherentsDemo = [
        {
            numeroAdherent: "JDM-000001",
            cle: "hardeman-nathan-01/01/1990",
            nom: "Hardeman",
            prenom: "Nathan",
            dateNaissance: "01/01/1990",
            demo: true
        },
        {
            numeroAdherent: "JDM-000002",
            cle: "martin-lucas-12/04/2013",
            nom: "Martin",
            prenom: "Lucas",
            dateNaissance: "12/04/2013",
            demo: true
        },
        {
            numeroAdherent: "JDM-000003",
            cle: "dupont-emma-08/09/2020",
            nom: "Dupont",
            prenom: "Emma",
            dateNaissance: "08/09/2020",
            demo: true
        }
    ];

    const organisationDemo = [
        {
            prenom: "Nathan",
            nom: "Hardeman",
            email: "",
            roles: ["Admin principal", "Vice-président", "Coach", "Gymnaste"],
            groupes: ["Compétiteurs 11/15"],
            photo: "../images/logo-jdm.png",
            demo: true
        },
        {
            prenom: "Jessy",
            nom: "Démo",
            email: "",
            roles: ["Trésorier", "Juge", "Bénévole"],
            groupes: [],
            photo: "../images/logo-jdm.png",
            demo: true
        },
        {
            prenom: "Président",
            nom: "À compléter",
            email: "",
            roles: ["Président"],
            groupes: [],
            photo: "../images/logo-jdm.png",
            demo: true
        }
    ];

    const groupesDemo = [
        {
            id: 1001,
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
            },
            demo: true
        },
        {
            id: 1002,
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
            },
            demo: true
        }
    ];

    const exceptionsDemo = [
        {
            groupeId: 1002,
            date: new Date().toISOString().split("T")[0],
            jour: "demo",
            statut: "annule",
            horaire: "Cours annulé",
            titre: "Information importante",
            message: "Cours annulé exceptionnellement. Une notification sera envoyée aux parents.",
            demo: true
        }
    ];

    const notificationsDemo = [
        {
            id: Date.now(),
            type: "groupes-parents",
            titre: "Cours annulé",
            message: "Le cours du groupe Compétiteurs 11/15 est annulé exceptionnellement.",
            destinataires: [1002],
            destinatairesNoms: ["Compétiteurs 11/15"],
            dateCreation: new Date().toISOString(),
            lue: false,
            demo: true
        }
    ];

    localStorage.setItem("adherentsJDM", JSON.stringify(adherentsDemo));
    localStorage.setItem("organisationJDM", JSON.stringify(organisationDemo));
    localStorage.setItem("groupesJDM", JSON.stringify(groupesDemo));
    localStorage.setItem("planningExceptionsJDM", JSON.stringify(exceptionsDemo));
    localStorage.setItem("notificationsJDM", JSON.stringify(notificationsDemo));

    alert("Données de démonstration complètes créées ✅");
}

function supprimerDonneesDemo() {
    if (!demanderCodeSecurite()) return;

    localStorage.removeItem("adherentsJDM");
    localStorage.removeItem("organisationJDM");
    localStorage.removeItem("groupesJDM");
    localStorage.removeItem("planningExceptionsJDM");
    localStorage.removeItem("notificationsJDM");
    localStorage.removeItem("inscriptionsJDM");

    alert("Toutes les données de démonstration ont été supprimées ✅");
}