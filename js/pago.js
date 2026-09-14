import { db } from "./auth.js";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const BCV_URL = "https://ve.dolarapi.com/v1/dolares/oficial";
const token = new URLSearchParams(location.search).get("token");
const info = document.querySelector("#paymentInfo");
const form = document.querySelector("#paymentForm");
const result = document.querySelector("#paymentResult");
const capture = document.querySelector("#capture");
const preview = document.querySelector("#capturePreview");
const money = v => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
const bs = v => Number(v || 0).toLocaleString("es-VE", { minimumFractionDigits:2, maximumFractionDigits:2 });

async function getBCV() {
  const response = await fetch(`${BCV_URL}?t=${Date.now()}`, { cache:"no-store" });
  if (!response.ok) throw new Error("No fue posible consultar la tasa BCV");
  const data = await response.json();
  return Number(data.promedio || data.venta || data.price || data.valor || 0) || 0;
}

function showResult(message, error = false) {
  result.className = `payment-result ${error ? "payment-error" : "payment-success"}`;
  result.textContent = message;
  result.classList.remove("hidden");
}

async function compressImage(file) {
  if (!file || !file.type.startsWith("image/")) throw new Error("Selecciona una imagen válida.");
  const source = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.72));
  if (!blob || blob.size > 700000) throw new Error("La captura es demasiado grande. Usa una captura con menor resolución.");
  return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
}

async function init() {
  if (!token) { info.innerHTML = "<strong>Enlace inválido</strong><p>Este enlace de pago no contiene un identificador válido.</p>"; return; }
  try {
    const snap = await getDoc(doc(db, "enlaces_pago", token));
    if (!snap.exists() || snap.data().activo === false) { info.innerHTML = "<strong>Enlace no disponible</strong><p>El enlace de pago no está activo.</p>"; return; }
    const payment = snap.data();
    let rate = 0;
    try { rate = await getBCV(); } catch (e) { console.warn(e); }
    info.innerHTML = `<div class="payment-detail"><span>Presupuesto</span><strong>${payment.numero || "—"}</strong></div><div class="payment-detail"><span>Monto pendiente máximo</span><strong>$${money(payment.saldoUSD ?? payment.totalUSD)}</strong></div>${rate ? `<div class="payment-detail"><span>Tasa BCV de referencia hoy</span><strong>Bs ${bs(rate)} / $</strong></div>` : ""}<p class="payment-note">La tasa mostrada es informativa. El pago será verificado por Cautiva antes de autorizar el trabajo.</p>`;
    form.classList.remove("hidden");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const oid = document.querySelector("#oid").value.trim();
      const file = capture.files?.[0];
      if (!oid || !file) return;
      const button = form.querySelector("button[type='submit']"); button.disabled = true; button.textContent = "Enviando...";
      try {
        const comprobanteData = await compressImage(file);
        await addDoc(collection(db, "solicitudes_pago"), { token, quoteId: payment.quoteId, numero: payment.numero, clienteNombre: payment.clienteNombre || "", oid, comprobanteData, estado:"PENDIENTE", createdAt:serverTimestamp() });
        form.classList.add("hidden");
        showResult("Comprobante recibido. Cautiva verificará el pago antes de iniciar el trabajo.");
      } catch (error) { console.error(error); showResult(error.message || "No se pudo enviar el comprobante.", true); button.disabled = false; button.textContent = "Enviar comprobante"; }
    });
  } catch (error) { console.error(error); info.innerHTML = "<strong>No se pudo cargar el enlace</strong><p>Intenta nuevamente o solicita un nuevo enlace a Cautiva.</p>"; }
}

capture?.addEventListener("change", () => { const file = capture.files?.[0]; preview.innerHTML = file ? `<span>Captura seleccionada: ${file.name}</span>` : ""; });
init();
