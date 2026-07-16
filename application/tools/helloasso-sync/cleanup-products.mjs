import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { CONFIG } from "./mapping.mjs";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("Secret GitHub manquant : FIREBASE_SERVICE_ACCOUNT");
}

initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

const db = getFirestore();
const cleanupMode = process.env.CLEANUP_MODE === "delete" ? "delete" : "audit";

function isProduct(data) {
  return String(data?.donneesHelloAsso?.type || "")
    .trim()
    .toLowerCase() === "product";
}

async function main() {
  console.log(`Mode nettoyage : ${cleanupMode}`);

  const registrations = await db
    .collection(CONFIG.collections.inscriptions)
    .get();

  const productDocs = registrations.docs.filter((docSnap) =>
    isProduct(docSnap.data())
  );

  const adherentNumbers = [
    ...new Set(
      productDocs
        .map((docSnap) => docSnap.data()?.numeroAdherent)
        .filter(Boolean)
    )
  ];

  console.log(`Inscriptions Product detectees : ${productDocs.length}`);
  console.log(`Adherents concernes : ${adherentNumbers.length}`);

  for (const docSnap of productDocs) {
    const data = docSnap.data();
    console.log({
      inscriptionId: docSnap.id,
      numeroAdherent: data.numeroAdherent,
      article: data?.donneesHelloAsso?.name,
      type: data?.donneesHelloAsso?.type
    });
  }

  if (cleanupMode !== "delete") {
    console.log("AUDIT uniquement : aucune suppression.");
    return;
  }

  for (const productDoc of productDocs) {
    await productDoc.ref.delete();
  }

  for (const numeroAdherent of adherentNumbers) {
    const remaining = await db
      .collection(CONFIG.collections.inscriptions)
      .where("numeroAdherent", "==", numeroAdherent)
      .get();

    const hasMembership = remaining.docs.some((docSnap) =>
      String(docSnap.data()?.donneesHelloAsso?.type || "")
        .trim()
        .toLowerCase() === "membership"
    );

    if (!hasMembership) {
      const adherents = await db
        .collection(CONFIG.collections.adherents)
        .where("numeroAdherent", "==", numeroAdherent)
        .get();

      for (const adherentDoc of adherents.docs) {
        await adherentDoc.ref.delete();
      }
    }
  }

  console.log("Nettoyage termine.");
}

await main();
