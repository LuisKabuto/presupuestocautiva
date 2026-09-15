import { db } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const money=v=>Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const bs=v=>Number(v||0).toLocaleString("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const dateValue=v=>v?.toDate?v.toDate().getTime():new Date(v||0).getTime()||0;
const dateTime=v=>v?.toDate?v.toDate().toLocaleString("es-VE",{dateStyle:"short",timeStyle:"short"}):v?new Date(v).toLocaleString("es-VE",{dateStyle:"short",timeStyle:"short"}):"—";

export async function renderFinanzas(container){
 container.innerHTML=`<article class="card loading-card"><p class="muted">Cargando historial financiero...</p></article>`;
 try{
  const [qs,ps]=await Promise.all([getDocs(collection(db,"presupuestos")),getDocs(collection(db,"pagos"))]);
  const quotes=qs.docs.map(d=>({id:d.id,...d.data()}));
  const payments=ps.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.estado==="VERIFICADO").sort((a,b)=>dateValue(b.fechaPago||b.createdAt)-dateValue(a.fechaPago||a.createdAt));
  const byQuote=Object.fromEntries(quotes.map(q=>[q.id,[]])); payments.forEach(p=>{if(byQuote[p.quoteId])byQuote[p.quoteId].push(p);});
  const total=quotes.reduce((s,q)=>s+Number(q.totalUSD||0),0), collected=payments.reduce((s,p)=>s+Number(p.montoUSD||0),0), collectedBs=payments.reduce((s,p)=>s+Number(p.montoBs||0),0);
  const render=()=>{
   const term=(container.querySelector("#financeSearch")?.value||"").toLowerCase().trim();
   const list=quotes.filter(q=>[q.numero,q.clienteNombre,q.estado,q.estadoPago].some(v=>String(v||"").toLowerCase().includes(term)));
   container.innerHTML=`<section class="finance-module"><div class="module-toolbar"><div><span class="eyebrow">ADMINISTRACIÓN FINANCIERA</span><h2>Finanzas</h2><p class="muted">Trazabilidad de cobros por presupuesto y por operación.</p></div><div class="toolbar-actions"><input id="financeSearch" class="search-input" type="search" value="${esc(term)}" placeholder="Buscar presupuesto o cliente..."><button class="btn-secondary" id="refreshFinance">Actualizar</button></div></div>
   <div class="grid kpis"><article class="card stat-card"><h3>Presupuestado</h3><div class="metric">$${money(total)}</div><p class="muted">Todos los presupuestos</p></article><article class="card stat-card"><h3>Cobrado</h3><div class="metric">$${money(collected)}</div><p class="muted">${payments.length} pagos verificados</p></article><article class="card stat-card"><h3>Registrado en Bs</h3><div class="metric">Bs ${bs(collectedBs)}</div><p class="muted">Según tasa de cada pago</p></article><article class="card stat-card"><h3>Saldo</h3><div class="metric">$${money(Math.max(0,total-collected))}</div><p class="muted">Diferencia global</p></article></div>
   <div class="card client-list-card"><div class="list-summary"><span>${list.length} presupuesto${list.length===1?"":"s"}</span><span class="muted">Cada pago conserva monto, OID, fecha y tasa BCV propia.</span></div><div id="financeQuotes">${list.length?list.map(q=>quoteCard(q,byQuote[q.id]||[])).join(""):empty()}</div></div>
   </section>`;
   container.querySelector("#financeSearch").addEventListener("input",render); container.querySelector("#refreshFinance").addEventListener("click",async()=>renderFinanzas(container));
  };
  render();
 }catch(e){console.error(e);container.innerHTML=`<article class="card"><h3>No se pudo cargar Finanzas</h3><p class="muted">Revisa la conexión con Firestore y las reglas publicadas.</p></article>`;}
}
function quoteCard(q,payments){
 const paid=payments.reduce((s,p)=>s+Number(p.montoUSD||0),0), balance=Math.max(0,Number(q.totalUSD||0)-paid), status=balance<=.005?"PAGADO":paid>0?"PARCIAL":"PENDIENTE";
 return `<article class="finance-quote-card"><div class="card-heading"><div><span class="eyebrow">${esc(q.numero||"PRESUPUESTO")}</span><h2>${esc(q.clienteNombre||"Cliente")}</h2><p class="muted">Fecha ${esc(q.fecha||"—")} · Tasa histórica Bs ${bs(q.tasaBCV||0)}/$</p></div><span class="status-pill status-${status.toLowerCase()}">${status}</span></div><div class="finance-quote-summary"><div><span>Total</span><strong>$${money(q.totalUSD)}</strong></div><div><span>Cobrado</span><strong>$${money(paid)}</strong></div><div><span>Saldo</span><strong>$${money(balance)}</strong></div><div><span>Pagos</span><strong>${payments.length}</strong></div></div>${payments.length?`<div class="quote-lines-wrap"><table class="quote-lines"><thead><tr><th>Fecha</th><th>OID</th><th>USD</th><th>Tasa BCV pago</th><th>Bs</th><th>Nota</th></tr></thead><tbody>${payments.map(p=>`<tr><td>${esc(dateTime(p.fechaPago||p.createdAt))}</td><td><strong>${esc(p.oid||"—")}</strong></td><td><strong>$${money(p.montoUSD)}</strong></td><td>Bs ${bs(p.tasaBCVPago||0)}/$</td><td>Bs ${bs(p.montoBs||0)}</td><td>${esc(p.nota||"—")}</td></tr>`).join("")}</tbody></table></div>`:`<p class="muted finance-note">Sin pagos verificados registrados.</p>`}</article>`;
}
function empty(){return `<div class="empty-state"><strong>No se encontraron presupuestos</strong><p class="muted">Prueba con otro número o cliente.</p></div>`;}
