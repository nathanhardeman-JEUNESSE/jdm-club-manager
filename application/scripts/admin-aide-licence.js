import {
  listAdherents,
  listInscriptions,
  listTresorerieCotisations,
  saveTresorerieCotisation,
  updateCotisationStatus,
  listHelloAssoDonations,
  updateHelloAssoDonation
} from "../firebase/firebase-db.js";

let adherents = [];
let inscriptions = [];
let dossiersSauves = [];
let donsHelloAsso = [];

const $ = id => document.getElementById(id);
const zoneStats = $("stats-cotisations");
const zoneListe = $("liste-aide-licence");
const zoneAlertes = $("liste-alertes-cotisations");
const zoneResume = $("resume-liste-tresorerie");
const zoneDons = $("liste-dons-helloasso");
const recherche = $("recherche-aide");
const filtreStatut = $("filtre-aide-statut");
const filtreMode = $("filtre-mode-paiement");
const filtreDossiers = $("filtre-dossiers");

function nettoyer(v) {
  return String(v || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function n(v) {
  const x = Number(String(v ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function arr(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

function euros(v) {
  return Number(v || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " €";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function inscriptionsPour(numero) {
  return inscriptions.filter(i => String(i.numeroAdherent) === String(numero));
}

function derniereInscription(adherent) {
  return inscriptionsPour(adherent.numeroAdherent)
    .slice()
    .sort((a, b) => String(a.dateInscription || "").localeCompare(String(b.dateInscription || "")))
    .at(-1) || null;
}

function valeurChamp(inscription, mots, exclusions = []) {
  const fields = inscription?.donneesHelloAsso?.customFields || [];
  const found = fields.find(field => {
    const nom = nettoyer(field?.name);
    return mots.every(m => nom.includes(nettoyer(m))) &&
      exclusions.every(m => !nom.includes(nettoyer(m)));
  });
  return found?.answer ?? "";
}

function groupes(adherent) {
  return unique([
    ...(Array.isArray(adherent.groupes) ? adherent.groupes : []),
    adherent.groupe,
    ...inscriptionsPour(adherent.numeroAdherent).map(i =>
      i.groupe || i.donneesHelloAsso?.name || ""
    )
  ]).filter(g => nettoyer(g) !== "fixed");
}

function reduction(inscription) {
  const d = inscription?.donneesHelloAsso?.discount || {};
  return { code: d.code || "", montant: n(d.amount) / 100 };
}

function montantInitial(inscription) {
  const d = inscription?.donneesHelloAsso || {};
  if (d.initialAmount !== undefined) return arr(n(d.initialAmount) / 100);
  if (d.amount !== undefined) return arr(n(d.amount) / 100);
  return arr(n(inscription?.montant));
}

function montantHelloAsso(inscription) {
  const d = inscription?.donneesHelloAsso || {};
  const totalPaiements = Array.isArray(d.payments)
    ? d.payments.reduce((total, paiement) =>
        total + n(paiement.shareAmount ?? paiement.amount ?? 0), 0)
    : 0;
  if (totalPaiements > 0) return arr(totalPaiements / 100);
  if (d.amount !== undefined) return arr(n(d.amount) / 100);
  return arr(n(inscription?.montant));
}

function dossierSauve(adherent) {
  return dossiersSauves.find(d =>
    String(d.numeroAdherent) === String(adherent.numeroAdherent)
  ) || {};
}

function dossier(adherent) {
  const ins = derniereInscription(adherent);
  const saved = dossierSauve(adherent);
  const red = reduction(ins);
  const montantCBImporte = montantHelloAsso(ins);
  let reglements = Array.isArray(saved.reglements) ? [...saved.reglements] : [];
  const paiementHelloAssoExistant = reglements.some(reglement =>
    reglement.source === "helloasso" || reglement.mode === "cb-helloasso"
  );
  if (montantCBImporte > 0 && !paiementHelloAssoExistant) {
    reglements.unshift({
      id: `helloasso-${ins?.helloAssoItemId || adherent.numeroAdherent}`,
      source: "helloasso",
      verrouille: true,
      mode: "cb-helloasso",
      montant: montantCBImporte,
      date: ins?.dateInscription ? String(ins.dateInscription).slice(0, 10) : "",
      reference: ins?.helloAssoOrderId || ins?.donneesHelloAsso?.payments?.[0]?.id || "",
      commentaire: "Paiement importé automatiquement depuis HelloAsso"
    });
  }
  const attendu = arr(n(saved.montantAttendu || montantInitial(ins)));
  const total = arr(reglements.reduce((s, r) => s + n(r.montant), 0));
  const reste = Math.max(0, arr(attendu - total));

  let statut = "attente";

  if (
    saved.statutForce === true &&
    ["attente", "partiel", "regle", "annule"].includes(saved.statut)
  ) {
    statut = saved.statut;
  } else if (attendu > 0 && total >= attendu) {
    statut = "regle";
  } else if (total > 0) {
    statut = "partiel";
  }

  return {
    ...saved,
    numeroAdherent: adherent.numeroAdherent,
    numeroMembre: adherent.numeroMembre || adherent.numeroAdherent,
    nom: adherent.nom || "",
    prenom: adherent.prenom || "",
    groupes: groupes(adherent),
    saison: ins?.saison || adherent.saison || "",
    montantInitial: montantInitial(ins),
    montantAttendu: attendu,
    montantHelloAsso: montantHelloAsso(ins),
    reductionCode: red.code,
    reductionMontant: red.montant,
    reglements,
    totalRegle: total,
    reste,
    statut,
    adresse: valeurChamp(ins, ["adresse"], ["email"]),
    codePostal: valeurChamp(ins, ["code", "postal"]),
    ville: valeurChamp(ins, ["ville"]),
    justificatifValide: saved.justificatifValide === true,
    licenceValidee: saved.licenceValidee === true,
    cotisationRegularisee: saved.cotisationRegularisee === true,
    dateValidationTresorier: saved.dateValidationTresorier || "",
    relance: saved.relance === true,
    commentaire: saved.commentaire || ""
  };
}

const labelsStatut = {
  attente: "En attente",
  partiel: "Partiellement réglé",
  regle: "Réglé",
  annule: "Annulé / impayé"
};

const labelsMode = {
  "cb-helloasso": "CB HelloAsso",
  cheque: "Chèque",
  especes: "Espèces",
  virement: "Virement",
  passsport: "Pass’Sport",
  "cheque-sport": "Chèque sport",
  "aide-lomme": "Aide Ville de Lomme",
  autre: "Autre"
};

const classesStatut = {
  attente: "treasury-status-waiting",
  partiel: "treasury-status-partial",
  regle: "treasury-status-paid",
  annule: "treasury-status-cancelled"
};

function visible(d) {
  if (filtreStatut.value && d.statut !== filtreStatut.value) return false;
  if (filtreMode.value && !d.reglements.some(r => r.mode === filtreMode.value)) return false;

  if (filtreDossiers.value === "reste" && d.reste <= 0) return false;
  if (filtreDossiers.value === "lomme" &&
      !(nettoyer(d.ville).includes("lomme") || String(d.codePostal) === "59160")) return false;
  if (filtreDossiers.value === "justificatif-manquant" && d.justificatifValide) return false;
  if (filtreDossiers.value === "reduction" && !d.reductionCode && d.reductionMontant <= 0) return false;

  const q = nettoyer(recherche.value);
  if (!q) return true;

  return nettoyer([
    d.nom, d.prenom, d.numeroAdherent, d.numeroMembre, d.groupes.join(" "),
    d.adresse, d.codePostal, d.ville, d.reductionCode, d.commentaire,
    ...d.reglements.map(r => `${labelsMode[r.mode]} ${r.reference} ${r.commentaire}`)
  ].join(" ")).includes(q);
}

function dossiersFiltres() {
  return adherents.map(dossier).filter(visible).sort((a, b) =>
    `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr", { sensitivity: "base" })
  );
}


function afficherDons() {
  if (!zoneDons) return;

  const dons = donsHelloAsso
    .slice()
    .sort((a, b) =>
      String(b.dateDon || "")
        .localeCompare(
          String(a.dateDon || "")
        )
    );

  if (dons.length === 0) {
    zoneDons.innerHTML = `
      <section class="card">
        <p>Aucun don importé.</p>
      </section>
    `;
    return;
  }

  const totalDons = arr(
    dons.reduce(
      (total, don) =>
        total + n(
          don.montantPaye ??
          don.montantDeclare
        ),
      0
    )
  );

  zoneDons.innerHTML = `
    <section class="card treasury-donation-summary">
      <strong>${dons.length} don${dons.length > 1 ? "s" : ""}</strong>
      <span>Total encaissé : ${euros(totalDons)}</span>
    </section>

    ${dons.map(don => `
      <article
        class="card treasury-donation-card"
        data-donation-id="${don.id}">

        <div>
          <h3>
            🎁 ${don.prenom || ""}
            ${don.nom || "Donateur"}
          </h3>

          <p>
            <strong>Montant :</strong>
            ${euros(
              don.montantPaye ??
              don.montantDeclare
            )}
          </p>

          <p>
            <strong>Date :</strong>
            ${don.dateDon
              ? new Date(
                  don.dateDon
                ).toLocaleDateString("fr-FR")
              : "Non renseignée"}
          </p>

          <p>
            <strong>Email :</strong>
            ${don.email || "Non renseigné"}
          </p>
        </div>

        <div class="treasury-donation-actions">
          <label class="treasury-checkbox">
            <input
              type="checkbox"
              data-donation-field="recuDemande"
              ${don.recuDemande ? "checked" : ""}>
            Reçu demandé
          </label>

          <label class="treasury-checkbox">
            <input
              type="checkbox"
              data-donation-field="recuRemis"
              ${don.recuRemis ? "checked" : ""}>
            Reçu remis
          </label>

          <textarea
            class="form-input"
            data-donation-field="commentaireTresorier"
            rows="2"
            placeholder="Commentaire">${don.commentaireTresorier || ""}</textarea>

          <button
            type="button"
            class="primary-button treasury-save-donation">
            Enregistrer
          </button>
        </div>
      </article>
    `).join("")}
  `;

  zoneDons
    .querySelectorAll(
      ".treasury-save-donation"
    )
    .forEach(button => {
      button.onclick = async () => {
        const card = button.closest(
          "[data-donation-id]"
        );

        const id =
          card.dataset.donationId;

        const data = {
          recuDemande:
            card.querySelector(
              '[data-donation-field="recuDemande"]'
            ).checked,

          recuRemis:
            card.querySelector(
              '[data-donation-field="recuRemis"]'
            ).checked,

          commentaireTresorier:
            card.querySelector(
              '[data-donation-field="commentaireTresorier"]'
            ).value.trim()
        };

        button.disabled = true;
        button.textContent =
          "Enregistrement...";

        try {
          await updateHelloAssoDonation(
            id,
            data
          );

          const index =
            donsHelloAsso.findIndex(
              don => don.id === id
            );

          if (index >= 0) {
            donsHelloAsso[index] = {
              ...donsHelloAsso[index],
              ...data
            };
          }

          afficherDons();
        } catch (error) {
          console.error(error);
          alert(
            "Impossible d'enregistrer le suivi du don."
          );
          button.disabled = false;
          button.textContent =
            "Enregistrer";
        }
      };
    });
}

function afficherStats() {
  const all = adherents.map(dossier);
  const attendu = arr(all.reduce((s, d) => s + d.montantAttendu, 0));
  const encaisse = arr(all.reduce((s, d) => s + d.totalRegle, 0));
  const reste = arr(all.reduce((s, d) => s + d.reste, 0));
  const count = s => all.filter(d => d.statut === s).length;

  zoneStats.innerHTML = `
    <article class="treasury-stat treasury-stat-blue"><span>Attendu</span><strong>${euros(attendu)}</strong></article>
    <article class="treasury-stat treasury-stat-green"><span>Encaissé</span><strong>${euros(encaisse)}</strong></article>
    <article class="treasury-stat treasury-stat-red"><span>Reste</span><strong>${euros(reste)}</strong></article>
    <article class="treasury-stat treasury-stat-neutral"><span>Réglés</span><strong>${count("regle")} / ${all.length}</strong></article>
    <article class="treasury-stat treasury-stat-orange"><span>Partiels</span><strong>${count("partiel")}</strong></article>
    <article class="treasury-stat treasury-stat-red"><span>En attente</span><strong>${count("attente")}</strong></article>
  `;
}

function paymentRow(r = {}, index = 0) {
  const modes = Object.keys(labelsMode);
  const verrouille = r.source === "helloasso" || r.verrouille === true;
  const disabled = verrouille ? "disabled" : "";
  return `
    <div class="treasury-payment-row ${verrouille ? "treasury-payment-imported" : ""}"
         data-payment-source="${r.source || "manuel"}">
      <select class="admin-select" data-p="mode" ${disabled}>
        ${modes.map(m => `<option value="${m}" ${r.mode === m ? "selected" : ""}>${labelsMode[m]}</option>`).join("")}
      </select>
      <input class="form-input" data-p="montant" type="number" min="0" step="0.01"
             value="${r.montant || ""}" placeholder="Montant" ${disabled}>
      <input class="form-input" data-p="date" type="date" value="${r.date || ""}" ${disabled}>
      <input class="form-input" data-p="reference" value="${r.reference || ""}"
             placeholder="N° chèque / référence" ${disabled}>
      <input class="form-input" data-p="commentaire" value="${r.commentaire || ""}"
             placeholder="Note" ${disabled}>
      ${verrouille
        ? `<span class="treasury-imported-badge">Import HelloAsso</span>`
        : `<button type="button" class="treasury-remove-payment">×</button>`}
    </div>`;
}

function card(d) {
  const cls = classesStatut[d.statut];
  return `
    <article class="card treasury-member-card ${cls}" data-numero="${d.numeroAdherent}">
      <button type="button" class="treasury-member-summary">
        <div class="treasury-member-main">
          <h2>${d.prenom} ${d.nom}</h2>
          <p class="treasury-member-number">${d.numeroMembre}</p>
          <div class="treasury-group-list">${d.groupes.map(g => `<span>${g}</span>`).join("")}</div>
        </div>
        <div class="treasury-member-totals">
          <span class="treasury-status-pill ${cls}">${labelsStatut[d.statut]}</span>
          <strong>${euros(d.reste)} restant</strong>
          <small>${euros(d.totalRegle)} / ${euros(d.montantAttendu)}</small>
        </div>
      </button>

      <section class="treasury-member-details" hidden>
        <div class="treasury-payment-summary">
          <div><span>Tarif initial</span><strong>${euros(d.montantInitial)}</strong></div>
          <div><span>HelloAsso encaissé</span><strong>${euros(d.montantHelloAsso)}</strong></div>
          <div><span>Réduction / coupon</span><strong>${d.reductionCode || "Aucun"}${d.reductionMontant ? ` · ${euros(d.reductionMontant)}` : ""}</strong></div>
        </div>

        <div class="treasury-detail-grid">
          <label>Montant réellement attendu
            <input class="form-input" data-f="montantAttendu" type="number" min="0"
                   step="0.01" value="${d.montantAttendu}">
          </label>
          <label>Validation du trésorier
            <select class="admin-select" data-f="statutManuel">
              <option value="" ${!d.statutForce ? "selected" : ""}>
                Calcul automatique
              </option>
              <option value="regle" ${d.statutForce && d.statut === "regle" ? "selected" : ""}>
                Cotisation régularisée / licence validée
              </option>
              <option value="partiel" ${d.statutForce && d.statut === "partiel" ? "selected" : ""}>
                Paiement partiel confirmé
              </option>
              <option value="attente" ${d.statutForce && d.statut === "attente" ? "selected" : ""}>
                En attente de règlement
              </option>
              <option value="annule" ${d.statutForce && d.statut === "annule" ? "selected" : ""}>
                Annulé / impayé
              </option>
            </select>
          </label>
        </div>

        <section class="treasury-manual-validation">
          <label class="treasury-checkbox">
            <input
              data-f="licenceValidee"
              type="checkbox"
              ${d.licenceValidee ? "checked" : ""}>
            Licence validée par le trésorier
          </label>

          <p>
            À utiliser notamment lorsqu'une réduction a été contrôlée
            (résident Lomme, Pass’Sport, aide, régularisation, etc.).
          </p>
        </section>

        <section class="treasury-payments-section">
          <div class="treasury-section-heading">
            <div>
              <h3>Règlements reçus</h3>
              <p>Plusieurs moyens de paiement sont possibles.</p>
            </div>
            <button type="button" class="treasury-add-payment">+ Ajouter</button>
          </div>
          <div class="treasury-payments-list">
            ${d.reglements.length ? d.reglements.map(paymentRow).join("") :
              `<p class="treasury-empty-payment">Aucun règlement validé.</p>`}
          </div>
        </section>

        <section class="treasury-address-section">
          <h3>Adresse & justificatif</h3>
          <div class="treasury-address-grid">
            <p><strong>Adresse :</strong><br>${d.adresse || "Non renseignée"}<br>
               ${d.codePostal || ""} ${d.ville || ""}</p>
            <label class="treasury-checkbox">
              <input data-f="justificatifValide" type="checkbox"
                     ${d.justificatifValide ? "checked" : ""}>
              Justificatif domicile vérifié
            </label>
          </div>
        </section>

        <label>Commentaire trésorier
          <textarea class="form-input" data-f="commentaire" rows="3">${d.commentaire}</textarea>
        </label>

        <label class="treasury-checkbox">
          <input data-f="relance" type="checkbox" ${d.relance ? "checked" : ""}>
          Dossier à relancer
        </label>

        <div class="treasury-card-actions">
          <button type="button" class="primary-button treasury-save">Enregistrer</button>
        </div>
      </section>
    </article>`;
}

function brancher() {
  document.querySelectorAll(".treasury-member-summary").forEach(btn => {
    btn.onclick = () => {
      const details = btn.parentElement.querySelector(".treasury-member-details");
      details.hidden = !details.hidden;
    };
  });

  document.querySelectorAll(".treasury-add-payment").forEach(btn => {
    btn.onclick = () => {
      const list = btn.closest(".treasury-member-details").querySelector(".treasury-payments-list");
      list.querySelector(".treasury-empty-payment")?.remove();
      list.insertAdjacentHTML("beforeend", paymentRow({
        mode: "cheque", date: new Date().toISOString().split("T")[0]
      }));
      brancher();
    };
  });

  document.querySelectorAll(".treasury-remove-payment").forEach(btn => {
    btn.onclick = () => btn.closest(".treasury-payment-row")?.remove();
  });

  document.querySelectorAll(".treasury-save").forEach(btn => {
    btn.onclick = () => enregistrer(btn.closest(".treasury-member-card"), btn);
  });
}


function ordreStatut(statut) {
  return {
    attente: 1,
    partiel: 2,
    regle: 3,
    annule: 4
  }[statut] || 5;
}

function titreSectionStatut(statut) {
  return {
    attente: "🔴 En attente",
    partiel: "🟠 Partiellement réglés",
    regle: "🟢 Réglés / licences validées",
    annule: "⚫ Annulés / impayés"
  }[statut] || "Autres";
}

function sectionStatut(statut, dossiers, ouverteParDefaut = false) {
  const id = `treasury-section-${statut}`;

  return `
    <section class="treasury-status-section ${classesStatut[statut] || ""}">
      <button
        type="button"
        class="treasury-status-section-toggle"
        aria-expanded="${ouverteParDefaut ? "true" : "false"}"
        aria-controls="${id}">
        <span>
          ${titreSectionStatut(statut)}
          <strong>${dossiers.length}</strong>
        </span>

        <span class="treasury-status-section-arrow">
          ${ouverteParDefaut ? "▾" : "▸"}
        </span>
      </button>

      <div
        id="${id}"
        class="treasury-status-section-content"
        ${ouverteParDefaut ? "" : "hidden"}>
        ${dossiers.length
          ? dossiers.map(card).join("")
          : `
              <section class="card treasury-empty-section">
                <p>Aucun dossier dans cette section.</p>
              </section>
            `}
      </div>
    </section>
  `;
}

function brancherSectionsStatut() {
  document
    .querySelectorAll(".treasury-status-section-toggle")
    .forEach(button => {
      button.onclick = () => {
        const id = button.getAttribute("aria-controls");
        const content = document.getElementById(id);
        if (!content) return;

        const ouvert = content.hidden === false;
        content.hidden = ouvert;
        button.setAttribute("aria-expanded", String(!ouvert));

        const arrow = button.querySelector(
          ".treasury-status-section-arrow"
        );

        if (arrow) {
          arrow.textContent = ouvert ? "▸" : "▾";
        }
      };
    });
}

function afficherListes() {
  const data = dossiersFiltres()
    .slice()
    .sort((a, b) => {
      const statutDiff =
        ordreStatut(a.statut) -
        ordreStatut(b.statut);

      if (statutDiff !== 0) {
        return statutDiff;
      }

      return `${a.nom} ${a.prenom}`.localeCompare(
        `${b.nom} ${b.prenom}`,
        "fr",
        { sensitivity: "base" }
      );
    });

  zoneResume.textContent =
    `${data.length} dossier${data.length > 1 ? "s" : ""}`;

  const groupes = {
    attente: data.filter(d => d.statut === "attente"),
    partiel: data.filter(d => d.statut === "partiel"),
    regle: data.filter(d => d.statut === "regle"),
    annule: data.filter(d => d.statut === "annule")
  };

  const alertes = data.filter(d =>
    d.statut === "attente" ||
    d.statut === "partiel" ||
    d.relance ||
    !d.justificatifValide
  );

  zoneAlertes.innerHTML = alertes.length
    ? `
        <section class="card treasury-alert-title">
          <h2>🚨 À traiter</h2>
          <p>
            Dossiers en attente, partiels, à relancer
            ou justificatifs à vérifier.
          </p>
        </section>
      `
    : `
        <section class="card treasury-all-clear">
          <h2>✅ Aucun dossier urgent</h2>
        </section>
      `;

  zoneListe.innerHTML = data.length
    ? [
        sectionStatut("attente", groupes.attente, true),
        sectionStatut("partiel", groupes.partiel, true),
        sectionStatut("regle", groupes.regle, false),
        sectionStatut("annule", groupes.annule, false)
      ].join("")
    : `
        <section class="card">
          <h2>Aucun résultat</h2>
          <p>Aucun dossier ne correspond aux filtres.</p>
        </section>
      `;

  brancherSectionsStatut();
  brancher();
}

function lireCarte(carte) {
  const adherent = adherents.find(a => String(a.numeroAdherent) === String(carte.dataset.numero));
  const d = dossier(adherent);
  d.montantAttendu = n(
    carte.querySelector('[data-f="montantAttendu"]').value
  );

  d.justificatifValide =
    carte.querySelector('[data-f="justificatifValide"]').checked;

  d.licenceValidee =
    carte.querySelector('[data-f="licenceValidee"]').checked;

  d.cotisationRegularisee = d.licenceValidee;

  d.commentaire =
    carte.querySelector('[data-f="commentaire"]').value.trim();

  d.relance =
    carte.querySelector('[data-f="relance"]').checked;

  const statutManuel =
    carte.querySelector('[data-f="statutManuel"]').value;

  d.statutForce = statutManuel !== "";

  if (d.licenceValidee) {
    d.statutForce = true;
    d.statut = "regle";
    d.dateValidationTresorier =
      new Date().toISOString();
  } else if (d.statutForce) {
    d.statut = statutManuel;
  }

  d.reglements = [...carte.querySelectorAll(".treasury-payment-row")].map((row, i) => {
    const val = k => row.querySelector(`[data-p="${k}"]`)?.value || "";
    const source = row.dataset.paymentSource || "manuel";
    return {
      id: source === "helloasso" ? `helloasso-${d.numeroAdherent}` : `${Date.now()}-${i}`,
      source,
      verrouille: source === "helloasso",
      mode: val("mode"),
      montant: n(val("montant")),
      date: val("date"),
      reference: val("reference").trim(),
      commentaire: val("commentaire").trim()
    };
  });

  d.totalRegle = arr(d.reglements.reduce((s, r) => s + n(r.montant), 0));
  d.reste = Math.max(0, arr(d.montantAttendu - d.totalRegle));

  if (!d.statutForce) {
    if (
      d.montantAttendu > 0 &&
      d.totalRegle >= d.montantAttendu
    ) {
      d.statut = "regle";
    } else if (d.totalRegle > 0) {
      d.statut = "partiel";
    } else {
      d.statut = "attente";
    }
  }

  return d;
}

async function enregistrer(carte, btn) {
  const d = lireCarte(carte);
  btn.disabled = true;
  btn.textContent = "Enregistrement...";

  try {
    await saveTresorerieCotisation(d.numeroAdherent, d);
    await updateCotisationStatus(d.numeroAdherent, d.statut);

    const i = dossiersSauves.findIndex(x =>
      String(x.numeroAdherent) === String(d.numeroAdherent)
    );
    if (i >= 0) dossiersSauves[i] = d;
    else dossiersSauves.push(d);

    afficherStats();
    afficherListes();
  } catch (error) {
    console.error(error);
    alert("Enregistrement impossible. Vérifiez les règles Firestore.");
    btn.disabled = false;
    btn.textContent = "Enregistrer";
  }
}

function exportRows(data) {
  return data.map(d => ({
    Nom: d.nom,
    Prénom: d.prenom,
    "N° membre": d.numeroMembre,
    Groupes: d.groupes.join(" | "),
    Saison: d.saison,
    "Tarif initial": d.montantInitial,
    "Montant attendu": d.montantAttendu,
    "HelloAsso encaissé": d.montantHelloAsso,
    Coupon: d.reductionCode,
    "Montant réduction": d.reductionMontant,
    "Total encaissé validé": d.totalRegle,
    "Reste à payer": d.reste,
    Statut: labelsStatut[d.statut],
    Modes: unique(d.reglements.map(r => labelsMode[r.mode])).join(" | "),
    Références: d.reglements.map(r => r.reference).filter(Boolean).join(" | "),
    Adresse: d.adresse,
    "Code postal": d.codePostal,
    Ville: d.ville,
    "Justificatif validé": d.justificatifValide ? "Oui" : "Non",
    "Licence validée": d.licenceValidee ? "Oui" : "Non",
    "Cotisation régularisée": d.cotisationRegularisee ? "Oui" : "Non",
    "Date validation trésorier": d.dateValidationTresorier || "",
    Relance: d.relance ? "Oui" : "Non",
    Commentaire: d.commentaire
  }));
}

function exporter(data, filename) {
  if (!window.XLSX) {
    alert("Le module Excel n'est pas disponible.");
    return;
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportRows(data));
  ws["!cols"] = Array(21).fill({ wch: 18 });
  XLSX.utils.book_append_sheet(wb, ws, "Cotisations");
  XLSX.writeFile(wb, filename);
}

[recherche, filtreStatut, filtreMode, filtreDossiers].forEach(el => {
  el.addEventListener(el === recherche ? "input" : "change", afficherListes);
});

$("reinitialiser-filtres-tresorerie").onclick = () => {
  recherche.value = "";
  filtreStatut.value = "";
  filtreMode.value = "";
  filtreDossiers.value = "";
  afficherListes();
};

$("exporter-excel").onclick = () =>
  exporter(dossiersFiltres(), "tresorerie-cotisations-jdm.xlsx");

$("exporter-alertes").onclick = () =>
  exporter(dossiersFiltres().filter(d => d.reste > 0 || d.relance),
    "cotisations-a-relancer-jdm.xlsx");

async function init() {
  zoneListe.innerHTML = `<section class="card"><p>Chargement...</p></section>`;
  try {
    [
      adherents,
      inscriptions,
      dossiersSauves,
      donsHelloAsso
    ] = await Promise.all([
      listAdherents(),
      listInscriptions(),
      listTresorerieCotisations(),
      listHelloAssoDonations()
    ]);

    afficherStats();
    afficherDons();
    afficherListes();
  } catch (error) {
    console.error(error);
    zoneListe.innerHTML = `<section class="card"><h2>Erreur</h2>
      <p>Impossible de charger les données.</p></section>`;
  }
}

init();
