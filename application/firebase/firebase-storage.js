import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

import { storage, JDM_CONFIG } from "./firebase.js";

export async function uploadClubFile(path, file) {
    const fileRef = ref(storage, `${JDM_CONFIG.clubId}/${path}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
}

export async function deleteClubFile(path) {
    const fileRef = ref(storage, `${JDM_CONFIG.clubId}/${path}`);
    return deleteObject(fileRef);
}
