const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const competitions = JSON.parse(localStorage.getItem("competitionsJDM")) || [];
const adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];

const zone = document.getElementById("convocation-zone");
const competition = competitions.find(c => String(c.id) === String(id));

function formatDateFR(dateISO) {
    if (!dateISO) return "Date non renseignée";
    const morceaux = dateISO.split("-");
    if (morceaux.length !== 3) return dateISO;
    return `${morceaux[2]}/${morceaux[1]}/${morceaux[0]}`;
}

function messageAvecRouge(message) {
    return String(message || "")
        .replace("CHAUSSETTES BLANCHES ET SLIP BLANC", `<span class="convocation-red">CHAUSSETTES BLANCHES ET SLIP BLANC</span>`)
        .replace(/\n/g, "<br>");
}

if (!competition) {
    zone.innerHTML = `<section class="convocation-page"><h1>Compétition introuvable</h1></section>`;
} else {
    const convoques = adherents.filter(a => (competition.convoques || []).includes(a.numeroAdherent));

    zone.innerHTML = `
        <section class="convocation-page">
            <img src="../images/logo-jdm-noir.png" class="convocation-watermark" alt="Logo JDM">

            <header class="convocation-header">
                <h1>Convocation compétition</h1>
                <h2>${competition.nom || ""}</h2>
            </header>

            <section class="convocation-block">
                <h3>Informations générales</h3>
                <p><strong>Date :</strong> ${formatDateFR(competition.date)}</p>
                <p><strong>Groupe :</strong> ${competition.groupe || "Non renseigné"}</p>
                <p><strong>Coach(s) :</strong> ${competition.coachs || "Non renseigné"}</p>
                <p><strong>Adresse :</strong> ${competition.adresse || "Non renseignée"}</p>
                <p><strong>Transport :</strong> ${competition.transport || "Non renseigné"}</p>
            </section>

            <section class="convocation-block">
                <h3>Rendez-vous</h3>
                <p>${competition.rendezvous || "Non renseigné"}</p>
            </section>

            <section class="convocation-block">
                <h3>Passage prévu</h3>
                <p><strong>Heure :</strong> ${competition.heurePassage || "XXhXX"}</p>
                <p><strong>Premier agrès :</strong> ${competition.agres || "Non renseigné"}</p>
            </section>

            <section class="convocation-block convocation-warning">
                <h3>Consignes importantes</h3>
                <p>${messageAvecRouge(competition.message)}</p>
            </section>

            <section class="convocation-block">
                <h3>Gymnastes convoqués</h3>
                <table class="convocation-table">
                    <thead>
                        <tr><th>Nom</th><th>Prénom</th></tr>
                    </thead>
                    <tbody>
                        ${convoques.map(a => `<tr><td>${a.nom || ""}</td><td>${a.prenom || ""}</td></tr>`).join("")}
                    </tbody>
                </table>
            </section>

            <footer class="convocation-footer">
                Jeunesse du Marais · Convocation générée depuis JDM Club Manager
            </footer>
        </section>
    `;
}
