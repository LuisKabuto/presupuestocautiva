import { auth, db } from "./auth.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const esc = v => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const dateText = v => v?.toDate ? v.toDate().toLocaleDateString("es-VE") : v || "—";
const user = () => auth.currentUser;
const projectStatuses = ["PLANIFICACION", "EN_PROGRESO", "PAUSADO", "COMPLETADO", "CANCELADO"];
const phaseStatuses = ["PENDIENTE", "EN_PROGRESO", "COMPLETADA", "BLOQUEADA"];
const projectStatusLabel = s => ({ PLANIFICACION:"Planificación", EN_PROGRESO:"En progreso", PAUSADO:"Pausado", COMPLETADO:"Completado", CANCELADO:"Cancelado" }[s] || s || "—");
const phaseStatusLabel = s => ({ PENDIENTE:"Pendiente", EN_PROGRESO:"En progreso", COMPLETADA:"Completada", BLOQUEADA:"Bloqueada" }[s] || s || "—");
const money = v => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });

async function read(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

function phaseFormHTML(phase = {}) {
  return `<form class="phase-form" data-phase-id="${esc(phase.id || "")}">
    <div class="form-grid">
      <label>Nombre de fase *<input name="nombre" required maxlength="120" value="${esc(phase.nombre)}" placeholder="Ej. Instalación"></label>
      <label>Estado<select name="estado">${phaseStatuses.map(s => `<option value="${s}" ${(phase.estado || "PENDIENTE") === s ? "selected" : ""}>${phaseStatusLabel(s)}</option>`).join("")}</select></label>
      <label>Responsable<input name="responsable" maxlength="120" value="${esc(phase.responsable)}" placeholder="Responsable"></label>
      <label>Avance (%)<input name="porcentaje" type="number" min="0" max="100" step="1" value="${Number(phase.porcentaje) || 0}"></label>
      <label>Fecha de inicio<input name="fechaInicio" type="date" value="${esc(phase.fechaInicio)}"></label>
      <label>Fecha de cierre<input name="fechaFin" type="date" value="${esc(phase.fechaFin)}"></label>
      <label class="form-full">Notas<textarea name="notas" rows="2" maxlength="500" placeholder="Pendientes, observaciones o entregables">${esc(phase.notas)}</textarea></label>
    </div>
    <div class="form-actions"><button type="button" class="btn-secondary" data-phase-cancel>Cancelar</button><button type="submit" class="btn-primary">${phase.id ? "Guardar fase" : "Agregar fase"}</button></div>
  </form>`;
}

function phasesSectionHTML(projectId, phases) {
  const items = phases.filter(p => p.proyectoId === projectId).sort((a,b) => (Number(a.orden)||0) - (Number(b.orden)||0));
  const average = items.length ? Math.round(items.reduce((n,p) => n + Math.max(0, Math.min(100, Number(p.porcentaje)||0)), 0) / items.length) : 0;
  return `<section class="card" id="phasesSection" style="margin-top:18px">
    <div class="list-summary"><div><span class="eyebrow">EJECUCIÓN</span><h3 style="margin:4px 0">Fases del proyecto</h3><p class="muted">Divide el proyecto en etapas y controla su avance.</p></div><div style="text-align:right"><strong>${average}%</strong><small class="muted" style="display:block">avance promedio</small></div></div>
    <div style="height:8px;background:rgba(255,255,255,.08);border-radius:8px;overflow:hidden;margin:12px 0 16px"><div style="width:${average}%;height:100%;background:var(--gold,#d9ad4b)"></div></div>
    <div id="phaseList">${items.length ? items.map(p => `<div class="card" style="margin-top:10px;padding:14px"><div style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(130px,1fr) minmax(110px,1fr) minmax(110px,1fr) 140px;gap:10px;align-items:center"><div><strong>${esc(p.nombre || "Sin nombre")}</strong><small style="display:block;color:var(--muted)">${esc(p.responsable || "Sin responsable")}</small></div><span class="status-pill status-${String(p.estado || "PENDIENTE").toLowerCase()}">${phaseStatusLabel(p.estado || "PENDIENTE")}</span><span>Inicio: ${esc(dateText(p.fechaInicio))}</span><span>Fin: ${esc(dateText(p.fechaFin))}</span><div style="text-align:right"><strong>${Number(p.porcentaje)||0}%</strong> <button type="button" class="btn-table" data-phase-edit="${esc(p.id)}">Editar</button> <button type="button" class="btn-table btn-deactivate" data-phase-delete="${esc(p.id)}">Eliminar</button></div></div><div style="margin-top:10px;height:7px;background:rgba(255,255,255,.08);border-radius:8px;overflow:hidden"><div style="width:${Math.max(0,Math.min(100,Number(p.porcentaje)||0))}%;height:100%;background:var(--gold,#d9ad4b)"></div></div>${p.notas ? `<small style="display:block;margin-top:8px;color:var(--muted)">${esc(p.notas)}</small>` : ""}</div>`).join("") : `<p class="muted">Este proyecto todavía no tiene fases.</p>`}</div>
    <button type="button" class="btn-secondary" data-phase-new style="margin-top:12px">+ Agregar fase</button><div id="phaseFormHost"></div>
  </section>`;
}

function formHTML(clients, quotes, project = {}, phases = []) {
  const editing = Boolean(project.id);
  const approved = quotes.filter(q => q.estado === "APROBADA");
  const selectedQuote = quotes.find(q => q.id === project.presupuestoId);
  const quoteOptions = approved.concat(selectedQuote && !approved.some(q => q.id === selectedQuote.id) ? [selectedQuote] : []);
  return `<div class="client-form-head"><div><span class="eyebrow">${editing ? "EDITAR PROYECTO" : "NUEVO PROYECTO"}</span><h2>${editing ? esc(project.nombre) : "Crear proyecto"}</h2></div><button type="button" class="btn-secondary" data-action="close-form">Cerrar</button></div>
    <form id="projectForm" data-id="${esc(project.id || "")}">
      <div class="form-grid">
        <label>Nombre del proyecto *<input name="nombre" required maxlength="150" value="${esc(project.nombre)}" placeholder="Nombre del proyecto"></label>
        <label>Presupuesto asociado<select name="presupuestoId"><option value="">Sin presupuesto asociado</option>${quoteOptions.map(q => `<option value="${esc(q.id)}" ${project.presupuestoId === q.id ? "selected" : ""}>${esc(q.numero || "Presupuesto")} · ${esc(q.clienteNombre || "")} · $${money(q.totalUSD)}</option>`).join("")}</select><small class="field-help">Solo se muestran presupuestos aprobados.</small></label>
        <label>Cliente<select name="clienteId"><option value="">Sin cliente asociado</option>${clients.map(c => `<option value="${esc(c.id)}" ${project.clienteId === c.id ? "selected" : ""}>${esc(c.nombre)}${c.rif ? ` · ${esc(c.rif)}` : ""}</option>`).join("")}</select></label>
        <label>Estado<select name="estado">${projectStatuses.map(s => `<option value="${s}" ${(project.estado || "PLANIFICACION") === s ? "selected" : ""}>${projectStatusLabel(s)}</option>`).join("")}</select></label>
        <label>Responsable<input name="responsable" maxlength="120" value="${esc(project.responsable)}" placeholder="Responsable interno"></label>
        <label>Fecha de inicio<input name="fechaInicio" type="date" value="${esc(project.fechaInicio)}"></label>
        <label>Fecha estimada de cierre<input name="fechaFin" type="date" value="${esc(project.fechaFin)}"></label>
        <label class="form-full">Descripción<textarea name="descripcion" rows="3" maxlength="800" placeholder="Alcance y objetivo del proyecto">${esc(project.descripcion)}</textarea></label>
        <label class="form-full">Notas internas<textarea name="notas" rows="3" maxlength="1000" placeholder="Pendientes, riesgos o información operativa">${esc(project.notas)}</textarea></label>
      </div>
      <div class="form-actions"><button type="button" class="btn-secondary" data-action="close-form">Cancelar</button><button type="submit" class="btn-primary">${editing ? "Guardar cambios" : "Crear proyecto"}</button></div>
    </form>${editing ? phasesSectionHTML(project.id, phases) : ""}`;
}

function tableHTML(items) {
  if (!items.length) return `<div class="empty-state"><strong>No hay proyectos registrados</strong><p class="muted">Crea el primer proyecto para comenzar el seguimiento operativo.</p><button class="btn-primary" data-action="new-project">+ Nuevo proyecto</button></div>`;
  return `<div class="client-table-wrap"><table class="client-table"><thead><tr><th>Proyecto</th><th>Cliente</th><th>Presupuesto</th><th>Estado</th><th>Responsable</th><th>Inicio</th><th>Cierre estimado</th><th></th></tr></thead><tbody>${items.map(p => `<tr><td><strong>${esc(p.nombre || "Sin nombre")}</strong><small>${esc(p.descripcion || "")}</small></td><td>${esc(p.clienteNombre || "—")}</td><td>${p.presupuestoNumero ? `<strong>${esc(p.presupuestoNumero)}</strong><small>$${money(p.presupuestoTotalUSD)}</small>` : "—"}</td><td><span class="status-pill status-${String(p.estado || "PLANIFICACION").toLowerCase()}">${projectStatusLabel(p.estado || "PLANIFICACION")}</span></td><td>${esc(p.responsable || "—")}</td><td>${esc(dateText(p.fechaInicio))}</td><td>${esc(dateText(p.fechaFin))}</td><td class="table-actions"><button class="btn-table" data-action="edit" data-id="${esc(p.id)}">Editar</button></td></tr>`).join("")}</tbody></table></div>`;
}

export async function renderProyectos(container) {
  container.innerHTML = `<article class="card loading-card"><p class="muted">Cargando proyectos...</p></article>`;
  try {
    let [projects, clients, quotes, phases] = await Promise.all([read("proyectos"), read("clientes"), read("presupuestos"), read("fases_proyecto")]);

    const render = () => {
      const term = (container.querySelector("#projectSearch")?.value || "").toLowerCase().trim();
      const list = projects.filter(p => [p.nombre,p.clienteNombre,p.responsable,p.estado,p.presupuestoNumero].some(v => String(v || "").toLowerCase().includes(term)));
      container.innerHTML = `<section class="project-module"><div class="module-toolbar"><div><span class="eyebrow">OPERACIONES</span><h2>Proyectos</h2><p class="muted">Seguimiento del trabajo desde la aprobación hasta la entrega.</p></div><div class="toolbar-actions"><input id="projectSearch" class="search-input" type="search" value="${esc(term)}" placeholder="Buscar proyecto, cliente, presupuesto o responsable..."><button class="btn-primary" data-action="new-project">+ Nuevo proyecto</button></div></div><div class="grid kpis"><article class="card stat-card"><h3>Total</h3><div class="metric">${projects.length}</div><p class="muted">Proyectos registrados</p></article><article class="card stat-card"><h3>En progreso</h3><div class="metric">${projects.filter(p=>p.estado === "EN_PROGRESO").length}</div><p class="muted">Trabajo activo</p></article><article class="card stat-card"><h3>Planificación</h3><div class="metric">${projects.filter(p=>p.estado === "PLANIFICACION").length}</div><p class="muted">Pendientes de ejecución</p></article><article class="card stat-card"><h3>Completados</h3><div class="metric">${projects.filter(p=>p.estado === "COMPLETADO").length}</div><p class="muted">Entregados</p></article></div><div class="card client-list-card"><div class="list-summary"><span>${list.length} proyecto${list.length === 1 ? "" : "s"}</span><span class="muted">Los proyectos conservan su historial operativo.</span></div><div id="projectTable">${tableHTML(list)}</div></div><div id="projectFormHost" class="client-form-host hidden"></div></section>`;
      container.querySelector("#projectSearch").addEventListener("input", render);
      container.querySelectorAll("[data-action]").forEach(b => b.addEventListener("click", () => { if (b.dataset.action === "new-project") openForm(); if (b.dataset.action === "edit") openForm(projects.find(p => p.id === b.dataset.id)); }));
    };

    const openForm = project => {
      const host = container.querySelector("#projectFormHost");
      host.innerHTML = `<div class="client-form-card">${formHTML(clients, quotes, project || {}, phases)}</div>`;
      host.classList.remove("hidden");
      host.scrollIntoView({ behavior:"smooth", block:"start" });
      host.querySelectorAll('[data-action="close-form"]').forEach(b => b.addEventListener("click", () => { host.classList.add("hidden"); host.innerHTML = ""; }));

      const form = host.querySelector("#projectForm");
      const quoteSelect = form.querySelector('[name="presupuestoId"]');
      const clientSelect = form.querySelector('[name="clienteId"]');
      quoteSelect.addEventListener("change", () => { const q = quotes.find(x => x.id === quoteSelect.value); if (q?.clienteId) clientSelect.value = q.clienteId; });
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget).entries());
        const client = clients.find(c => c.id === d.clienteId);
        const quote = quotes.find(q => q.id === d.presupuestoId);
        if (quote && quote.estado !== "APROBADA" && quote.id !== project?.presupuestoId) return alert("El presupuesto seleccionado debe estar aprobado.");
        const payload = { nombre:String(d.nombre||"").trim(), clienteId:client?.id||quote?.clienteId||"", clienteNombre:client?.nombre||quote?.clienteNombre||"", clienteRif:client?.rif||quote?.clienteRif||"", presupuestoId:quote?.id||"", presupuestoNumero:quote?.numero||"", presupuestoTotalUSD:Number(quote?.totalUSD||0), presupuestoTasaBCV:Number(quote?.tasaBCV||0), estado:projectStatuses.includes(d.estado)?d.estado:"PLANIFICACION", responsable:String(d.responsable||"").trim(), fechaInicio:d.fechaInicio||"", fechaFin:d.fechaFin||"", descripcion:String(d.descripcion||"").trim(), notas:String(d.notas||"").trim(), updatedAt:serverTimestamp(), updatedBy:user()?.uid||null };
        if (!payload.nombre) return alert("El nombre del proyecto es obligatorio.");
        try {
          if (project?.id) await updateDoc(doc(db,"proyectos",project.id), payload);
          else await addDoc(collection(db,"proyectos"), { ...payload, createdAt:serverTimestamp(), createdBy:user()?.uid||null });
          await renderProyectos(container);
        } catch (error) { console.error(error); alert("No se pudo guardar el proyecto. Revisa Firestore."); }
      });

      if (!project?.id) return;

      const bindPhaseForm = () => {
        const phaseHost = host.querySelector("#phaseFormHost");
        const pf = phaseHost?.querySelector(".phase-form");
        if (!pf) return;
        pf.querySelector("[data-phase-cancel]")?.addEventListener("click", () => { phaseHost.innerHTML = ""; });
        pf.addEventListener("submit", async e => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(pf).entries());
          const phaseId = pf.dataset.phaseId;
          const current = phases.find(x => x.id === phaseId);
          const payload = { proyectoId:project.id, nombre:String(d.nombre||"").trim(), estado:phaseStatuses.includes(d.estado)?d.estado:"PENDIENTE", responsable:String(d.responsable||"").trim(), porcentaje:Math.max(0,Math.min(100,Number(d.porcentaje)||0)), fechaInicio:d.fechaInicio||"", fechaFin:d.fechaFin||"", notas:String(d.notas||"").trim(), orden:Number(current?.orden)||phases.filter(x=>x.proyectoId===project.id).length+1, updatedAt:serverTimestamp(), updatedBy:user()?.uid||null };
          if (!payload.nombre) return alert("El nombre de la fase es obligatorio.");
          try {
            if (phaseId) { await updateDoc(doc(db,"fases_proyecto",phaseId), payload); const i=phases.findIndex(x=>x.id===phaseId); if(i>=0) phases[i]={...phases[i],...payload}; }
            else { const ref=await addDoc(collection(db,"fases_proyecto"), {...payload,createdAt:serverTimestamp(),createdBy:user()?.uid||null}); phases.push({...payload,id:ref.id}); }
            refreshPhaseSection();
          } catch (error) { console.error(error); alert("No se pudo guardar la fase. Revisa Firestore."); }
        });
      };

      const refreshPhaseSection = () => {
        const section = host.querySelector("#phasesSection");
        if (!section) return;
        section.outerHTML = phasesSectionHTML(project.id, phases);
        bindPhaseButtons();
      };

      const bindPhaseButtons = () => {
        const phaseHost = host.querySelector("#phaseFormHost");
        host.querySelectorAll("[data-phase-new]").forEach(b => b.addEventListener("click", () => { host.querySelector("#phaseFormHost").innerHTML = phaseFormHTML(); bindPhaseForm(); }));
        host.querySelectorAll("[data-phase-edit]").forEach(b => b.addEventListener("click", () => { const p=phases.find(x=>x.id===b.dataset.phaseEdit); host.querySelector("#phaseFormHost").innerHTML=phaseFormHTML(p||{}); bindPhaseForm(); }));
        host.querySelectorAll("[data-phase-delete]").forEach(b => b.addEventListener("click", async () => { if(!confirm("¿Eliminar esta fase?")) return; try { await deleteDoc(doc(db,"fases_proyecto",b.dataset.phaseDelete)); phases=phases.filter(x=>x.id!==b.dataset.phaseDelete); refreshPhaseSection(); } catch(error) { console.error(error); alert("No se pudo eliminar la fase."); } }));
      };

      bindPhaseButtons();
    };

    render();
  } catch (error) {
    console.error(error);
    container.innerHTML = `<article class="card"><h3>No se pudo cargar Proyectos</h3><p class="muted">Revisa la conexión con Firestore y las reglas publicadas.</p></article>`;
  }
}
