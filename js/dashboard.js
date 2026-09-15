import { db } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const money = v => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
const bs = v => Number(v || 0).toLocaleString("es-VE", { minimumFractionDigits:2, maximumFractionDigits:2 });
const esc = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

function dateValue(v) {
  if (!v) return 0;
  if (v?.toDate) return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function monthKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function monthLabel(key) {
  const [y,m] = key.split("-").map(Number);
  return new Date(y,m-1,1).toLocaleDateString("es-VE", { month:"short" }).replace(".","");
}

async function readCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
}

export async function getDashboardStats() {
  const [presupuestos, clientes, pagos, proyectos] = await Promise.all([
    readCollection("presupuestos"),
    readCollection("clientes"),
    readCollection("pagos"),
    readCollection("proyectos")
  ]);

  const validQuotes = presupuestos.filter(q => q.estado !== "ANULADA" && q.estado !== "RECHAZADA");
  const approved = presupuestos.filter(q => q.estado === "APROBADA");
  const verifiedPayments = pagos.filter(p => p.estado === "VERIFICADO");
  const ventasUSD = validQuotes.reduce((s,q) => s + Number(q.totalUSD || 0), 0);
  const aprobadoUSD = approved.reduce((s,q) => s + Number(q.totalUSD || 0), 0);
  const cobradoUSD = verifiedPayments.reduce((s,p) => s + Number(p.montoUSD || 0), 0);
  const cobradoBs = verifiedPayments.reduce((s,p) => s + Number(p.montoBs || 0), 0);
  const porCobrarUSD = validQuotes.reduce((s,q) => s + Number(q.saldoUSD ?? ((q.estado === "APROBADA") ? q.totalUSD : 0) ?? 0), 0);
  const pendientes = presupuestos.filter(q => q.estado === "APROBADA" && Number(q.saldoUSD ?? q.totalUSD ?? 0) > 0.005).length;
  const solicitudesPendientes = (await readCollection("solicitudes_pago")).filter(p => p.estado === "PENDIENTE").length;

  const months = [];
  const now = new Date();
  for (let i=5;i>=0;i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push(monthKey(d));
  }
  const monthly = Object.fromEntries(months.map(m => [m, { ventas:0, cobrado:0 }]));
  presupuestos.forEach(q => {
    const key = monthKey(q.fecha ? new Date(`${q.fecha}T12:00:00`) : new Date(dateValue(q.createdAt)));
    if (monthly[key] && q.estado !== "ANULADA" && q.estado !== "RECHAZADA") monthly[key].ventas += Number(q.totalUSD || 0);
  });
  verifiedPayments.forEach(p => {
    const d = p.fechaPago?.toDate ? p.fechaPago.toDate() : new Date(dateValue(p.fechaPago || p.createdAt));
    const key = monthKey(d);
    if (monthly[key]) monthly[key].cobrado += Number(p.montoUSD || 0);
  });

  const recientes = [...presupuestos].sort((a,b) => dateValue(b.createdAt || b.fecha) - dateValue(a.createdAt || a.fecha)).slice(0,6);

  return {
    presupuestos: presupuestos.length,
    clientes: clientes.filter(c => c.activo !== false).length,
    pagos: verifiedPayments.length,
    proyectos: proyectos.length,
    ventasUSD,
    aprobadoUSD,
    cobradoUSD,
    cobradoBs,
    porCobrarUSD,
    pendientes,
    solicitudesPendientes,
    monthly,
    months,
    recientes
  };
}

function statusLabel(s) {
  return { BORRADOR:"Borrador", ENVIADA:"Enviada", APROBADA:"Aprobada", RECHAZADA:"Rechazada", ANULADA:"Anulada" }[s] || s || "—";
}

export function dashboardHTML(stats) {
  const maxChart = Math.max(...stats.months.map(m => Math.max(stats.monthly[m].ventas, stats.monthly[m].cobrado)), 1);
  const chart = stats.months.map(m => {
    const x = stats.monthly[m];
    const ventasH = Math.max(4, Math.round((x.ventas / maxChart) * 130));
    const cobradoH = Math.max(4, Math.round((x.cobrado / maxChart) * 130));
    return `<div class="bar-group" title="${esc(monthLabel(m))}: ventas $${money(x.ventas)} · cobrado $${money(x.cobrado)}"><div class="bar-pair"><span class="bar bar-sales" style="height:${ventasH}px"></span><span class="bar bar-collected" style="height:${cobradoH}px"></span></div><small>${esc(monthLabel(m))}</small></div>`;
  }).join("");

  const recent = stats.recientes.length ? `<div class="client-table-wrap"><table class="client-table"><thead><tr><th>Presupuesto</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead><tbody>${stats.recientes.map(q => `<tr><td><strong>${esc(q.numero || "—")}</strong></td><td>${esc(q.clienteNombre || "—")}</td><td><strong>$${money(q.totalUSD)}</strong></td><td><span class="status-pill status-${String(q.estado||"").toLowerCase()}">${statusLabel(q.estado)}</span></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>Aún no hay presupuestos</strong><p class="muted">Los movimientos comerciales aparecerán aquí.</p></div>`;

  return `
    <section class="dashboard-module">
      <div class="module-toolbar">
        <div><span class="eyebrow">CENTRO DE CONTROL</span><h2>Dashboard</h2><p class="muted">Resumen comercial y financiero en tiempo real desde Firestore.</p></div>
        ${stats.solicitudesPendientes ? `<span class="status-pill status-pendiente">${stats.solicitudesPendientes} pago${stats.solicitudesPendientes===1?"":"s"} por revisar</span>` : `<span class="live-dot">Firebase conectado</span>`}
      </div>
      <div class="grid kpis">
        <article class="card stat-card"><h3>Ventas registradas</h3><div class="metric">$${money(stats.ventasUSD)}</div><p class="muted">Presupuestos activos</p></article>
        <article class="card stat-card"><h3>Aprobado</h3><div class="metric">$${money(stats.aprobadoUSD)}</div><p class="muted">Negocio aprobado</p></article>
        <article class="card stat-card"><h3>Cobrado</h3><div class="metric">$${money(stats.cobradoUSD)}</div><p class="muted">${stats.pagos} pago${stats.pagos===1?"":"s"} verificado${stats.pagos===1?"":"s"}</p></article>
        <article class="card stat-card"><h3>Por cobrar</h3><div class="metric">$${money(stats.porCobrarUSD)}</div><p class="muted">${stats.pendientes} presupuesto${stats.pendientes===1?"":"s"} con saldo</p></article>
      </div>
      <div class="dashboard-grid">
        <article class="card">
          <div class="card-heading"><div><span class="eyebrow">ÚLTIMOS 6 MESES</span><h2>Ventas vs. cobros</h2></div><div class="chart-legend"><span>Ventas</span><span>Cobrado</span></div></div>
          <div class="mini-chart">${chart}</div>
        </article>
        <article class="card">
          <span class="eyebrow">CONCILIACIÓN</span><h2>Control financiero</h2>
          <div class="finance-summary"><div><span>Cobrado en USD</span><strong>$${money(stats.cobradoUSD)}</strong></div><div><span>Registrado en Bs</span><strong>Bs ${bs(stats.cobradoBs)}</strong></div><div><span>Solicitudes pendientes</span><strong>${stats.solicitudesPendientes}</strong></div></div>
          <p class="muted finance-note">Cada pago verificado conserva su propia tasa BCV del día.</p>
        </article>
      </div>
      <article class="card recent-card"><div class="card-heading"><div><span class="eyebrow">ACTIVIDAD COMERCIAL</span><h2>Presupuestos recientes</h2></div><span class="muted">${stats.presupuestos} total</span></div>${recent}</article>
    </section>`;
}
