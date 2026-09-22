import { auth, onAuthStateChanged, signOut } from "./auth.js";
import { ensureUserProfile } from "./usuarios.js";
import { getDashboardStats, dashboardHTML } from "./dashboard.js";
import { renderClientes } from "./clientes.js";
import { renderPresupuestos } from "./presupuestos-v2.js";
import { renderPagos } from "./pagos.js";
import { renderFinanzas } from "./finanzas.js";
import { renderProyectos } from "./proyectos.js";
import { renderIncidencias } from "./incidencias.js";
import { renderConfiguracion } from "./configuracion.js";
import { renderDocumentos } from "./documentos.js";
import { renderRecibos } from "./recibos.js";
import { renderReportes } from "./reportes.js";
import { renderUsuarios } from "./usuarios-admin.js";

const view=document.querySelector("#view");
const title=document.querySelector("#pageTitle");
const badge=document.querySelector("#userBadge");
const logout=document.querySelector("#logoutBtn");
const views={dashboard:{title:"Dashboard"},presupuestos:{title:"Presupuestos"},documentos:{title:"Documentos"},recibos:{title:"Recibos de trabajo"},clientes:{title:"Clientes"},pagos:{title:"Pagos"},finanzas:{title:"Finanzas"},reportes:{title:"Reportes"},usuarios:{title:"Usuarios"},proyectos:{title:"Proyectos"},incidencias:{title:"Incidencias"},configuracion:{title:"Configuración"}};
async function render(name){const item=views[name]||views.dashboard;title.textContent=item.title;document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.view===name));if(name==="dashboard"){view.innerHTML='<article class="card loading-card"><p class="muted">Consultando información...</p></article>';try{view.innerHTML=dashboardHTML(await getDashboardStats());}catch(error){console.error(error);view.innerHTML='<article class="card"><h3>No se pudo cargar el Dashboard</h3><p class="muted">Firestore no respondió correctamente.</p></article>';}return;}if(name==="clientes"){await renderClientes(view);return;}if(name==="presupuestos"){await renderPresupuestos(view);return;}if(name==="documentos"){await renderDocumentos(view);return;}if(name==="recibos"){await renderRecibos(view);return;}if(name==="pagos"){await renderPagos(view);return;}if(name==="finanzas"){await renderFinanzas(view);return;}if(name==="reportes"){await renderReportes(view);return;}if(name==="usuarios"){await renderUsuarios(view);return;}if(name==="proyectos"){await renderProyectos(view);return;}if(name==="incidencias"){await renderIncidencias(view);return;}if(name==="configuracion"){await renderConfiguracion(view);return;}view.innerHTML='<article class="card"><h3>Sección no disponible</h3></article>';}
document.querySelectorAll(".nav-item").forEach(el=>el.addEventListener("click",event=>{event.preventDefault();const name=el.dataset.view;history.replaceState(null,"",`#${name}`);render(name);}));
logout.addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,async currentUser=>{if(!currentUser){window.location.replace("login.html");return;}try{const profile=await ensureUserProfile(currentUser);badge.textContent=profile?.rol?`${currentUser.email} · ${profile.rol}`:(currentUser.email||"Usuario");const navUsers=document.querySelector('[data-view="usuarios"]');if(navUsers) navUsers.style.display=profile?.rol==="admin"?"block":"none";await render(location.hash.slice(1)||"dashboard");}catch(error){console.error(error);view.innerHTML='<article class="card"><h3>No se pudo inicializar el sistema</h3><p class="muted">La autenticación funciona, pero no se pudo leer el perfil en Firestore.</p></article>';}});
