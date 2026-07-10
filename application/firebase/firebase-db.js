import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db, JDM_CONFIG } from "./firebase.js";

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
    await setDoc(ref, { ...data, clubId: data.clubId || JDM_CONFIG.clubId, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getPendingUserByEmail(email) {
    const id = emailId(email);
    if (!id) return null;

    const ref = doc(db, "pendingUsers", id);
    const snap = await getDoc(ref);

    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

export async function ensureUserProfile(user) {
    if (!user) return null;
    const existing = await getUserProfile(user.uid);
    if (existing) return existing;

    const email = emailId(user.email);
    const pending = await getPendingUserByEmail(email);

    const role = pending && pending.role
        ? pending.role
        : email === JDM_CONFIG.superAdminEmail.toLowerCase()
            ? JDM_CONFIG.roles.SUPER_ADMIN
            : JDM_CONFIG.roles.MEMBRE;

    const profile = {
        email: user.email,
        role,
        actif: pending ? pending.actif !== false : true,
        clubId: JDM_CONFIG.clubId,
        accesPages: pending ? pending.accesPages || {} : {},
        numeroAdherent: pending ? pending.numeroAdherent || "" : "",
        nom: pending ? pending.nom || "" : "",
        prenom: pending ? pending.prenom || "" : "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await createOrUpdateUser(user.uid, profile);
    return profile;
}

export async function listUsers() {
    const ref = collection(db, "users");
    const snap = await getDocs(ref);
    return snap.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() }));
}


export async function listPendingUsers() {
    const ref = collection(db, "pendingUsers");
    const snap = await getDocs(ref);

    return snap.docs.map(docSnap => ({
        uid: docSnap.id,
        ...docSnap.data(),
        pending: true
    }));
}

export async function createPendingUser(data) {
    const id = emailId(data.email);
    if (!id) throw new Error("Email obligatoire.");

    const ref = doc(db, "pendingUsers", id);

    await setDoc(ref, {
        ...data,
        email: id,
        clubId: data.clubId || JDM_CONFIG.clubId,
        actif: data.actif !== false,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
    }, { merge: true });
}

export async function updatePendingUser(uid, data) {
    const ref = doc(db, "pendingUsers", uid);

    await setDoc(ref, {
        ...data,
        clubId: data.clubId || JDM_CONFIG.clubId,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

export async function updateUserRole(uid, role) {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, { role, updatedAt: serverTimestamp() });
}

export async function updateUserActif(uid, actif) {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, { actif, updatedAt: serverTimestamp() });
}

export async function updateUserAccesPages(uid, accesPages) {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, { accesPages: accesPages || {}, updatedAt: serverTimestamp() });
}


export async function updateUserPresence(uid, online = true) {
    if (!uid) return;

    const ref = doc(db, "users", uid);
    const data = {
        online,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    if (online) {
        data.lastLoginAt = serverTimestamp();
    }

    await updateDoc(ref, data);
}

export async function updateUserLastSeen(uid) {
    if (!uid) return;

    const ref = doc(db, "users", uid);

    await updateDoc(ref, {
        lastSeenAt: serverTimestamp(),
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
    const cible = String(email || "").trim().toLowerCase();
    if (!cible) return null;

    const ref = collection(db, "adherents");
    const snap = await getDocs(ref);

    const match = snap.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .find(adherent => {
            const emails = [
                adherent.email,
                adherent.emailAdherent,
                adherent.emailParent1,
                adherent.emailParent2
            ].map(value => String(value || "").trim().toLowerCase());

            return emails.includes(cible);
        });

    return match || null;
}
