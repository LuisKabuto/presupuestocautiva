import { auth, db } from "./auth.js";
import {
  collection, getDocs, addDoc, updateDoc, doc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const BCV_URL = "https://ve.dolarapi.com/v1/dolares/oficial";
const esc = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const money = v => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
const bs = v => Number(v || 0).toLocaleString("es-VE", { minimumFractionDigits:2, maximumFractionDigits:2 });
const user = () => auth.currentUser;

async function getRequests() {
  const snap = await getDocs(collection(db, "solicitudes_pago"));
  return snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => {
    const av = a.createdAt?.seconds || 0, bv = b.createdAt?.seconds || 0;
    return bv - av;
  });
}

async function getBCV() {
  const response = await fetch(`${BCV_URL}?t=${Date.now()}`, { cache:"no-store" });
  if (!response.ok) throw new Error("No fue posible consultar la tasa BCV");
  const data = await response.json();
  return Number(data.promedio || data.venta || data.price || data.valor || 0) || 0;
}

function dateTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-VE", { dateStyle:"short", timeStyle:"short" });
}

function statusLabel(s) {
  return { PENDIENTE:"Pendiente", VERIFICADO:"Verificado", RECHAZADO:"Rechazado" }[s] || s || "—";
}

function tableHTML(items) {
  if (!items.length) return `<div class="empty-state"><strong>No hay solicitudes de pago</strong><p class="muted">Los comprobantes enviados por clientes aparecerán aquí.</p></div>`;
  return `<div class="client-table-wrap"><table class="client-table"><thead><tr><th>Fecha</th><th>Presupuesto</th><th>Cliente</th><th>OID</th><th>Estado</th><th></th></tr></thead><tbody>${items.map(p => `<tr><td>${esc(dateTime(p.createdAt))}</td><td><strong>${esc(p.numero || "—")}</strong></td><td>${esc(p.clienteNombre || "—")}</td><td><strong>${esc(p.oid || "—")}</strong></td><td><span class="status-pill status-${String(p.estado||"").toLowerCase()}">${statusLabel(p.estado)}</span></td><td class="table-actions"><button class="btn-table" data-action="view" data-id="${p.id}">Revisar</button></td></tr>`).join("")}</tbody></table></div>`;
}

function detailHTML(p, rate) {
  return `<div class="payment-review-card"><div class="client-form-head"><div><span class="eyebrow">VERIFICACIÓN ADMINISTRATIVA</span><h2>${esc(p.numero || "Solicitud de pago")}</h2><p class="muted">${esc(p.clienteNombre || "Cliente no identificado")} · OID ${esc(p.oid || "—")}</p></div><button type="button" class="btn-secondary" data-action="close-review">Cerrar</button></div><div class="payment-review-grid"><div class="payment-review-data"><div><span>Presupuesto</span><strong>${esc(p.numero || "—")}</strong></div><div><span>Cliente</span><strong>${esc(p.clienteNombre || "—")}</strong></div><div><span>OID</span><strong>${esc(p.oid || "—")}</strong></div><div><span>Recibido</span><strong>${esc(dateTime(p.createdAt))}</strong></div><div><span>Estado</span><strong>${statusLabel(p.estado)}</strong></div></div><div class="receipt-box">${p.comprobanteData ? `<img src="${p.comprobanteData}" alt="Comprobante de pago">` : `<p class="muted">No hay comprobante disponible.</p>`}</div></div>${p.estado === "PENDIENTE" ? `<form id="verifyPaymentForm" data-id="${esc(p.id)}"><div class="form-grid"><label>Monto recibido USD *<input name="montoUSD" type="number" min="0.01" step="0.01" required placeholder="Ej. 500.00"></label><label>Tasa BCV del día *<input name="tasaBCVPago" type="number" min="0.0001" step="0.0001" value="${rate || ""}" required><small class="field-help">Se guarda como tasa histórica del pago.</small></label><label class="form-full">Observación<textarea name="nota" rows="2" maxlength="500" placeholder="Referencia de conciliación o nota interna"></textarea></label></div><div class="payment-live-total"><span>Equivalente a cobrar/registrar</span><strong id="paymentBsPreview">Bs 0,00</strong></div><div class="form-actions"><button type="button" class="btn-table btn-deactivate" data-action="reject" data-id="${p.id}">Rechazar comprobante</button><button type="submit" class="btn-primary">Verificar y registrar pago</button></div></form>` : `<div class="payment-closed-note"><strong>Solicitud ${statusLabel(p.estado).toLowerCase()}.</strong><p class="muted">Esta solicitud ya no puede ser procesada nuevamente.</p></div>`}</div>`;
}

export async function renderPagos(container) {
  container.innerHTML = `<article class="card loading-card"><p class="muted">Cargando pagos...</p></article>`;
  try {
    let requests = await getRequests();
    let currentRate = 0;
    try { currentRate = await getBCV(); } catch (e) { console.warn(e); }

    const render = () => {
      const pending = requests.filter(p => p.estado === "PENDIENTE").length;
      container.innerHTML = `<section class="payment-module"><div class="module-toolbar"><div><span class="eyebrow">ADMINISTRACIÓN FINANCIERA</span><h2>Pagos</h2><p class="muted">Revisa comprobantes, verifica el monto y registra la tasa BCV del día del pago.</p></div><div class="toolbar-actions"><span class="status-pill status-pendiente">${pending} pendiente${pending===1?"":"s"}</span><button class="btn-secondary" id="refreshPayments">Actualizar</button></div></div><div class="card client-list-card"><div class="list-summary"><span>${requests.length} solicitud${requests.length===1?"":"es"}</span><span class="muted">La tasa del presupuesto nunca se reutiliza para registrar pagos.</span></div><div id="paymentTable">${tableHTML(requests)}</div></div><div id="paymentReviewHost" class="client-form-host hidden"></div></section>`;
      container.querySelector("#refreshPayments").addEventListener("click", async () => { requests = await getRequests(); render(); });
      container.querySelectorAll('[data-action="view"]').forEach(b => b.addEventListener("click", () => openReview(requests.find(p => p.id === b.dataset.id))));
    };

    const openReview = async p => {
      if (!p) return;
      const host = container.querySelector("#paymentReviewHost");
      let rate = currentRate;
      if (!rate) { try { rate = await getBCV(); } catch {} }
      host.innerHTML = detailHTML(p, rate);
      host.classList.remove("hidden");
      host.scrollIntoView({ behavior:"smooth", block:"start" });
      host.querySelector('[data-action="close-review"]')?.addEventListener("click", () => { host.classList.add("hidden"); host.innerHTML=""; });
      const form = host.querySelector("#verifyPaymentForm");
      if (!form) return;
      const updatePreview = () => {
        const amount = Number(form.querySelector('[name="montoUSD"]')?.value) || 0;
        const r = Number(form.querySelector('[name="tasaBCVPago"]')?.value) || 0;
        host.querySelector("#paymentBsPreview").textContent = `Bs ${bs(amount*r)}`;
      };
      form.querySelectorAll("input").forEach(i => i.addEventListener("input", updatePreview));
      updatePreview();
      host.querySelector('[data-action="reject"]')?.addEventListener("click", async () => {
        const reason = prompt("Motivo del rechazo (opcional):", "");
        if (reason === null) return;
        try {
          await updateDoc(doc(db, "solicitudes_pago", p.id), { estado:"RECHAZADO", motivoRechazo:reason.trim(), reviewedAt:serverTimestamp(), reviewedBy:user()?.uid||null });
          requests = await getRequests();
          render();
        } catch (e) { console.error(e); alert("No se pudo rechazar la solicitud."); }
      });
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const amount = Number(form.querySelector('[name="montoUSD"]').value) || 0;
        const rate = Number(form.querySelector('[name="tasaBCVPago"]').value) || 0;
        const nota = form.querySelector('[name="nota"]').value.trim();
        if (amount <= 0 || rate <= 0) return alert("Indica un monto USD y una tasa BCV válidos.");
        const button = form.querySelector("button[type='submit']");
        button.disabled = true; button.textContent = "Registrando...";
        try {
          await runTransaction(db, async transaction => {
            const requestRef = doc(db, "solicitudes_pago", p.id);
            const requestSnap = await transaction.get(requestRef);
            if (!requestSnap.exists()) throw new Error("La solicitud ya no existe.");
            const request = requestSnap.data();
            if (request.estado !== "PENDIENTE") throw new Error("Esta solicitud ya fue procesada.");
            const quoteRef = doc(db, "presupuestos", request.quoteId);
            const quoteSnap = await transaction.get(quoteRef);
            if (!quoteSnap.exists()) throw new Error("El presupuesto asociado no existe.");
            const quote = quoteSnap.data();
            const saldoActual = Number(quote.saldoUSD ?? quote.totalUSD ?? 0);
            if (amount > saldoActual + 0.005) throw new Error(`El monto excede el saldo pendiente de $${money(saldoActual)}.`);
            const pagoRef = doc(collection(db, "pagos"));
            transaction.set(pagoRef, {
              solicitudPagoId:p.id,
              quoteId:request.quoteId,
              numero:request.numero || quote.numero || "",
              clienteNombre:request.clienteNombre || quote.clienteNombre || "",
              oid:request.oid || "",
              montoUSD:amount,
              tasaBCVPago:rate,
              montoBs:amount*rate,
              estado:"VERIFICADO",
              comprobanteData:request.comprobanteData || "",
              nota,
              fechaPago:serverTimestamp(),
              createdAt:serverTimestamp(),
              createdBy:user()?.uid||null
            });
            const nuevoSaldo = Math.max(0, saldoActual - amount);
            transaction.update(quoteRef, { saldoUSD:nuevoSaldo, updatedAt:serverTimestamp(), updatedBy:user()?.uid||null, estadoPago:nuevoSaldo <= 0.005 ? "PAGADO" : "PARCIAL" });
            transaction.update(requestRef, { estado:"VERIFICADO", montoUSD:amount, tasaBCVPago:rate, montoBs:amount*rate, reviewedAt:serverTimestamp(), reviewedBy:user()?.uid||null });
          });
          requests = await getRequests();
          render();
          alert("Pago verificado y registrado correctamente.");
        } catch (error) { console.error(error); alert(error.message || "No se pudo registrar el pago."); button.disabled=false; button.textContent="Verificar y registrar pago"; }
      });
    };
    render();
  } catch (error) {
    console.error(error);
    container.innerHTML = `<article class="card"><h3>No se pudo cargar Pagos</h3><p class="muted">Revisa la conexión con Firestore y las reglas publicadas.</p></article>`;
  }
}
