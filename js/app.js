import { auth, onAuthStateChanged, signOut } from "./auth.js";
import { ensureUserProfile } from "./usuarios.js";
import { getDashboardStats, dashboardHTML } from "./dashboard.js";
import { renderClientes } from "./clientes.js";

const view = document.querySelector("#view");
const title = document.querySelector("#pageTitle");
const badge = document.querySelector("#userBadge");
const logout = document.querySelector("#logoutBtn");

const views = {
  dashboard: { title: "Dashboard" },
  presupuestos: { title: "Presupuestos", html: `<article class="card"><h3>Módulo de presupuestos</h3><p class="muted">Aquí construiremos el flujo de creación, edición, aprobación, PDF y seguimiento.</p></article>` },
  clientes: { title: "Clientes" },
  pagos: { title: "Pagos", html: `<article class="card"><h3>Pagos</h3><p class="muted">Registro de pagos, cuentas, referencias y comprobantes.</p></article>` },
  proyectos: { title: "Proyectos", html: `<article class="card"><h3>Proyectos</h3><p class="muted">Seguimiento de fases, responsables, fechas y avance.</p></article>` },
  configuracion: { title: "Configuración", html: `<article class="card"><h3>Configuración y seguridad</h3><p class="muted">Usuarios, roles, empresa, IVA, tasa BCV, cuentas y parámetros del sistema.</p></article>` }
};

async function render(name) {
  const item = views[name] || views.dashboard;
  title.textContent = item.title;
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === name));

  if (name === "dashboard") {
    view.innerHTML = `<article class="card loading-card"><p class="muted">Consultando información...</p></article>`;
    try {
      const stats = await getDashboardStats();
      view.innerHTML = dashboardHTML(stats);
    } catch (error) {
      console.error("Error cargando Dashboard:", error);
      view.innerHTML = `<article class="card"><h3>No se pudo cargar el Dashboard</h3><p class="muted">La sesión está activa, pero Firestore no respondió correctamente. Revisa las reglas y la configuración de la base de datos.</p></article>`;
    }
    return;
  }

  if (name === "clientes") {
    await renderClientes(view);
    return;
  }

  view.innerHTML = item.html;
}

document.querySelectorAll(".nav-item").forEach(el => el.addEventListener("click", event => {
  event.preventDefault();
  const name = el.dataset.view;
  history.replaceState(null, "", `#${name}`);
  render(name);
}));

logout.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  try {
    const profile = await ensureUserProfile(user);
    badge.textContent = profile?.rol ? `${user.email} · ${profile.rol}` : (user.email || "Usuario");
    await render(location.hash.slice(1) || "dashboard");
  } catch (error) {
    console.error("Error inicializando Cautiva Business:", error);
    view.innerHTML = `<article class="card"><h3>No se pudo inicializar el sistema</h3><p class="muted">La autenticación funciona, pero no se pudo leer el perfil en Firestore.</p></article>`;
  }
});
