import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { CONFIG, customField, firestoreId, normalize } from "./mapping.mjs";

const REQUIRED_SECRETS = [
  "HELLOASSO_CLIENT_ID",
  "HELLOASSO_CLIENT_SECRET",
  "HELLOASSO_ORGANIZATION_SLUG",
  "FIREBASE_SERVICE_ACCOUNT"
];

for (const name of REQUIRED_SECRETS) {
  if (!process.env[name]) {
    throw new Error(`Secret GitHub manquant : ${name}`);
  }
}

initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

const db = getFirestore();
const season = process.env.JDM_SEASON || CONFIG.defaultSeason;
const mode = process.env.SYNC_MODE === "complete" ? "complete" : "incremental";

const REQUEST_TIMEOUT_MS = 30000;
const MAXIMUM_PAGES = 50;

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

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function getAccessToken() {
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
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    throw new Error(
      `OAuth HelloAsso refusé (${response.status}) : ${JSON.stringify(data)}`
    );
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

  console.log(`Appel HelloAsso : ${url.pathname}${url.search}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `API HelloAsso refusée (${response.status}) : ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function getLastSuccessfulSync() {
  if (mode === "complete") return null;

  const snapshot = await db
    .collection(CONFIG.collections.syncStatus)
    .doc("helloasso")
    .get();

  if (!snapshot.exists) return null;

  return snapshot.data()?.lastSuccessAt?.toDate?.() ?? null;
}

async function fetchOrders(accessToken, lastSyncAt) {
  const organizationSlug = encodeURIComponent(
    process.env.HELLOASSO_ORGANIZATION_SLUG
  );

  const allOrders = [];
  let pageIndex = 1;
  let totalPages = 1;

  do {
    console.log(`Lecture HelloAsso : page ${pageIndex}/${totalPages}`);

    const result = await apiGet(
      `/v5/organizations/${organizationSlug}/orders`,
      accessToken,
      {
        pageIndex,
        pageSize: CONFIG.pageSize || 100,
        sortOrder: "Desc",
        withDetails: true,
        from: lastSyncAt ? lastSyncAt.toISOString() : undefined
      }
    );

    const pageOrders = Array.isArray(result.data) ? result.data : [];
    const pagination = result.pagination || {};

    allOrders.push(...pageOrders);

    totalPages = Math.max(
      1,
      Number(
        pagination.totalPages ||
        pagination.totalNumberOfPages ||
        pagination.pageCount ||
        1
      )
    );

    console.log(`Page ${pageIndex} reçue : ${pageOrders.length} commande(s)`);

    if (pageOrders.length === 0) break;

    pageIndex += 1;
  } while (pageIndex <= totalPages && pageIndex <= MAXIMUM_PAGES);

  if (pageIndex > MAXIMUM_PAGES) {
    console.warn(`Arrêt de sécurité après ${MAXIMUM_PAGES} pages HelloAsso.`);
  }

  console.log(`Total commandes récupérées : ${allOrders.length}`);
  return allOrders;
}

function getPayer(order) {
  return order.payer || order.payerInfo || order.user || {};
}

function splitFullName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 2) {
    return {
      nom: parts[0] || "",
      prenom: ""
    };
  }

  return {
    nom: parts[0],
    prenom: parts.slice(1).join(" ")
  };
}

function normalizeAdherentIdentity(nomValue, prenomValue) {
  let nom = String(nomValue || "").trim();
  let prenom = String(prenomValue || "").trim();

  if (nom && prenom && normalize(nom) === normalize(prenom)) {
    return splitFullName(nom);
  }

  if (!nom && prenom) {
    return splitFullName(prenom);
  }

  if (nom && !prenom) {
    return splitFullName(nom);
  }

  return { nom, prenom };
}

function buildAdherent(order, item, index) {
  const payer = getPayer(order);
  const user = item?.user || {};
  const fields = item?.customFields || item?.fields || item?.answers || [];

  const nomBrut =
    user.lastName ||
    item?.lastName ||
    item?.lastname ||
    payer.lastName ||
    customField(
      fields,
      ["nom"],
      ["parent", "representant", "email", "urgence"]
    ) ||
    "";

  const prenomBrut =
    user.firstName ||
    item?.firstName ||
    item?.firstname ||
    payer.firstName ||
    customField(
      fields,
      ["prenom"],
      ["parent", "representant", "email", "urgence"]
    ) ||
    customField(
      fields,
      ["prénom"],
      ["parent", "representant", "email", "urgence"]
    ) ||
    "";

  const { nom, prenom } = normalizeAdherentIdentity(
    nomBrut,
    prenomBrut
  );

  const email =
    item?.email ||
    customField(fields, ["email"]) ||
    payer.email ||
    "";

  const birthDate =
    item?.birthDate ||
    customField(fields, ["naissance"]) ||
    "";

  const group =
    item?.name ||
    item?.tierName ||
    item?.title ||
    item?.priceCategory ||
    "";

  const telephone =
    customField(fields, ["telephone", "contact", "urgence"]) ||
    customField(fields, ["telephone", "appeler", "urgence"]) ||
    customField(fields, ["numero", "telephone"]) ||
    payer.phone ||
    "";

  const parent1 =
    customField(fields, ["parent", "1"], ["email"]) ||
    customField(fields, ["representant", "legal"], ["email"]) ||
    "";

  const parent2 = customField(fields, ["parent", "2"], ["email"]) || "";
  const emailParent2 = customField(fields, ["email", "parent", "2"]) || "";

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
    emailParent1: payer.email || email,
    emailParent2,
    parent1,
    parent2,
    telephone,
    telephoneUrgence: telephone,
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
  const cents =
    item?.amount ??
    item?.price ??
    order?.amount?.total ??
    order?.amount ??
    0;

  return {
    saison: season,
    numeroAdherent: adherent.numeroAdherent,
    source: "helloasso",
    statutPaiement: "payé",
    cotisationAJour: true,
    montant: Number(cents || 0) / 100,
    dateInscription:
      order.date ||
      order.creationDate ||
      new Date().toISOString(),
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

  await db
    .collection(CONFIG.collections.orders)
    .doc(orderId)
    .set(
      {
        ...order,
        source: "helloasso",
        organizationSlug: process.env.HELLOASSO_ORGANIZATION_SLUG,
        syncedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  stats.ordersWritten += 1;

  for (const payment of order.payments || []) {
    const paymentId = firestoreId(
      payment.id ?? `${orderId}-${payment.date || stats.paymentsWritten}`
    );

    if (!paymentId) continue;

    await db
      .collection(CONFIG.collections.payments)
      .doc(paymentId)
      .set(
        {
          ...payment,
          helloAssoOrderId: String(order.id ?? order.orderId ?? ""),
          source: "helloasso",
          syncedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    stats.paymentsWritten += 1;
  }

  const items = Array.isArray(order.items)
    ? order.items.filter(
        (item) => String(item?.type || "").trim().toLowerCase() === "membership"
      )
    : [];

  if (items.length === 0) {
    console.log(
      "Commande ignorée pour les adhérents : aucune adhésion Membership",
      order.id ?? order.orderId ?? ""
    );
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const adherent = buildAdherent(order, item, index);

    if (!adherent.nom && !adherent.prenom && !adherent.emailParent1) {
      stats.skipped += 1;
      continue;
    }

    const adherentId = firestoreId(adherent.numeroAdherent);
    const registrationId = firestoreId(
      `${adherent.numeroAdherent}-${season}`
    );

    await db
      .collection(CONFIG.collections.adherents)
      .doc(adherentId)
      .set(adherent, { merge: true });

    stats.adherentsWritten += 1;

    await db
      .collection(CONFIG.collections.inscriptions)
      .doc(registrationId)
      .set(buildRegistration(order, item, adherent), { merge: true });

    stats.registrationsWritten += 1;

    const pending = buildPendingUser(adherent);

    if (pending) {
      await db
        .collection(CONFIG.collections.pendingUsers)
        .doc(pending.email)
        .set(pending, { merge: true });

      stats.pendingUsersWritten += 1;
    }
  }
}

async function writeStatus(status, extra = {}) {
  await db
    .collection(CONFIG.collections.syncStatus)
    .doc("helloasso")
    .set(
      {
        status,
        mode,
        season,
        organizationSlug: process.env.HELLOASSO_ORGANIZATION_SLUG,
        finishedAt: FieldValue.serverTimestamp(),
        stats,
        ...extra
      },
      { merge: true }
    );
}

async function main() {
  try {
    console.log("Début synchronisation HelloAsso", { mode, season });

    await db
      .collection(CONFIG.collections.syncStatus)
      .doc("helloasso")
      .set(
        {
          status: "running",
          mode,
          season,
          startedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    const accessToken = await getAccessToken();
    console.log("Authentification HelloAsso réussie");

    const lastSyncAt = await getLastSuccessfulSync();

    if (lastSyncAt) {
      console.log(
        `Synchronisation incrémentale depuis ${lastSyncAt.toISOString()}`
      );
    } else {
      console.log("Synchronisation complète ou première exécution");
    }

    const orders = await fetchOrders(accessToken, lastSyncAt);
    stats.ordersRead = orders.length;

    for (const order of orders) {
      try {
        await writeOrder(order);
      } catch (error) {
        stats.errors += 1;
        console.error(
          "Erreur commande",
          order?.id ?? order?.orderId,
          safeMessage(error)
        );
      }
    }

    await writeStatus("success", {
      lastSuccessAt: FieldValue.serverTimestamp()
    });

    console.log("Synchronisation terminée", stats);

    if (stats.errors > 0) process.exitCode = 2;
  } catch (error) {
    stats.errors += 1;
    console.error("Synchronisation interrompue", safeMessage(error));

    await writeStatus("error", {
      errorMessage: safeMessage(error)
    }).catch((statusError) => {
      console.error(
        "Impossible d'enregistrer l'état d'erreur",
        safeMessage(statusError)
      );
    });

    process.exitCode = 1;
  }
}

await main();
