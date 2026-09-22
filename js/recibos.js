import { db } from "./auth.js";
import { collection, getDocs, addDoc, getDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const esc=v=>String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const money=v=>Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const today=()=>new Date().toISOString().slice(0,10);

async function load(){
 const [cs,cfg]=await Promise.all([getDocs(collection(db,"clientes")),getDoc(doc(db,"configuracion","general"))]);
 return {clientes:cs.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.activo!==false),config:cfg.exists()?cfg.data():{}};
}
function print(r,c,cfg){
 const html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(r.numero)+'</title><style>body{font-family:Arial;color:#172033;margin:0}.doc{max-width:800px;margin:auto;padding:50px}.head{display:flex;justify-content:space-between;border-bottom:3px solid #d6ad52;padding-bottom:20px}.brand{font-size:25px;font-weight:bold}.title{text-align:right}.title strong{display:block;font-size:24px}.client{margin:25px 0;padding:18px;background:#f8fafc;border:1px solid #ddd}.work{padding:22px;border-left:4px solid #d6ad52;border:1px solid #ddd}.amount{margin:25px 0 0 auto;width:320px}.amount div{display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #ddd}.foot{margin-top:60px;border-top:1px solid #ddd;padding-top:12px;font-size:10px;color:#64748b}@media print{@page{size:A4;margin:15mm}}</style></head><body><div class="doc"><div class="head"><div><div class="brand">'+esc(cfg.empresaNombre||"Cautiva Business")+'</div><small>'+(cfg.empresaRif?"RIF: "+esc(cfg.empresaRif):"")+'</small></div><div class="title"><span>RECIBO DE TRABAJO</span><strong>'+esc(r.numero)+'</strong><small>'+esc(r.fecha)+'</small></div></div><div class="client"><b>CLIENTE</b><br>'+esc(c.nombre)+(c.rif?"<br>RIF/CI: "+esc(c.rif):"")+'</div><div class="work"><b>TRABAJO REALIZADO</b><h3>'+esc(r.trabajo)+'</h3><p>'+esc(r.descripcion||"")+'</p></div>'+(r.montoUSD?'<div class="amount"><div><span>Monto</span><b>$'+money(r.montoUSD)+'</b></div>'+(r.formaPago?'<div><span>Forma de pago</span><b>'+esc(r.formaPago)+'</b></div>':"")+(r.referencia?'<div><span>Referencia</span><b>'+esc(r.referencia)+'</b></div>':"")+'</div>':"")+(r.observaciones?'<p><b>Observaciones</b><br>'+esc(r.observaciones)+'</p>':"")+'<div class="foot">Documento emitido por Cautiva Business como constancia del trabajo realizado.</div></div></body></html>';
 const w=window.open("","_blank"); if(!w){alert("Permite ventanas emergentes.");return;} w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),300);
}
export async function renderRecibos(container){
 container.innerHTML='<article class="card"><p class="muted">Cargando...</p></article>';
 try{
  const {clientes,config}=await load();
  container.innerHTML='<section><div class="module-toolbar"><div><span class="eyebrow">DOCUMENTOS</span><h2>Recibos de trabajo</h2><p class="muted">Entrega un comprobante profesional de los trabajos realizados.</p></div></div><div class="card receipt-form-card"><div class="receipt-grid"><label>Cliente<select id="rc"><option value="">Seleccionar</option>'+clientes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.nombre)+'</option>').join("")+'</select></label><label>Fecha<input id="rf" type="date" value="'+today()+'"></label><label>Trabajo realizado<input id="rt" placeholder="Ej. Instalación y configuración"></label><label>Responsable<input id="rr" placeholder="Responsable"></label><label>Monto USD<input id="rm" type="number" step="0.01" min="0" placeholder="Opcional"></label><label>Forma de pago<select id="rp"><option value="">No especificar</option><option>Transferencia</option><option>Pago móvil</option><option>Efectivo</option><option>Zelle</option><option>Otro</option></select></label><label class="full">Descripción<textarea id="rd" rows="4"></textarea></label><label class="full">Referencia / OID<input id="ro"></label><label class="full">Observaciones<textarea id="rn" rows="3"></textarea></label></div><button id="saveReceipt" class="btn-primary">Guardar y generar recibo</button></div><div id="receiptResult"></div></section>';
  const $=x=>container.querySelector(x);
  $("#saveReceipt").onclick=async()=>{
   const c=clientes.find(x=>x.id===$("#rc").value), trabajo=$("#rt").value.trim();
   if(!c||!trabajo){alert("Selecciona el cliente e indica el trabajo realizado.");return;}
   const p={clienteId:c.id,clienteNombre:c.nombre,fecha:$("#rf").value||today(),trabajo,responsable:$("#rr").value.trim(),montoUSD:Number($("#rm").value||0),formaPago:$("#rp").value,descripcion:$("#rd").value.trim(),referencia:$("#ro").value.trim(),observaciones:$("#rn").value.trim(),createdAt:serverTimestamp()};
   const ref=await addDoc(collection(db,"recibos"),p); const r={...p,numero:"REC-"+new Date().getFullYear()+"-"+ref.id.slice(0,6).toUpperCase()};
   $("#receiptResult").innerHTML='<div class="card receipt-generated"><h3>'+esc(r.numero)+'</h3><p>Recibo guardado correctamente.</p><button id="printReceipt" class="btn-primary">Imprimir / PDF</button></div>';
   $("#printReceipt").onclick=()=>print(r,c,config);
  };
 }catch(e){console.error(e);container.innerHTML='<article class="card"><h3>No se pudieron cargar los recibos</h3></article>';}
}