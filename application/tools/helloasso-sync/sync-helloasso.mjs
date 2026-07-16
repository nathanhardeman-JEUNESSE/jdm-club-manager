import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  CONFIG,
  customField,
  firestoreId,
  normalize
} from "./mapping.mjs";

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
  credential: cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  )
});

const db = getFirestore();

const season =
  process.env.JDM_SEASON ||
  CONFIG.defaultSeason;

const mode =
  process.env.SYNC_MODE === "complete"
    ? "complete"
    : "incremental";

const REQUEST_TIMEOUT_MS = 30000;
const MAXIMUM_PAGES = 50;

const stats = {
  ordersRead: 0,
  ordersWritten: 0,
  paymentsWritten: 0,
  productsIgnored: 0,
  adherentsWritten: 0,
  registrationsWritten: 0,
  pendingUsersWritten: 0,
  skipped: 0,
  errors: 0
};

function safeMessage(error) {
  return error instanceof Error
    ? error.message
    : String(error);
}

function clean(value) {
  return String(value ?? "").trim();
}

function isMembership(item) {
  return normalize(item?.type) === "membership";
}

function totalPaidCents(item) {
  const payments = Array.isArray(item?.payments)
    ? item.payments
    : [];

  return payments.reduce(
    (total, payment) =>
      total +
      Number(
        payment?.shareAmount ??
        payment?.amount ??
        0
      ),
    0
  );
}

async function getAccessToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id:
      process.env.HELLOASSO_CLIENT_ID,
    client_secret:
      process.env.HELLOASSO_CLIENT_SECRET
  });

  const response = await fetch(
    `${CONFIG.apiBase}/oauth2/token`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type":
          "application/x-www-form-urlencoded"
      },
      body,
      signal:
        AbortSignal.timeout(
          REQUEST_TIMEOUT_MS
        )
    }
  );

  const data =
    await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    throw new Error(
      `OAuth HelloAsso refusé (${response.status}) : ` +
      JSON.stringify(data)
    );
  }

  return data.access_token;
}

async function apiGet(
  path,
  accessToken,
  query = {}
) {
  const url =
    new URL(`${CONFIG.apiBase}${path}`);

  for (const [key, value] of
    Object.entries(query)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(
        key,
        String(value)
      );
    }
  }

  console.log(
    `Appel HelloAsso : ` +
    `${url.pathname}${url.search}`
  );

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization:
        `Bearer ${accessToken}`
    },
    signal:
      AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      )
  });

  const data =
    await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `API HelloAsso refusée ` +
      `(${response.status}) : ` +
      JSON.stringify(data)
    );
  }

  return data;
}

async function getLastSuccessfulSync() {
  if (mode === "complete") {
    return null;
  }

  const snapshot = await db
    .collection(
      CONFIG.collections.syncStatus
    )
    .doc("helloasso")
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return (
    snapshot
      .data()
      ?.lastSuccessAt
      ?.toDate?.() ??
    null
  );
}

async function fetchOrders(
  accessToken,
  lastSyncAt
) {
  const organizationSlug =
    encodeURIComponent(
      process.env
        .HELLOASSO_ORGANIZATION_SLUG
    );

  const allOrders = [];

  let pageIndex = 1;
  let totalPages = 1;

  do {
    console.log(
      `Lecture HelloAsso : ` +
      `page ${pageIndex}/${totalPages}`
    );

    const result = await apiGet(
      `/v5/organizations/` +
      `${organizationSlug}/orders`,
      accessToken,
      {
        pageIndex,
        pageSize:
          CONFIG.pageSize || 100,
        sortOrder: "Desc",
        withDetails: true,
        from: lastSyncAt
          ? lastSyncAt.toISOString()
          : undefined
      }
    );

    const pageOrders =
      Array.isArray(result.data)
        ? result.data
        : [];

    const pagination =
      result.pagination || {};

    allOrders.push(...pageOrders);

    totalPages = Math.max(
      1,
      Number(
        pagination.totalPages ||
        pagination
          .totalNumberOfPages ||
        pagination.pageCount ||
        1
      )
    );

    console.log(
      `Page ${pageIndex} reçue : ` +
      `${pageOrders.length} commande(s)`
    );

    if (pageOrders.length === 0) {
      break;
    }

    pageIndex += 1;
  } while (
    pageIndex <= totalPages &&
    pageIndex <= MAXIMUM_PAGES
  );

  if (pageIndex > MAXIMUM_PAGES) {
    console.warn(
      `Arrêt de sécurité après ` +
      `${MAXIMUM_PAGES} pages.`
    );
  }

  console.log(
    `Total commandes récupérées : ` +
    `${allOrders.length}`
  );

  return allOrders;
}

function getPayer(order) {
  return (
    order.payer ||
    order.payerInfo ||
    order.user ||
    {}
  );
}

function fieldAnswer(fields, groups) {
  const list =
    Array.isArray(fields)
      ? fields
      : [];

  for (const words of groups) {
    const expected =
      words.map(normalize);

    const found = list.find(item => {
      const name =
        normalize(item?.name || "");

      return expected.every(word =>
        name.includes(word)
      );
    });

    const answer = found?.answer;

    if (
      answer !== undefined &&
      answer !== null &&
      clean(answer) !== ""
    ) {
      return answer;
    }
  }

  return "";
}

function buildAdherent(
  order,
  item,
  index
) {
  const payer = getPayer(order);
  const itemUser = item?.user || {};

  const fields =
    item?.customFields ||
    item?.fields ||
    item?.answers ||
    [];

  /*
   * Pour l'adhérent pratiquant :
   * HelloAsso item.user est prioritaire.
   * Le payeur ne sert qu'en dernier recours.
   */
  const nom =
    itemUser.lastName ||
    item?.lastName ||
    item?.lastname ||
    customField(
      fields,
      ["nom"],
      [
        "parent",
        "representant",
        "email",
        "urgence"
      ]
    ) ||
    payer.lastName ||
    "";

  const prenom =
    itemUser.firstName ||
    item?.firstName ||
    item?.firstname ||
    customField(
      fields,
      ["prenom"],
      [
        "parent",
        "representant",
        "email",
        "urgence"
      ]
    ) ||
    customField(
      fields,
      ["prénom"],
      [
        "parent",
        "representant",
        "email",
        "urgence"
      ]
    ) ||
    payer.firstName ||
    "";

  const email =
    item?.email ||
    itemUser.email ||
    customField(fields, ["email"]) ||
    payer.email ||
    "";

  const birthDate =
    item?.birthDate ||
    customField(
      fields,
      ["naissance"]
    ) ||
    "";

  const group =
    item?.name ||
    item?.tierName ||
    item?.title ||
    "";

  const telephone =
    fieldAnswer(fields, [
      [
        "numero",
        "telephone",
        "contact",
        "urgence"
      ],
      [
        "numero",
        "telephone",
        "appeler",
        "urgence"
      ],
      [
        "telephone",
        "contact",
        "urgence"
      ],
      [
        "telephone",
        "urgence"
      ]
    ]) ||
    payer.phone ||
    "";

  const parent1 =
    fieldAnswer(fields, [
      ["parent", "1"],
      ["representant", "legal"],
      ["representant"]
    ]);

  const parent2 =
    fieldAnswer(
      fields,
      [["parent", "2"]]
    );

  const emailParent2 =
    fieldAnswer(
      fields,
      [["email", "parent", "2"]]
    );

  const orderId =
    order.id ?? order.orderId;

  const itemId =
    item?.id ??
    `${orderId}-${index + 1}`;

  const numeroAdherent =
    `HA-${itemId}`;

  return {
    numeroAdherent,
    cle: [
      normalize(nom),
      normalize(prenom),
      normalize(birthDate)
    ].join("-"),
    nom: clean(nom),
    prenom: clean(prenom),
    dateNaissance:
      clean(birthDate),
    email: clean(email),
    emailParent1:
      clean(payer.email || email),
    emailParent2:
      clean(emailParent2),
    parent1: clean(parent1),
    parent2: clean(parent2),
    telephone: clean(telephone),
    telephoneUrgence:
      clean(telephone),
    groupe: clean(group),
    saison: season,
    actif: true,

    /*
     * La synchronisation ne valide jamais
     * elle-même une cotisation.
     */
    cotisationAJour: false,
    statutCotisationTresorier:
      "attente",

    source: "helloasso",
    helloAssoOrderId:
      String(orderId ?? ""),
    helloAssoItemId:
      String(itemId),
    updatedAt:
      FieldValue.serverTimestamp()
  };
}

function buildRegistration(
  order,
  item,
  adherent
) {
  const initialCents =
    item?.initialAmount ??
    item?.amount ??
    item?.price ??
    order?.amount?.total ??
    order?.amount ??
    0;

  const paidCents =
    totalPaidCents(item);

  return {
    saison: season,
    numeroAdherent:
      adherent.numeroAdherent,
    groupe:
      adherent.groupe,
    source: "helloasso",

    /*
     * Information HelloAsso seulement.
     * Ce statut ne vaut pas validation
     * du trésorier.
     */
    statutPaiementHelloAsso:
      paidCents > 0
        ? "payé"
        : "non payé en ligne",

    montant:
      Number(initialCents || 0) / 100,

    montantPayeHelloAsso:
      Number(paidCents || 0) / 100,

    cotisationAJour: false,
    statutCotisationTresorier:
      "attente",

    dateInscription:
      order.date ||
      order.creationDate ||
      new Date().toISOString(),

    helloAssoOrderId:
      adherent.helloAssoOrderId,

    helloAssoItemId:
      adherent.helloAssoItemId,

    donneesHelloAsso: item,

    updatedAt:
      FieldValue.serverTimestamp()
  };
}

function buildPendingUser(adherent) {
  const email =
    normalize(
      adherent.emailParent1 ||
      adherent.email
    );

  if (
    !email ||
    !email.includes("@")
  ) {
    return null;
  }

  return {
    email,
    nom: adherent.nom,
    prenom: adherent.prenom,
    role: "membre",
    actif: true,
    numeroAdherent:
      adherent.numeroAdherent,
    source: "helloasso",
    clubId: CONFIG.clubId,
    accesPages: {
      accueil: {
        lecture: true,
        ecriture: false
      },
      "espace-membre": {
        lecture: true,
        ecriture: false
      },
      "planning-membre": {
        lecture: true,
        ecriture: false
      },
      notifications: {
        lecture: true,
        ecriture: false
      },
      absence: {
        lecture: true,
        ecriture: true
      },
      boutique: {
        lecture: true,
        ecriture: false
      },
      panier: {
        lecture: true,
        ecriture: true
      },
      commande: {
        lecture: true,
        ecriture: true
      }
    },
    updatedAt:
      FieldValue.serverTimestamp()
  };
}

async function writeAdherent(
  adherentId,
  importedAdherent
) {
  const reference = db
    .collection(
      CONFIG.collections.adherents
    )
    .doc(adherentId);

  const snapshot =
    await reference.get();

  const current =
    snapshot.exists
      ? snapshot.data()
      : {};

  /*
   * Les validations du trésorier et les
   * corrections du membre sont conservées.
   */
  const finalAdherent = {
    ...importedAdherent,

    cotisationAJour:
      current.cotisationAJour === true,

    statutCotisationTresorier:
      current
        .statutCotisationTresorier ||
      "attente",

    profil:
      current.profil || {},

    champsModifiesParMembre:
      current
        .champsModifiesParMembre ||
      {},

    sourceHelloAsso: {
      nom:
        importedAdherent.nom,
      prenom:
        importedAdherent.prenom,
      dateNaissance:
        importedAdherent
          .dateNaissance,
      email:
        importedAdherent.email,
      emailParent1:
        importedAdherent
          .emailParent1,
      emailParent2:
        importedAdherent
          .emailParent2,
      parent1:
        importedAdherent.parent1,
      parent2:
        importedAdherent.parent2,
      telephone:
        importedAdherent.telephone,
      telephoneUrgence:
        importedAdherent
          .telephoneUrgence,
      groupe:
        importedAdherent.groupe,
      synchroniseAt:
        FieldValue.serverTimestamp()
    }
  };

  const protectedFields = [
    "nom",
    "prenom",
    "dateNaissance",
    "email",
    "emailParent1",
    "emailParent2",
    "parent1",
    "parent2",
    "telephone",
    "telephoneUrgence"
  ];

  for (const field of protectedFields) {
    if (
      current
        ?.champsModifiesParMembre
        ?.[field] === true
    ) {
      finalAdherent[field] =
        Object.prototype
          .hasOwnProperty.call(
            current.profil || {},
            field
          )
          ? current.profil[field]
          : current[field] ?? "";
    }
  }

  await reference.set(
    finalAdherent,
    { merge: true }
  );
}

async function writeRegistration(
  registrationId,
  importedRegistration
) {
  const reference = db
    .collection(
      CONFIG.collections.inscriptions
    )
    .doc(registrationId);

  const snapshot =
    await reference.get();

  const current =
    snapshot.exists
      ? snapshot.data()
      : {};

  await reference.set(
    {
      ...importedRegistration,

      /*
       * Une synchro complète ne remplace
       * jamais la validation du trésorier.
       */
      cotisationAJour:
        current.cotisationAJour === true,

      statutCotisationTresorier:
        current
          .statutCotisationTresorier ||
        "attente"
    },
    { merge: true }
  );
}

async function writeOrder(order) {
  const orderId = firestoreId(
    order.id ?? order.orderId
  );

  if (!orderId) {
    stats.skipped += 1;
    return;
  }

  await db
    .collection(
      CONFIG.collections.orders
    )
    .doc(orderId)
    .set(
      {
        ...order,
        source: "helloasso",
        organizationSlug:
          process.env
            .HELLOASSO_ORGANIZATION_SLUG,
        syncedAt:
          FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  stats.ordersWritten += 1;

  for (
    const payment of
    order.payments || []
  ) {
    const paymentId = firestoreId(
      payment.id ??
      `${orderId}-` +
      `${payment.date || stats.paymentsWritten}`
    );

    if (!paymentId) {
      continue;
    }

    await db
      .collection(
        CONFIG.collections.payments
      )
      .doc(paymentId)
      .set(
        {
          ...payment,
          helloAssoOrderId:
            String(
              order.id ??
              order.orderId ??
              ""
            ),
          source: "helloasso",
          syncedAt:
            FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    stats.paymentsWritten += 1;
  }

  const rawItems =
    Array.isArray(order.items)
      ? order.items
      : [];

  /*
   * Seules les adhésions créent des
   * adhérents et des inscriptions.
   * Product, Donation, Payment, etc.
   * restent dans les commandes/paiements.
   */
  const memberships =
    rawItems.filter(isMembership);

  stats.productsIgnored +=
    rawItems.length -
    memberships.length;

  if (memberships.length === 0) {
    return;
  }

  for (
    let index = 0;
    index < memberships.length;
    index += 1
  ) {
    const item =
      memberships[index];

    const adherent =
      buildAdherent(
        order,
        item,
        index
      );

    if (
      !adherent.nom &&
      !adherent.prenom &&
      !adherent.emailParent1
    ) {
      stats.skipped += 1;
      continue;
    }

    const adherentId =
      firestoreId(
        adherent.numeroAdherent
      );

    /*
     * L'item HelloAsso fait partie de l'ID :
     * une seconde licence reste une
     * inscription distincte.
     */
    const registrationId =
      firestoreId(
        `${adherent.numeroAdherent}-` +
        `${season}-` +
        `${adherent.helloAssoItemId}`
      );

    await writeAdherent(
      adherentId,
      adherent
    );

    stats.adherentsWritten += 1;

    await writeRegistration(
      registrationId,
      buildRegistration(
        order,
        item,
        adherent
      )
    );

    stats.registrationsWritten += 1;

    const pending =
      buildPendingUser(adherent);

    if (pending) {
      await db
        .collection(
          CONFIG.collections.pendingUsers
        )
        .doc(pending.email)
        .set(
          pending,
          { merge: true }
        );

      stats.pendingUsersWritten += 1;
    }
  }
}

async function writeStatus(
  status,
  extra = {}
) {
  await db
    .collection(
      CONFIG.collections.syncStatus
    )
    .doc("helloasso")
    .set(
      {
        status,
        mode,
        season,
        organizationSlug:
          process.env
            .HELLOASSO_ORGANIZATION_SLUG,
        finishedAt:
          FieldValue.serverTimestamp(),
        stats,
        ...extra
      },
      { merge: true }
    );
}

async function main() {
  try {
    console.log(
      "Début synchronisation HelloAsso",
      { mode, season }
    );

    await db
      .collection(
        CONFIG.collections.syncStatus
      )
      .doc("helloasso")
      .set(
        {
          status: "running",
          mode,
          season,
          startedAt:
            FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    const accessToken =
      await getAccessToken();

    console.log(
      "Authentification HelloAsso réussie"
    );

    const lastSyncAt =
      await getLastSuccessfulSync();

    if (lastSyncAt) {
      console.log(
        `Synchronisation incrémentale ` +
        `depuis ` +
        `${lastSyncAt.toISOString()}`
      );
    } else {
      console.log(
        "Synchronisation complète " +
        "ou première exécution"
      );
    }

    const orders =
      await fetchOrders(
        accessToken,
        lastSyncAt
      );

    stats.ordersRead =
      orders.length;

    for (const order of orders) {
      try {
        await writeOrder(order);
      } catch (error) {
        stats.errors += 1;

        console.error(
          "Erreur commande",
          order?.id ??
          order?.orderId,
          safeMessage(error)
        );
      }
    }

    await writeStatus(
      "success",
      {
        lastSuccessAt:
          FieldValue.serverTimestamp()
      }
    );

    console.log(
      "Synchronisation terminée",
      stats
    );

    if (stats.errors > 0) {
      process.exitCode = 2;
    }
  } catch (error) {
    stats.errors += 1;

    console.error(
      "Synchronisation interrompue",
      safeMessage(error)
    );

    await writeStatus(
      "error",
      {
        errorMessage:
          safeMessage(error)
      }
    ).catch(statusError => {
      console.error(
        "Impossible d'enregistrer " +
        "l'état d'erreur",
        safeMessage(statusError)
      );
    });

    process.exitCode = 1;
  }
}

await main();
