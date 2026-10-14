# EcoMaps

**EcoMaps** es una aplicación web gratuita que ayuda a las personas de Montería a saber **dónde reciclar**. Quien quiere deshacerse de un residuo (plástico, vidrio, papel, cartón, metal, orgánicos, electrónicos o pilas) escribe qué material tiene y el sistema le muestra en un mapa los puntos de reciclaje que lo reciben, con su dirección, horario y datos de contacto.

Proyecto del **Objetivo de Desarrollo Sostenible 12 (Producción y consumo responsables)** · Actividad evaluativa Momento 2, Desarrollo Sostenible.

- **Integrantes:** Eileen Peña Diaz y Sarith Calles Paez
- **Docente:** Mauricio Antonio Ricardo Padilla
- **Estado:** solución terminada y funcionando de extremo a extremo.
- **Aplicación desplegada:** https://ecomaps.onrender.com (el plan gratuito de Render puede tardar cerca de un minuto en despertar en la primera visita).

## ¿Qué problema resuelve?

Mucha gente no recicla porque no sabe a dónde llevar cada material, qué horario tiene el punto o cómo preparar los residuos. EcoMaps reúne esa información en un solo lugar, verificada por el equipo, y motiva a reciclar con un sistema de puntos y niveles.

## ¿Cómo funciona?

1. Buscar el material en el mapa o en el buscador.
2. Prepararlo en casa siguiendo la guía de reciclaje y el código de colores de separación de residuos de Colombia.
3. Llevarlo al punto y registrar la entrega con una foto. La empresa dueña del punto (o el administrador) la confirma y emite un recibo digital con código único; si la rechaza, debe indicar el motivo. Cada aporte confirmado suma puntos y sube el nivel.

## ¿Quiénes la usan?

- **Ciudadano:** busca puntos, registra aportes, propone puntos nuevos, reporta problemas y consulta su perfil, logros y estadísticas.
- **Empresa** (recicladoras y puntos de acopio): administra sus puntos y confirma los aportes entregados en ellos.
- **Administrador:** aprueba los puntos propuestos, gestiona usuarios y empresas, atiende reportes y revisa las estadísticas generales.

## Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Usuario (ciudadano) | usuario@ecomaps.com | USUARIO2026 |
| Empresa | empresa@ecomaps.com | EMPRESA2026* |
| Administrador | admin@ecomaps.com | ADMIN2026* |

## Tecnologías

HTML5, CSS3 y JavaScript (plantillas Jinja2) · Python y Flask (API REST, Flask-SQLAlchemy, JWT) · MySQL 8 (Aiven en producción, XAMPP en local) · Leaflet con OpenStreetMap · Cloudinary (fotos) · Brevo (correo) · Render con gunicorn.

El código sigue prácticas de código verde: consultas indexadas, conexiones reutilizadas, imágenes optimizadas y pocas dependencias.

## Base de datos

Seis tablas: `usuario`, `categoria_residuo`, `punto_reciclaje`, `punto_material`, `accion_reciclaje` y `reporte`. En la carpeta [`database/`](database/) están el esquema (`schema.sql`), datos de ejemplo (`datos_ejemplo.sql`) y el diagrama entidad-relación (`DER_ecomaps.png`).

Para usarla en local: crear una base de datos vacía en XAMPP/phpMyAdmin, importar `database/schema.sql` y luego `database/datos_ejemplo.sql`.

## Instalación local

```bash
cd app
python -m venv venv
venv\Scripts\activate        # en Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
copy ..\.env.example .env    # en Linux/Mac: cp ../.env.example .env  (y completar los valores)
python app.py
```

Las variables de entorno (conexión a MySQL, JWT, Cloudinary, Brevo, Google) están descritas en [`.env.example`](.env.example). Los secretos reales nunca se suben al repositorio.

Documentación del backend: [`app/README.md`](app/README.md).
