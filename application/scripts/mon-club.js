const membresClub = JSON.parse(localStorage.getItem("organisationJDM")) || [];

const zoneClub = document.getElementById("club-organisation");

function prioriteMembre(membre) {
    const roles = membre.roles || [];

    if (roles.includes("Admin principal")) return 1;
    if (roles.includes("Président")) return 2;
    if (roles.includes("Vice-président")) return 3;
    if (roles.includes("Trésorier")) return 4;
    if (roles.includes("Secrétaire")) return 5;
    if (roles.includes("Coach")) return 6;
    if (roles.includes("Juge")) return 7;
    if (roles.includes("Bénévole")) return 8;
    return 99;
}

function afficherOrganisationComplete() {
    if (membresClub.length === 0) {
        zoneClub.innerHTML = `
            <section class="card">
                <h2>Organisation à compléter</h2>
                <p>Aucun membre du bureau ou coach n'a encore été ajouté.</p>
            </section>
        `;
        return;
    }

    const membresTries = membresClub
        .slice()
        .sort((a, b) => prioriteMembre(a) - prioriteMembre(b));

    zoneClub.innerHTML = `
        <section class="card">
            <h2>🏛 Membres du club</h2>

            ${membresTries.map(membre => `
                <div class="club-member">
                    <img src="${membre.photo || "../images/logo-jdm.png"}"
                         alt="${membre.prenom} ${membre.nom}"
                         class="club-member-photo">

                    <div>
                        <h3>${membre.prenom} ${membre.nom}</h3>

                        <p>
                            ${membre.roles.join(" / ")}
                        </p>

                        ${membre.groupes && membre.groupes.length > 0 ? `
                            <p>
                                ${membre.groupes.join(" / ")}
                            </p>
                        ` : ""}
                    </div>
                </div>
            `).join("")}
        </section>
    `;
}

afficherOrganisationComplete();