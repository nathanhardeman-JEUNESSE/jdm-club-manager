import {
    listAdherents,
    listInscriptions
} from "../firebase/firebase-db.js";

const params = new URLSearchParams(window.location.search);
const numero = params.get("id");

const front = document.getElementById("card-front");
const back = document.getElementById("card-back");

function nettoyer(texte) {
    return String(texte || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function donneesInscription(inscription) {
    return inscription?.donneesHelloAsso || inscription?.donnees || {};
}

function trouverDerniereInscription(inscriptions, numeroAdherent) {
    return inscriptions
        .filter(item =>
            String(item.numeroAdherent) === String(numeroAdherent)
        )
        .sort((a, b) =>
            String(a.dateInscription || "")
                .localeCompare(String(b.dateInscription || ""))
        )
        .at(-1) || null;
}

function groupeAdherent(adherent, inscription) {
    const donnees = donneesInscription(inscription);
    const groupeFirestore = String(adherent?.groupe || "").trim();

    return (
        donnees?.name ||
        inscription?.groupe ||
        adherent?.groupeNom ||
        (
            groupeFirestore &&
            nettoyer(groupeFirestore) !== "fixed"
                ? groupeFirestore
                : ""
        ) ||
        "Non renseigné"
    );
}

function afficherErreur(message) {
    if (front) {
        front.innerHTML = `
            <div class="card-content">
                <h2>${message}</h2>
            </div>
        `;
    }

    if (back) {
        back.innerHTML = "";
    }
}

function afficherCarte(adherent, inscription) {
    const saison =
        inscription?.saison ||
        adherent?.saison ||
        "Saison non renseignée";

    const groupe = groupeAdherent(adherent, inscription);

    front.innerHTML = `
        <img src="../images/logo-jdm.png"
             class="card-watermark"
             alt="Logo La Jeunesse du Marais">

        <div class="card-content">
            <h1>LA JEUNESSE DU MARAIS</h1>
            <h2>CLUB DE GYMNASTIQUE</h2>

            <div class="member-name">
                <span>${adherent.prenom || ""}</span>
                <strong>${adherent.nom || ""}</strong>
            </div>

            <p class="card-label">N° ADHÉRENT</p>
            <p class="card-number">${adherent.numeroAdherent || numero || ""}</p>

            <p class="card-label">GROUPE</p>
            <p class="card-season">${groupe}</p>

            <p class="card-label">SAISON</p>
            <p class="card-season">${saison}</p>
        </div>
    `;

    back.innerHTML = `
        <img src="../images/logo-jdm.png"
             class="card-watermark back-logo"
             alt="Logo La Jeunesse du Marais">

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
            <img src="../images/QRC.png"
                 class="card-qr"
                 alt="QR Code du club">

            <img src="../images/logo.lomme.jpg"
                 class="lomme-logo"
                 alt="Logo Ville de Lomme">
        </div>
    `;
}

async function initialiserCarte() {
    if (!numero) {
        afficherErreur("Numéro adhérent manquant");
        return;
    }

    try {
        const [adherents, inscriptions] = await Promise.all([
            listAdherents(),
            listInscriptions()
        ]);

        const adherent = adherents.find(item =>
            String(item.numeroAdherent) === String(numero) ||
            String(item.id) === String(numero)
        );

        if (!adherent) {
            afficherErreur("Adhérent introuvable");
            return;
        }

        const inscription = trouverDerniereInscription(
            inscriptions,
            adherent.numeroAdherent || numero
        );

        afficherCarte(adherent, inscription);
    } catch (error) {
        console.error("Impossible de charger la carte adhérent :", error);
        afficherErreur("Impossible de charger la carte");
    }
}

initialiserCarte();
