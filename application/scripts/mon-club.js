const membresClub = JSON.parse(localStorage.getItem("organisationJDM")) || [];

const zoneClub = document.getElementById("club-organisation");

function afficherMembres(titre, filtreRole) {
    const membres = membresClub.filter(membre =>
        membre.roles && membre.roles.includes(filtreRole)
    );

    if (membres.length === 0) return "";

    return `
        <section class="card">
            <h2>${titre}</h2>

            ${membres.map(membre => `
                <div class="club-member">
                    <img src="${membre.photo || "../images/logo-jdm.png"}" 
                         alt="${membre.prenom} ${membre.nom}" 
                         class="club-member-photo">

                    <div>
                        <h3>${membre.prenom} ${membre.nom}</h3>

                        <p>
                            <strong>Rôles :</strong>
                            ${membre.roles.join(" / ")}
                        </p>

                        ${membre.groupes && membre.groupes.length > 0 ? `
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

if (membresClub.length === 0) {
    zoneClub.innerHTML = `
        <section class="card">
            <h2>Organisation à compléter</h2>
            <p>
                Aucun membre du bureau ou coach n'a encore été ajouté.
            </p>
        </section>
    `;
} else {
    zoneClub.innerHTML = `
        ${afficherMembres("👑 Administration principale", "Admin principal")}
        ${afficherMembres("🏛 Présidence", "Président")}
        ${afficherMembres("🤝 Vice-présidence", "Vice-président")}
        ${afficherMembres("💰 Trésorerie", "Trésorier")}
        ${afficherMembres("📝 Secrétariat", "Secrétaire")}
        ${afficherMembres("🤸 Coachs", "Coach")}
        ${afficherMembres("⚖️ Juges", "Juge")}
        ${afficherMembres("❤️ Bénévoles", "Bénévole")}
        ${afficherMembres("🏅 Membres d'honneur", "Membre d'honneur")}
    `;
}