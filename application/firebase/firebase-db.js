import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    query,
    where,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db, JDM_CONFIG } from "./firebase.js";

export const JDM_RGPD_VERSION = "JDM-RGPD-2026-01";

function emailId(email) {
    return String(email || "").trim().toLowerCase();
}

function listeNumerosAdherents(...sources) {
    return [...new Set(
        sources
            .flatMap(source => Array.isArray(source) ? source : [source])
            .map(value => String(value || "").trim())
            .filter(Boolean)
    )];
}

function accesMembreParDefaut() {
    const acces = {};

    [
        "accueil",
        "espace-membre",
        "planning-membre",
        "mon-club",
        "actualites",
        "contact",
        "notifications",
        "boutique",
        "boutique-accessoires",
        "boutique-ephemere",
        "confirmation-commande",
        "fiche-adherent-complete",
        "carte-adherent"
    ].forEach(page => {
        acces[page] = { lecture: true, ecriture: false };
    });

    ["absence", "panier", "commande", "paiement"].forEach(page => {
        acces[page] = { lecture: true, ecriture: true };
    });

    return acces;
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

    const email = emailId(user.email);
    const [existing, pending] = await Promise.all([
        getUserProfile(user.uid),
        getPendingUserByEmail(email)
    ]);

    if (existing) {
        const numerosAdherents = listeNumerosAdherents(
            existing.numerosAdherents,
            existing.numeroAdherent,
            pending?.numerosAdherents,
            pending?.numeroAdherent
        );

        const numeroAdherent =
            existing.numeroAdherent || numerosAdherents[0] || "";

        const modifications = {
            numerosAdherents,
            numeroAdherent,
            updatedAt: serverTimestamp()
        };

        if (pending) {
            await createOrUpdateUser(user.uid, modifications);
            await deletePendingUser(email);
        } else if (
            !Array.isArray(existing.numerosAdherents) ||
            existing.numerosAdherents.length !== numerosAdherents.length
        ) {
            await createOrUpdateUser(user.uid, modifications);
        }

        return {
            uid: user.uid,
            ...existing,
            ...modifications
        };
    }

    if (pending && pending.actif === false) {
        const error = new Error("Cet accès a été désactivé par le club.");
        error.code = "jdm/account-disabled";
        throw error;
    }

    let profile;

    if (pending) {
        const numerosAdherents = listeNumerosAdherents(
            pending.numerosAdherents,
            pending.numeroAdherent
        );

        profile = {
            email,
            role: pending.role || JDM_CONFIG.roles.MEMBRE,
            roles: Array.isArray(pending.roles)
                ? pending.roles
                : [pending.role || JDM_CONFIG.roles.MEMBRE],
            actif: true,
            clubId: JDM_CONFIG.clubId,
            accesPages: pending.accesPages || {},
            numeroAdherent: pending.numeroAdherent || numerosAdherents[0] || "",
            numerosAdherents,
            adherentIds: Array.isArray(pending.adherentIds) ? pending.adherentIds : [],
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
    } else {
        const adherentsCorrespondants = await findAdherentsByEmail(email);

        if (!adherentsCorrespondants.length) {
            const error = new Error(
                "Aucune adhésion ni aucun accès préparé n'a été trouvé pour cette adresse email."
            );
            error.code = "jdm/no-member-access";
            throw error;
        }

        const adherentIds = adherentsCorrespondants
            .map(adherent => String(adherent.id || "").trim())
            .filter(Boolean)
            .slice(0, 6);

        const adherentsRetenus = adherentsCorrespondants
            .filter(adherent => adherentIds.includes(String(adherent.id)))
            .slice(0, 6);

        const numerosAdherents = listeNumerosAdherents(
            adherentsRetenus.map(adherent => adherent.numeroAdherent || adherent.id)
        );

        const adherentPrincipal = adherentsRetenus[0];

        profile = {
            email,
            role: JDM_CONFIG.roles.MEMBRE,
            roles: [JDM_CONFIG.roles.MEMBRE],
            actif: true,
            clubId: JDM_CONFIG.clubId,
            accesPages: accesMembreParDefaut(),
            numeroAdherent: numerosAdherents[0] || "",
            numerosAdherents,
            adherentIds,
            nom: adherentPrincipal?.nom || "",
            prenom: adherentPrincipal?.prenom || "",
            source: "adherent",
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
    }

    await createOrUpdateUser(user.uid, profile);

    if (pending) {
        await deletePendingUser(email);
    }

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


export async function findAdherentsByEmail(email) {
    const emailBrut = String(email || "").trim();
    const cible = emailId(emailBrut);
    if (!cible) return [];

    const valeurs = [...new Set([emailBrut, cible].filter(Boolean))];
    const champs = [
        "email",
        "emailAdherent",
        "emailParent1",
        "emailParent2",
        "emailPayeur"
    ];

    const resultats = await Promise.all(
        champs.flatMap(champ =>
            valeurs.map(valeur =>
                getDocs(
                    query(
                        collection(db, "adherents"),
                        where(champ, "==", valeur)
                    )
                )
            )
        )
    );

    const adherents = new Map();

    resultats.forEach(snap => {
        snap.docs.forEach(item => {
            adherents.set(item.id, { id: item.id, ...item.data() });
        });
    });

    return [...adherents.values()];
}

export async function getAdherentsByNumbers(numeros) {
    const cibles = new Set(
        listeNumerosAdherents(numeros).map(String)
    );

    if (cibles.size === 0) return [];

    const snap = await getDocs(collection(db, "adherents"));

    return snap.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .filter(adherent =>
            cibles.has(String(adherent.numeroAdherent || adherent.id))
        );
}

export async function updateMemberProfile(adherentId, modifications) {
    if (!adherentId) throw new Error("Identifiant adhérent manquant.");

    const champs = Object.keys(modifications || {});
    const champsModifiesParMembre = Object.fromEntries(
        champs.map(champ => [champ, true])
    );

    await setDoc(doc(db, "adherents", String(adherentId)), {
        profil: modifications || {},
        champsModifiesParMembre,
        updatedAt: serverTimestamp()
    }, { merge: true });
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
/* =========================================================
   NOTIFICATIONS
   ========================================================= */

export async function updateNotificationPreferences(uid, preferences) {
    if (!uid) throw new Error("UID utilisateur manquant.");

    await setDoc(doc(db, "users", String(uid)), {
        preferencesNotifications: {
            mode: preferences?.mode || "sonore",
            debutSilence: preferences?.debutSilence || "22:00",
            finSilence: preferences?.finSilence || "07:00"
        },
        updatedAt: serverTimestamp()
    }, { merge: true });
}

export async function listNotificationsFirestore() {
    const snap = await getDocs(collection(db, "notifications"));

    return snap.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}

export async function saveNotificationFirestore(notification) {
    if (!notification) {
        throw new Error("Notification invalide.");
    }

    const id = identifiantDocument(
        notification.id ||
        `${notification.type || "notification"}_${Date.now()}`
    );

    await setDoc(doc(db, "notifications", id), {
        ...notification,
        id,
        clubId: notification.clubId || JDM_CONFIG.clubId,
        updatedAt: serverTimestamp(),
        createdAt: notification.createdAt || serverTimestamp()
    }, { merge: true });

    return id;
}

export async function updateNotificationFirestore(id, modifications) {
    if (!id) {
        throw new Error("ID notification manquant.");
    }

    await updateDoc(doc(db, "notifications", String(id)), {
        ...modifications,
        updatedAt: serverTimestamp()
    });
}

export async function deleteNotificationFirestore(id) {
    if (!id) return;

    await deleteDoc(
        doc(db, "notifications", String(id))
    );
}


/* =========================================================
   ABSENCES
   ========================================================= */

export async function listAbsencesFirestore() {
    const snap = await getDocs(collection(db, "absences"));

    return snap.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}

export async function saveAbsenceFirestore(absence) {
    if (!absence) {
        throw new Error("Absence invalide.");
    }

    const id = identifiantDocument(
        absence.id ||
        `${absence.numeroAdherent || "adherent"}_${absence.date || Date.now()}`
    );

    await setDoc(doc(db, "absences", id), {
        ...absence,
        id,
        clubId: absence.clubId || JDM_CONFIG.clubId,
        updatedAt: serverTimestamp(),
        createdAt: absence.createdAt || serverTimestamp()
    }, { merge: true });

    return id;
}

export async function updateAbsenceFirestore(id, modifications) {
    if (!id) {
        throw new Error("ID absence manquant.");
    }

    await updateDoc(doc(db, "absences", String(id)), {
        ...modifications,
        updatedAt: serverTimestamp()
    });
}

export async function deleteAbsenceFirestore(id) {
    if (!id) return;

    await deleteDoc(
        doc(db, "absences", String(id))
    );
}

/* =========================================================
   TRESORERIE & COTISATIONS
   ========================================================= */

function idTresorerie(numeroAdherent) {
    return String(numeroAdherent || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function listTresorerieCotisations() {
    const snap = await getDocs(
        collection(db, "tresorerieCotisations")
    );

    return snap.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}

export async function saveTresorerieCotisation(
    numeroAdherent,
    data
) {
    const id = idTresorerie(numeroAdherent);

    if (!id) {
        throw new Error("Numéro adhérent obligatoire.");
    }

    await setDoc(
        doc(db, "tresorerieCotisations", id),
        {
            ...data,
            numeroAdherent: String(numeroAdherent),
            clubId: data.clubId || JDM_CONFIG.clubId,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

    return id;
}

export async function updateCotisationStatus(
    numeroAdherent,
    statut
) {
    const numero = String(numeroAdherent || "").trim();

    if (!numero) {
        throw new Error("Numéro adhérent obligatoire.");
    }

    const cotisationAJour = statut === "regle";

    const adherentsSnap = await getDocs(
        query(
            collection(db, "adherents"),
            where("numeroAdherent", "==", numero)
        )
    );

    const inscriptionsSnap = await getDocs(
        query(
            collection(db, "inscriptions"),
            where("numeroAdherent", "==", numero)
        )
    );

    const batch = writeBatch(db);

    adherentsSnap.docs.forEach(item => {
        batch.update(item.ref, {
            cotisationAJour,
            statutCotisationTresorier: statut,
            updatedAt: serverTimestamp()
        });
    });

    inscriptionsSnap.docs.forEach(item => {
        batch.update(item.ref, {
            cotisationAJour,
            statutCotisationTresorier: statut,
            updatedAt: serverTimestamp()
        });
    });

    await batch.commit();
}


/* =========================================================
   DONS HELLOASSO
   ========================================================= */

export async function listHelloAssoDonations() {
    const snap = await getDocs(
        collection(
            db,
            "helloassoDonations"
        )
    );

    return snap.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}

export async function updateHelloAssoDonation(
    donationId,
    data
) {
    if (!donationId) {
        throw new Error(
            "Identifiant du don obligatoire."
        );
    }

    await setDoc(
        doc(
            db,
            "helloassoDonations",
            String(donationId)
        ),
        {
            ...data,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );
}

/* =========================================================
   APPELS & PRESENCES
   ========================================================= */

export async function listAppelsFirestore() {
    const snap = await getDocs(collection(db, "appels"));
    return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function saveAppelsSeanceFirestore({ groupe, seance, pointages, auteur }) {
    if (!groupe?.id || !seance?.dateISO || !Array.isArray(pointages)) {
        throw new Error("Données d'appel incomplètes.");
    }

    const batch = writeBatch(db);

    pointages.forEach(pointage => {
        const numero = String(pointage.numeroAdherent || pointage.adherentId || "").trim();
        if (!numero) return;

        const id = identifiantDocument(`${groupe.id}_${seance.dateISO}_${numero}`);
        const ref = doc(db, "appels", id);

        batch.set(ref, {
            id,
            numeroAdherent: numero,
            adherentId: String(pointage.adherentId || numero),
            nom: pointage.nom || "",
            prenom: pointage.prenom || "",
            groupeId: String(groupe.id),
            groupeNom: groupe.nom || "",
            date: seance.dateISO,
            jour: seance.jourCle || "",
            jourNom: seance.jourNom || "",
            horaire: seance.horaire || "",
            statut: pointage.statut === "absent" ? "absent" : "present",
            absenceSignalee: pointage.absenceSignalee === true,
            auteurUid: auteur?.uid || "",
            auteurNom: auteur?.nom || "",
            auteurEmail: auteur?.email || "",
            clubId: JDM_CONFIG.clubId,
            updatedAt: serverTimestamp(),
            createdAt: pointage.createdAt || serverTimestamp()
        }, { merge: true });
    });

    await batch.commit();
}
