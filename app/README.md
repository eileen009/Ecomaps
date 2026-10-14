# EcoMaps · Backend (Flask + MySQL)

Módulos listos: **Autenticación y usuarios**, **Puntos de reciclaje**, **Categorías y buscador**, **Sistema de puntos (núcleo)**.

## Estructura

```
app/
├── app.py              ← application factory, registra blueprints
├── config.py            ← configuración (lee .env)
├── extensions.py         ← instancias compartidas (db, jwt, cors)
├── ecomapsBD.sql           ← esquema de la base de datos ecomapsBD
├── models/                ← modelos SQLAlchemy (uno por tabla)
├── routes/
│   ├── auth.py             ← API: registro / login / logout
│   ├── usuarios.py          ← API: perfil propio
│   ├── categorias.py         ← API: catálogo de residuos (solo lectura)
│   ├── puntos.py               ← API: puntos de reciclaje
│   ├── buscador.py               ← API: buscar puntos por tipo de residuo
│   └── paginas.py                ← vistas HTML (renderiza templates/)
├── utils/                  ← validaciones, geo y helpers reutilizables
├── templates/                ← todas las páginas .html (Jinja2)
└── static/
    ├── css/style.css
    ├── js/main.js
    └── assets/img/logo.png
```

Las páginas ya no son archivos sueltos: Flask las sirve como plantillas
Jinja2 desde `templates/`, y los enlaces internos usan `url_for(...)`
en vez de rutas fijas (`mapa.html`, `css/style.css`, etc.). Si agregas
una página nueva, va en `templates/`, se referencia con `url_for('static', filename=...)` / `url_for('paginas.<nombre>')`, y se registra una ruta en `routes/paginas.py`.

## Puesta en marcha

1. Instalar dependencias (usa tu Python 3.14 dedicado al proyecto):
   ```
   pip install -r requirements.txt
   ```
2. Copiar `.env.example` a `.env` y completar tus datos de MySQL.
3. Crear la base de datos y las tablas:
   ```
   mysql -u root -p < ecomapsBD.sql
   ```
4. Ejecutar el servidor:
   ```
   python app.py
   ```
5. Abrir `http://localhost:5000/`.

## Endpoints de la API

### Autenticación y usuarios

| Método | Ruta                  | Descripción                    | Requiere token |
|--------|-----------------------|---------------------------------|----------------|
| POST   | `/api/auth/registro`  | Crear cuenta                    | No             |
| POST   | `/api/auth/login`     | Iniciar sesión                  | No             |
| POST   | `/api/auth/logout`    | Cerrar sesión                   | Sí             |
| GET    | `/api/usuarios/me`    | Ver perfil propio                | Sí             |
| PUT    | `/api/usuarios/me`    | Editar nombre/correo propio      | Sí             |

### Categorías de residuos

| Método | Ruta               | Descripción         | Requiere token |
|--------|--------------------| ---------------------|----------------|
| GET    | `/api/categorias`  | Listar categorías     | No             |

### Puntos de reciclaje

| Método | Ruta                        | Descripción                                 | Requiere token         |
|--------|-----------------------------|-----------------------------------------------|------------------------|
| GET    | `/api/puntos`                | Listar puntos (filtros: `ciudad`, `material`, `estado`, `lat`, `lng`, `radio`) | No |
| GET    | `/api/puntos/<id>`            | Ver un punto                                  | No                      |
| POST   | `/api/puntos`                 | Proponer un punto nuevo (queda "pendiente")    | Sí                      |
| PUT    | `/api/puntos/<id>`            | Editar un punto                               | Sí (rol admin)          |
| PATCH  | `/api/puntos/<id>/estado`     | Aprobar / rechazar / marcar reportado          | Sí (rol admin)          |

Ejemplo de búsqueda por cercanía:
`GET /api/puntos?lat=8.75&lng=-75.88&radio=5&material=Plástico`

### Buscador (módulo 3)

| Método | Ruta          | Descripción                                            | Requiere token |
|--------|---------------|---------------------------------------------------------|----------------|
| GET    | `/api/buscar` | Busca puntos activos por residuo (filtros: `residuo`, `ciudad`, `lat`, `lng`, `radio`) | No |
| GET    | `/api/categorias/<nombre>` | Ver una categoría por nombre                | No             |

Ejemplo: `GET /api/buscar?residuo=Vidrio&ciudad=Montería`

El token se envía como `Authorization: Bearer <access_token>`.

### Sistema de puntos (módulo 5, núcleo)

| Método | Ruta                          | Descripción                                          | Requiere token |
|--------|-------------------------------|-------------------------------------------------------|----------------|
| POST   | `/api/acciones`               | Registrar un aporte con foto (`multipart/form-data`: `categoria`, `cantidad`, `unidad`, `id_punto` opcional, `foto`) — queda "pendiente" | Sí |
| GET    | `/api/acciones/mias`          | Historial propio de aportes                            | Sí             |
| GET    | `/api/acciones?estado=`       | Listar aportes por estado (revisión)                    | Sí (admin)     |
| PATCH  | `/api/acciones/<id>/estado`   | Confirmar o rechazar; si se confirma, asigna puntos      | Sí (admin)     |

Las fotos se guardan en `static/uploads/acciones/` (fuera de git, ver `.gitignore`).
Los puntos solo se suman al confirmar, nunca al registrar.

## Vistas (páginas HTML)

Todas se sirven en `GET /<nombre>` (ej. `/mapa`, `/login`, `/estadisticas`)
y la de inicio en `GET /`. Ver `routes/paginas.py` para el listado completo.

## Sesión en el frontend

El login/registro (`static/js/main.js`) guarda `{ usuario, token }` en
`localStorage` tras un login exitoso. Las páginas privadas (`/perfil`,
`/actividad`, `/logros`, todo `/admin/*`) llevan `data-requiere-sesion="true"`
o `data-requiere-rol="admin"` en el `<body>`; `main.js` redirige a `/login`
si no hay sesión válida **antes** de pintar el contenido (protección solo de
cliente: falta el equivalente en el servidor, igual que se dejó anotado
para el panel admin).

## Mapa (`/mapa`)

Usa **Leaflet + OpenStreetMap** (sin API key, sin costo) en vez de Google
Maps: se eligió por no requerir facturación ni credenciales, alineado con
"código verde" (una sola librería liviana, sin llamadas de pago). La lógica
vive en `static/js/mapa.js`, consulta `/api/puntos` y muestra una única
barra de filtros (antes había dos: buscador+chips arriba y un select
duplicado en el panel lateral).
