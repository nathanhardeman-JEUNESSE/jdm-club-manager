import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { CONFIG, customField, firestoreId, normalize } from "./mapping.mjs";

const required = [
  "HELLOASSO_CLIENT_ID",
  "HELLOASSO_CLIENT_SECRET",
  "HELLOASSO_ORGANIZATION_SLUG",
  "FIREBASE_SERVICE_ACCOUNT"
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Secret GitHub manquant : ${name}`);
}

initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});
const db = getFirestore();
const season = process.env.JDM_SEASON || CONFIG.defaultSeason;
const mode = process.env.SYNC_MODE === "complete" ? "complete" : "incremental";
const stats = {
  ordersRead: 0,
  ordersWritten: 0,
  paymentsWritten: 0,
  adherentsWritten: 0,
  registrationsWritten: 0,
  pendingUsersWritten: 0,
  skipped: 0,
  errors: 0
};

async function token() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.HELLOASSO_CLIENT_ID,
    client_secret: process.env.HELLOASSO_CLIENT_SECRET
  });
  const response = await fetch(`${CONFIG.apiBase}/oauth2/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(`OAuth HelloAsso refusé (${response.status})`);
  }
  return data.access_token;
}

async function apiGet(path, accessToken, query = {}) {
  const url = new URL(`${CONFIG.apiBase}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`API HelloAsso refusée (${response.status})`);
  }
  return data;
}

async function lastSuccess() {
  if (mode === "complete") return null;
  const snapshot = await db.collection(CONFIG.collections.syncStatus).doc("helloasso").get();
  return snapshot.exists ? snapshot.data()?.lastSuccessAt?.toDate?.() ?? null : null;
}

async function fetchOrders(accessToken, since) {
  const slug = encodeURIComponent(process.env.HELLOASSO_ORGANIZATION_SLUG);
  const all = [];
  let pageIndex = 1;
  let totalPages = 1;
  let continuationToken = "";

  do {
    const result = await apiGet(`/v5/organizations/${slug}/orders`, accessToken, {
      pageIndex,
      pageSize: CONFIG.pageSize,
      continuationToken: continuationToken || undefined,
      sortOrder: "Desc"
    });
    const page = Array.isArray(result.data) ? result.data : [];
    all.push(...page);
    const pagination = result.pagination || {};
    totalPages = Number(pagination.totalPages || 1);
    continuationToken = pagination.continuationToken || "";
    pageIndex += 1;
  } while (continuationToken || pageIndex <= totalPages);

  if (!since) return all;
  return all.filter((order) => {
    const date = new Date(order.date || order.creationDate || 0);
    return !Number.isNaN(date.getTime()) && date >= since;
  });
}

function payer(order) {
  return order.payer || order.payerInfo || order.user || {};
}

function buildAdherent(order, item, index) {
  const p = payer(order);
  const fields = item?.customFields || item?.fields || item?.answers || [];
  const nom = item?.lastName || item?.lastname || customField(fields, ["nom"]) || p.lastName || "";
  const prenom = item?.firstName || item?.firstname || customField(fields, ["prenom"]) || customField(fields, ["prénom"]) || p.firstName || "";
  const email = item?.email || customField(fields, ["email"]) || p.email || "";
  const birthDate = item?.birthDate || customField(fields, ["naissance"]) || "";
  const group = item?.tierName || item?.priceCategory || item?.name || item?.title || "";
  const orderId = order.id ?? order.orderId;
  const itemId = item?.id ?? `${orderId}-${index + 1}`;
  const numeroAdherent = `HA-${itemId}`;

  return {
    numeroAdherent,
    cle: [normalize(nom), normalize(prenom), normalize(birthDate)].join("-"),
    nom,
    prenom,
    dateNaissance: birthDate,
    email,
    emailParent1: p.email || email,
    telephone: p.phone || "",
    groupe: group,
    saison: season,
    actif: true,
    cotisationAJour: true,
    source: "helloasso",
    helloAssoOrderId: String(orderId ?? ""),
    helloAssoItemId: String(itemId),
    updatedAt: FieldValue.serverTimestamp()
  };
}

function buildRegistration(order, item, adherent) {
  const cents = item?.amount ?? item?.price ?? order?.amount?.total ?? order?.amount ?? 0;
  return {
    saison: season,
    numeroAdherent: adherent.numeroAdherent,
    source: "helloasso",
    statutPaiement: "payé",
    cotisationAJour: true,
    montant: Number(cents || 0) / 100,
    dateInscription: order.date || order.creationDate || new Date().toISOString(),
    helloAssoOrderId: adherent.helloAssoOrderId,
    helloAssoItemId: adherent.helloAssoItemId,
    donneesHelloAsso: item,
    updatedAt: FieldValue.serverTimestamp()
  };
}

function buildPendingUser(adherent) {
  const email = normalize(adherent.emailParent1 || adherent.email);
  if (!email || !email.includes("@")) return null;
  return {
    email,
    nom: adherent.nom,
    prenom: adherent.prenom,
    role: "membre",
    actif: true,
    numeroAdherent: adherent.numeroAdherent,
    source: "helloasso",
    clubId: CONFIG.clubId,
    accesPages: {
      accueil: { lecture: true, ecriture: false },
      "espace-membre": { lecture: true, ecriture: false },
      "planning-membre": { lecture: true, ecriture: false },
      notifications: { lecture: true, ecriture: false },
      absence: { lecture: true, ecriture: true },
      boutique: { lecture: true, ecriture: false },
      panier: { lecture: true, ecriture: true },
      commande: { lecture: true, ecriture: true }
    },
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function writeOrder(order) {
  const orderId = firestoreId(order.id ?? order.orderId);
  if (!orderId) {
    stats.skipped += 1;
    return;
  }
  await db.collection(CONFIG.collections.orders).doc(orderId).set({
    ...order,
    source: "helloasso",
    organizationSlug: process.env.HELLOASSO_ORGANIZATION_SLUG,
    syncedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  stats.ordersWritten += 1;

  for (const payment of order.payments || []) {
    const paymentId = firestoreId(payment.id ?? `${orderId}-${payment.date || stats.paymentsWritten}`);
    if (!paymentId) continue;
    await db.collection(CONFIG.collections.payments).doc(paymentId).set({
      ...payment,
      helloAssoOrderId: String(order.id ?? order.orderId ?? ""),
      source: "helloasso",
      syncedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    stats.paymentsWritten += 1;
  }

  const items = Array.isArray(order.items) && order.items.length ? order.items : [{}];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const adherent = buildAdherent(order, item, index);
    if (!adherent.nom && !adherent.prenom && !adherent.emailParent1) {
      stats.skipped += 1;
      continue;
    }
    const adherentId = firestoreId(adherent.numeroAdherent);
    const registrationId = firestoreId(`${adherent.numeroAdherent}-${season}`);
    await db.collection(CONFIG.collections.adherents).doc(adherentId).set(adherent, { merge: true });
    stats.adherentsWritten += 1;
    await db.collection(CONFIG.collections.inscriptions).doc(registrationId).set(buildRegistration(order, item, adherent), { merge: true });
    stats.registrationsWritten += 1;
    const pending = buildPendingUser(adherent);
    if (pending) {
      await db.collection(CONFIG.collections.pendingUsers).doc(pending.email).set(pending, { merge: true });
      stats.pendingUsersWritten += 1;
    }
  }
}

async function writeStatus(status, extra = {}) {
  await db.collection(CONFIG.collections.syncStatus).doc("helloasso").set({
    status,
    mode,
    season,
    organizationSlug: process.env.HELLOASSO_ORGANIZATION_SLUG,
    finishedAt: FieldValue.serverTimestamp(),
    stats,
    ...extra
  }, { merge: true });
}

async function main() {
  try {
    await db.collection(CONFIG.collections.syncStatus).doc("helloasso").set({
      status: "running",
      mode,
      season,
      startedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    const accessToken = await token();
    const orders = await fetchOrders(accessToken, await lastSuccess());
    stats.ordersRead = orders.length;

    for (const order of orders) {
      try {
        await writeOrder(order);
      } catch (error) {
        stats.errors += 1;
        console.error("Erreur commande", order?.id ?? order?.orderId, error);
      }
    }

    await writeStatus("success", { lastSuccessAt: FieldValue.serverTimestamp() });
    console.log("Synchronisation terminée", stats);
    if (stats.errors > 0) process.exitCode = 2;
  } catch (error) {
    stats.errors += 1;
    console.error("Synchronisation interrompue", error);
    await writeStatus("error", { errorMessage: error.message || String(error) }).catch(console.error);
    process.exitCode = 1;
  }
}

await main();
