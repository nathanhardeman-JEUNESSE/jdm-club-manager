const membresClub = [
    {
        nom: "Hardeman",
        prenom: "Nathan",
        roles: ["Admin principal", "Vice-président", "Coach", "Gymnaste"],
        groupes: ["Compétiteurs 16+", "Gym Adultes"],
        photo: "../images/logo-jdm.png"
    },
    {
        nom: "Durand",
        prenom: "Xavier",
        roles: ["Trésorier", "Vice-président", "Coach"],
        groupes: ["Compétiteurs 11/15"],
        photo: "../images/logo-jdm.png"
    },
    {
        nom: "À compléter",
        prenom: "Président",
        roles: ["Président"],
        groupes: [],
        photo: "../images/logo-jdm.png"
    }
];

const zoneClub = document.getElementById("club-organisation");

function afficherMembres(titre, filtreRole) {
    const membres = membresClub.filter(membre =>
        membre.roles.includes(filtreRole)
    );

    if (membres.length === 0) return "";

    return `
        <section class="card">
            <h2>${titre}</h2>

            ${membres.map(membre => `
                <div class="club-member">
                    <img src="${membre.photo}" alt="${membre.prenom} ${membre.nom}" class="club-member-photo">

                    <div>
                        <h3>${membre.prenom} ${membre.nom}</h3>

                        <p>
                            <strong>Rôles :</strong>
                            ${membre.roles.join(" / ")}
                        </p>

                        ${membre.groupes.length > 0 ? `
                            <p>
                                <strong>Groupes :</strong>
                                ${membre.groupes.join(" / ")}
                            </p>
                        ` : ""}
                    </div>
                </div>
            `).join("")}
        </section>
    `;
}

zoneClub.innerHTML = `
    ${afficherMembres("🏛 Bureau", "Président")}
    ${afficherMembres("🤝 Vice-présidence", "Vice-président")}
    ${afficherMembres("💰 Trésorerie", "Trésorier")}
    ${afficherMembres("🤸 Coachs", "Coach")}
`;