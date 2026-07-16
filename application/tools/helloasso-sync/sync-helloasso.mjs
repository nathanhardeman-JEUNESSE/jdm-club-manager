import { createHash } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { CONFIG, customField, firestoreId, normalize } from "./mapping.mjs";

for (const name of ["HELLOASSO_CLIENT_ID","HELLOASSO_CLIENT_SECRET","HELLOASSO_ORGANIZATION_SLUG","FIREBASE_SERVICE_ACCOUNT"]) {
  if (!process.env[name]) throw new Error(`Secret GitHub manquant : ${name}`);
}

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const season = process.env.JDM_SEASON || CONFIG.defaultSeason;
const mode = process.env.SYNC_MODE === "complete" ? "complete" : "incremental";
const FAMILIES = CONFIG.collections?.families || "families";
const TIMEOUT = 30000;
const MAX_PAGES = 50;

const stats = {
  ordersRead: 0, ordersWritten: 0, paymentsWritten: 0,
  adherentsWritten: 0, registrationsWritten: 0,
  pendingUsersWritten: 0, familiesWritten: 0,
  productsIgnored: 0, membershipsMerged: 0, skipped: 0, errors: 0
};

const clean = (v) => String(v ?? "").trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const safeMessage = (e) => e instanceof Error ? e.message : String(e);

function compactName(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "").slice(0, 12).toUpperCase();
}

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 6).toUpperCase();
}

function readableNumber(prenom, identityKey) {
  return `HA-${compactName(prenom) || "MEMBRE"}-${shortHash(identityKey)}`;
}

async function getAccessToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.HELLOASSO_CLIENT_ID,
    client_secret: process.env.HELLOASSO_CLIENT_SECRET
  });

  const response = await fetch(`${CONFIG.apiBase}/oauth2/token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(TIMEOUT)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(`OAuth HelloAsso refuse (${response.status}) : ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function apiGet(path, token, query = {}) {
  const url = new URL(`${CONFIG.apiBase}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`API HelloAsso refusee (${response.status}) : ${JSON.stringify(data)}`);
  return data;
}

async function getLastSuccessfulSync() {
  if (mode === "complete") return null;
  const snapshot = await db.collection(CONFIG.collections.syncStatus).doc("helloasso").get();
  return snapshot.exists ? snapshot.data()?.lastSuccessAt?.toDate?.() ?? null : null;
}

async function fetchOrders(token, lastSyncAt) {
  const slug = encodeURIComponent(process.env.HELLOASSO_ORGANIZATION_SLUG);
  const orders = [];
  let pageIndex = 1;
  let totalPages = 1;

  do {
    const result = await apiGet(`/v5/organizations/${slug}/orders`, token, {
      pageIndex, pageSize: CONFIG.pageSize || 100, sortOrder: "Desc",
      withDetails: true, from: lastSyncAt ? lastSyncAt.toISOString() : undefined
    });

    const pageOrders = Array.isArray(result.data) ? result.data : [];
    const pagination = result.pagination || {};
    orders.push(...pageOrders);
    totalPages = Math.max(1, Number(
      pagination.totalPages || pagination.totalNumberOfPages ||
      pagination.pageCount || 1
    ));
    if (pageOrders.length === 0) break;
    pageIndex += 1;
  } while (pageIndex <= totalPages && pageIndex <= MAX_PAGES);

  return orders;
}

function getPayer(order) {
  return order.payer || order.payerInfo || order.user || {};
}

function splitFullName(value) {
  const parts = clean(value).split(/\s+/).filter(Boolean);
  return parts.length < 2
    ? { nom: parts[0] || "", prenom: "" }
    : { nom: parts[0], prenom: parts.slice(1).join(" ") };
}

function normalizeIdentity(nomValue, prenomValue) {
  const nom = clean(nomValue);
  const prenom = clean(prenomValue);
  if (nom && prenom && normalize(nom) === normalize(prenom)) return splitFullName(nom);
  if (!nom && prenom) return splitFullName(prenom);
  if (nom && !prenom) return splitFullName(nom);
  return { nom, prenom };
}

function isMembership(item) {
  return normalize(item?.type) === "membership";
}

function buildCandidate(order, item, index) {
  const payer = getPayer(order);
  const user = item?.user || {};
  const fields = item?.customFields || item?.fields || item?.answers || [];

  const identity = normalizeIdentity(
    user.lastName || item?.lastName || item?.lastname || payer.lastName ||
      customField(fields, ["nom"], ["parent","representant","email","urgence"]) || "",
    user.firstName || item?.firstName || item?.firstname || payer.firstName ||
      customField(fields, ["prenom"], ["parent","representant","email","urgence"]) ||
      customField(fields, ["prénom"], ["parent","representant","email","urgence"]) || ""
  );

  const email = item?.email || customField(fields, ["email"]) || payer.email || "";
  const birthDate = item?.birthDate || customField(fields, ["naissance"]) || "";
  const telephone =
    customField(fields, ["telephone","contact","urgence"]) ||
    customField(fields, ["telephone","appeler","urgence"]) ||
    customField(fields, ["numero","telephone"]) || payer.phone || "";

  const orderId = String(order.id ?? order.orderId ?? "");
  const itemId = String(item?.id ?? `${orderId}-${index + 1}`);
  const strictKey = [normalize(identity.nom), normalize(identity.prenom), normalize(birthDate)].join("-");
  const fallbackKey = [normalize(identity.nom), normalize(identity.prenom), normalize(email)].join("-");

  return {
    order, item, orderId, itemId,
    nom: identity.nom, prenom: identity.prenom,
    email, birthDate, telephone,
    parent1: customField(fields, ["parent","1"], ["email"]) ||
      customField(fields, ["representant","legal"], ["email"]) || "",
    parent2: customField(fields, ["parent","2"], ["email"]) || "",
    emailParent2: customField(fields, ["email","parent","2"]) || "",
    group: item?.name || item?.tierName || item?.title || "",
    identityKey: birthDate ? strictKey : fallbackKey
  };
}

async function findExistingAdherent(candidate) {
  const ref = db.collection(CONFIG.collections.adherents);

  if (candidate.identityKey) {
    const byIdentity = await ref.where("identityKey", "==", candidate.identityKey).limit(1).get();
    if (!byIdentity.empty) return byIdentity.docs[0];
  }

  if (candidate.birthDate) {
    const legacyKey = [normalize(candidate.nom), normalize(candidate.prenom), normalize(candidate.birthDate)].join("-");
    const byLegacy = await ref.where("cle", "==", legacyKey).limit(1).get();
    if (!byLegacy.empty) return byLegacy.docs[0];
  }

  if (candidate.email) {
    const byEmail = await ref.where("email", "==", candidate.email).get();
    const exact = byEmail.docs.find((docSnap) => {
      const d = docSnap.data();
      return normalize(d.nom) === normalize(candidate.nom) &&
        normalize(d.prenom) === normalize(candidate.prenom);
    });
    if (exact) return exact;
  }

  return null;
}

async function upsertAdherent(candidate) {
  const existing = await findExistingAdherent(candidate);
  const current = existing?.data() || {};
  const numeroAdherent = current.numeroAdherent || `HA-${candidate.itemId}`;
  const numeroMembre = current.numeroMembre || readableNumber(candidate.prenom, candidate.identityKey);

  const groupes = unique([
    ...(Array.isArray(current.groupes) ? current.groupes : []),
    current.groupe, candidate.group
  ]).filter((value) => normalize(value) !== "fixed");

  const helloAssoItemIds = unique([
    ...(Array.isArray(current.helloAssoItemIds) ? current.helloAssoItemIds : []),
    current.helloAssoItemId, candidate.itemId
  ]);

  const previousSource = current.sourceHelloAsso || {};
  const profil = current.profil || {};
  const modified = current.champsModifiesParMembre || {};

  const sourceHelloAsso = {
    nom: candidate.nom || previousSource.nom || current.nom || "",
    prenom: candidate.prenom || previousSource.prenom || current.prenom || "",
    dateNaissance:
      candidate.birthDate ||
      previousSource.dateNaissance ||
      current.dateNaissance ||
      "",
    email: candidate.email || previousSource.email || current.email || "",
    emailParent1:
      candidate.email ||
      previousSource.emailParent1 ||
      current.emailParent1 ||
      current.email ||
      "",
    emailParent2:
      candidate.emailParent2 ||
      previousSource.emailParent2 ||
      current.emailParent2 ||
      "",
    parent1:
      candidate.parent1 ||
      previousSource.parent1 ||
      current.parent1 ||
      "",
    parent2:
      candidate.parent2 ||
      previousSource.parent2 ||
      current.parent2 ||
      "",
    telephone:
      candidate.telephone ||
      previousSource.telephone ||
      current.telephone ||
      "",
    telephoneUrgence:
      candidate.telephone ||
      previousSource.telephoneUrgence ||
      current.telephoneUrgence ||
      current.telephone ||
      "",
    groupe:
      candidate.group ||
      previousSource.groupe ||
      current.groupe ||
      "",
    groupes,
    helloAssoOrderId: candidate.orderId,
    helloAssoItemId: candidate.itemId,
    helloAssoItemIds,
    synchroniseAt: FieldValue.serverTimestamp()
  };

  function effectiveValue(field) {
    if (modified[field] === true) {
      return Object.prototype.hasOwnProperty.call(profil, field)
        ? profil[field]
        : current[field] ?? "";
    }

    return sourceHelloAsso[field] ?? current[field] ?? "";
  }

  const adherent = {
    numeroAdherent,
    numeroMembre,
    identityKey: candidate.identityKey,
    cle: [
      normalize(effectiveValue("nom")),
      normalize(effectiveValue("prenom")),
      normalize(effectiveValue("dateNaissance"))
    ].join("-"),

    nom: effectiveValue("nom"),
    prenom: effectiveValue("prenom"),
    dateNaissance: effectiveValue("dateNaissance"),
    email: effectiveValue("email"),
    emailParent1: effectiveValue("emailParent1"),
    emailParent2: effectiveValue("emailParent2"),
    parent1: effectiveValue("parent1"),
    parent2: effectiveValue("parent2"),
    telephone: effectiveValue("telephone"),
    telephoneUrgence: effectiveValue("telephoneUrgence"),

    groupe: groupes[0] || sourceHelloAsso.groupe || current.groupe || "",
    groupes,

    sourceHelloAsso,
    profil,
    champsModifiesParMembre: modified,

    saison: season,
    actif: true,
    cotisationAJour: true,
    source: "helloasso",
    helloAssoOrderId: candidate.orderId,
    helloAssoItemId: candidate.itemId,
    helloAssoItemIds,
    updatedAt: FieldValue.serverTimestamp()
  };

  const adherentId = existing ? existing.id : firestoreId(numeroAdherent);
  await db.collection(CONFIG.collections.adherents).doc(adherentId).set(adherent, { merge: true });

  if (existing) stats.membershipsMerged += 1;
  stats.adherentsWritten += 1;
  return adherent;
}

async function upsertRegistration(candidate, adherent) {
  const item = candidate.item;
  const order = candidate.order;
  const cents = item?.amount ?? item?.price ?? order?.amount?.total ?? order?.amount ?? 0;
  const registrationId = firestoreId(`${adherent.numeroAdherent}-${season}-${candidate.itemId}`);

  await db.collection(CONFIG.collections.inscriptions).doc(registrationId).set({
    saison: season,
    numeroAdherent: adherent.numeroAdherent,
    numeroMembre: adherent.numeroMembre,
    groupe: candidate.group,
    source: "helloasso",
    statutPaiement: "payé",
    cotisationAJour: true,
    montant: Number(cents || 0) / 100,
    dateInscription: order.date || order.creationDate || new Date().toISOString(),
    helloAssoOrderId: candidate.orderId,
    helloAssoItemId: candidate.itemId,
    donneesHelloAsso: item,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  stats.registrationsWritten += 1;
}

async function upsertFamily(adherent) {
  const email = normalize(adherent.emailParent1 || adherent.email);
  if (!email || !email.includes("@")) return;

  const familyId = firestoreId(email);
  const familyRef = db.collection(FAMILIES).doc(familyId);
  const snap = await familyRef.get();
  const existing = Array.isArray(snap.data()?.membres) ? snap.data().membres : [];

  const member = {
    numeroAdherent: adherent.numeroAdherent,
    numeroMembre: adherent.numeroMembre,
    nom: adherent.nom,
    prenom: adherent.prenom,
    groupes: adherent.groupes || []
  };

  const membres = [
    ...existing.filter((m) => String(m.numeroAdherent) !== String(adherent.numeroAdherent)),
    member
  ].sort((a,b) => String(a.prenom || "").localeCompare(String(b.prenom || ""), "fr"));

  const numeroAdherents = unique(membres.map((m) => m.numeroAdherent));

  await familyRef.set({
    email, clubId: CONFIG.clubId, numeroAdherents, membres,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  stats.familiesWritten += 1;

  await db.collection(CONFIG.collections.pendingUsers).doc(email).set({
    email, nom: adherent.nom, prenom: adherent.prenom,
    role: "membre", actif: true,
    numeroAdherent: numeroAdherents[0] || adherent.numeroAdherent,
    numeroAdherents, membres, familyId,
    source: "helloasso", clubId: CONFIG.clubId,
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
  }, { merge: true });

  stats.pendingUsersWritten += 1;
}

async function writeOrder(order) {
  const orderId = firestoreId(order.id ?? order.orderId);
  if (!orderId) { stats.skipped += 1; return; }

  await db.collection(CONFIG.collections.orders).doc(orderId).set({
    ...order, source: "helloasso",
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

  const rawItems = Array.isArray(order.items) ? order.items : [];
  const memberships = rawItems.filter(isMembership);
  stats.productsIgnored += rawItems.length - memberships.length;

  for (let index = 0; index < memberships.length; index += 1) {
    const candidate = buildCandidate(order, memberships[index], index);
    if (!candidate.nom && !candidate.prenom && !candidate.email) {
      stats.skipped += 1;
      continue;
    }
    const adherent = await upsertAdherent(candidate);
    await upsertRegistration(candidate, adherent);
    await upsertFamily(adherent);
  }
}

async function writeStatus(status, extra = {}) {
  await db.collection(CONFIG.collections.syncStatus).doc("helloasso").set({
    status, mode, season,
    organizationSlug: process.env.HELLOASSO_ORGANIZATION_SLUG,
    finishedAt: FieldValue.serverTimestamp(),
    stats, ...extra
  }, { merge: true });
}

async function main() {
  try {
    await db.collection(CONFIG.collections.syncStatus).doc("helloasso").set({
      status: "running", mode, season, startedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    const token = await getAccessToken();
    const lastSyncAt = await getLastSuccessfulSync();
    const orders = await fetchOrders(token, lastSyncAt);
    stats.ordersRead = orders.length;

    for (const order of orders) {
      try { await writeOrder(order); }
      catch (error) {
        stats.errors += 1;
        console.error("Erreur commande", order?.id ?? order?.orderId, safeMessage(error));
      }
    }

    await writeStatus("success", { lastSuccessAt: FieldValue.serverTimestamp() });
    console.log("Synchronisation terminee", stats);
    if (stats.errors > 0) process.exitCode = 2;
  } catch (error) {
    stats.errors += 1;
    console.error("Synchronisation interrompue", safeMessage(error));
    await writeStatus("error", { errorMessage: safeMessage(error) }).catch(() => {});
    process.exitCode = 1;
  }
}

await main();
