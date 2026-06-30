const groupes = JSON.parse(localStorage.getItem("groupesJDM")) || [];

const zonePlanning = document.getElementById("planning-public");

function lireHoraire(groupe, jour) {
    if (!groupe.horaires) return "";

    return groupe.horaires[jour] || "";
}

function afficherPlanning() {
    if (groupes.length === 0) {
        zonePlanning.innerHTML = `
            <section class="card">
                <h2>Aucun planning disponible</h2>
                <p>
                    Aucun groupe n'a encore été paramétré.
                </p>
            </section>
        `;
        return;
    }

    zonePlanning.innerHTML = "";

    groupes.forEach((groupe) => {
        zonePlanning.innerHTML += `
            <section class="schedule-card">

                <div class="schedule-info">
                    <h2>${groupe.nom}</h2>

                    ${groupe.note ? `<p class="note">${groupe.note}</p>` : ""}

                    <p>${groupe.sexe || "Mixte"} · ${groupe.type || "Loisir"} · ${groupe.federation || "-"}</p>

                    <p>
                        <strong>Années :</strong>
                        ${groupe.anneeMin || "?"} à ${groupe.anneeMax || "?"}
                    </p>

                    <p>
                        <strong>Coach(s) :</strong>
                        ${groupe.coachs && groupe.coachs.length > 0 ? groupe.coachs.join(" / ") : "Non renseigné"}
                    </p>
                </div>

                <div class="week-grid">
                    <div>Lun<span class="slot ${lireHoraire(groupe, "lundi") ? "ok" : "off"}">${lireHoraire(groupe, "lundi") || "-"}</span></div>
                    <div>Mar<span class="slot ${lireHoraire(groupe, "mardi") ? "ok" : "off"}">${lireHoraire(groupe, "mardi") || "-"}</span></div>
                    <div>Mer<span class="slot ${lireHoraire(groupe, "mercredi") ? "ok" : "off"}">${lireHoraire(groupe, "mercredi") || "-"}</span></div>
                    <div>Jeu<span class="slot ${lireHoraire(groupe, "jeudi") ? "ok" : "off"}">${lireHoraire(groupe, "jeudi") || "-"}</span></div>
                    <div>Ven<span class="slot ${lireHoraire(groupe, "vendredi") ? "ok" : "off"}">${lireHoraire(groupe, "vendredi") || "-"}</span></div>
                    <div>Sam<span class="slot ${lireHoraire(groupe, "samedi") ? "ok" : "off"}">${lireHoraire(groupe, "samedi") || "-"}</span></div>
                    <div>Dim<span class="slot off">-</span></div>
                </div>

            </section>
        `;
    });
}

afficherPlanning();