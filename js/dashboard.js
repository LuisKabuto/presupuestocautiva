import { db } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const COLLECTIONS = ["presupuestos", "clientes", "pagos", "proyectos"];

export async function getDashboardStats() {
  const results = await Promise.all(
    COLLECTIONS.map(async name => {
      const snapshot = await getDocs(collection(db, name));
      return [name, snapshot.size];
    })
  );

  return Object.fromEntries(results);
}

export function dashboardHTML(stats) {
  return `
    <div class="grid kpis">
      <article class="card stat-card"><h3>Presupuestos</h3><div class="metric">${stats.presupuestos}</div><p class="muted">Registrados</p></article>
      <article class="card stat-card"><h3>Clientes</h3><div class="metric">${stats.clientes}</div><p class="muted">Directorio</p></article>
      <article class="card stat-card"><h3>Pagos</h3><div class="metric">${stats.pagos}</div><p class="muted">Movimientos registrados</p></article>
      <article class="card stat-card"><h3>Proyectos</h3><div class="metric">${stats.proyectos}</div><p class="muted">En el sistema</p></article>
    </div>
    <div class="dashboard-grid">
      <article class="card">
        <div class="card-heading"><div><span class="eyebrow">CENTRO DE CONTROL</span><h2>Resumen operativo</h2></div><span class="live-dot">Firebase conectado</span></div>
        <p class="muted">Los indicadores se leen directamente desde Cloud Firestore. A medida que incorporemos información real, este panel mostrará ventas, cobros, saldos y proyectos.</p>
      </article>
      <article class="card">
        <span class="eyebrow">PRÓXIMAMENTE</span>
        <h2>Indicadores financieros</h2>
        <p class="muted">Ventas en USD · Cobrado · Por cobrar · Flujo mensual · Presupuestos por estado.</p>
      </article>
    </div>`;
}
