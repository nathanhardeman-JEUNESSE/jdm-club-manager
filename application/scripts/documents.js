const contenuSite = JSON.parse(localStorage.getItem("contenuSiteJDM")) || {};
const documents = contenuSite.documents || [];

const zoneDocuments = document.getElementById("liste-documents-public");

function afficherDocuments() {
    if (documents.length === 0) {
        zoneDocuments.innerHTML = `
            <section class="card">
                <h2>Aucun document</h2>
                <p>Aucun document n'est disponible pour le moment.</p>
            </section>
        `;
        return;
    }

    zoneDocuments.innerHTML = "";

    documents.forEach(documentClub => {
        zoneDocuments.innerHTML += `
            <section class="card">
                <h2>${documentClub.titre || "Document"}</h2>
                <p>${documentClub.description || ""}</p>

                ${documentClub.lien ? `
                    <a href="${documentClub.lien}" class="primary-button order-button" target="_blank" rel="noopener noreferrer">
                        Ouvrir le document
                    </a>
                ` : ""}
            </section>
            
        `;
    });
}

afficherDocuments();