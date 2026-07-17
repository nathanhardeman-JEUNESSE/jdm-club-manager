import crypto from "node:crypto";
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
  if (!process.env[name]) throw new Error(`Secret GitHub manquant : ${name}`);
}

initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

const db = getFirestore();
const season = process.env.JDM_SEASON || CONFIG.defaultSeason;
const mode = process.env.SYNC_MODE === "complete" ? "complete" : "incremental";
const REQUEST_TIMEOUT_MS = 30000;
const MAXIMUM_PAGES = 50;

const collections = {
  orders: CONFIG.collections.orders,
  payments: CONFIG.collections.payments,
  adherents: CONFIG.collections.adherents,
  inscriptions: CONFIG.collections.inscriptions,
  pendingUsers: CONFIG.collections.pendingUsers,
  syncStatus: CONFIG.collections.syncStatus,
  donations: CONFIG.collections.donations || "helloassoDonations"
};

const stats = {
  ordersRead: 0,
  ordersWritten: 0,
  paymentsWritten: 0,
  adherentsWritten: 0,
  registrationsWritten: 0,
  pendingUsersWritten: 0,
  donationsWritten: 0,
  membershipItemsRead: 0,
  uniquePeople: 0,
  duplicateMembershipItemsMerged: 0,
  productsIgnored: 0,
  unknownItemsIgnored: 0,
  skipped: 0,
  errors: 0
};

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function stableHash(value, length = 20) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, length);
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
    throw new Error(`OAuth HelloAsso refusé (${response.status}) : ${JSON.stringify(data)}`);
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
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`API HelloAsso refusée (${response.status}) : ${JSON.stringify(data)}`);
  }
  return data;
}

async function getLastSuccessfulSync() {
  if (mode === "complete") return null;
  const snapshot = await db.collection(collections.syncStatus).doc("helloasso").get();
  return snapshot.exists ? snapshot.data()?.lastSuccessAt?.toDate?.() ?? null : null;
}

async function fetchOrders(accessToken, lastSyncAt) {
  const organizationSlug = encodeURIComponent(process.env.HELLOASSO_ORGANIZATION_SLUG);
  const allOrders = [];
  let pageIndex = 1;
  let totalPages = 1;

  do {
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
    totalPages = Math.max(1, Number(
      pagination.totalPages ||
      pagination.totalNumberOfPages ||
      pagination.pageCount ||
      1
    ));

    if (pageOrders.length === 0) break;
    pageIndex += 1;
  } while (pageIndex <= totalPages && pageIndex <= MAXIMUM_PAGES);

  return allOrders;
}

function getPayer(order) {
  return order.payer || order.payerInfo || order.user || {};
}

function fieldAnswer(fields, groups) {
  const list = Array.isArray(fields) ? fields : [];
  for (const words of groups) {
    const terms = words.map(normalize);
    const found = list.find(item => {
      const name = normalize(item?.name || "");
      return terms.every(term => name.includes(term));
    });
    const value = found?.answer;
    if (value !== undefined && value !== null && clean(value) !== "") return value;
  }
  return "";
}

function itemKind(order, item) {
  const raw = clean(
    item?.type ||
    item?.itemType ||
    item?.category ||
    item?.kind ||
    order?.formType ||
    order?.type ||
    ""
  ).toLowerCase();

  if (["membership", "registration", "adhesion", "adhésion"].some(token => raw.includes(token))) {
    return "membership";
  }
  if (["donation", "don"].some(token => raw === token || raw.includes(token))) {
    return "donation";
  }
  if (["product", "produit", "shop"].some(token => raw.includes(token))) {
    return "product";
  }
  return "unknown";
}

function extractPerson(order, item, index) {
  const payer = getPayer(order);
  const itemUser = item?.user || {};
  const fields = item?.customFields || item?.fields || item?.answers || [];

  const nom = clean(
    item?.lastName || item?.lastname || itemUser?.lastName ||
    customField(fields, ["nom"]) || payer.lastName
  );
  const prenom = clean(
    item?.firstName || item?.firstname || itemUser?.firstName ||
    customField(fields, ["prenom"]) || customField(fields, ["prénom"]) || payer.firstName
  );
  const email = normalizeEmail(
    item?.email || itemUser?.email || customField(fields, ["email"]) || payer.email
  );
  const birthDate = clean(item?.birthDate || customField(fields, ["naissance"]));
  const group = clean(item?.name || item?.tierName || item?.title || item?.priceCategory);
  const telephone = clean(
    fieldAnswer(fields, [
      ["numero", "telephone", "contact", "urgence"],
      ["numero", "telephone", "appeler", "urgence"],
      ["telephone", "contact", "urgence"],
      ["telephone", "urgence"]
    ]) || payer.phone
  );
  const parent1 = clean(fieldAnswer(fields, [["parent", "1"], ["representant", "legal"], ["representant"]]));
  const parent2 = clean(fieldAnswer(fields, [["parent", "2"]]));
  const emailParent2 = normalizeEmail(fieldAnswer(fields, [["email", "parent", "2"]]));
  const orderId = clean(order.id ?? order.orderId);
  const itemId = clean(item?.id ?? `${orderId}-${index + 1}`);

  const nameKey = [normalize(nom), normalize(prenom)].filter(Boolean).join("|");
  const identityKey = birthDate
    ? `${nameKey}|birth:${normalize(birthDate)}`
    : email
      ? `${nameKey}|email:${email}`
      : telephone
        ? `${nameKey}|phone:${normalize(telephone)}`
        : `${nameKey}|item:${itemId}`;

  return {
    identityKey,
    personId: `HA-P-${stableHash(identityKey)}`,
    nom,
    prenom,
    dateNaissance: birthDate,
    email,
    emailParent1: normalizeEmail(payer.email || email),
    emailParent2,
    parent1,
    parent2,
    telephone,
    telephoneUrgence: telephone,
    groupe: group,
    saison: season,
    actif: true,
    source: "helloasso",
    helloAssoOrderId: orderId,
    helloAssoItemId: itemId,
    updatedAt: FieldValue.serverTimestamp()
  };
}

function completenessScore(person) {
  return [
    person.nom,
    person.prenom,
    person.dateNaissance,
    person.email,
    person.emailParent1,
    person.telephone,
    person.parent1,
    person.parent2
  ].filter(value => clean(value)).length;
}

function mergePerson(existing, incoming) {
  if (!existing) {
    return {
      ...incoming,
      groupes: incoming.groupe ? [incoming.groupe] : [],
      helloAssoItemIds: incoming.helloAssoItemId ? [incoming.helloAssoItemId] : [],
      helloAssoOrderIds: incoming.helloAssoOrderId ? [incoming.helloAssoOrderId] : []
    };
  }

  const primary = completenessScore(incoming) > completenessScore(existing) ? incoming : existing;
  const secondary = primary === incoming ? existing : incoming;
  const merged = { ...secondary, ...primary };

  for (const key of [
    "nom", "prenom", "dateNaissance", "email", "emailParent1", "emailParent2",
    "parent1", "parent2", "telephone", "telephoneUrgence"
  ]) {
    merged[key] = clean(primary[key]) || clean(secondary[key]);
  }

  merged.groupes = [...new Set([
    ...(existing.groupes || []),
    existing.groupe,
    incoming.groupe
  ].filter(Boolean))];
  merged.groupe = merged.groupes[0] || "";
  merged.helloAssoItemIds = [...new Set([
    ...(existing.helloAssoItemIds || []),
    incoming.helloAssoItemId
  ].filter(Boolean))];
  merged.helloAssoOrderIds = [...new Set([
    ...(existing.helloAssoOrderIds || []),
    incoming.helloAssoOrderId
  ].filter(Boolean))];
  return merged;
}

function buildRegistration(order, item, person) {
  const cents = item?.amount ?? item?.price ?? order?.amount?.total ?? order?.amount ?? 0;
  return {
    saison: season,
    numeroAdherent: person.personId,
    source: "helloasso",
    statutPaiement: "payé",
    montant: Number(cents || 0) / 100,
    dateInscription: order.date || order.creationDate || new Date().toISOString(),
    groupe: person.groupe,
    helloAssoOrderId: person.helloAssoOrderId,
    helloAssoItemId: person.helloAssoItemId,
    donneesHelloAsso: item,
    updatedAt: FieldValue.serverTimestamp()
  };
}

function buildPendingUser(person) {
  const email = normalizeEmail(person.emailParent1 || person.email);
  if (!email || !email.includes("@")) return null;
  return {
    email,
    nom: person.nom,
    prenom: person.prenom,
    role: "membre",
    actif: true,
    numeroAdherent: person.personId,
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

function buildDonation(order, item, index) {
  const payer = getPayer(order);
  const orderId = clean(order.id ?? order.orderId);
  const itemId = clean(item?.id ?? `${orderId}-don-${index + 1}`);
  const cents = item?.amount ?? item?.price ?? order?.amount?.total ?? order?.amount ?? 0;
  return {
    source: "helloasso",
    helloAssoOrderId: orderId,
    helloAssoItemId: itemId,
    nom: clean(payer.lastName),
    prenom: clean(payer.firstName),
    email: normalizeEmail(payer.email),
    montant: Number(cents || 0) / 100,
    date: order.date || order.creationDate || new Date().toISOString(),
    saison: season,
    donneesHelloAsso: item,
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function archiveOrder(order) {
  const orderId = firestoreId(order.id ?? order.orderId);
  if (!orderId) {
    stats.skipped += 1;
    return;
  }

  await db.collection(collections.orders).doc(orderId).set({
    ...order,
    source: "helloasso",
    organizationSlug: process.env.HELLOASSO_ORGANIZATION_SLUG,
    syncedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  stats.ordersWritten += 1;

  for (const payment of order.payments || []) {
    const paymentId = firestoreId(payment.id ?? `${orderId}-${payment.date || stats.paymentsWritten}`);
    if (!paymentId) continue;
    await db.collection(collections.payments).doc(paymentId).set({
      ...payment,
      helloAssoOrderId: clean(order.id ?? order.orderId),
      source: "helloasso",
      syncedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    stats.paymentsWritten += 1;
  }
}

async function processOrders(orders) {
  const people = new Map();
  const registrations = [];
  const donations = [];

  for (const order of orders) {
    await archiveOrder(order);
    const items = Array.isArray(order.items) ? order.items : [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const kind = itemKind(order, item);

      if (kind === "donation") {
        donations.push(buildDonation(order, item, index));
        continue;
      }
      if (kind === "product") {
        stats.productsIgnored += 1;
        continue;
      }
      if (kind !== "membership") {
        stats.unknownItemsIgnored += 1;
        continue;
      }

      stats.membershipItemsRead += 1;
      const person = extractPerson(order, item, index);
      if (!person.nom && !person.prenom && !person.emailParent1) {
        stats.skipped += 1;
        continue;
      }

      const previous = people.get(person.identityKey);
      if (previous) stats.duplicateMembershipItemsMerged += 1;
      people.set(person.identityKey, mergePerson(previous, person));
      registrations.push({ order, item, person });
    }
  }

  stats.uniquePeople = people.size;

  for (const person of people.values()) {
    await db.collection(collections.adherents).doc(firestoreId(person.personId)).set({
      numeroAdherent: person.personId,
      cle: person.identityKey,
      nom: person.nom,
      prenom: person.prenom,
      dateNaissance: person.dateNaissance,
      email: person.email,
      emailParent1: person.emailParent1,
      emailParent2: person.emailParent2,
      parent1: person.parent1,
      parent2: person.parent2,
      telephone: person.telephone,
      telephoneUrgence: person.telephoneUrgence,
      groupe: person.groupe,
      groupes: person.groupes,
      saison: season,
      actif: true,
      source: "helloasso",
      helloAssoOrderIds: person.helloAssoOrderIds,
      helloAssoItemIds: person.helloAssoItemIds,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    stats.adherentsWritten += 1;

    const pending = buildPendingUser(person);
    if (pending) {
      await db.collection(collections.pendingUsers).doc(firestoreId(pending.email)).set(pending, { merge: true });
      stats.pendingUsersWritten += 1;
    }
  }

  for (const entry of registrations) {
    const canonical = people.get(entry.person.identityKey);
    const registrationId = firestoreId(`${canonical.personId}-${entry.person.helloAssoItemId}-${season}`);
    await db.collection(collections.inscriptions).doc(registrationId).set(
      buildRegistration(entry.order, entry.item, { ...entry.person, personId: canonical.personId }),
      { merge: true }
    );
    stats.registrationsWritten += 1;
  }

  for (const donation of donations) {
    const donationId = firestoreId(`HA-DON-${donation.helloAssoItemId}`);
    await db.collection(collections.donations).doc(donationId).set(donation, { merge: true });
    stats.donationsWritten += 1;
  }
}

async function writeStatus(status, extra = {}) {
  await db.collection(collections.syncStatus).doc("helloasso").set({
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
    await db.collection(collections.syncStatus).doc("helloasso").set({
      status: "running",
      mode,
      season,
      startedAt: FieldValue.serverTimestamp(),
      stats
    }, { merge: true });

    const accessToken = await getAccessToken();
    const lastSyncAt = await getLastSuccessfulSync();
    const orders = await fetchOrders(accessToken, lastSyncAt);
    stats.ordersRead = orders.length;

    await processOrders(orders);

    await writeStatus("success", {
      lastSuccessAt: FieldValue.serverTimestamp()
    });

    console.log("Synchronisation terminée", stats);
    if (stats.errors > 0) process.exitCode = 2;
  } catch (error) {
    stats.errors += 1;
    console.error("Synchronisation interrompue", safeMessage(error));
    await writeStatus("error", { errorMessage: safeMessage(error) }).catch(() => {});
    process.exitCode = 1;
  }
}

await main();
