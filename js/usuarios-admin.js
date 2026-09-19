import { db, auth } from "./auth.js";
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const current=()=>auth.currentUser;

export async function renderUsuarios(container){
  container.innerHTML='<article class="card loading-card"><p class="muted">Cargando usuarios...</p></article>';
  try{
    const snap=await getDocs(collection(db,"usuarios"));
    let users=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.email||"").localeCompare(String(b.email||"")));
    const render=()=>{
      const admin=current();
      container.innerHTML=`<section>
        <div class="module-toolbar">
          <div><span class="eyebrow">ADMINISTRACIÓN</span><h2>Usuarios y permisos</h2><p class="muted">Gestiona el rol y el estado de acceso de los usuarios existentes.</p></div>
          <div class="toolbar-actions"><span class="status-pill status-aprobada">${users.filter(u=>u.activo!==false).length} activos</span><button id="refreshUsers" class="btn-secondary">Actualizar</button></div>
        </div>
        <div class="card client-list-card">
          <div class="list-summary"><span>${users.length} usuario(s)</span><span class="muted">La cuenta de acceso se crea y administra desde Firebase Authentication.</span></div>
          <div class="table-wrap"><table class="client-table"><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          ${users.length?users.map(u=>`<tr>
            <td><strong>${esc(u.email||"—")}</strong><small class="muted" style="display:block">${esc(u.id)}</small></td>
            <td>${esc(u.nombre||"—")}</td>
            <td><select class="user-role" data-id="${u.id}" ${u.id===admin?.uid?"disabled":""}><option value="usuario" ${u.rol==="usuario"?"selected":""}>Usuario</option><option value="admin" ${u.rol==="admin"?"selected":""}>Administrador</option></select></td>
            <td><span class="status-pill ${u.activo===false?"status-rechazado":"status-aprobada"}">${u.activo===false?"Inactivo":"Activo"}</span></td>
            <td><button class="btn-table user-toggle" data-id="${u.id}" data-active="${u.activo!==false}" ${u.id===admin?.uid?"disabled":""}>${u.activo===false?"Activar":"Desactivar"}</button></td>
          </tr>`).join(""):`<tr><td colspan="5" class="muted">No hay perfiles de usuario.</td></tr>`}
          </tbody></table></div>
        </div>
        <div class="card" style="margin-top:16px"><span class="eyebrow">SEGURIDAD</span><h3>Regla operativa</h3><p class="muted">Un usuario nuevo entra como <strong>Usuario</strong>. Solo un administrador puede asignar el rol Administrador o desactivar el acceso al sistema.</p></div>
      </section>`;
      container.querySelector("#refreshUsers").addEventListener("click",async()=>{const fresh=await getDocs(collection(db,"usuarios"));users=fresh.docs.map(d=>({id:d.id,...d.data()}));render();});
      container.querySelectorAll(".user-role").forEach(select=>select.addEventListener("change",async()=>{
        const id=select.dataset.id;
        try{await updateDoc(doc(db,"usuarios",id),{rol:select.value,updatedAt:new Date()});users=users.map(u=>u.id===id?{...u,rol:select.value}:u);alert("Rol actualizado correctamente.");}
        catch(e){console.error(e);alert("No se pudo actualizar el rol.");render();}
      }));
      container.querySelectorAll(".user-toggle").forEach(button=>button.addEventListener("click",async()=>{
        const id=button.dataset.id;
        const active=button.dataset.active==="true";
        const next=!active;
        if(!confirm(next?"¿Activar el acceso de este usuario?":"¿Desactivar el acceso de este usuario?")) return;
        try{await updateDoc(doc(db,"usuarios",id),{activo:next,updatedAt:new Date()});users=users.map(u=>u.id===id?{...u,activo:next}:u);render();}catch(e){console.error(e);alert("No se pudo actualizar el estado.");}
      }));
    };
    render();
  }catch(error){
    console.error(error);
    container.innerHTML='<article class="card"><h2>No se pudieron cargar los usuarios</h2><p class="muted">Revisa que tu cuenta tenga rol administrador y que las reglas de Firestore estén publicadas.</p></article>';
  }
}
