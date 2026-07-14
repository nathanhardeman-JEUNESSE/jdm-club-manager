import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db, JDM_CONFIG } from "./firebase.js";

export const JDM_RGPD_VERSION = "JDM-RGPD-2026-01";

function emailId(email) {
    return String(email || "").trim().toLowerCase();
}

export async function getUserProfile(uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

export async function createOrUpdateUser(uid, data) {
    const ref = doc(db, "users", uid);
    await setDoc(ref, {
        ...data,
        uid,
        clubId: data.clubId || JDM_CONFIG.clubId,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

export async function getPendingUserByEmail(email) {
    const id = emailId(email);
    if (!id) return null;
    const ref = doc(db, "pendingUsers", id);
    const snap = await getDoc(ref);
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

export async function deletePendingUser(email) {
    const id = emailId(email);
    if (!id) return;
    await deleteDoc(doc(db, "pendingUsers", id));
}

export async function ensureUserProfile(user) {
    if (!user) return null;

    const existing = await getUserProfile(user.uid);
    if (existing) {
        return { uid: user.uid, ...existing };
    }

    const email = emailId(user.email);
    const pending = await getPendingUserByEmail(email);

    if (!pending) {
        const error = new Error("Aucun accès préparé n'a été trouvé pour cette adresse email.");
        error.code = "jdm/no-pending-access";
        throw error;
    }

    if (pending.actif === false) {
        const error = new Error("Cet accès a été désactivé par le club.");
        error.code = "jdm/account-disabled";
        throw error;
    }

    const profile = {
        email,
        role: pending.role || JDM_CONFIG.roles.MEMBRE,
        actif: true,
        clubId: JDM_CONFIG.clubId,
        accesPages: pending.accesPages || {},
        numeroAdherent: pending.numeroAdherent || "",
        nom: pending.nom || "",
        prenom: pending.prenom || "",
        source: pending.source || "invitation",
        compteCreeAt: serverTimestamp(),
        derniereConnexionAt: serverTimestamp(),
        derniereActiviteAt: serverTimestamp(),
        consentementRGPD: false,
        consentementDate: null,
        versionConditions: null,
        signatureNom: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await createOrUpdateUser(user.uid, profile);
    await deletePendingUser(email);

    return { uid: user.uid, ...profile };
}

export async function enregistrerConsentementRGPD(uid, signatureNom) {
    const signature = String(signatureNom || "").trim();

    if (!uid) throw new Error("UID utilisateur manquant.");
    if (signature.length < 3) throw new Error("Le nom de signature est obligatoire.");

    await updateDoc(doc(db, "users", uid), {
        consentementRGPD: true,
        consentementDate: serverTimestamp(),
        versionConditions: JDM_RGPD_VERSION,
        signatureNom: signature,
        updatedAt: serverTimestamp()
    });
}

export async function listUsers() {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(item => ({ uid: item.id, ...item.data() }));
}

export async function listPendingUsers() {
    const snap = await getDocs(collection(db, "pendingUsers"));
    return snap.docs.map(item => ({ uid: item.id, ...item.data(), pending: true }));
}

export async function createPendingUser(data) {
    const id = emailId(data.email);
    if (!id) throw new Error("Email obligatoire.");

    await setDoc(doc(db, "pendingUsers", id), {
        ...data,
        email: id,
        clubId: data.clubId || JDM_CONFIG.clubId,
        actif: data.actif !== false,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
    }, { merge: true });
}

export async function updatePendingUser(uid, data) {
    await setDoc(doc(db, "pendingUsers", uid), {
        ...data,
        clubId: data.clubId || JDM_CONFIG.clubId,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

export async function updateUserRole(uid, role) {
    await updateDoc(doc(db, "users", uid), { role, updatedAt: serverTimestamp() });
}

export async function updateUserActif(uid, actif) {
    await updateDoc(doc(db, "users", uid), { actif, updatedAt: serverTimestamp() });
}

export async function updateUserAccesPages(uid, accesPages) {
    await updateDoc(doc(db, "users", uid), {
        accesPages: accesPages || {},
        updatedAt: serverTimestamp()
    });
}

export async function updateUserPresence(uid, online = true) {
    if (!uid) return;

    const data = {
        online,
        lastSeenAt: serverTimestamp(),
        derniereActiviteAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    if (online) {
        data.lastLoginAt = serverTimestamp();
        data.derniereConnexionAt = serverTimestamp();
    }

    await updateDoc(doc(db, "users", uid), data);
}

export async function updateUserLastSeen(uid) {
    if (!uid) return;

    await updateDoc(doc(db, "users", uid), {
        lastSeenAt: serverTimestamp(),
        derniereActiviteAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}

export async function initAppSettings() {
    const ref = doc(db, "settings", "application");
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();

    const settings = {
        clubId: JDM_CONFIG.clubId,
        clubNom: JDM_CONFIG.clubNom,
        superAdminEmail: JDM_CONFIG.superAdminEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await setDoc(ref, settings, { merge: true });
    return settings;
}

export async function findAdherentByEmail(email) {
    const cible = emailId(email);
    if (!cible) return null;

    const snap = await getDocs(collection(db, "adherents"));

    return snap.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .find(adherent => [
            adherent.email,
            adherent.emailAdherent,
            adherent.emailParent1,
            adherent.emailParent2
        ].map(emailId).includes(cible)) || null;
}


/* =========================================================
   GROUPES & PLANNING PARTAGES
   ========================================================= */

function identifiantDocument(valeur) {
    return String(valeur || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function listGroupesFirestore() {
    const snap = await getDocs(collection(db, "groupes"));
    return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function saveGroupesFirestore(groupes) {
    const liste = Array.isArray(groupes) ? groupes : [];

    await Promise.all(
        liste.map((groupe, index) => {
            const id = identifiantDocument(groupe.id || groupe.nom || `groupe-${index + 1}`);

            return setDoc(doc(db, "groupes", id), {
                ...groupe,
                id,
                clubId: groupe.clubId || JDM_CONFIG.clubId,
                updatedAt: serverTimestamp()
            }, { merge: true });
        })
    );
}

export async function listPlanningExceptionsFirestore() {
    const snap = await getDocs(collection(db, "planningExceptions"));
    return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function savePlanningExceptionFirestore(exception) {
    if (!exception || !exception.groupeId || !exception.date) {
        throw new Error("Exception de planning invalide.");
    }

    const id = identifiantDocument(`${exception.groupeId}_${exception.date}`);

    await setDoc(doc(db, "planningExceptions", id), {
        ...exception,
        id,
        clubId: exception.clubId || JDM_CONFIG.clubId,
        updatedAt: serverTimestamp()
    }, { merge: true });

    return id;
}
/* =========================================================
   ADHERENTS & INSCRIPTIONS
   ========================================================= */

export async function listAdherents() {
    const snap = await getDocs(collection(db, "adherents"));
    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

export async function listInscriptions() {
    const snap = await getDocs(collection(db, "inscriptions"));
    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}