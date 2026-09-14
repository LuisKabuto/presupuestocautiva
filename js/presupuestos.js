import { auth, db } from "./auth.js";
import {
  collection, getDocs, addDoc, updateDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const FIRESTORE = "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
const BCV_URL = "https://ve.dolarapi.com/v1/dolares/oficial";
const esc = v => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const money = v => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bs = v => Number(v || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const user = () => auth.currentUser;

async function getClientes() {
  const snap = await getDocs(collection(db, "clientes"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.activo !== false).sort((a,b) => String(a.nombre).localeCompare(String(b.nombre), "es", { sensitivity:"base" }));
}

async function getPresupuestos() {
  const snap = await getDocs(collection(db, "presupuestos"));
  return snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => String(b.numero || "").localeCompare(String(a.numero || "")));
}

async function getBCV() {
  try {
    const response = await fetch(`${BCV_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("BCV no disponible");
    const data = await response.json();
    return Number(data.promedio || data.venta || data.price || data.valor || 0) || null;
  } catch (error) {
    console.warn("No se pudo consultar BCV:", error);
    return null;
  }
}

function nextNumber(items) {
  const max = items.reduce((n, item) => {
    const match = String(item.numero || "").match(/(\d+)$/);
    return Math.max(n, match ? Number(match[1]) : 0);
  }, 0);
  return `PRES-${String(max + 1).padStart(5, "0")}`;
}

function statusLabel(status) {
  return { BORRADOR:"Borrador", ENVIADA:"Enviada", APROBADA:"Aprobada", RECHAZADA:"Rechazada", ANULADA:"Anulada" }[status] || status;
}

function lineRow(line = {}, index = 0) {
  return `<tr data-line="${index}"><td><input class="line-desc" value="${esc(line.descripcion)}" maxlength="180" placeholder="Servicio o producto"></td><td><input class="line-qty" type="number" min="0" step="0.01" value="${line.cantidad ?? 1}"></td><td><input class="line-price" type="number" min="0" step="0.01" value="${line.precioUSD ?? 0}"></td><td class="line-total">$${money((Number(line.cantidad)||0)*(Number(line.precioUSD)||0))}</td><td><button type="button" class="btn-table btn-deactivate" data-remove-line="${index}">Quitar</button></td></tr>`;
}

function formHTML({ clientes, quote = {}, lines = [{ descripcion:"", cantidad:1, precioUSD:0 }], bcv = null }) {
  const editing = Boolean(quote.id);
  return `<div class="quote-form-card">
    <div class="client-form-head"><div><span class="eyebrow">${editing ? "EDITAR PRESUPUESTO" : "NUEVO PRESUPUESTO"}</span><h2>${editing ? quote.numero : "Crear presupuesto"}</h2></div><button type="button" class="btn-secondary" data-action="close-quote">Cerrar</button></div>
    <form id="quoteForm" data-id="${esc(quote.id || "")}" autocomplete="off">
      <div class="form-grid">
        <label>Cliente *<select name="clienteId" required><option value="">Seleccionar cliente...</option>${clientes.map(c => `<option value="${esc(c.id)}" ${quote.clienteId === c.id ? "selected" : ""}>${esc(c.nombre)}${c.rif ? ` · ${esc(c.rif)}` : ""}</option>`).join("")}</select></label>
        <label>Fecha<input name="fecha" type="date" value="${esc(quote.fecha || today())}" required></label>
        <label>Vigencia (días)<input name="vigenciaDias" type="number" min="1" value="${quote.vigenciaDias || 15}"></label>
        <label>IVA (%)<input name="iva" type="number" min="0" max="100" step="0.01" value="${quote.iva ?? 16}"></label>
        <label>Tasa BCV del presupuesto<input name="tasaBCV" id="quoteBCV" type="number" min="0" step="0.0001" value="${quote.tasaBCV || bcv || ""}" required><small class="field-help">Queda congelada como histórico.</small></label>
        <label>Estado<select name="estado">${["BORRADOR","ENVIADA","APROBADA","RECHAZADA","ANULADA"].map(s => `<option value="${s}" ${(quote.estado || "BORRADOR") === s ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}</select></label>
        <label class="form-full">Descripción general<textarea name="descripcion" rows="2" maxlength="500" placeholder="Alcance general del servicio">${esc(quote.descripcion)}</textarea></label>
      </div>
      <div class="quote-lines-head"><div><span class="eyebrow">DETALLE COMERCIAL</span><h3>Conceptos</h3></div><button type="button" class="btn-secondary" id="addLine">+ Agregar línea</button></div>
      <div class="quote-lines-wrap"><table class="quote-lines"><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio USD</th><th>Total</th><th></th></tr></thead><tbody id="quoteLines">${lines.map(lineRow).join("")}</tbody></table></div>
      <div class="quote-total-box"><div><span>Subtotal USD</span><strong id="quoteSubtotal">$0.00</strong></div><div><span>IVA</span><strong id="quoteTax">$0.00</strong></div><div class="grand"><span>Total USD</span><strong id="quoteTotal">$0.00</strong></div><div><span>Referencia histórica en Bs</span><strong id="quoteBs">Bs 0,00</strong></div></div>
      <div class="form-grid"><label class="form-full">Observaciones<textarea name="observaciones" rows="3" maxlength="800" placeholder="Condiciones, forma de pago, notas comerciales">${esc(quote.observaciones)}</textarea></label></div>
      <div class="form-actions"><button type="button" class="btn-secondary" data-action="close-quote">Cancelar</button><button type="submit" class="btn-primary">${editing ? "Guardar cambios" : "Crear presupuesto"}</button></div>
    </form>
  </div>`;
}

function calculate(form) {
  let subtotal = 0;
  form.querySelectorAll("#quoteLines tr").forEach(row => {
    const total = (Number(row.querySelector(".line-qty")?.value) || 0) * (Number(row.querySelector(".line-price")?.value) || 0);
    subtotal += total;
    row.querySelector(".line-total").textContent = `$${money(total)}`;
  });
  const iva = Number(form.querySelector('[name="iva"]')?.value) || 0;
  const tax = subtotal * iva / 100;
  const total = subtotal + tax;
  const rate = Number(form.querySelector('[name="tasaBCV"]')?.value) || 0;
  form.querySelector("#quoteSubtotal").textContent = `$${money(subtotal)}`;
  form.querySelector("#quoteTax").textContent = `$${money(tax)}`;
  form.querySelector("#quoteTotal").textContent = `$${money(total)}`;
  form.querySelector("#quoteBs").textContent = `Bs ${bs(total * rate)}`;
  return { subtotal, tax, total, rate };
}

function collectLines(form) {
  return [...form.querySelectorAll("#quoteLines tr")].map(row => ({
    descripcion: row.querySelector(".line-desc")?.value.trim() || "",
    cantidad: Number(row.querySelector(".line-qty")?.value) || 0,
    precioUSD: Number(row.querySelector(".line-price")?.value) || 0
  })).filter(line => line.descripcion || line.precioUSD);
}

function tableHTML(items) {
  if (!items.length) return `<div class="empty-state"><strong>No hay presupuestos</strong><p class="muted">Crea el primer presupuesto para comenzar el ciclo comercial.</p><button class="btn-primary" data-action="new-quote">+ Nuevo presupuesto</button></div>`;
  return `<div class="client-table-wrap"><table class="client-table"><thead><tr><th>Presupuesto</th><th>Cliente</th><th>Fecha</th><th>Total USD</th><th>Estado</th><th>Tasa histórica</th><th></th></tr></thead><tbody>${items.map(q => `<tr><td><strong>${esc(q.numero)}</strong><small>${esc(q.vigenciaDias || 15)} días de vigencia</small></td><td>${esc(q.clienteNombre || "—")}</td><td>${esc(q.fecha || "—")}</td><td><strong>$${money(q.totalUSD)}</strong></td><td><span class="status-pill status-${String(q.estado || "BORRADOR").toLowerCase()}">${statusLabel(q.estado || "BORRADOR")}</span></td><td>Bs ${bs(q.tasaBCV || 0)}/$</td><td class="table-actions"><button class="btn-table" data-action="edit-quote" data-id="${esc(q.id)}">Editar</button>${q.estado === "APROBADA" ? `<button class="btn-table btn-reactivate" data-action="payment-link" data-id="${esc(q.id)}">Enlace pago</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
}

export async function renderPresupuestos(container) {
  container.innerHTML = `<article class="card loading-card"><p class="muted">Cargando presupuestos...</p></article>`;
  try {
    let [clientes, presupuestos] = await Promise.all([getClientes(), getPresupuestos()]);
    const render = () => {
      container.innerHTML = `<section class="quote-module"><div class="module-toolbar"><div><span class="eyebrow">GESTIÓN COMERCIAL</span><h2>Presupuestos</h2><p class="muted">Cotiza, aprueba y prepara el siguiente paso: el pago.</p></div><div class="toolbar-actions"><input id="quoteSearch" class="search-input" type="search" placeholder="Buscar presupuesto o cliente..."><button class="btn-primary" data-action="new-quote">+ Nuevo presupuesto</button></div></div><div class="card client-list-card"><div class="list-summary"><span id="quoteCount">${presupuestos.length} presupuesto${presupuestos.length === 1 ? "" : "s"}</span><span class="muted">La tasa BCV mostrada aquí es histórica y no determina el pago futuro.</span></div><div id="quoteTable">${tableHTML(presupuestos)}</div></div><div id="quoteFormHost" class="client-form-host hidden"></div></section>`;
      const search = container.querySelector("#quoteSearch");
      search.addEventListener("input", () => { const term = search.value.toLowerCase().trim(); const filtered = presupuestos.filter(q => [q.numero,q.clienteNombre,q.estado].some(v => String(v || "").toLowerCase().includes(term))); container.querySelector("#quoteCount").textContent = `${filtered.length} presupuesto${filtered.length === 1 ? "" : "s"}`; container.querySelector("#quoteTable").innerHTML = tableHTML(filtered); bindTable(); });
      bindTable();
    };
    const closeForm = () => { const host = container.querySelector("#quoteFormHost"); host.classList.add("hidden"); host.innerHTML = ""; };
    const openForm = async (quote = {}) => {
      const host = container.querySelector("#quoteFormHost");
      const bcv = quote.tasaBCV || await getBCV();
      host.innerHTML = formHTML({ clientes, quote, lines: quote.lineas || [{ descripcion:"", cantidad:1, precioUSD:0 }], bcv });
      host.classList.remove("hidden"); host.scrollIntoView({ behavior:"smooth", block:"start" });
      const form = host.querySelector("#quoteForm");
      form.querySelectorAll('[data-action="close-quote"]').forEach(b => b.addEventListener("click", closeForm));
      const add = () => { const tbody = form.querySelector("#quoteLines"); const index = tbody.children.length; tbody.insertAdjacentHTML("beforeend", lineRow({}, index)); bindLines(); calculate(form); };
      host.querySelector("#addLine").addEventListener("click", add);
      const bindLines = () => { form.querySelectorAll(".line-qty,.line-price").forEach(i => i.addEventListener("input", () => calculate(form))); form.querySelectorAll("[data-remove-line]").forEach(b => b.addEventListener("click", () => { if (form.querySelectorAll("#quoteLines tr").length > 1) { b.closest("tr").remove(); calculate(form); } })); };
      bindLines();
      form.querySelector('[name="iva"]').addEventListener("input", () => calculate(form));
      form.querySelector('[name="tasaBCV"]').addEventListener("input", () => calculate(form));
      calculate(form);
      form.addEventListener("submit", async e => { e.preventDefault(); await saveQuote(form, presupuestos, clientes, render); });
    };
    const bindTable = () => {
      container.querySelectorAll("[data-action='new-quote']").forEach(b => b.addEventListener("click", () => openForm()));
      container.querySelectorAll("[data-action='edit-quote']").forEach(b => b.addEventListener("click", () => openForm(presupuestos.find(q => q.id === b.dataset.id))));
      container.querySelectorAll("[data-action='payment-link']").forEach(b => b.addEventListener("click", () => copyPaymentLink(presupuestos.find(q => q.id === b.dataset.id))));
    };
    const copyPaymentLink = async quote => { if (!quote?.paymentToken) return window.alert("Este presupuesto todavía no tiene enlace de pago."); const link = `${location.origin}${location.pathname.replace(/index\.html$/, "")}pago.html?token=${encodeURIComponent(quote.paymentToken)}`; try { await navigator.clipboard.writeText(link); window.alert(`Enlace de pago copiado:\n\n${link}`); } catch { window.prompt("Copia este enlace de pago:", link); } };
    async function saveQuote(form, items, clients, rerender) {
      const data = Object.fromEntries(new FormData(form).entries());
      const cliente = clients.find(c => c.id === data.clienteId);
      const calc = calculate(form);
      const lineas = collectLines(form);
      if (!cliente || !lineas.length || calc.total <= 0) return window.alert("Selecciona un cliente y agrega al menos un concepto con valor mayor a cero.");
      const id = form.dataset.id;
      const existing = items.find(q => q.id === id);
      const payload = { clienteId: cliente.id, clienteNombre: cliente.nombre, clienteRif: cliente.rif || "", fecha:data.fecha, vigenciaDias:Number(data.vigenciaDias)||15, iva:Number(data.iva)||0, tasaBCV:Number(data.tasaBCV)||0, lineas, subtotalUSD:calc.subtotal, ivaUSD:calc.tax, totalUSD:calc.total, totalBsHistorico:calc.total*calc.rate, descripcion:String(data.descripcion||"").trim(), observaciones:String(data.observaciones||"").trim(), estado:data.estado || "BORRADOR", updatedAt:serverTimestamp(), updatedBy:user()?.uid || null };
      try {
        if (id) await updateDoc(doc(db,"presupuestos",id), payload);
        else await addDoc(collection(db,"presupuestos"), { ...payload, numero:nextNumber(items), paymentToken:crypto.randomUUID(), createdAt:serverTimestamp(), createdBy:user()?.uid || null });
        await reload(rerender);
      } catch (error) { console.error(error); window.alert("No se pudo guardar el presupuesto. Revisa Firestore."); }
    }
    async function reload(rerender) { [clientes,presupuestos] = await Promise.all([getClientes(),getPresupuestos()]); await rerender(); }
    await render();
  } catch (error) { console.error(error); container.innerHTML = `<article class="card"><h3>No se pudo cargar Presupuestos</h3><p class="muted">Revisa la conexión con Firestore.</p></article>`; }
}
