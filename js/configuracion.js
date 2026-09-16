import { auth, db } from "./auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const user=()=>auth.currentUser;

async function profile(){
  const u=user();
  if(!u) return null;
  const snap=await getDoc(doc(db,"usuarios",u.uid));
  return snap.exists()?snap.data():null;
}

const defaults={
  empresaNombre:"Cautiva Business",
  empresaRif:"",
  empresaTelefono:"",
  empresaEmail:"",
  empresaDireccion:"",
  iva:16,
  vigenciaPresupuesto:15,
  tasaBCV:0,
  cuentaPago1:"",
  cuentaPago2:"",
  monedaBase:"USD"
};

function formHTML(c){
  return `<div class="client-form-card" style="margin-top:18px"><div class="client-form-head"><div><span class="eyebrow">PARÁMETROS GENERALES</span><h2>Configuración de Cautiva</h2><p class="muted">Datos que utilizarán presupuestos, pagos y documentos comerciales.</p></div></div><form id="configForm"><div class="form-grid"><label>Nombre de la empresa *<input name="empresaNombre" required maxlength="150" value="${esc(c.empresaNombre)}"></label><label>RIF / identificación<input name="empresaRif" maxlength="60" value="${esc(c.empresaRif)}"></label><label>Teléfono<input name="empresaTelefono" maxlength="60" value="${esc(c.empresaTelefono)}"></label><label>Correo comercial<input name="empresaEmail" type="email" maxlength="160" value="${esc(c.empresaEmail)}"></label><label class="form-full">Dirección<input name="empresaDireccion" maxlength="250" value="${esc(c.empresaDireccion)}"></label><label>IVA (%)<input name="iva" type="number" min="0" max="100" step="0.01" value="${Number(c.iva)}"></label><label>Vigencia del presupuesto (días)<input name="vigenciaPresupuesto" type="number" min="1" max="365" step="1" value="${Number(c.vigenciaPresupuesto)}"></label><label>Tasa BCV de referencia<input name="tasaBCV" type="number" min="0" step="0.0001" value="${Number(c.tasaBCV)||0}"></label><label>Moneda base<select name="monedaBase"><option value="USD" ${c.monedaBase==="USD"?"selected":""}>USD</option><option value="VES" ${c.monedaBase==="VES"?"selected":""}>VES</option></select></label><label>Cuenta de pago 1<input name="cuentaPago1" maxlength="180" value="${esc(c.cuentaPago1)}" placeholder="Banco · cuenta · titular"></label><label>Cuenta de pago 2<input name="cuentaPago2" maxlength="180" value="${esc(c.cuentaPago2)}" placeholder="Banco · cuenta · titular"></label></div><div class="form-actions"><button type="submit" class="btn-primary">Guardar configuración</button></div></form></div>`;
}

function securityHTML(p){
  const u=user();
  return `<div class="card" style="margin-top:18px"><div class="card-heading"><div><span class="eyebrow">SEGURIDAD</span><h2>Sesión y permisos</h2></div><span class="status-pill status-aprobada">${esc(p?.rol||"usuario")}</span></div><div class="finance-summary"><div><span>Usuario actual</span><strong>${esc(u?.email||"—")}</strong></div><div><span>UID</span><strong style="font-size:11px">${esc(u?.uid||"—")}</strong></div><div><span>Rol</span><strong>${esc(p?.rol||"usuario")}</strong></div><div><span>Estado</span><strong>${p?.activo===false?"Inactivo":"Activo"}</strong></div></div><p class="muted finance-note">El rol se controla en Firestore y no puede ser cambiado desde esta pantalla.</p></div>`;
}

export async function renderConfiguracion(container){
  container.innerHTML=`<article class="card loading-card"><p class="muted">Cargando configuración...</p></article>`;
  try{
    const p=await profile();
    if(p?.rol!=="admin"){
      container.innerHTML=`<article class="card"><span class="eyebrow">SEGURIDAD</span><h2>Configuración restringida</h2><p class="muted">Solo un administrador puede modificar los parámetros generales del sistema.</p></article>`;
      return;
    }
    const ref=doc(db,"configuracion","general");
    const snap=await getDoc(ref);
    const c={...defaults,...(snap.exists()?snap.data():{})};
    container.innerHTML=`<section><div class="module-toolbar"><div><span class="eyebrow">ADMINISTRACIÓN</span><h2>Configuración</h2><p class="muted">Empresa, impuestos, tasa de referencia y cuentas de pago.</p></div></div>${formHTML(c)}${securityHTML(p)}</section>`;
    container.querySelector("#configForm").addEventListener("submit",async e=>{
      e.preventDefault();
      const d=Object.fromEntries(new FormData(e.currentTarget).entries());
      const payload={empresaNombre:String(d.empresaNombre||"").trim(),empresaRif:String(d.empresaRif||"").trim(),empresaTelefono:String(d.empresaTelefono||"").trim(),empresaEmail:String(d.empresaEmail||"").trim(),empresaDireccion:String(d.empresaDireccion||"").trim(),iva:Number(d.iva||0),vigenciaPresupuesto:Number(d.vigenciaPresupuesto||15),tasaBCV:Number(d.tasaBCV||0),monedaBase:d.monedaBase==="VES"?"VES":"USD",cuentaPago1:String(d.cuentaPago1||"").trim(),cuentaPago2:String(d.cuentaPago2||"").trim(),updatedAt:serverTimestamp(),updatedBy:user()?.uid||null};
      if(!payload.empresaNombre) return alert("El nombre de la empresa es obligatorio.");
      try{await setDoc(ref,payload,{merge:true});alert("Configuración guardada correctamente.");}catch(error){console.error(error);alert("No se pudo guardar la configuración.");}
    });
  }catch(error){console.error(error);container.innerHTML=`<article class="card"><h2>No se pudo cargar Configuración</h2><p class="muted">Revisa la sesión y las reglas de Firestore.</p></article>`;}
}
