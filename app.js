// ============================================================
//  COCHERA MANAGER — app.js
//  Firebase Realtime Database + Cloudinary (imágenes)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, set, push, onValue, remove, update
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ============================================================
//  🖼️ CONFIGURACIÓN CLOUDINARY
// ============================================================
const CLOUDINARY_CLOUD  = "dxqd2n0sj";
const CLOUDINARY_PRESET = "garage_preset";

// ============================================================
//  🔧 CONFIGURACIÓN FIREBASE
// ============================================================
const firebaseConfig = {
  apiKey:            "AIzaSyAL6rHw1I5UUXFiV1lAwBLsMdavIxfc8v0",
  authDomain:        "jpsoft-garage.firebaseapp.com",
  databaseURL:       "https://jpsoft-garage-default-rtdb.firebaseio.com",
  projectId:         "jpsoft-garage",
  storageBucket:     "jpsoft-garage.firebasestorage.app",
  messagingSenderId: "53748268483",
  appId:             "1:53748268483:web:8f0ecc612788a9adb5d176"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ============================================================
//  ESTADO GLOBAL
// ============================================================
let vehiculos     = {};
let pagos         = {};   // { "YYYY-MM": { vehiculoId: { pagado, metodo, admin, monto, fecha } } }
let totalEspacios = 20;
let editandoId    = null;
let pendingFrente = null;
let pendingDorso  = null;

// Mes activo en la vista de pagos
let mesActivo = (() => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
})();

// ============================================================
//  CLOUDINARY: SUBIR IMAGEN
// ============================================================
async function subirImagenCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) throw new Error("Error al subir imagen a Cloudinary");
  const data = await res.json();
  return data.secure_url;
}

// ============================================================
//  FIREBASE: ESCUCHAR CAMBIOS EN TIEMPO REAL
// ============================================================
function initFirebase() {
  onValue(ref(db, "vehiculos"), (snap) => {
    vehiculos = snap.val() || {};
    renderAll();
  });

  onValue(ref(db, "config/totalEspacios"), (snap) => {
    if (snap.val() !== null) {
      totalEspacios = snap.val();
      document.getElementById("esp-num").textContent = totalEspacios;
    }
    renderAll();
  });

  onValue(ref(db, "pagos"), (snap) => {
    pagos = snap.val() || {};
    renderPagos();
  });
}

function saveTotalEspacios(n) {
  set(ref(db, "config/totalEspacios"), n);
}

// ============================================================
//  HELPERS
// ============================================================
const ICONOS = { auto: "🚗", moto: "🏍️", camioneta: "🚙", pickup: "🛻", otro: "🚌" };
const TIPOS  = { auto: "Auto", moto: "Moto", camioneta: "Camioneta / SUV", pickup: "Pickup", otro: "Otro" };

function iniciales(nombre) {
  return (nombre || "?").trim().split(/[\s,]+/).filter(Boolean)
    .map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function formatMonto(n) {
  if (!n && n !== 0) return "—";
  return "$ " + Number(n).toLocaleString("es-AR");
}

function ocupados() {
  return Object.values(vehiculos).map(v => Number(v.cochera));
}

function vehiculoPorCochera(n) {
  return Object.entries(vehiculos).find(([, v]) => Number(v.cochera) === n) || null;
}

function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast" + (type ? " " + type : "");
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 2800);
}

// ============================================================
//  RENDER
// ============================================================
function renderAll() {
  renderStats();
  renderMapa();
  renderVehiculos();
  renderAlquileres();
  renderPagos();
}

const MESES_NOMBRES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function mesLabel(clave) {
  const [anio, mes] = clave.split("-");
  return `${MESES_NOMBRES[Number(mes) - 1]} ${anio}`;
}

function mesOffset(clave, offset) {
  const [anio, mes] = clave.split("-").map(Number);
  const d = new Date(anio, mes - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function renderStats() {
  const ocu = Object.keys(vehiculos).length;
  const lib = Math.max(0, totalEspacios - ocu);
  document.getElementById("mini-libres").textContent   = `${lib} libre${lib !== 1 ? "s" : ""}`;
  document.getElementById("mini-ocupados").textContent = `${ocu} ocupado${ocu !== 1 ? "s" : ""}`;
}

// ---- MAPA ----
function renderMapa() {
  const grid = document.getElementById("cocheras-grid");
  grid.innerHTML = "";

  for (let i = 1; i <= totalEspacios; i++) {
    const entrada = vehiculoPorCochera(i);
    const libre   = !entrada;
    const v       = entrada ? entrada[1] : null;
    const id      = entrada ? entrada[0] : null;

    const card = document.createElement("div");
    card.className = `cochera-card ${libre ? "libre" : "ocupado"}`;
    card.innerHTML = `
      <span class="cochera-num">${String(i).padStart(2, "0")}</span>
      <span class="cochera-icon">${libre ? "🅿️" : (ICONOS[v.tipo] || "🚗")}</span>
      <span class="cochera-label">${libre ? "Libre" : (v.nombre || "").split(/[\s,]+/)[0]}</span>
    `;
    card.title = libre ? `Cochera ${i} — libre` : `${v.nombre} · ${v.patente || ""}`;
    card.addEventListener("click", () => {
      if (libre) abrirModal(null, i);
      else        abrirDetalle(id);
    });
    grid.appendChild(card);
  }
}

// ---- VEHÍCULOS ----
function renderVehiculos(filtroTexto = "", filtroTipo = "") {
  const grid = document.getElementById("vehiculos-grid");
  grid.innerHTML = "";

  const lista = Object.entries(vehiculos).filter(([, v]) => {
    const txt      = filtroTexto.toLowerCase();
    const matchTxt = !txt ||
      (v.nombre   || "").toLowerCase().includes(txt) ||
      (v.patente  || "").toLowerCase().includes(txt) ||
      (v.modelo   || "").toLowerCase().includes(txt) ||
      String(v.cochera).includes(txt);
    const matchTipo = !filtroTipo || v.tipo === filtroTipo;
    return matchTxt && matchTipo;
  }).sort((a, b) => Number(a[1].cochera) - Number(b[1].cochera));

  if (lista.length === 0) {
    grid.innerHTML = `<div class="v-empty">No se encontraron vehículos.</div>`;
    return;
  }

  lista.forEach(([id, v]) => {
    const card = document.createElement("div");
    card.className = "vehiculo-card";
    card.innerHTML = `
      <div class="vehiculo-card-header">
        <div class="v-avatar">${iniciales(v.nombre)}</div>
        <div>
          <div class="v-nombre">${v.nombre || "Sin nombre"}</div>
          <div class="v-tipo">${v.modelo || TIPOS[v.tipo] || "—"}</div>
        </div>
        <span class="v-cochera-badge">Nº ${v.cochera}</span>
      </div>
      <div class="v-details">
        <div class="v-detail-row">
          <span class="v-detail-key">Patente</span>
          <span class="v-patente">${v.patente || "—"}</span>
        </div>
        ${v.dni ? `<div class="v-detail-row"><span class="v-detail-key">DNI</span><span class="v-detail-val">${v.dni}</span></div>` : ""}
        ${v.domicilio ? `<div class="v-detail-row"><span class="v-detail-key">Domicilio</span><span class="v-detail-val">${v.domicilio}</span></div>` : ""}
        <div class="v-detail-row">
          <span class="v-detail-key">WhatsApp</span>
          <span class="v-detail-val">${v.wsp ? "+54 " + v.wsp : "—"}</span>
        </div>
        <div class="v-detail-row">
          <span class="v-detail-key">Alquiler</span>
          <span class="v-detail-val">${formatMonto(v.monto)}</span>
        </div>
        ${v.notas ? `<div class="v-detail-row"><span class="v-detail-key">Notas</span><span class="v-detail-val">${v.notas}</span></div>` : ""}
      </div>
    `;
    card.addEventListener("click", () => abrirDetalle(id));
    grid.appendChild(card);
  });
}

// ---- ALQUILERES ----
function renderAlquileres() {
  const list = document.getElementById("alquileres-list");
  list.innerHTML = "";

  const lista = Object.entries(vehiculos)
    .sort((a, b) => Number(a[1].cochera) - Number(b[1].cochera));

  let total = 0;
  lista.forEach(([id, v]) => {
    const monto = Number(v.monto) || 0;
    total += monto;

    const row = document.createElement("div");
    row.className = "alquiler-row";
    row.innerHTML = `
      <span class="alq-cochera">#${v.cochera}</span>
      <span class="alq-nombre">${v.nombre || "—"}</span>
      <span class="alq-monto">${formatMonto(v.monto)}</span>
      <input type="number" class="alq-input-monto" value="${monto || ""}" placeholder="$ nuevo monto" min="0" data-id="${id}" />
      <button class="alq-save-btn" data-id="${id}">Guardar</button>
    `;
    list.appendChild(row);
  });

  document.getElementById("alq-total").textContent = formatMonto(total);

  list.querySelectorAll(".alq-save-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id    = btn.dataset.id;
      const input = list.querySelector(`.alq-input-monto[data-id="${id}"]`);
      const val   = Number(input.value);
      if (isNaN(val) || val < 0) { showToast("Ingresá un monto válido", "error"); return; }
      update(ref(db, `vehiculos/${id}`), { monto: val });
      showToast("Monto actualizado ✓", "success");
    });
  });
}

// ============================================================
//  MODAL REGISTRO / EDICIÓN
// ============================================================
function poblarSelectCochera(cocheraActual = null) {
  const sel  = document.getElementById("f-cochera");
  const ocup = ocupados();
  sel.innerHTML = "";

  for (let i = 1; i <= totalEspacios; i++) {
    const estaOcup = ocup.includes(i);
    const esMia    = Number(cocheraActual) === i;
    if (!estaOcup || esMia) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `Cochera ${i}`;
      if (esMia) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  if (sel.options.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No hay cocheras libres";
    opt.disabled = true;
    sel.appendChild(opt);
  }
}

function resetFotos(v = {}) {
  // Frente
  const wrapF = document.getElementById("preview-wrap-frente");
  const imgF  = document.getElementById("preview-frente");
  if (v.cedulaFrente) {
    imgF.src = v.cedulaFrente;
    wrapF.classList.remove("hidden");
  } else {
    imgF.src = "";
    wrapF.classList.add("hidden");
  }
  document.getElementById("f-cedula-frente").value = "";

  // Dorso
  const wrapD = document.getElementById("preview-wrap-dorso");
  const imgD  = document.getElementById("preview-dorso");
  if (v.cedulaDorso) {
    imgD.src = v.cedulaDorso;
    wrapD.classList.remove("hidden");
  } else {
    imgD.src = "";
    wrapD.classList.add("hidden");
  }
  document.getElementById("f-cedula-dorso").value = "";

  pendingFrente = null;
  pendingDorso  = null;
}

function abrirModal(id = null, cocheraPredef = null) {
  editandoId = id;
  document.getElementById("modal-titulo").textContent = id ? "Editar vehículo" : "Registrar vehículo";

  const v = id ? (vehiculos[id] || {}) : {};
  document.getElementById("f-nombre").value    = v.nombre    || "";
  document.getElementById("f-patente").value   = (v.patente  || "").toUpperCase();
  document.getElementById("f-tipo").value      = v.tipo      || "auto";
  document.getElementById("f-dni").value       = v.dni       || "";
  document.getElementById("f-domicilio").value = v.domicilio || "";
  document.getElementById("f-modelo").value    = v.modelo    || "";
  document.getElementById("f-wsp").value       = v.wsp       || "";
  document.getElementById("f-monto").value     = v.monto     || "";
  document.getElementById("f-notas").value     = v.notas     || "";

  resetFotos(v);
  poblarSelectCochera(v.cochera || cocheraPredef);
  if (cocheraPredef && !id) document.getElementById("f-cochera").value = cocheraPredef;

  const btnEl = document.getElementById("btn-eliminar");
  id ? btnEl.classList.remove("hidden") : btnEl.classList.add("hidden");

  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("f-nombre").focus();
}

function cerrarModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  editandoId    = null;
  pendingFrente = null;
  pendingDorso  = null;
}

async function guardar() {
  const nombre  = document.getElementById("f-nombre").value.trim();
  const patente = document.getElementById("f-patente").value.trim().toUpperCase();
  const cochera = document.getElementById("f-cochera").value;

  if (!nombre)  { document.getElementById("f-nombre").focus();  showToast("Ingresá el nombre", "error"); return; }
  if (!patente) { document.getElementById("f-patente").focus(); showToast("Ingresá la patente", "error"); return; }
  if (!cochera) { showToast("Seleccioná una cochera", "error"); return; }

  // Conservar URLs existentes si no hay archivo nuevo
  const vActual = editandoId ? (vehiculos[editandoId] || {}) : {};

  const datos = {
    nombre,
    patente,
    cochera:      Number(cochera),
    tipo:         document.getElementById("f-tipo").value,
    dni:          document.getElementById("f-dni").value.trim(),
    domicilio:    document.getElementById("f-domicilio").value.trim(),
    modelo:       document.getElementById("f-modelo").value.trim(),
    wsp:          document.getElementById("f-wsp").value.trim(),
    monto:        Number(document.getElementById("f-monto").value) || 0,
    notas:        document.getElementById("f-notas").value.trim(),
    cedulaFrente: vActual.cedulaFrente || "",
    cedulaDorso:  vActual.cedulaDorso  || ""
  };

  // Subir fotos si hay archivos nuevos
  try {
    if (pendingFrente) {
      showToast("Subiendo frente de cédula…", "");
      datos.cedulaFrente = await subirImagenCloudinary(pendingFrente);
    }
    if (pendingDorso) {
      showToast("Subiendo dorso de cédula…", "");
      datos.cedulaDorso = await subirImagenCloudinary(pendingDorso);
    }
  } catch (e) {
    showToast("Error al subir fotos. Revisá Cloudinary.", "error");
    console.error(e);
    return;
  }

  try {
    if (editandoId) {
      await update(ref(db, `vehiculos/${editandoId}`), datos);
      showToast("Registro actualizado ✓", "success");
    } else {
      await push(ref(db, "vehiculos"), datos);
      showToast("Vehículo registrado ✓", "success");
    }
    cerrarModal();
  } catch (e) {
    showToast("Error al guardar. Revisá la conexión.", "error");
    console.error(e);
  }
}

async function eliminar() {
  if (!editandoId) return;
  if (!confirm("¿Eliminás este vehículo de la cochera?")) return;
  await remove(ref(db, `vehiculos/${editandoId}`));
  showToast("Registro eliminado", "");
  cerrarModal();
}

// ============================================================
//  MODAL DETALLE
// ============================================================
function abrirDetalle(id) {
  const v = vehiculos[id];
  if (!v) return;

  document.getElementById("detalle-titulo").textContent = `Cochera Nº ${v.cochera}`;

  const body = document.getElementById("detalle-body");
  body.innerHTML = `
    <div class="detalle-row"><span class="detalle-key">Nombre</span><span class="detalle-val">${v.nombre || "—"}</span></div>
    ${v.dni       ? `<div class="detalle-row"><span class="detalle-key">DNI</span><span class="detalle-val">${v.dni}</span></div>` : ""}
    ${v.domicilio ? `<div class="detalle-row"><span class="detalle-key">Domicilio</span><span class="detalle-val">${v.domicilio}</span></div>` : ""}
    <div class="detalle-row"><span class="detalle-key">Patente</span><span class="detalle-val"><span class="v-patente">${v.patente || "—"}</span></span></div>
    <div class="detalle-row"><span class="detalle-key">Vehículo</span><span class="detalle-val">${ICONOS[v.tipo] || ""} ${v.modelo || TIPOS[v.tipo] || "—"}</span></div>
    <div class="detalle-row"><span class="detalle-key">WhatsApp</span><span class="detalle-val">${v.wsp ? "+54 " + v.wsp : "—"}</span></div>
    <div class="detalle-row"><span class="detalle-key">Alquiler</span><span class="detalle-val">${formatMonto(v.monto)}</span></div>
    ${v.notas ? `<div class="detalle-row"><span class="detalle-key">Notas</span><span class="detalle-val">${v.notas}</span></div>` : ""}
    ${v.cedulaFrente || v.cedulaDorso ? `
      <div class="detalle-row" style="flex-direction:column;gap:8px">
        <span class="detalle-key" style="margin-bottom:2px">Cédula</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${v.cedulaFrente ? `<div style="text-align:center"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Frente</div><img src="${v.cedulaFrente}" class="detalle-tarjeta" style="max-width:160px" /></div>` : ""}
          ${v.cedulaDorso  ? `<div style="text-align:center"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Dorso</div><img src="${v.cedulaDorso}"  class="detalle-tarjeta" style="max-width:160px" /></div>` : ""}
        </div>
      </div>` : ""}
  `;

  const btnWsp = document.getElementById("detalle-wsp");
  if (v.wsp) {
    btnWsp.classList.remove("hidden");
    btnWsp.onclick = () => {
      const num = v.wsp.replace(/\D/g, "");
      window.open(`https://wa.me/54${num}`, "_blank");
    };
  } else {
    btnWsp.classList.add("hidden");
  }

  document.getElementById("detalle-editar").onclick = () => {
    cerrarDetalle();
    abrirModal(id);
  };

  document.getElementById("detalle-overlay").classList.remove("hidden");
}

function cerrarDetalle() {
  document.getElementById("detalle-overlay").classList.add("hidden");
  // Restaurar botones por si se usó para historial
  document.getElementById("detalle-editar").classList.remove("hidden");
  document.getElementById("detalle-wsp").classList.remove("hidden");
}

// ============================================================
//  AJUSTE GLOBAL DE ALQUILERES
// ============================================================
document.getElementById("btn-aplicar-ajuste").addEventListener("click", async () => {
  const tipo  = document.getElementById("ajuste-tipo").value;
  const valor = Number(document.getElementById("ajuste-valor").value);

  if (!valor || valor <= 0) { showToast("Ingresá un valor válido", "error"); return; }
  if (!confirm("¿Aplicar ajuste a TODOS los alquileres?")) return;

  const updates = {};
  Object.entries(vehiculos).forEach(([id, v]) => {
    const montoActual = Number(v.monto) || 0;
    const nuevoMonto  = tipo === "porcentaje"
      ? Math.round(montoActual * (1 + valor / 100))
      : valor;
    updates[`vehiculos/${id}/monto`] = nuevoMonto;
  });

  await update(ref(db), updates);
  showToast("Alquileres actualizados ✓", "success");
  document.getElementById("ajuste-valor").value = "";
});

// ============================================================
//  PAGOS
// ============================================================
function renderPagos() {
  // Etiqueta del mes
  document.getElementById("mes-label").textContent = mesLabel(mesActivo);

  const pagosMes = (pagos[mesActivo] || {});
  const lista = Object.entries(vehiculos)
    .sort((a, b) => Number(a[1].cochera) - Number(b[1].cochera));

  // Contadores resumen
  let pagados = 0, pendientes = 0;
  let jqEf = 0, jqTr = 0, fdEf = 0, fdTr = 0;

  lista.forEach(([vid, v]) => {
    const p = pagosMes[vid];
    if (p && p.pagado) {
      pagados++;
      const m = Number(p.monto) || 0;
      if (p.admin === "joaquin") { p.metodo === "transferencia" ? jqTr += m : jqEf += m; }
      else                       { p.metodo === "transferencia" ? fdTr += m : fdEf += m; }
    } else {
      pendientes++;
    }
  });

  document.getElementById("pill-pagados").textContent    = `${pagados} pagado${pagados !== 1 ? "s" : ""}`;
  document.getElementById("pill-pendientes").textContent = `${pendientes} pendiente${pendientes !== 1 ? "s" : ""}`;
  document.getElementById("jq-ef").textContent  = formatMonto(jqEf);
  document.getElementById("jq-tr").textContent  = formatMonto(jqTr);
  document.getElementById("jq-tot").textContent = formatMonto(jqEf + jqTr);
  document.getElementById("fd-ef").textContent  = formatMonto(fdEf);
  document.getElementById("fd-tr").textContent  = formatMonto(fdTr);
  document.getElementById("fd-tot").textContent = formatMonto(fdEf + fdTr);

  // Lista
  const list = document.getElementById("pagos-list");
  list.innerHTML = "";

  if (lista.length === 0) {
    list.innerHTML = `<div class="v-empty">No hay inquilinos registrados.</div>`;
    return;
  }

  lista.forEach(([vid, v]) => {
    const p       = pagosMes[vid] || {};
    const esPagado = !!p.pagado;
    const monto   = Number(v.monto) || 0;

    const row = document.createElement("div");
    row.className = `pago-row${esPagado ? " pagado" : ""}`;
    row.innerHTML = `
      <span class="pago-num">${String(v.cochera).padStart(2,"0")}</span>
      <div class="pago-info">
        <div class="pago-nombre">${v.nombre || "—"}</div>
        <div class="pago-monto-label">${formatMonto(monto)}</div>
      </div>
      <div class="pago-toggle" title="Marcar como pagado">
        <div class="toggle-switch"></div>
        <span class="toggle-label">${esPagado ? "Pagado" : "Pendiente"}</span>
      </div>
      <select class="pago-select" id="met-${vid}" ${!esPagado ? "disabled" : ""}>
        <option value="efectivo"      ${p.metodo === "efectivo"      ? "selected" : ""}>💵 Efectivo</option>
        <option value="transferencia" ${p.metodo === "transferencia" ? "selected" : ""}>📲 Transferencia</option>
      </select>
      <select class="pago-select" id="adm-${vid}" ${!esPagado ? "disabled" : ""}>
        <option value="joaquin"  ${p.admin === "joaquin"  ? "selected" : ""}>Joaquín</option>
        <option value="federico" ${p.admin === "federico" ? "selected" : ""}>Federico</option>
      </select>
      <button class="pago-historial-btn" title="Ver historial" data-vid="${vid}">🕐</button>
    `;

    // Toggle pagado/pendiente
    const toggle = row.querySelector(".pago-toggle");
    toggle.addEventListener("click", async () => {
      const nuevoPagado = !esPagado;
      const metodo = row.querySelector(`#met-${vid}`).value || "efectivo";
      const admin  = row.querySelector(`#adm-${vid}`).value || "joaquin";
      const datos  = nuevoPagado
        ? { pagado: true, metodo, admin, monto, fecha: new Date().toISOString() }
        : { pagado: false, metodo: "", admin: "", monto: 0, fecha: "" };
      await set(ref(db, `pagos/${mesActivo}/${vid}`), datos);
    });

    // Cambio de método o admin (solo si pagado)
    const selMet = row.querySelector(`#met-${vid}`);
    const selAdm = row.querySelector(`#adm-${vid}`);
    const guardarSelects = async () => {
      if (!esPagado) return;
      await update(ref(db, `pagos/${mesActivo}/${vid}`), {
        metodo: selMet.value,
        admin:  selAdm.value
      });
    };
    selMet.addEventListener("change", guardarSelects);
    selAdm.addEventListener("change", guardarSelects);

    // Botón historial
    row.querySelector(".pago-historial-btn").addEventListener("click", () => {
      abrirHistorial(vid, v.nombre);
    });

    list.appendChild(row);
  });
}

// Navegación de meses
document.getElementById("mes-prev").addEventListener("click", () => {
  mesActivo = mesOffset(mesActivo, -1);
  renderPagos();
});
document.getElementById("mes-next").addEventListener("click", () => {
  mesActivo = mesOffset(mesActivo, +1);
  renderPagos();
});

// ---- MODAL HISTORIAL ----
function abrirHistorial(vid, nombre) {
  // Reutilizamos el modal detalle para historial
  document.getElementById("detalle-titulo").textContent = `Historial — ${nombre || "Inquilino"}`;

  const body = document.getElementById("detalle-body");

  // Recopilar todos los meses con pago para este inquilino
  const historial = [];
  Object.entries(pagos).forEach(([mes, mesDatos]) => {
    const p = mesDatos[vid];
    if (p && p.pagado) historial.push({ mes, ...p });
  });

  historial.sort((a, b) => b.mes.localeCompare(a.mes)); // más reciente primero

  if (historial.length === 0) {
    body.innerHTML = `<div class="historial-empty">Sin pagos registrados aún.</div>`;
  } else {
    body.innerHTML = `<div class="historial-list">` +
      historial.map(h => `
        <div class="historial-item">
          <span class="historial-mes">${mesLabel(h.mes)}</span>
          <span class="historial-monto">${formatMonto(h.monto)}</span>
          <span class="historial-meta">
            ${h.metodo === "transferencia" ? "📲" : "💵"}
            ${h.admin === "joaquin" ? "Joaquín" : "Federico"}
          </span>
        </div>
      `).join("") +
    `</div>`;
  }

  // Ocultar botones de editar/wsp del modal detalle
  document.getElementById("detalle-editar").classList.add("hidden");
  document.getElementById("detalle-wsp").classList.add("hidden");

  document.getElementById("detalle-overlay").classList.remove("hidden");
}

// ============================================================
//  NAVEGACIÓN DE VISTAS
// ============================================================
const TITULOS = { mapa: "Cocheras", vehiculos: "Vehículos", alquileres: "Alquileres", pagos: "Pagos" };

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const view = item.dataset.view;
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");
    document.getElementById("topbar-title").textContent = TITULOS[view] || "";
    closeSidebar();
  });
});

// ============================================================
//  SIDEBAR MOBILE
// ============================================================
function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("open");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
}
document.getElementById("menu-btn").addEventListener("click", openSidebar);
document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
document.getElementById("sidebar-overlay").addEventListener("click", closeSidebar);

// ============================================================
//  CONTROL TOTAL ESPACIOS
// ============================================================
document.getElementById("esp-minus").addEventListener("click", () => {
  const ocu = Object.keys(vehiculos).length;
  if (totalEspacios <= ocu) { showToast("No podés reducir por debajo de los espacios ocupados", "error"); return; }
  if (totalEspacios <= 1)   return;
  totalEspacios--;
  document.getElementById("esp-num").textContent = totalEspacios;
  saveTotalEspacios(totalEspacios);
});

document.getElementById("esp-plus").addEventListener("click", () => {
  if (totalEspacios >= 99) return;
  totalEspacios++;
  document.getElementById("esp-num").textContent = totalEspacios;
  saveTotalEspacios(totalEspacios);
});

// ============================================================
//  BÚSQUEDA Y FILTRO
// ============================================================
document.getElementById("search-vehiculos").addEventListener("input", aplicarFiltros);
document.getElementById("filter-tipo").addEventListener("change", aplicarFiltros);

function aplicarFiltros() {
  renderVehiculos(
    document.getElementById("search-vehiculos").value,
    document.getElementById("filter-tipo").value
  );
}

// ============================================================
//  BOTONES MODALES
// ============================================================
document.getElementById("btn-nuevo").addEventListener("click",    () => abrirModal());
document.getElementById("btn-cancelar").addEventListener("click", cerrarModal);
document.getElementById("modal-close").addEventListener("click",  cerrarModal);
document.getElementById("btn-guardar").addEventListener("click",  guardar);
document.getElementById("btn-eliminar").addEventListener("click", eliminar);
document.getElementById("detalle-close").addEventListener("click", cerrarDetalle);

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-overlay")) cerrarModal();
});
document.getElementById("detalle-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("detalle-overlay")) cerrarDetalle();
});

// ============================================================
//  MANEJO DE FOTOS — CÉDULA FRENTE Y DORSO
// ============================================================
function setupFileDrop(dropId, inputId, previewId, wrapId, removeId, lado) {
  const drop   = document.getElementById(dropId);
  const input  = document.getElementById(inputId);
  const img    = document.getElementById(previewId);
  const wrap   = document.getElementById(wrapId);
  const btnRem = document.getElementById(removeId);

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      showToast("Solo se aceptan imágenes", "error");
      return;
    }
    if (lado === "frente") pendingFrente = file;
    else                   pendingDorso  = file;

    img.src = URL.createObjectURL(file);
    wrap.classList.remove("hidden");
  }

  input.addEventListener("change", () => handleFile(input.files[0]));

  drop.addEventListener("dragover",  (e) => { e.preventDefault(); drop.classList.add("dragover"); });
  drop.addEventListener("dragleave", ()  => drop.classList.remove("dragover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    handleFile(e.dataTransfer.files[0]);
  });

  btnRem.addEventListener("click", (e) => {
    e.stopPropagation();
    if (lado === "frente") {
      pendingFrente = null;
      if (editandoId && vehiculos[editandoId]) vehiculos[editandoId].cedulaFrente = "";
    } else {
      pendingDorso = null;
      if (editandoId && vehiculos[editandoId]) vehiculos[editandoId].cedulaDorso = "";
    }
    img.src = "";
    input.value = "";
    wrap.classList.add("hidden");
  });
}

setupFileDrop("file-drop-frente", "f-cedula-frente", "preview-frente", "preview-wrap-frente", "remove-frente", "frente");
setupFileDrop("file-drop-dorso",  "f-cedula-dorso",  "preview-dorso",  "preview-wrap-dorso",  "remove-dorso",  "dorso");

// ============================================================
//  INIT
// ============================================================
initFirebase();
