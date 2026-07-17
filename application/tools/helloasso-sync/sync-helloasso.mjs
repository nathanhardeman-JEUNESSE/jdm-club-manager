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
  donationsWritten: 0,
  productsIgnored: 0,
  uniqueAdherentsWritten: 0,
  duplicateMembershipsMerged: 0,
  skipped: 0,
  errors: 0
};

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const adherentIdsWritten = new Set();

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return String(hash >>> 0).padStart(10, "0");
}

function normalizeDate(value) {
  return normalize(value).replace(/[^0-9]/g, "");
}

function buildIdentityKey({ nom, prenom, birthDate, email, telephone }) {
  const namePart = `${normalize(nom)}|${normalize(prenom)}`;
  const birthPart = normalizeDate(birthDate);

  if (birthPart) return `${namePart}|birth:${birthPart}`;

  const emailPart = normalize(email);
  if (emailPart) return `${namePart}|email:${emailPart}`;

  const phonePart = String(telephone || "").replace(/\D/g, "");
  if (phonePart) return `${namePart}|phone:${phonePart}`;

  return `${namePart}|unknown`;
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

function fieldAnswer(fields, groups) {
  const liste = Array.isArray(fields) ? fields : [];

  for (const mots of groups) {
    const termes = mots.map(normalize);
    const trouve = liste.find(item => {
      const nom = normalize(item?.name || "");
      return termes.every(terme => nom.includes(terme));
    });

    const valeur = trouve?.answer;
    if (valeur !== undefined && valeur !== null && String(valeur).trim() !== "") {
      return valeur;
    }
  }

  return "";
}

function buildAdherent(order, item, index) {
  const payer = getPayer(order);
  const itemUser = item?.user || {};
  const fields = item?.customFields || item?.fields || item?.answers || [];

  const nom =
    item?.lastName ||
    item?.lastname ||
    itemUser?.lastName ||
    customField(fields, ["nom"]) ||
    payer.lastName ||
    "";

  const prenom =
    item?.firstName ||
    item?.firstname ||
    itemUser?.firstName ||
    customField(fields, ["prenom"]) ||
    customField(fields, ["prénom"]) ||
    payer.firstName ||
    "";

  const email =
    item?.email ||
    itemUser?.email ||
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
    fieldAnswer(fields, [
      ["numero", "telephone", "contact", "urgence"],
      ["numero", "telephone", "appeler", "urgence"],
      ["telephone", "contact", "urgence"],
      ["telephone", "urgence"]
    ]) ||
    payer.phone ||
    "";

  const parent1 = fieldAnswer(fields, [
    ["parent", "1"],
    ["representant", "legal"],
    ["representant"]
  ]);

  const parent2 = fieldAnswer(fields, [["parent", "2"]]);
  const emailParent2 = fieldAnswer(fields, [["email", "parent", "2"]]);

  const orderId = order.id ?? order.orderId;
  const itemId = item?.id ?? `${orderId}-${index + 1}`;
  const cleIdentite = buildIdentityKey({
    nom,
    prenom,
    birthDate,
    email: email || payer.email,
    telephone
  });
  const numeroAdherent = `HA-${stableHash(cleIdentite)}`;

  return {
    numeroAdherent,
    cle: cleIdentite,
    cleIdentite,
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
    groupes: group ? FieldValue.arrayUnion(group) : [],
    saison: season,
    actif: true,
    cotisationAJour: false,
    statutCotisationTresorier: "attente",
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
    groupe: item?.name || item?.tierName || item?.title || item?.priceCategory || "",
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

function buildPendingUser(adherent, emailCible) {
  const email = normalize(emailCible);

  if (!email || !email.includes("@")) return null;

  return {
    email,
    nom: adherent.nom,
    prenom: adherent.prenom,
    role: "membre",
    actif: true,
    numeroAdherent: adherent.numeroAdherent,
    numerosAdherents: FieldValue.arrayUnion(adherent.numeroAdherent),
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

  const allItems = Array.isArray(order.items) ? order.items : [];

  const membershipItems = allItems.filter((item) =>
    String(item?.type || "").trim().toLowerCase() === "membership"
  );

  const donationItems = allItems.filter((item) =>
    String(item?.type || "").trim().toLowerCase() === "donation"
  );

  const productItems = allItems.filter((item) =>
    String(item?.type || "").trim().toLowerCase() === "product"
  );

  stats.productsIgnored += productItems.length;

  for (let index = 0; index < donationItems.length; index += 1) {
    const item = donationItems[index];
    const donationId = firestoreId(item?.id ?? `${orderId}-donation-${index + 1}`);

    if (!donationId) {
      stats.skipped += 1;
      continue;
    }

    const payer = getPayer(order);
    const cents = item?.amount ?? item?.price ?? order?.amount?.total ?? order?.amount ?? 0;

    await db
      .collection(CONFIG.collections.donations)
      .doc(donationId)
      .set(
        {
          helloAssoDonationId: String(item?.id ?? donationId),
          helloAssoOrderId: String(order.id ?? order.orderId ?? ""),
          nom: payer.lastName || "",
          prenom: payer.firstName || "",
          email: payer.email || "",
          montant: Number(cents || 0) / 100,
          montantPaye: Number(cents || 0) / 100,
          montantCentimes: Number(cents || 0),
          date: order.date || order.creationDate || new Date().toISOString(),
          dateDon: order.date || order.creationDate || new Date().toISOString(),
          source: "helloasso",
          donneesHelloAsso: item,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    stats.donationsWritten += 1;
  }

  if (membershipItems.length === 0) {
    console.log(
      "Commande sans adhésion Membership : aucun adhérent créé",
      order.id ?? order.orderId ?? ""
    );
  }

  for (let index = 0; index < membershipItems.length; index += 1) {
    const item = membershipItems[index];
    const adherent = buildAdherent(order, item, index);

    if (!adherent.nom && !adherent.prenom && !adherent.emailParent1) {
      stats.skipped += 1;
      continue;
    }

    const adherentId = firestoreId(adherent.numeroAdherent);
    const itemId = firestoreId(item?.id ?? `${orderId}-${index + 1}`);
    const registrationId = firestoreId(
      `${adherent.numeroAdherent}-${itemId}-${season}`
    );

    await db
      .collection(CONFIG.collections.adherents)
      .doc(adherentId)
      .set(adherent, { merge: true });

    stats.adherentsWritten += 1;
    if (adherentIdsWritten.has(adherentId)) {
      stats.duplicateMembershipsMerged += 1;
    } else {
      adherentIdsWritten.add(adherentId);
      stats.uniqueAdherentsWritten += 1;
    }

    await db
      .collection(CONFIG.collections.inscriptions)
      .doc(registrationId)
      .set(buildRegistration(order, item, adherent), { merge: true });

    stats.registrationsWritten += 1;

    const emailsAcces = [...new Set([
      adherent.email,
      adherent.emailParent1,
      adherent.emailParent2
    ].map(normalize).filter(email => email && email.includes("@")))];

    for (const emailAcces of emailsAcces) {
      const pending = buildPendingUser(adherent, emailAcces);
      if (!pending) continue;

      const pendingRef = db
        .collection(CONFIG.collections.pendingUsers)
        .doc(pending.email);

      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(pendingRef);
        const existant = snapshot.exists ? snapshot.data() : {};

        transaction.set(pendingRef, {
          ...pending,
          numeroAdherent:
            existant.numeroAdherent || pending.numeroAdherent,
          nom: existant.nom || pending.nom,
          prenom: existant.prenom || pending.prenom
        }, { merge: true });
      });

      const usersSnapshot = await db
        .collection("users")
        .where("email", "==", pending.email)
        .get();

      for (const userDoc of usersSnapshot.docs) {
        await userDoc.ref.set({
          numeroAdherent:
            userDoc.data()?.numeroAdherent || pending.numeroAdherent,
          numerosAdherents: FieldValue.arrayUnion(adherent.numeroAdherent),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

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
