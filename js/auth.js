import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { onAuthStateChanged, signOut };
