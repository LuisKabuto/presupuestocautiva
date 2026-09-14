import { auth } from "./auth.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const form = document.querySelector("#loginForm");
const error = document.querySelector("#loginError");

onAuthStateChanged(auth, user => {
  if (user) window.location.replace("index.html");
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  error.textContent = "";
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error(err);
    error.textContent = "No fue posible iniciar sesión. Verifica tus datos.";
  }
});
