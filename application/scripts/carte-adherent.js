const params = new URLSearchParams(window.location.search);
const numero = params.get("id");

const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
const inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];

const adherent = adherents.find(a => a.numeroAdherent === numero);
const inscription = inscriptions.find(i => i.numeroAdherent === numero);

const front = document.getElementById("card-front");
const back = document.getElementById("card-back");

const saison = inscription ? inscription.saison : "Saison non renseignée";

const qrData = encodeURIComponent(
    window.location.origin + "/application/pages/admin-fiche-adherent.html?id=" + numero
);

const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${qrData}`;

if (!adherent) {
    front.innerHTML = `<h2>Adhérent introuvable</h2>`;
} else {
    front.innerHTML = `
        <img src="../images/logo-jdm.png" class="card-watermark">

        <div class="card-content">
            <h1>LA JEUNESSE DU MARAIS</h1>
            <h2>CLUB DE GYMNASTIQUE</h2>

            <div class="member-name">
                <span>${adherent.prenom}</span>
                <strong>${adherent.nom}</strong>
            </div>

            <p class="card-label">N° ADHÉRENT</p>
            <p class="card-number">${adherent.numeroAdherent}</p>

            <p class="card-label">SAISON</p>
            <p class="card-season">${saison}</p>
        </div>
    `;

    back.innerHTML = `
        <img src="../images/logo-jdm.png" class="card-watermark back-logo">

        <div class="back-info">
            <h2>Carte personnelle</h2>

            <p>
                Cette carte est propre à son adhérent.
            </p>

            <p>
                En cas de perte, merci de contacter le club :
            </p>

            <p>
                jeunessedumaraisdelomme@gmail.com<br>
                Rue Condorcet, Lomme<br>
                59160 Lille<br>
                Contact : 0621650000
            </p>
        </div>

        <div class="back-right">
            <img src="${qrUrl}" class="card-qr">
            <img src="../images/logo.lomme.jpg" class="lomme-logo">
        </div>
    `;
}