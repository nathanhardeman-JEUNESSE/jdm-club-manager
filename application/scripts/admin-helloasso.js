import {
  collection,
  doc,
  getCountFromServer,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../firebase/firebase.js";

const statusZone = document.getElementById("helloasso-sync-status");
const statsZone = document.getElementById("helloasso-sync-stats");

function formatDate(value) {
  if (!value) return "Jamais";
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Non renseigné" : date.toLocaleString("fr-FR");
}

function statusLabel(status) {
  if (status === "success") return "✅ Terminée";
  if (status === "running") return "⏳ En cours";
  if (status === "error") return "❌ Erreur";
  return "⚪ Jamais lancée";
}

onSnapshot(doc(db, "syncStatus", "helloasso"), (snapshot) => {
  if (!snapshot.exists()) {
    statusZone.innerHTML = "<p>Aucune synchronisation enregistrée.</p>";
    return;
  }
  const data = snapshot.data();
  const stats = data.stats || {};
  statusZone.innerHTML = `
    <p><strong>État :</strong> ${statusLabel(data.status)}</p>
    <p><strong>Mode :</strong> ${data.mode || "-"}</p>
    <p><strong>Saison :</strong> ${data.season || "-"}</p>
    <p><strong>Dernière réussite :</strong> ${formatDate(data.lastSuccessAt)}</p>
    ${data.errorMessage ? `<p><strong>Erreur :</strong> ${data.errorMessage}</p>` : ""}
  `;
  statsZone.innerHTML = `
    <p><strong>Commandes lues :</strong> ${stats.ordersRead || 0}</p>
    <p><strong>Paiements enregistrés :</strong> ${stats.paymentsWritten || 0}</p>
    <p><strong>Adhérents mis à jour :</strong> ${stats.adherentsWritten || 0}</p>
    <p><strong>Inscriptions mises à jour :</strong> ${stats.registrationsWritten || 0}</p>
    <p><strong>Comptes préparés :</strong> ${stats.pendingUsersWritten || 0}</p>
    <p><strong>Erreurs :</strong> ${stats.errors || 0}</p>
  `;
}, (error) => {
  console.error(error);
  statusZone.innerHTML = "<p>Impossible de lire l'état de synchronisation.</p>";
});

async function loadCounts() {
  try {
    const [orders, payments, adherents, registrations] = await Promise.all([
      getCountFromServer(collection(db, "helloassoOrders")),
      getCountFromServer(collection(db, "helloassoPayments")),
      getCountFromServer(collection(db, "adherents")),
      getCountFromServer(collection(db, "inscriptions"))
    ]);
    statsZone.insertAdjacentHTML("beforeend", `
      <hr>
      <p><strong>Total commandes HelloAsso :</strong> ${orders.data().count}</p>
      <p><strong>Total paiements HelloAsso :</strong> ${payments.data().count}</p>
      <p><strong>Total adhérents Firebase :</strong> ${adherents.data().count}</p>
      <p><strong>Total inscriptions Firebase :</strong> ${registrations.data().count}</p>
    `);
  } catch (error) {
    console.warn("Compteurs HelloAsso indisponibles", error);
  }
}

loadCounts();
