# 🚗 Gestor de Cocheras

Aplicación web para gestionar cocheras residenciales. Registrá vehículos, controlá espacios, gestioná alquileres y accedé a la tarjeta verde de cada inquilino.

---

## ✅ Funcionalidades

- **Mapa visual** de cocheras: libre / ocupado en tiempo real
- **Registro de vehículos** con nombre, patente, tipo, WhatsApp, monto de alquiler y foto de tarjeta verde
- **Mensajes directos por WhatsApp** desde la ficha del inquilino
- **Gestión de alquileres**: ajuste global por porcentaje o nuevo monto fijo
- **Búsqueda y filtros** en la lista de vehículos
- **Sincronización en tiempo real** vía Firebase Realtime Database
- **Almacenamiento de fotos** en Firebase Storage

---

## 🔧 Paso 1 — Crear el proyecto en Firebase

1. Ir a [https://console.firebase.google.com](https://console.firebase.google.com)
2. Hacer click en **"Agregar proyecto"**
3. Ponerle un nombre (ej: `cochera-residencial`) y seguir los pasos
4. Una vez creado, ir a **"Descripción general del proyecto"**

---

## 🔑 Paso 2 — Registrar la app web y obtener el config

1. En la pantalla principal del proyecto, hacer click en el ícono **`</>`** (Web)
2. Ponerle un nombre a la app (ej: `cochera-web`) → **"Registrar app"**
3. Firebase te muestra el objeto `firebaseConfig` con tus credenciales
4. **Copiar todos esos valores** y pegarlos en `app.js` reemplazando los placeholders:

```js
const firebaseConfig = {
  apiKey:            "TU_API_KEY",          // ← reemplazar
  authDomain:        "TU_PROJECT.firebaseapp.com",
  databaseURL:       "https://TU_PROJECT-default-rtdb.firebaseio.com",
  projectId:         "TU_PROJECT",
  storageBucket:     "TU_PROJECT.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID"
};
```

---

## 🗄️ Paso 3 — Activar Realtime Database

1. En el menú lateral de Firebase → **"Compilación"** → **"Realtime Database"**
2. Hacer click en **"Crear base de datos"**
3. Elegir la región (recomendado: `us-central1`)
4. Seleccionar **"Comenzar en modo de prueba"** (o configurar reglas más adelante)
5. Copiar la URL de la base de datos (termina en `.firebaseio.com`) y verificar que coincida con `databaseURL` en `app.js`

### Reglas recomendadas (Realtime Database)

Ir a **Realtime Database → Reglas** y pegar:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> ⚠️ Esto es para uso privado/residencial. Si la app va a estar pública, configurar autenticación.

---

## 🖼️ Paso 4 — Activar Firebase Storage (para fotos de tarjeta verde)

1. En el menú lateral → **"Compilación"** → **"Storage"**
2. Hacer click en **"Comenzar"**
3. Aceptar las reglas por defecto → elegir región → **"Listo"**

### Reglas de Storage

Ir a **Storage → Reglas** y pegar:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

---

## 🐙 Paso 5 — Subir a GitHub y publicar con GitHub Pages

### 5.1 — Crear repositorio en GitHub

1. Ir a [https://github.com/new](https://github.com/new)
2. Nombre del repositorio: `cochera` (o el que prefieras)
3. Visibilidad: **Público** (necesario para GitHub Pages gratuito)
4. Hacer click en **"Create repository"**

### 5.2 — Subir los archivos

Desde la terminal (con Git instalado):

```bash
cd carpeta-del-proyecto
git init
git add .
git commit -m "Primer commit - Gestor de Cocheras"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/cochera.git
git push -u origin main
```

O simplemente arrastrar los archivos desde la interfaz web de GitHub.

### 5.3 — Activar GitHub Pages

1. En el repositorio → **"Settings"** → **"Pages"**
2. En **"Branch"**: seleccionar `main` y carpeta `/root`
3. Hacer click en **"Save"**
4. En unos minutos la app estará disponible en:
   `https://TU_USUARIO.github.io/cochera/`

---

## 📁 Estructura de archivos

```
cochera/
├── index.html    ← estructura de la app
├── styles.css    ← estilos y tema oscuro
├── app.js        ← lógica + conexión Firebase
└── README.md     ← este archivo
```

---

## 🛠️ Próximos pasos opcionales

- Agregar **autenticación** con Firebase Auth (usuario/contraseña)
- Enviar **recordatorios de pago** automáticos por WhatsApp
- Historial de pagos por inquilino
- Exportar lista a PDF o Excel

---

## 💡 Soporte

Ante cualquier duda con Firebase o GitHub Pages, revisá la documentación oficial:
- [Firebase Docs](https://firebase.google.com/docs)
- [GitHub Pages Docs](https://docs.github.com/es/pages)
