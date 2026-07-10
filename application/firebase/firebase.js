import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

export const firebaseConfig = {
    apiKey: "AIzaSyCnNsURrMjQDNLhVrkfdYWzIb7GXrgEYAU",
    authDomain: "jdm-club-manager.firebaseapp.com",
    projectId: "jdm-club-manager",
    storageBucket: "jdm-club-manager.firebasestorage.app",
    messagingSenderId: "445787818689",
    appId: "1:445787818689:web:d583ee8d48faf3516d2240",
    measurementId: "G-B8XRGS0MR1"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

setPersistence(auth, browserLocalPersistence);

export const JDM_CONFIG = {
    clubId: "jdm-lomme",
    clubNom: "Jeunesse du Marais de Lomme",
    superAdminEmail: "nathan.hardeman@gmail.com",
    roles: {
        SUPER_ADMIN: "super_admin",
        ADMIN: "admin",
        COACH: "coach",
        MEMBRE: "membre"
    }
};
