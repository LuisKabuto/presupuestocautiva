import { db } from "./auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export async function ensureUserProfile(user) {
  if (!user) return null;

  const ref = doc(db, "usuarios", user.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    return snapshot.data();
  }

  const profile = {
    uid: user.uid,
    email: user.email || "",
    nombre: user.displayName || "",
    rol: "admin",
    activo: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(ref, profile);
  return profile;
}
