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
//  Reemplazá estos valores con los de tu proyecto Firebase
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
let vehiculos    = {};          // { id: { nombre, patente, cochera, tipo, wsp, monto, notas, tarjetaUrl } }
let totalEspacios = 20;
let editandoId   = null;
let pendingFile  = null;        // File obj pendiente de subir

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
  // Vehículos
  onValue(ref(db, "vehiculos"), (snap) => {
    vehiculos = snap.val() || {};
    renderAll();
  });

  // Config (total de espacios)
  onValue(ref(db, "config/totalEspacios"), (snap) => {
    if (snap.val() !== null) {
      totalEspacios = snap.val();
      document.getElementById("esp-num").textContent = totalEspacios;
    }
    renderAll();
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
  const ocup = ocupados();

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
    const txt = filtroTexto.toLowerCase();
    const matchTxt = !txt ||
      (v.nombre  || "").toLowerCase().includes(txt) ||
      (v.patente || "").toLowerCase().includes(txt) ||
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
          <div class="v-tipo">${TIPOS[v.tipo] || v.tipo || "—"}</div>
        </div>
        <span class="v-cochera-badge">Nº ${v.cochera}</span>
      </div>
      <div class="v-details">
        <div class="v-detail-row">
          <span class="v-detail-key">Patente</span>
          <span class="v-patente">${v.patente || "—"}</span>
        </div>
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

  // Guardar monto individual
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
  const sel = document.getElementById("f-cochera");
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

function abrirModal(id = null, cocheraPredef = null) {
  editandoId = id;
  pendingFile = null;
  document.getElementById("modal-titulo").textContent = id ? "Editar vehículo" : "Registrar vehículo";

  const v = id ? (vehiculos[id] || {}) : {};
  document.getElementById("f-nombre").value  = v.nombre  || "";
  document.getElementById("f-patente").value = (v.patente || "").toUpperCase();
  document.getElementById("f-tipo").value    = v.tipo    || "auto";
  document.getElementById("f-wsp").value     = v.wsp     || "";
  document.getElementById("f-monto").value   = v.monto   || "";
  document.getElementById("f-notas").value   = v.notas   || "";

  // Foto tarjeta verde
  const previewWrap = document.getElementById("file-preview-wrap");
  const preview     = document.getElementById("file-preview");
  if (v.tarjetaUrl) {
    preview.src = v.tarjetaUrl;
    previewWrap.classList.remove("hidden");
  } else {
    previewWrap.classList.add("hidden");
    preview.src = "";
  }

  poblarSelectCochera(v.cochera || cocheraPredef);
  if (cocheraPredef && !id) {
    document.getElementById("f-cochera").value = cocheraPredef;
  }

  // Botón eliminar
  const btnEl = document.getElementById("btn-eliminar");
  id ? btnEl.classList.remove("hidden") : btnEl.classList.add("hidden");

  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("f-nombre").focus();
}

function cerrarModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  editandoId = null;
  pendingFile = null;
}

async function guardar() {
  const nombre  = document.getElementById("f-nombre").value.trim();
  const patente = document.getElementById("f-patente").value.trim().toUpperCase();
  const cochera = document.getElementById("f-cochera").value;

  if (!nombre)  { document.getElementById("f-nombre").focus();  showToast("Ingresá el nombre", "error"); return; }
  if (!patente) { document.getElementById("f-patente").focus(); showToast("Ingresá la patente", "error"); return; }
  if (!cochera) { showToast("Seleccioná una cochera", "error"); return; }

  const datos = {
    nombre,
    patente,
    cochera: Number(cochera),
    tipo:    document.getElementById("f-tipo").value,
    wsp:     document.getElementById("f-wsp").value.trim(),
    monto:   Number(document.getElementById("f-monto").value) || 0,
    notas:   document.getElementById("f-notas").value.trim(),
    tarjetaUrl: editandoId ? (vehiculos[editandoId]?.tarjetaUrl || "") : ""
  };

  // Subir foto de tarjeta verde a Cloudinary si hay archivo nuevo
  if (pendingFile) {
    try {
      datos.tarjetaUrl = await subirImagenCloudinary(pendingFile);
    } catch (e) {
      showToast("Error al subir la foto. Revisá la configuración de Cloudinary.", "error");
      console.error(e);
    }
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
//  MODAL DETALLE COCHERA
// ============================================================
function abrirDetalle(id) {
  const v = vehiculos[id];
  if (!v) return;

  document.getElementById("detalle-titulo").textContent = `Cochera Nº ${v.cochera}`;

  const body = document.getElementById("detalle-body");
  body.innerHTML = `
    <div class="detalle-row"><span class="detalle-key">Nombre</span><span class="detalle-val">${v.nombre || "—"}</span></div>
    <div class="detalle-row"><span class="detalle-key">Patente</span><span class="detalle-val"><span class="v-patente">${v.patente || "—"}</span></span></div>
    <div class="detalle-row"><span class="detalle-key">Vehículo</span><span class="detalle-val">${ICONOS[v.tipo] || ""} ${TIPOS[v.tipo] || "—"}</span></div>
    <div class="detalle-row"><span class="detalle-key">WhatsApp</span><span class="detalle-val">${v.wsp ? "+54 " + v.wsp : "—"}</span></div>
    <div class="detalle-row"><span class="detalle-key">Alquiler</span><span class="detalle-val">${formatMonto(v.monto)}</span></div>
    ${v.notas ? `<div class="detalle-row"><span class="detalle-key">Notas</span><span class="detalle-val">${v.notas}</span></div>` : ""}
    ${v.tarjetaUrl ? `<div class="detalle-row" style="flex-direction:column"><span class="detalle-key" style="margin-bottom:6px">Tarjeta verde</span><img src="${v.tarjetaUrl}" class="detalle-tarjeta" /></div>` : ""}
  `;

  // Botón WhatsApp
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
}

// ============================================================
//  AJUSTE GLOBAL DE ALQUILERES
// ============================================================
document.getElementById("btn-aplicar-ajuste").addEventListener("click", async () => {
  const tipo  = document.getElementById("ajuste-tipo").value;
  const valor = Number(document.getElementById("ajuste-valor").value);

  if (!valor || valor <= 0) { showToast("Ingresá un valor válido", "error"); return; }
  if (!confirm(`¿Aplicar ajuste a TODOS los alquileres?`)) return;

  const updates = {};
  Object.entries(vehiculos).forEach(([id, v]) => {
    const montoActual = Number(v.monto) || 0;
    let nuevoMonto;
    if (tipo === "porcentaje") {
      nuevoMonto = Math.round(montoActual * (1 + valor / 100));
    } else {
      nuevoMonto = valor;
    }
    updates[`vehiculos/${id}/monto`] = nuevoMonto;
  });

  await update(ref(db), updates);
  showToast("Alquileres actualizados ✓", "success");
  document.getElementById("ajuste-valor").value = "";
});

// ============================================================
//  NAVEGACIÓN DE VISTAS
// ============================================================
const TITULOS = { mapa: "Cocheras", vehiculos: "Vehículos", alquileres: "Alquileres" };

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const view = item.dataset.view;

    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");

    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");

    document.getElementById("topbar-title").textContent = TITULOS[view] || "";

    // Cerrar sidebar en mobile
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
//  BÚSQUEDA Y FILTRO — VEHÍCULOS
// ============================================================
document.getElementById("search-vehiculos").addEventListener("input", aplicarFiltros);
document.getElementById("filter-tipo").addEventListener("change", aplicarFiltros);

function aplicarFiltros() {
  const txt  = document.getElementById("search-vehiculos").value;
  const tipo = document.getElementById("filter-tipo").value;
  renderVehiculos(txt, tipo);
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

// Cerrar modal al hacer click en overlay
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-overlay")) cerrarModal();
});
document.getElementById("detalle-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("detalle-overlay")) cerrarDetalle();
});

// ============================================================
//  MANEJO DE ARCHIVO — TARJETA VERDE
// ============================================================
const fileDrop    = document.getElementById("file-drop");
const fileInput   = document.getElementById("f-tarjeta");
const previewWrap = document.getElementById("file-preview-wrap");
const previewImg  = document.getElementById("file-preview");
const fileRemove  = document.getElementById("file-remove");

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Solo se aceptan imágenes", "error");
    return;
  }
  pendingFile = file;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewWrap.classList.remove("hidden");
}

fileInput.addEventListener("change",  () => handleFile(fileInput.files[0]));
fileDrop.addEventListener("dragover",  (e) => { e.preventDefault(); fileDrop.classList.add("dragover"); });
fileDrop.addEventListener("dragleave", ()  => fileDrop.classList.remove("dragover"));
fileDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  fileDrop.classList.remove("dragover");
  handleFile(e.dataTransfer.files[0]);
});

fileRemove.addEventListener("click", (e) => {
  e.stopPropagation();
  pendingFile = null;
  previewImg.src = "";
  previewWrap.classList.add("hidden");
  fileInput.value = "";
  // Si estamos editando, marcamos la tarjeta para borrar
  if (editandoId && vehiculos[editandoId]) {
    vehiculos[editandoId].tarjetaUrl = "";
  }
});

// ============================================================
//  INIT
// ============================================================
initFirebase();
