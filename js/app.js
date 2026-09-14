import { auth, onAuthStateChanged, signOut } from "./auth.js";

const view = document.querySelector("#view");
const title = document.querySelector("#pageTitle");
const badge = document.querySelector("#userBadge");
const logout = document.querySelector("#logoutBtn");

const views = {
  dashboard: {
    title: "Dashboard",
    html: `<div class="grid kpis"><article class="card"><h3>Ventas</h3><div class="metric">$0.00</div><p class="muted">Este mes</p></article><article class="card"><h3>Cobrado</h3><div class="metric">$0.00</div><p class="muted">Pagos registrados</p></article><article class="card"><h3>Por cobrar</h3><div class="metric">$0.00</div><p class="muted">Saldo pendiente</p></article><article class="card"><h3>Proyectos</h3><div class="metric">0</div><p class="muted">En ejecución</p></article></div><h2 class="section-title">Cautiva Business V3</h2><article class="card"><h3>Base del sistema</h3><p class="muted">La nueva arquitectura está activa. Los módulos comerciales, financieros y operativos se incorporarán sobre Firebase.</p></article>`
  },
  presupuestos: { title: "Presupuestos", html: `<article class="card"><h3>Módulo de presupuestos</h3><p class="muted">Aquí construiremos el flujo de creación, edición, aprobación, PDF y seguimiento.</p></article>` },
  clientes: { title: "Clientes", html: `<article class="card"><h3>Clientes</h3><p class="muted">Directorio centralizado de clientes y empresas.</p></article>` },
  pagos: { title: "Pagos", html: `<article class="card"><h3>Pagos</h3><p class="muted">Registro de pagos, cuentas, referencias y comprobantes.</p></article>` },
  proyectos: { title: "Proyectos", html: `<article class="card"><h3>Proyectos</h3><p class="muted">Seguimiento de fases, responsables, fechas y avance.</p></article>` },
  configuracion: { title: "Configuración", html: `<article class="card"><h3>Configuración y seguridad</h3><p class="muted">Usuarios, roles, empresa, IVA, tasa BCV, cuentas y parámetros del sistema.</p></article>` }
};

function render(name) {
  const item = views[name] || views.dashboard;
  title.textContent = item.title;
  view.innerHTML = item.html;
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === name));
}

document.querySelectorAll(".nav-item").forEach(el => el.addEventListener("click", event => {
  event.preventDefault();
  const name = el.dataset.view;
  history.replaceState(null, "", `#${name}`);
  render(name);
}));

logout.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }
  badge.textContent = user.email || "Usuario";
  render(location.hash.slice(1) || "dashboard");
});
