const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];

const liste = document.getElementById("liste-adherents");

if (adherents.length === 0) {

    liste.innerHTML = `
        <section class="card">
            <h2>Aucun adhérent</h2>

            <p>
                Aucun adhérent n'a encore été importé.
            </p>
        </section>
    `;

} else {

    adherents
        .slice()
        .sort((a, b) => a.nom.localeCompare(b.nom))

        .forEach((adherent) => {

            liste.innerHTML += `
                <section class="card">

                    <h2>${adherent.prenom} ${adherent.nom}</h2>

                    <p>
                        <strong>N° adhérent :</strong>
                        ${adherent.numeroAdherent}
                    </p>

                    <p>
                        <strong>Date de naissance :</strong>
                        ${adherent.dateNaissance}
                    </p>

                 <a
                href="admin-fiche-adherent.html?id=${adherent.numeroAdherent}"
                class="primary-button order-button">

                 👤 Voir la fiche

                </a>

                </section>
            `;

        });

}