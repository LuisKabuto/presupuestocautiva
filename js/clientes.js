import { auth, db } from "./auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const COLLECTION = "clientes";
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const currentUser = () => auth.currentUser;
const normalizeRif = value => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
const formatDate = value => !value ? "—" : typeof value.toDate === "function" ? value.toDate().toLocaleDateString("es-VE") : "—";

async function getClientes() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" }));
}

function formHTML(cliente = {}) {
  const editing = Boolean(cliente.id);
  return `<div class="client-form-head"><div><span class="eyebrow">${editing ? "EDITAR CLIENTE" : "NUEVO CLIENTE"}</span><h2>${editing ? "Actualizar información" : "Registrar cliente"}</h2></div><button type="button" class="btn-secondary" data-action="close-form">Cerrar</button></div>
  <form id="clienteForm" class="client-form" data-id="${esc(cliente.id || "")}" autocomplete="off"><div class="form-grid">
    <label>Tipo<select name="tipo"><option value="empresa" ${cliente.tipo === "persona" ? "" : "selected"}>Empresa</option><option value="persona" ${cliente.tipo === "persona" ? "selected" : ""}>Persona</option></select></label>
    <label>Razón social / Nombre *<input name="nombre" required maxlength="120" value="${esc(cliente.nombre)}" placeholder="Nombre del cliente"></label>
    <label>RIF / CI<input name="rif" maxlength="30" value="${esc(cliente.rif)}" placeholder="J-12345678-9"></label>
    <label>Persona de contacto<input name="contacto" maxlength="100" value="${esc(cliente.contacto)}" placeholder="Nombre y apellido"></label>
    <label>Teléfono<input name="telefono" type="tel" maxlength="30" value="${esc(cliente.telefono)}" placeholder="+58 ..."></label>
    <label>WhatsApp<input name="whatsapp" type="tel" maxlength="30" value="${esc(cliente.whatsapp)}" placeholder="+58 ..."></label>
    <label>Email<input name="email" type="email" maxlength="120" value="${esc(cliente.email)}" placeholder="correo@empresa.com"></label>
    <label>Estado<select name="activo"><option value="true" ${cliente.activo === false ? "" : "selected"}>Activo</option><option value="false" ${cliente.activo === false ? "selected" : ""}>Inactivo</option></select></label>
    <label class="form-full">Dirección<textarea name="direccion" rows="2" maxlength="300" placeholder="Dirección fiscal o comercial">${esc(cliente.direccion)}</textarea></label>
    <label class="form-full">Notas<textarea name="notas" rows="3" maxlength="500" placeholder="Información adicional">${esc(cliente.notas)}</textarea></label>
  </div><div class="form-actions"><button type="button" class="btn-secondary" data-action="close-form">Cancelar</button><button type="submit" class="btn-primary">${editing ? "Guardar cambios" : "Crear cliente"}</button></div>${editing ? `<p class="form-meta">Creado: ${formatDate(cliente.createdAt)} · Última actualización: ${formatDate(cliente.updatedAt)}</p>` : ""}</form>`;
}

function tableHTML(clientes) {
  if (!clientes.length) return `<div class="empty-state"><strong>No hay clientes registrados</strong><p class="muted">Crea el primer cliente para comenzar a construir el directorio.</p><button class="btn-primary" data-action="new-client">Nuevo cliente</button></div>`;
  return `<div class="client-table-wrap"><table class="client-table"><thead><tr><th>Cliente</th><th>RIF / CI</th><th>Contacto</th><th>Teléfono</th><th>Estado</th><th>Actualizado</th><th></th></tr></thead><tbody>${clientes.map(cliente => `<tr>
    <td><strong>${esc(cliente.nombre || "Sin nombre")}</strong><small>${esc(cliente.tipo === "persona" ? "Persona" : "Empresa")}</small></td><td>${esc(cliente.rif || "—")}</td>
    <td>${esc(cliente.contacto || "—")}<small>${esc(cliente.email || "")}</small></td><td>${esc(cliente.telefono || cliente.whatsapp || "—")}</td>
    <td><span class="status-pill ${cliente.activo === false ? "status-inactive" : "status-active"}">${cliente.activo === false ? "Inactivo" : "Activo"}</span></td><td>${formatDate(cliente.updatedAt || cliente.createdAt)}</td>
    <td class="table-actions"><button class="btn-table" data-action="edit" data-id="${esc(cliente.id)}">Editar</button><button class="btn-table ${cliente.activo === false ? "btn-reactivate" : "btn-deactivate"}" data-action="toggle" data-id="${esc(cliente.id)}">${cliente.activo === false ? "Activar" : "Desactivar"}</button></td>
  </tr>`).join("")}</tbody></table></div>`;
}

export async function renderClientes(container) {
  container.innerHTML = `<article class="card loading-card"><p class="muted">Cargando clientes...</p></article>`;
  try {
    let clientes = await getClientes();
    let current = clientes;

    const closeForm = () => { const host = container.querySelector("#clientFormHost"); if (host) { host.classList.add("hidden"); host.innerHTML = ""; } };
    const openForm = (cliente = {}) => {
      const host = container.querySelector("#clientFormHost");
      host.innerHTML = `<div class="client-form-card">${formHTML(cliente)}</div>`;
      host.classList.remove("hidden"); host.scrollIntoView({ behavior: "smooth", block: "start" });
      host.querySelectorAll('[data-action="close-form"]').forEach(button => button.addEventListener("click", closeForm));
      host.querySelector("#clienteForm").addEventListener("submit", async event => { event.preventDefault(); await saveCliente(event.currentTarget, clientes, render); });
    };
    const toggleCliente = async id => {
      const cliente = clientes.find(c => c.id === id); if (!cliente) return;
      const nextActive = cliente.activo === false;
      if (!window.confirm(nextActive ? `¿Activar a ${cliente.nombre}?` : `¿Desactivar a ${cliente.nombre}?`)) return;
      try {
        const user = currentUser();
        await updateDoc(doc(db, COLLECTION, id), { activo: nextActive, updatedAt: serverTimestamp(), updatedBy: user?.uid || null });
        await render();
      } catch (error) { console.error("Error actualizando cliente:", error); window.alert("No se pudo actualizar el estado del cliente."); }
    };
    const render = async () => {
      clientes = await getClientes(); current = clientes;
      container.innerHTML = `<section class="client-module"><div class="module-toolbar"><div><span class="eyebrow">DIRECTORIO COMERCIAL</span><h2>Clientes</h2><p class="muted">Gestiona empresas y personas desde un único registro.</p></div><div class="toolbar-actions"><input id="clientSearch" class="search-input" type="search" placeholder="Buscar nombre, RIF, teléfono o email..."><button class="btn-primary" data-action="new-client">+ Nuevo cliente</button></div></div><div class="card client-list-card"><div class="list-summary"><span id="clientCount">${current.length} cliente${current.length === 1 ? "" : "s"}</span><span class="muted">Los registros inactivos se conservan para historial.</span></div><div id="clientTable">${tableHTML(current)}</div></div><div id="clientFormHost" class="client-form-host hidden"></div></section>`;
      const search = container.querySelector("#clientSearch");
      search.addEventListener("input", () => { const term = search.value.trim().toLowerCase(); current = clientes.filter(c => [c.nombre, c.rif, c.contacto, c.telefono, c.whatsapp, c.email].some(value => String(value || "").toLowerCase().includes(term))); container.querySelector("#clientCount").textContent = `${current.length} cliente${current.length === 1 ? "" : "s"}`; container.querySelector("#clientTable").innerHTML = tableHTML(current); });
      container.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", async () => { const action = button.dataset.action; if (action === "new-client") openForm(); if (action === "edit") openForm(clientes.find(c => c.id === button.dataset.id)); if (action === "toggle") await toggleCliente(button.dataset.id); }));
    };
    await render();
  } catch (error) { console.error("Error cargando clientes:", error); container.innerHTML = `<article class="card"><h3>No se pudo cargar Clientes</h3><p class="muted">Firestore no respondió correctamente. Revisa las reglas de acceso y la conexión del proyecto.</p></article>`; }
}

async function saveCliente(form, clientes, rerender) {
  const data = Object.fromEntries(new FormData(form).entries());
  const nombre = String(data.nombre || "").trim(); const rif = normalizeRif(data.rif); const id = form.dataset.id;
  if (!nombre) { window.alert("El nombre o razón social es obligatorio."); return; }
  if (rif) { const duplicate = clientes.find(c => normalizeRif(c.rif) === rif && c.id !== id); if (duplicate) { window.alert(`Ya existe un cliente con RIF/CI ${rif}: ${duplicate.nombre}.`); return; } }
  const user = currentUser();
  const payload = { tipo: data.tipo === "persona" ? "persona" : "empresa", nombre, rif, contacto: String(data.contacto || "").trim(), telefono: String(data.telefono || "").trim(), whatsapp: String(data.whatsapp || "").trim(), email: String(data.email || "").trim().toLowerCase(), direccion: String(data.direccion || "").trim(), notas: String(data.notas || "").trim(), activo: data.activo !== "false", updatedAt: serverTimestamp(), updatedBy: user?.uid || null };
  try {
    if (id) await updateDoc(doc(db, COLLECTION, id), payload); else await addDoc(collection(db, COLLECTION), { ...payload, createdAt: serverTimestamp(), createdBy: user?.uid || null });
    await rerender();
  } catch (error) { console.error("Error guardando cliente:", error); window.alert("No se pudo guardar el cliente. Revisa la conexión y las reglas de Firestore."); }
}
