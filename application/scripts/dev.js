function creerDonneesDemo() {
    const groupesDemo = [
        {
            id: Date.now() + 1,
            nom: "Baby Gym",
            note: "Avec accompagnement des parents",
            sexe: "Mixte",
            type: "Loisir",
            federation: "-",
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
            id: Date.now() + 2,
            nom: "Éveil Gym",
            note: "Découverte de la gymnastique",
            sexe: "Mixte",
            type: "Loisir",
            federation: "-",
            anneeMin: "2019",
            anneeMax: "2020",
            effectifMax: "18",
            coachs: ["Nathan Hardeman"],
            horaires: {
                samedi: "10h00 - 10h45"
            },
            demo: true
        },
        {
            id: Date.now() + 3,
            nom: "Compétiteurs 11/15",
            note: "Groupe compétition soumis à validation entraîneur",
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
            prenom: "Président",
            nom: "À compléter",
            email: "",
            roles: ["Président"],
            groupes: [],
            photo: "../images/logo-jdm.png",
            demo: true
        }
    ];
    function supprimerDonneesDemo() {
    if (!demanderCodeSecurite()) return;

    const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];
    const organisation = JSON.parse(localStorage.getItem("organisationJDM")) || [];

    const groupesFiltres = groupes.filter(groupe => !groupe.demo);
    const organisationFiltree = organisation.filter(personne => !personne.demo);

    localStorage.setItem("groupesJDM", JSON.stringify(groupesFiltres));
    localStorage.setItem("organisationJDM", JSON.stringify(organisationFiltree));

    alert("Données de démonstration supprimées ✅");
}

    localStorage.setItem("groupesJDM", JSON.stringify(groupesDemo));
    localStorage.setItem("organisationJDM", JSON.stringify(organisationDemo));

    alert("Données de démonstration créées ✅");
}
