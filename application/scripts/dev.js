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
            nom: "Hardeman",
            prenom: "Nathan",
            dateNaissance: "01/01/1990",
            groupe: "Gym loisir adulte coach",
            demo: true
        },
        {
            numeroAdherent: "JDM-000002",
            nom: "Dupont",
            prenom: "Lucas",
            dateNaissance: "15/04/2016",
            groupe: "École de Gym 8/10 ans",
            demo: true
        },
        {
            numeroAdherent: "JDM-000003",
            nom: "Martin",
            prenom: "Emma",
            dateNaissance: "10/08/2020",
            groupe: "Initiation gymnique 5/6 ans",
            demo: true
        },
        {
            numeroAdherent: "JDM-000004",
            nom: "Petit",
            prenom: "Léo",
            dateNaissance: "22/02/2023",
            groupe: "Baby Gym 2/3 ans",
            demo: true
        },
        {
            numeroAdherent: "JDM-000005",
            nom: "Durand",
            prenom: "Camille",
            dateNaissance: "05/11/2013",
            groupe: "Compétiteurs 11/15 ans",
            demo: true
        }
    ];

    const inscriptionsDemo = adherentsDemo.map(adherent => ({
        numeroAdherent: adherent.numeroAdherent,
        saison: "2026-2027",
        donneesHelloAsso: {
            "Tarif": adherent.groupe,
            "Statut commande": "Payé",
            "Moyen de paiement": "Carte bancaire",
            "Email adhérent": "demo@jeunessedumarais.fr",
            "Parent 1": "Parent " + adherent.nom,
            "Parent 2": "",
            "Adresse postale": "123 rue de la Gymnastique",
            "Code postal": "59160",
            "Ville": "Lomme",
            "Personne à contacter en cas d'urgence": "Parent " + adherent.nom,
            "Téléphone urgence": "06 00 00 00 00",
            "Droit image": "Oui",
            "Certificat médical": "Reçu",
            "Photo licence": "Reçue",
            "Justificatif domicile": "Reçu"
        },
        demo: true
    }));

    const organisationDemo = [
        {
            prenom: "Nathan",
            nom: "Hardeman",
            email: "",
            roles: ["Admin principal", "Vice-président", "Coach"],
            groupes: ["Compétiteurs 11/15 ans", "Gym loisir adulte coach"],
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
            prenom: "Julie",
            nom: "Coach",
            email: "",
            roles: ["Coach"],
            groupes: ["Baby Gym 2/3 ans", "Initiation gymnique 5/6 ans"],
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
            nom: "Baby Gym 2/3 ans",
            sexe: "Mixte",
            type: "Loisir",
            federation: "-",
            anneeMin: "2023",
            anneeMax: "2024",
            effectifMax: "16",
            coachs: ["Julie Coach"],
            horaires: {
                samedi: "9h00 - 9h45"
            },
            whatsapp: "",
            demo: true
        },
        {
            id: 1002,
            nom: "Initiation gymnique 5/6 ans",
            sexe: "Mixte",
            type: "Loisir",
            federation: "-",
            anneeMin: "2020",
            anneeMax: "2021",
            effectifMax: "20",
            coachs: ["Julie Coach"],
            horaires: {
                samedi: "11h00 - 11h45"
            },
            whatsapp: "",
            demo: true
        },
        {
            id: 1003,
            nom: "École de Gym 8/10 ans",
            sexe: "Garçons",
            type: "Loisir",
            federation: "FFG",
            anneeMin: "2016",
            anneeMax: "2018",
            effectifMax: "24",
            coachs: ["Nathan Hardeman"],
            horaires: {
                samedi: "9h30 - 11h00"
            },
            whatsapp: "",
            demo: true
        },
        {
            id: 1004,
            nom: "Compétiteurs 11/15 ans",
            sexe: "Garçons",
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
            whatsapp: "",
            demo: true
        },
        {
            id: 1005,
            nom: "Gym loisir adulte coach",
            sexe: "Mixte",
            type: "Loisir",
            federation: "FFG",
            anneeMin: "1900",
            anneeMax: "2008",
            effectifMax: "30",
            coachs: ["Nathan Hardeman"],
            horaires: {
                lundi: "19h30 - 21h00",
                vendredi: "19h30 - 21h00"
            },
            whatsapp: "",
            demo: true
        }
    ];

    const aujourdHui = new Date().toISOString().split("T")[0];

    const exceptionsDemo = [
        {
            groupeId: 1004,
            date: aujourdHui,
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
            message: "Le cours du groupe Compétiteurs 11/15 ans est annulé exceptionnellement.",
            destinataires: [1004],
            destinatairesNoms: ["Compétiteurs 11/15 ans"],
            dateCreation: new Date().toISOString(),
            lue: false,
            demo: true
        }
    ];

    localStorage.setItem("adherentsJDM", JSON.stringify(adherentsDemo));
    localStorage.setItem("inscriptionsJDM", JSON.stringify(inscriptionsDemo));
    localStorage.setItem("organisationJDM", JSON.stringify(organisationDemo));
    localStorage.setItem("groupesJDM", JSON.stringify(groupesDemo));
    localStorage.setItem("planningExceptionsJDM", JSON.stringify(exceptionsDemo));
    localStorage.setItem("notificationsJDM", JSON.stringify(notificationsDemo));
    localStorage.setItem("utilisateurConnecteJDM", JSON.stringify({
    id: "parent-demo-001",
    role: "parent",
    nom: "Parent",
    prenom: "Démo",
    enfants: ["JDM-000003"]
}));

    alert("Données de démonstration complètes créées ✅");
}

function supprimerDonneesDemo() {
    if (!demanderCodeSecurite()) return;

    localStorage.removeItem("adherentsJDM");
    localStorage.removeItem("inscriptionsJDM");
    localStorage.removeItem("organisationJDM");
    localStorage.removeItem("groupesJDM");
    localStorage.removeItem("planningExceptionsJDM");
    localStorage.removeItem("notificationsJDM");
    localStorage.removeItem("commandesJDM");
    localStorage.removeItem("notificationsTresorierJDM");
    localStorage.removeItem("panierJDM");
    localStorage.removeItem("utilisateurConnecteJDM");

    alert("Toutes les données de démonstration ont été supprimées ✅");
}

function viderAdherents() {
    if (!demanderCodeSecurite()) return;

    localStorage.removeItem("adherentsJDM");
    localStorage.removeItem("inscriptionsJDM");

    alert("Adhérents et inscriptions vidés ✅");
}

function viderBoutique() {
    if (!demanderCodeSecurite()) return;

    localStorage.removeItem("commandesJDM");
    localStorage.removeItem("notificationsTresorierJDM");
    localStorage.removeItem("panierJDM");

    alert("Données boutique vidées ✅");
}