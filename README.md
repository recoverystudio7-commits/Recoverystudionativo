# Recovery Studio — App de agenda, recuperación y performance

Aplicación web estática (HTML, CSS y JavaScript sin dependencias) para que clientes de **Recovery Studio** reserven sesiones, sigan su plan y sus maximales, compren servicios y gestionen sus pagos por transferencia. Incluye un panel administrativo completo para agenda, usuarios, planes, pagos, finanzas, honorarios y cotizaciones de empresas.

Las **reseñas y calificaciones son compartidas** entre todos los visitantes mediante Supabase (con moderación previa), y el sitio incluye una página pública con los **beneficios del sauna húmedo**.

- App online: `https://recoverystudio7-commits.github.io/Recoverystudionativo/`
- Dominio objetivo: `https://www.recoverystudio.cl`

La identidad visual usa azul marino (`#0A2342`), azul de apoyo (`#123F70`), naranja (`#FF7A18`) y una interfaz clara, minimalista y responsive en español de Chile.

---

## Demo

Al abrir la app se cargan datos de demostración relativos a la fecha actual: usuarios, sesiones, pagos pendientes, historial de seis meses de ingresos/gastos, boletas de honorarios y cotizaciones.

| Rol | Correo | Contraseña | PIN |
| --- | --- | --- | --- |
| Administrador | `recoverystudio7@gmail.com` | `Recovery2026!` | `2468` |
| Cliente | `valentina@demo.cl` | `demo1234` | — |
| Cliente | `matias@demo.cl` | `demo1234` | — |
| Cliente | `carolina@demo.cl` | `demo1234` | — |

El administrador debe confirmar el acceso con su PIN. También hay accesos rápidos de demo en la pantalla de ingreso.

> Los datos de demostración pueden restablecerse desde **Configuración → Restablecer demo** o con `RS.DB.reset()` en la consola del navegador.

---

## Funcionalidades

### Área de clientes

- **Inicio:** próxima sesión, saldo del plan, asistencia, pagos pendientes y accesos rápidos.
- **Agendar sesión:** selección de servicio, fecha y horario según disponibilidad, pago con sesión del plan, transferencia o pago en recepción.
- **Mis reservas:** historial y próximas sesiones, con detalle, reagendamiento y cancelación.
- **Planes:** catálogo de planes y servicios, compra de plan/sesión y creación de la orden de pago.
- **Mis pagos:** estado de pagos, instrucciones de transferencia y envío de comprobante por WhatsApp.
- **Entrenamiento:** rutina asignada por el coach y registro de maximales (sentadilla, peso muerto, press banca, etc.).
- **Mi perfil:** datos personales, objetivo y preferencias de contacto.
- **Sauna húmedo:** página pública con beneficios, protocolo de uso y advertencias responsables.
- **Reseñas:** página pública con promedio, comentarios reales y formulario para dejar una opinión (queda pendiente de moderación).

### Panel administrativo

- **Resumen:** KPIs del mes, pagos por validar, próximas sesiones, actividad reciente y accesos rápidos.
- **Agenda:** vista de sesiones por día, creación/edición/reagendamiento y cambio de estado.
- **Usuarios:** registro y edición de clientes, plan, créditos y estado de la cuenta.
- **Planes y servicios:** creación y edición de planes, servicios, precios y créditos.
- **Pagos:** aprobación/rechazo de transferencias con comprobante, activación de créditos y registro de ingresos manuales.
- **Finanzas:** ingresos, gastos, utilidad, margen, comparativo de seis meses y exportación CSV.
- **Honorarios:** boletas emitidas, retención configurable (15,25 % por defecto), neto a recibir y resumen mensual.
- **Cotizaciones:** pipeline de solicitudes de empresas, cambio de estado, monto final, notas y contacto por WhatsApp/correo.
- **Reseñas:** listado de reseñas publicadas y acceso directo a la moderación en Supabase.
- **Configuración:** horarios, días de atención, duración de bloques, anticipación, política de cambios, datos bancarios, retención, dirección y auto-bloqueo.
- **Seguridad:** cambio de PIN y contraseña, bloqueo manual, cierre de todas las sesiones y registro de auditoría.

### Sitio público de cotizaciones

- Formulario para empresas con datos de contacto, tamaño del equipo, cantidad de participantes, servicios de interés y estimación automática.
- Pantalla de confirmación con referencia de la solicitud y acceso directo a WhatsApp.
- Las solicitudes quedan disponibles en **Admin → Cotizaciones**.

---

## Reglas de negocio implementadas

- **Política de cambios:** por defecto 12 horas antes de la sesión (configurable). Fuera de plazo se bloquea el reagendamiento/cancelación y la sesión se considera utilizada.
- **Créditos de plan:** al reservar con plan se descuenta una sesión; al aprobar un pago se suman los créditos del plan o servicio.
- **Pagos por transferencia:** los datos bancarios se muestran al cliente y el comprobante se envía a WhatsApp `+56 9 6505 8439`.
- **Ingresos:** se calculan con los pagos aprobados según su fecha. Los gastos se registran por mes.
- **Honorarios:** retención de tercera categoría configurable (15,25 % inicial) y neto por boleta/mes.
- **Cotizaciones:** estimación según servicios, cantidad de personas y descuento por volumen; el monto final puede ajustarse manualmente.
- **Seguridad admin:** contraseña + PIN de 4 dígitos, bloqueo automático por inactividad (15 min por defecto), bloqueo temporal tras 5 intentos fallidos y auditoría de acciones.

---

## Ejecutar el proyecto

No requiere build ni instalación de dependencias.

### Opción 1: servidor local

Sirve la carpeta por HTTP para que funcionen el service worker y la instalación como PWA:

```bash
# Con Python
python -m http.server 5173

# Con Node.js
npx serve .
```

Luego abre `http://localhost:5173/`.

### Opción 2: abrir directamente

También puede abrirse `index.html` en el navegador. La app funciona, pero el service worker y algunas funciones PWA requieren `http://` o `https://`.

---

## Estructura

```text
.
├── index.html                  # Shell de la app y carga de módulos
├── manifest.webmanifest        # Metadatos PWA
├── sw.js                       # Service worker (red primero, caché de respaldo)
├── assets/
│   ├── icon.svg                # Ícono/logo
│   ├── css/
│   │   ├── styles.css          # Sistema de diseño, layout y componentes base
│   │   └── views.css           # Estilos específicos de las vistas
│   └── js/
│       ├── data.js             # Estado, datos demo, cálculos y utilidades
│       ├── ui.js               # Iconos, modales, toasts y componentes
│       ├── auth.js             # Login, registro, PIN, bloqueo y cotizaciones públicas
│       ├── user.js             # Vistas y acciones del cliente
│       ├── admin-base.js       # Resumen, agenda y sesiones
│       ├── admin-people.js     # Usuarios, catálogo, maximales y rutinas
│       ├── admin-money.js      # Pagos, finanzas, honorarios y cotizaciones
│       ├── admin-system.js     # Configuración y seguridad
│       ├── reviews.js          # Reseñas compartidas (Supabase) y sauna húmedo
│       └── app.js              # Router, shell, eventos globales y arranque
├── supabase/
│   └── reviews.sql             # Tabla, permisos y políticas RLS de reseñas
└── README.md
```

No hay frameworks, bundler ni dependencias de npm. Los módulos se cargan con etiquetas `<script>` en orden y comparten el espacio global `window.RS`.

---

## Persistencia y datos

- **Estado principal:** `localStorage` bajo la clave `recoveryStudio.state.v1` (cuentas, reservas, pagos, planes, finanzas y configuración).
- **Sesión activa:** `sessionStorage` (se pierde al cerrar la pestaña).
- **Reseñas:** se guardan en **Supabase** y son compartidas entre todos los navegadores. Solo se leen las que tienen `status = 'approved'`.
- **Datos iniciales:** se generan una vez con fechas relativas a hoy y seis meses de historial financiero.
- **Respaldos:** **Configuración → Descargar respaldo JSON**.
- **Restablecer demo:** reemplaza el estado actual por los datos de demostración.

Contraseñas y PIN se almacenan como hash SHA-256 cuando el navegador expone `crypto.subtle` (contexto seguro o `localhost`); en caso contrario se usa un hash de respaldo no criptográfico.

---

## Reseñas compartidas con Supabase

- **Proyecto:** `https://bkvjlpdkyjrfvvokqjsx.supabase.co`
- **Tabla:** `public.reviews`
- **Frontend:** `assets/js/reviews.js` usa únicamente la **anon public key**; nunca se usa `service_role` en el navegador.
- **Seguridad:** la tabla tiene RLS activo. Cualquier visitante puede leer solo reseñas aprobadas y enviar reseñas que quedan en `pending`. La lectura de pendientes y la moderación quedan reservadas al correo administrador mediante Supabase Auth.
- **SQL reproducible:** `supabase/reviews.sql`.

### Moderar una reseña

1. Entra a **Supabase → Table Editor → reviews** (o **Admin → Reseñas → Moderar en Supabase**).
2. Filtra por `status = pending`.
3. Cambia `status` a `approved` o `rejected`. Si apruebas, completa `approved_at` con la fecha actual.
4. La reseña aprobada aparece automáticamente en la página pública y en el inicio de sesión.

También puedes aprobar todas las pendientes desde **SQL Editor**:

```sql
update public.reviews
set status = 'approved', approved_at = now()
where status = 'pending';
```

> Las reseñas enviadas desde un mismo navegador tienen una espera de 6 horas para reducir duplicados. La moderación es la barrera principal contra spam.

---

## Despliegue

Es un sitio estático: puede publicarse en Netlify, Vercel, GitHub Pages, Cloudflare Pages o cualquier servidor web.

**Publicación actual:** GitHub Pages en `https://recoverystudio7-commits.github.io/Recoverystudionativo/` (repositorio `recoverystudio7-commits/Recoverystudionativo`, rama `main`).

1. Sube `index.html`, `manifest.webmanifest`, `sw.js` y la carpeta `assets/`.
2. Sirve todo por **HTTPS**.
3. Verifica que `sw.js` quede en la raíz del sitio y que las rutas relativas se mantengan.
4. Si cambias archivos, el service worker usa estrategia **red primero**, por lo que las actualizaciones se ven al recargar; si cambias el nombre de la caché, actualiza `CACHE` en `sw.js`.
5. Si publicas en un subdirectorio, mantén las rutas relativas (`./`) del manifiesto y del service worker.

### Dominio `www.recoverystudio.cl`

El DNS se administra en **Cloudflare** (nameservers `clara.ns.cloudflare.com` y `renan.ns.cloudflare.com`). Para apuntar el dominio a GitHub Pages, crea estos registros en **modo DNS only / nube gris**:

| Tipo | Nombre | Contenido |
| --- | --- | --- |
| CNAME | `www` | `recoverystudio7-commits.github.io` |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

No modifiques los registros **MX** de Microsoft 365.

Después, en **GitHub → Settings → Pages → Custom domain**, escribe `www.recoverystudio.cl`, guarda y activa **Enforce HTTPS** cuando el certificado esté emitido.

---

## Limitaciones y seguridad en producción

Esta versión es un **prototipo funcional del lado cliente**. Antes de usarla con datos reales de clientes y pagos, se recomienda migrar a una arquitectura con backend:

- La autenticación, los roles y los permisos se validan en el navegador; un usuario con conocimientos técnicos puede modificarlos.
- **Las reseñas ya son compartidas** mediante Supabase, pero las cuentas, reservas, pagos, planes y finanzas siguen en `localStorage`: no se sincronizan entre dispositivos ni tienen respaldo automático. Migrar esos módulos a Supabase es la siguiente etapa.
- `localStorage` no está cifrado y los datos viven solo en el navegador/dispositivo.
- Los comprobantes de transferencia se guardan como data URLs en el navegador; no se envían a un servidor ni sustituyen la validación bancaria.
- El PIN y la contraseña protegen la interfaz, pero no reemplazan autenticación robusta del lado servidor (sesiones firmadas, rate limiting, 2FA real).
- Los pagos son un registro manual: no hay integración con pasarela de pago, conciliación bancaria ni firma electrónica.
- Para producción se requiere: base de datos, API autenticada, almacenamiento seguro de archivos, control de acceso por rol en el servidor, respaldos, HTTPS obligatorio, política de privacidad/tratamiento de datos y cumplimiento tributario aplicable.

---

## Checklist de pruebas sugerido

- [ ] Login de cliente y administrador (contraseña + PIN).
- [ ] Reserva con crédito de plan y con pago por transferencia.
- [ ] Reagendamiento dentro y fuera del plazo configurado.
- [ ] Compra de plan, subida de comprobante y aprobación en admin.
- [ ] Registro de usuario, edición de plan y créditos.
- [ ] Edición de catálogo, maximales y rutina.
- [ ] Ingresos, gastos, boletas y honorarios de seis meses.
- [ ] Cotización pública, confirmación y gestión en admin.
- [ ] Reseña pública: envío, estado pendiente y aparición tras aprobación en Supabase.
- [ ] Página de sauna húmedo y enlaces desde el inicio de sesión.
- [ ] Configuración de política, retención y datos bancarios.
- [ ] Cambio de PIN, bloqueo automático, cierre de sesiones y auditoría.
- [ ] Navegación responsive en móvil, tablet y escritorio.

---

## Créditos

Desarrollado para **Recovery Studio** · Santiago, Chile.
Entrena. Recupera. Rinde.
