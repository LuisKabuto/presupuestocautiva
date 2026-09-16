import { db } from "./auth.js";
import { collection, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const money=v=>Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const bs=v=>Number(v||0).toLocaleString("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2});
const date=v=>v?new Date(`${v}T00:00:00`).toLocaleDateString("es-VE"):"—";

async function getData(){
  const [qs,cs,configSnap]=await Promise.all([getDocs(collection(db,"presupuestos")),getDocs(collection(db,"clientes")),getDoc(doc(db,"configuracion","general"))]);
  return {
    presupuestos:qs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.numero||"").localeCompare(String(a.numero||""))),
    clientes:cs.docs.map(d=>({id:d.id,...d.data()})),
    config:configSnap.exists()?configSnap.data():{}
  };
}

function documentHTML(q,cliente,c){
  const subtotal=Number(q.subtotalUSD)||0;
  const iva=Number(q.ivaUSD)||0;
  const total=Number(q.totalUSD)||subtotal+iva;
  const rate=Number(q.tasaBCV)||0;
  const totalBs=Number(q.totalBsHistorico)||total*rate;
  const lines=(q.lineas||[]).filter(l=>l.descripcion||l.precioUSD);
  return `<div class="quote-document">
    <header class="quote-doc-head">
      <div><div class="doc-brand">${esc(c.empresaNombre||q.empresaNombre||"Cautiva Business")}</div><div class="doc-company">${c.empresaRif?`RIF: ${esc(c.empresaRif)}<br>`:""}${c.empresaTelefono?`${esc(c.empresaTelefono)}<br>`:""}${c.empresaEmail?`${esc(c.empresaEmail)}<br>`:""}${c.empresaDireccion?esc(c.empresaDireccion):""}</div></div>
      <div class="doc-title"><span>PRESUPUESTO</span><strong>${esc(q.numero||"—")}</strong><small>Fecha: ${date(q.fecha)}</small></div>
    </header>
    <section class="doc-client"><div><small>CLIENTE</small><strong>${esc(cliente?.nombre||q.clienteNombre||"—")}</strong>${cliente?.rif||q.clienteRif?`<span>RIF/CI: ${esc(cliente?.rif||q.clienteRif)}</span>`:""}${cliente?.email?`<span>${esc(cliente.email)}</span>`:""}${cliente?.telefono?`<span>${esc(cliente.telefono)}</span>`:""}</div><div><small>VIGENCIA</small><strong>${esc(q.vigenciaDias||15)} días</strong><span>Válido desde ${date(q.fecha)}</span></div></section>
    ${q.descripcion?`<section class="doc-description"><small>ALCANCE / DESCRIPCIÓN</small><p>${esc(q.descripcion)}</p></section>`:""}
    <table class="doc-lines"><thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio USD</th><th>Total USD</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${esc(l.descripcion)}</td><td>${Number(l.cantidad||0)}</td><td>$${money(l.precioUSD)}</td><td>$${money((Number(l.cantidad)||0)*(Number(l.precioUSD)||0))}</td></tr>`).join("")}</tbody></table>
    <section class="doc-totals"><div><span>Subtotal</span><strong>$${money(subtotal)}</strong></div><div><span>IVA (${Number(q.iva??0)}%)</span><strong>$${money(iva)}</strong></div><div class="doc-grand"><span>Total</span><strong>$${money(total)}</strong></div><div><span>Referencia histórica</span><strong>Bs ${bs(totalBs)}</strong></div><div><span>Tasa BCV del presupuesto</span><strong>Bs ${bs(rate)} / USD</strong></div></section>
    ${q.observaciones?`<section class="doc-notes"><small>OBSERVACIONES Y CONDICIONES</small><p>${esc(q.observaciones)}</p></section>`:""}
    ${(c.cuentaPago1||c.cuentaPago2)?`<section class="doc-payment"><small>DATOS PARA PAGO</small>${c.cuentaPago1?`<p>${esc(c.cuentaPago1)}</p>`:""}${c.cuentaPago2?`<p>${esc(c.cuentaPago2)}</p>`:""}</section>`:""}
    <footer class="doc-footer"><span>Documento generado por Cautiva Business</span><span>La referencia en Bs corresponde exclusivamente a la tasa histórica del presupuesto.</span></footer>
  </div>`;
}

function printDocument(q,cliente,c){
  const body=documentHTML(q,cliente,c);
  const w=window.open("","_blank","width=1000,height=800");
  if(!w){alert("El navegador bloqueó la ventana. Permite ventanas emergentes para Cautiva.");return;}
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(q.numero||"Presupuesto")} · Cautiva Business</title><style>body{margin:0;background:#fff;color:#172033;font-family:Arial,Helvetica,sans-serif}.quote-document{max-width:900px;margin:0 auto;padding:42px 46px}.quote-doc-head{display:flex;justify-content:space-between;gap:30px;border-bottom:3px solid #d6ad52;padding-bottom:22px}.doc-brand{font-size:27px;font-weight:800;letter-spacing:2px}.doc-company{margin-top:9px;color:#64748b;font-size:12px;line-height:1.6}.doc-title{text-align:right}.doc-title span{display:block;font-size:12px;letter-spacing:2px;color:#64748b}.doc-title strong{display:block;font-size:25px;margin:5px 0}.doc-title small{color:#64748b}.doc-client{display:grid;grid-template-columns:2fr 1fr;gap:20px;margin:25px 0;padding:18px;background:#f8fafc;border:1px solid #e2e8f0}.doc-client small,.doc-description small,.doc-notes small,.doc-payment small{display:block;font-size:10px;letter-spacing:1.2px;color:#64748b;margin-bottom:7px}.doc-client strong,.doc-client span{display:block}.doc-client span{font-size:12px;color:#64748b;margin-top:3px}.doc-description{margin:22px 0}.doc-description p,.doc-notes p,.doc-payment p{margin:7px 0;font-size:13px;line-height:1.55}.doc-lines{width:100%;border-collapse:collapse;margin-top:24px}.doc-lines th{background:#172033;color:#fff;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;padding:11px}.doc-lines td{padding:12px 11px;border-bottom:1px solid #e2e8f0;font-size:12px}.doc-lines th:nth-child(n+2),.doc-lines td:nth-child(n+2){text-align:right}.doc-totals{width:360px;margin:24px 0 0 auto}.doc-totals div{display:flex;justify-content:space-between;padding:8px 0;font-size:12px;border-bottom:1px solid #e2e8f0}.doc-grand{font-size:17px!important;border-top:2px solid #172033}.doc-grand strong{font-size:21px}.doc-notes,.doc-payment{margin-top:25px;padding-top:16px;border-top:1px solid #e2e8f0}.doc-footer{display:flex;justify-content:space-between;gap:20px;margin-top:38px;padding-top:14px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:9px}.doc-payment p{margin:4px 0}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.quote-document{padding:20px 25px}@page{size:A4;margin:12mm}}</style></head><body>${body}</body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),300);
}

export async function renderDocumentos(container){
  container.innerHTML=`<article class="card loading-card"><p class="muted">Cargando documentos...</p></article>`;
  try{
    const {presupuestos,clientes,config}=await getData();
    const approved=presupuestos.filter(q=>q.estado!=="ANULADA");
    const render=(q=approved[0])=>{
      const cliente=clientes.find(c=>c.id===q?.clienteId);
      container.innerHTML=`<section><div class="module-toolbar"><div><span class="eyebrow">DOCUMENTOS COMERCIALES</span><h2>Presupuestos imprimibles</h2><p class="muted">Genera una versión profesional para imprimir o guardar como PDF.</p></div><div class="toolbar-actions"><select id="docQuote" class="search-input">${approved.length?approved.map(x=>`<option value="${esc(x.id)}" ${x.id===q?.id?"selected":""}>${esc(x.numero)} · ${esc(x.clienteNombre||"—")} · $${money(x.totalUSD)}</option>`).join(""):"<option>No hay presupuestos</option>"}</select><button id="printQuote" class="btn-primary" ${q?"":"disabled"}>Imprimir / PDF</button></div></div><div class="card document-preview">${q?documentHTML(q,cliente,config):`<div class="empty-state"><strong>No hay presupuestos disponibles</strong><p class="muted">Crea un presupuesto primero.</p></div>`}</div></section>`;
      container.querySelector("#docQuote")?.addEventListener("change",e=>render(approved.find(x=>x.id===e.target.value)));
      container.querySelector("#printQuote")?.addEventListener("click",()=>printDocument(q,cliente,config));
    };
    render();
  }catch(error){console.error(error);container.innerHTML=`<article class="card"><h3>No se pudieron cargar los documentos</h3><p class="muted">Revisa la conexión con Firestore.</p></article>`;}
}
