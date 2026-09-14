import { auth, onAuthStateChanged, signOut } from "./auth.js";
import { ensureUserProfile } from "./usuarios.js";
import { getDashboardStats, dashboardHTML } from "./dashboard.js";
import { renderClientes } from "./clientes.js";
import { renderPresupuestos } from "./presupuestos-v2.js";
import { renderPagos } from "./pagos.js";

const view=document.querySelector("#view");
const title=document.querySelector("#pageTitle");
const badge=document.querySelector("#userBadge");
const logout=document.querySelector("#logoutBtn");
const views={dashboard:{title:"Dashboard"},presupuestos:{title:"Presupuestos"},clientes:{title:"Clientes"},pagos:{title:"Pagos"},proyectos:{title:"Proyectos",html:`<article class="card"><h3>Proyectos</h3><p class="muted">Seguimiento de fases, responsables, fechas y avance.</p></article>`},configuracion:{title:"Configuración",html:`<article class="card"><h3>Configuración y seguridad</h3><p class="muted">Usuarios, roles, empresa, IVA, tasa BCV, cuentas y parámetros del sistema.</p></article>`}};
async function render(name){const item=views[name]||views.dashboard;title.textContent=item.title;document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.view===name));if(name==="dashboard"){view.innerHTML=`<article class="card loading-card"><p class="muted">Consultando información...</p></article>`;try{view.innerHTML=dashboardHTML(await getDashboardStats());}catch(error){console.error(error);view.innerHTML=`<article class="card"><h3>No se pudo cargar el Dashboard</h3><p class="muted">Firestore no respondió correctamente.</p></article>`;}return;}if(name==="clientes"){await renderClientes(view);return;}if(name==="presupuestos"){await renderPresupuestos(view);return;}if(name==="pagos"){await renderPagos(view);return;}view.innerHTML=item.html;}
document.querySelectorAll(".nav-item").forEach(el=>el.addEventListener("click",event=>{event.preventDefault();const name=el.dataset.view;history.replaceState(null,"",`#${name}`);render(name);}));
logout.addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,async currentUser=>{if(!currentUser){window.location.replace("login.html");return;}try{const profile=await ensureUserProfile(currentUser);badge.textContent=profile?.rol?`${currentUser.email} · ${profile.rol}`:(currentUser.email||"Usuario");await render(location.hash.slice(1)||"dashboard");}catch(error){console.error(error);view.innerHTML=`<article class="card"><h3>No se pudo inicializar el sistema</h3><p class="muted">La autenticación funciona, pero no se pudo leer el perfil en Firestore.</p></article>`;}});
