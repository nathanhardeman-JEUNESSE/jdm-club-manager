const fileInput = document.getElementById("helloasso-file");
const importButton = document.getElementById("import-button");
const importResult = document.getElementById("import-result");

let lignesHelloAsso = [];

function normaliserTexte(texte) {
    return String(texte || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function creerCleAdherent(nom, prenom, dateNaissance) {
    return [
        normaliserTexte(nom),
        normaliserTexte(prenom),
        normaliserTexte(dateNaissance)
    ].join("-");
}

function genererNumeroAdherent(adherents) {
    const prochainNumero = adherents.length + 1;
    return "JDM-" + String(prochainNumero).padStart(6, "0");
}

importButton.addEventListener("click", () => {
    const file = fileInput.files[0];

    if (!file) {
        alert("Veuillez sélectionner un fichier HelloAsso.");
        return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];

        lignesHelloAsso = XLSX.utils.sheet_to_json(sheet);

        const adherentsExistants = JSON.parse(localStorage.getItem("adherentsJDM")) || [];

        let nouveaux = 0;
        let dejaConnus = 0;

        lignesHelloAsso.forEach((ligne) => {
            const nom = ligne["Nom"] || ligne["Nom du participant"] || "";
            const prenom = ligne["Prénom"] || ligne["Prénom du participant"] || "";
            const dateNaissance = ligne["Date de naissance"] || "";

            const cle = creerCleAdherent(nom, prenom, dateNaissance);

            const existeDeja = adherentsExistants.some((adherent) => {
                return adherent.cle === cle;
            });

            if (existeDeja) {
                dejaConnus++;
            } else {
                nouveaux++;
            }
        });

        importResult.innerHTML = `
            <p><strong>Fichier analysé avec succès ✅</strong></p>
            <p><strong>Lignes détectées :</strong> ${lignesHelloAsso.length}</p>
            <p><strong>Nouveaux adhérents possibles :</strong> ${nouveaux}</p>
            <p><strong>Adhérents déjà connus :</strong> ${dejaConnus}</p>

            <button class="primary-button order-button" id="confirm-import-button">
                Confirmer l'import
            </button>
        `;

        document
            .getElementById("confirm-import-button")
            .addEventListener("click", importerHelloAsso);
    };

    reader.readAsArrayBuffer(file);
});

function importerHelloAsso() {
    let adherents = JSON.parse(localStorage.getItem("adherentsJDM")) || [];
    let inscriptions = JSON.parse(localStorage.getItem("inscriptionsJDM")) || [];

    let nouveaux = 0;
    let misAJour = 0;

    lignesHelloAsso.forEach((ligne) => {
        const nom = ligne["Nom"] || ligne["Nom du participant"] || "";
        const prenom = ligne["Prénom"] || ligne["Prénom du participant"] || "";
        const dateNaissance = ligne["Date de naissance"] || "";

        const cle = creerCleAdherent(nom, prenom, dateNaissance);

        let adherent = adherents.find((a) => a.cle === cle);

        if (!adherent) {
            adherent = {
                numeroAdherent: genererNumeroAdherent(adherents),
                cle: cle,
                nom: nom,
                prenom: prenom,
                dateNaissance: dateNaissance
            };

            adherents.push(adherent);
            nouveaux++;
        } else {
            adherent.nom = nom;
            adherent.prenom = prenom;
            adherent.dateNaissance = dateNaissance;
            misAJour++;
        }

        inscriptions.push({
            saison: "2026-2027",
            numeroAdherent: adherent.numeroAdherent,
            donneesHelloAsso: ligne
        });
    });

    localStorage.setItem("adherentsJDM", JSON.stringify(adherents));
    localStorage.setItem("inscriptionsJDM", JSON.stringify(inscriptions));

    importResult.innerHTML = `
        <p><strong>Import terminé ✅</strong></p>
        <p><strong>Nouveaux adhérents créés :</strong> ${nouveaux}</p>
        <p><strong>Adhérents mis à jour :</strong> ${misAJour}</p>
        <p><strong>Inscriptions saison créées :</strong> ${lignesHelloAsso.length}</p>
    `;
}