const params = new URLSearchParams(window.location.search);

const numero = params.get("id");

const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];

const adherent = adherents.find(a => a.numeroAdherent === numero);

const fiche = document.getElementById("fiche-adherent");

if (!adherent) {

    fiche.innerHTML = `
        <section class="card">

            <h2>Erreur</h2>

            <p>Adhérent introuvable.</p>

        </section>
    `;

} else {

    fiche.innerHTML = `

<section class="card">

<h2>${adherent.prenom} ${adherent.nom}</h2>

<p><strong>Numéro adhérent :</strong> ${adherent.numeroAdherent}</p>

<p><strong>Date de naissance :</strong> ${adherent.dateNaissance}</p>

</section>

<section class="card">

<h2>🚧 En construction</h2>

<p>

Cette fiche sera progressivement complétée.

</p>

</section>

`;

}