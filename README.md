# Recovery Studio — App de agenda, recuperación y performance

Aplicación web estática (HTML, CSS y JavaScript sin dependencias) para que clientes de **Recovery Studio** reserven sesiones, sigan su plan y sus maximales, compren servicios y gestionen sus pagos por transferencia. Incluye un panel administrativo completo para agenda, usuarios, planes, pagos, finanzas, honorarios y cotizaciones de empresas.

Las **reseñas y calificaciones son compartidas** entre todos los visitantes mediante Supabase (con moderación previa), y el sitio incluye una página pública con los **beneficios del sauna húmedo**.

- App online: `https://recoverystudio7-commits.github.io/Recoverystudionativo/`
- Dominio objetivo: `https://www.recoverystudio.cl`

La identidad visual usa azul marino (`#0A2342`), azul de apoyo (`#123F70`), naranja (`#FF7A18`) y una interfaz clara, minimalista y responsive en español de Chile.

---

## Inicio y horarios

La primera carga no incluye usuarios, reservas, pagos ni movimientos ficticios. No se documentan credenciales de administrador en el repositorio. Para habilitar el panel, crea la cuenta en Supabase Auth y asigna `role = 'admin'` a su perfil desde Supabase. El PIN de la interfaz sigue siendo local y no reemplaza controles de seguridad del servidor.

Horario inicial, en bloques de 60 minutos:

- **Lunes a jueves:** 17:30–22:30 (último inicio 21:30).
- **Viernes:** 15:00–19:30 (último inicio 18:00).
- **Sábado y domingo:** cerrado.

El administrador puede activar o cerrar días y modificar sus horas desde **Admin → Configuración**. En **Admin → Agenda** puede bloquear o desbloquear horarios particulares, crear, editar o eliminar sesiones. Al agendar con **Plan del cliente**, se descuenta automáticamente una sesión de su saldo; si la sesión se cancela, se elimina o se cambia el método de pago, la sesión se devuelve al plan. Desde la ficha de cada usuario también puede quitar un plan asignado y su saldo de sesiones; el historial de pagos se conserva.

---

## Funcionalidades

### Área de clientes

- **Inicio:** próxima sesión, saldo del plan, asistencia, pagos pendientes y accesos rápidos.
- **Agendar sesión:** selección de servicio, fecha y horario según disponibilidad, pago con sesión del plan, transferencia o pago en recepción.
- **Mis reservas:** historial y próximas sesiones, con detalle, reagendamiento y cancelación.
- **Club Recovery:** un sello por sesión completada y un sello de constancia por cada tres meses consecutivos con actividad. El administrador configura el premio de los cinco sellos y revisa el progreso de todos los clientes en **Admin → Club Recovery** (también disponible en Configuración); ahí ve quiénes están a un sello y puede escribirles por WhatsApp. El equipo valida y coordina el canje.
- **Planes:** catálogo de planes y servicios, compra de plan/sesión y creación de la orden de pago.
- **Descuentos:** aplicación de códigos vigentes al comprar planes.
- **Mis pagos:** estado de pagos, instrucciones de transferencia y envío de comprobante por WhatsApp.
- **Entrenamiento:** rutina asignada por el coach, fotos privadas de progreso y registro de maximales (sentadilla, peso muerto, press banca, etc.).
- **Mi perfil:** datos personales, objetivo y preferencias de contacto.
- **Sauna húmedo:** página pública con beneficios, protocolo de uso y advertencias responsables.
- **Reseñas:** página pública con promedio, comentarios reales y formulario para dejar una opinión (queda pendiente de moderación).
- **Cápsulas:** página pública de videos de recuperación, movilidad y entrenamiento.

### Panel administrativo

- **Resumen:** KPIs del mes, pagos por validar, próximas sesiones, actividad reciente y accesos rápidos.
- **Agenda:** vista de sesiones por día, creación/edición/reagendamiento y cambio de estado; las sesiones agendadas con el plan descuentan el saldo del cliente.
- **Usuarios:** registro y edición de clientes; el selector usa los planes y servicios activos del catálogo y completa las sesiones incluidas.
- **Club Recovery:** premio configurable, sellos por cliente, filtros por progreso y contacto directo por WhatsApp.
- **Planes y servicios:** creación y edición de planes, servicios, precios y créditos.
- **Pagos:** aprobación/rechazo de transferencias con comprobante, activación de créditos y registro de ingresos manuales.
- **Finanzas:** ingresos, gastos, utilidad, margen, comparativo de seis meses y exportación CSV.
- **Honorarios:** boletas emitidas, retención configurable (15,25 % por defecto), neto a recibir y resumen mensual.
- **Cotizaciones:** pipeline de solicitudes de empresas, cambio de estado, monto final, notas y contacto por WhatsApp/correo.
- **Reseñas:** listado de reseñas publicadas y acceso directo a la moderación en Supabase.
- **Promociones y cápsulas:** creación, edición, activación y eliminación de códigos de descuento y videos de YouTube, Vimeo o archivos HTTPS.
- **Configuración:** horarios por día, duración de bloques, anticipación, política de cambios, datos bancarios, retención, dirección y auto-bloqueo.
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
- **Descuentos de planes:** el precio rebajado y el código se calculan y registran actualmente en el navegador; deben validarse en el servidor antes de tratarse como cobro definitivo.
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
│       ├── data.js             # Estado, catálogo inicial, cálculos y utilidades
│       ├── ui.js               # Iconos, modales, toasts y componentes
│       ├── auth.js             # Login, registro, PIN, bloqueo y cotizaciones públicas
│       ├── user.js             # Vistas y acciones del cliente
│       ├── admin-base.js       # Resumen, agenda y sesiones
│       ├── admin-people.js     # Usuarios, catálogo, maximales y rutinas
│       ├── admin-club.js       # Club Recovery: premios, sellos y progreso
│       ├── routine-sync.js     # Sincronización privada de rutinas con Supabase
│       ├── admin-money.js      # Pagos, finanzas, honorarios y cotizaciones
│       ├── admin-system.js     # Configuración y seguridad
│       ├── reviews.js          # Reseñas compartidas (Supabase) y sauna húmedo
│       ├── supabase-client.js  # Cliente REST/Auth de Supabase
│       └── app.js              # Router, shell, eventos globales y arranque
├── supabase/
│   ├── migrations/             # Esquema y funciones de Supabase
│   └── reviews.sql             # Tabla, permisos y políticas RLS de reseñas
└── README.md
```

No hay frameworks, bundler ni dependencias de npm. Los módulos se cargan con etiquetas `<script>` en orden y comparten el espacio global `window.RS`.

## Integraciones externas

- **Resend:** `recoverystudio.cl` aparece verificado en el panel. El CNAME `send` corresponde a recepción y no se necesita para notificaciones salientes. El MX y SPF raíz de Microsoft 365 deben permanecer sin cambios.
- **Notificaciones por correo y WhatsApp:** todavía no están activas. La aplicación debe migrar primero las reservas, pagos y anulaciones a Supabase; después se deben enviar avisos desde una Edge Function con claves guardadas como secretos del proyecto, nunca desde JavaScript público.
- La dirección planeada para las alertas es `recoverystudio7@gmail.com`, usando `notificaciones@recoverystudio.cl` como remitente de Resend.

---

## Persistencia y datos

- **Estado principal:** `localStorage` bajo la clave `recoveryStudio.state.v1` (cuentas, reservas, pagos, planes, finanzas y configuración).
- **Autenticación en curso:** las cuentas y contraseñas nuevas usan Supabase Auth; el perfil se consulta en Supabase y la sesión dura mientras la pestaña permanezca abierta. La administración requiere asignar `role = 'admin'` al perfil desde el panel Supabase; el registro público siempre crea clientes.
- **Sesión y perfil:** sesión de Supabase en `sessionStorage`; la edición del perfil usa la función `update_own_profile` de `supabase/migrations/20261104232000_profile_self_service.sql`, aplicada y verificada en Supabase.
- **Reseñas:** se guardan en **Supabase** y son compartidas entre todos los navegadores. Solo se leen las que tienen `status = 'approved'`.
- **Promociones y cápsulas:** se guardan en `public.discount_codes` y `public.video_capsules`. Ambas tablas tienen RLS activo; visitantes leen solo contenido activo y los cambios requieren un perfil administrador. La migración `supabase/migrations/20261104233000_marketing_content.sql` ya se aplicó y se verificó en Supabase.
- **Fotos de progreso de la rutina:** el administrador puede agregar fotos de inicio y de fin; el cliente las ve en **Entrenamiento → Mi rutina**. Las pautas de perfiles de Supabase, incluidas sus imágenes comprimidas, se guardan en `public.client_routines` y quedan disponibles al iniciar sesión desde otro dispositivo. Las cuentas creadas solo en el almacenamiento local no se sincronizan.
- **Club Recovery:** el premio se configura desde el panel y se comparte mediante `public.studio_settings`; por defecto es una sesión de sauna. El progreso se calcula a partir de las sesiones completadas visibles para la cuenta en el navegador; el canje es manual con el equipo y no agrega créditos automáticamente. Hasta migrar las reservas, el historial y el progreso no están sincronizados entre dispositivos.
- **Asignación de planes:** el formulario de usuarios toma los planes y servicios activos desde el catálogo local del administrador. Al seleccionar uno, completa el saldo inicial con sus sesiones incluidas; ese saldo puede ajustarse manualmente.
- **Esquema base de operaciones:** aplicado al proyecto Supabase el 4 de noviembre de 2026. Crea 14 tablas con RLS y carga los 7 servicios y la configuración inicial del studio. Se verificaron las tablas, esos datos iniciales y RLS de sesiones.
- **Migración pendiente:** las cuentas locales antiguas, reservas, pagos, finanzas, agenda y demás operaciones todavía se guardan localmente. Además, el descuento no se valida contra el importe en servidor. No considerar la migración completa ni usar los montos promocionales como cobros definitivos hasta completar esos flujos.
- **Datos iniciales:** cuenta administradora, catálogo y horarios; sin usuarios ni actividad ficticia.
- **Respaldos:** **Configuración → Descargar respaldo JSON**.

Supabase Auth gestiona las contraseñas. El PIN de administrador sigue siendo local y debe migrarse a una verificación del servidor antes de tratarlo como un control de seguridad.

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

Es un sitio estático: puede publicarse en Netlify, Vercel, GitHub Pages, Cloudflare Pages o cualquier servidor web. El despliegue publica el sitio; no convierte los datos de `localStorage` en datos compartidos o sincronizados.

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
- [ ] Edición de catálogo, maximales, rutina e imágenes de progreso visibles para el cliente.
- [ ] Ingresos, gastos, boletas y honorarios de seis meses.
- [ ] Cotización pública, confirmación y gestión en admin.
- [ ] Reseña pública: envío, estado pendiente y aparición tras aprobación en Supabase.
- [ ] Página de sauna húmedo y enlaces desde el inicio de sesión.
- [ ] Crear/editar/desactivar/eliminar un descuento y comprobar sus fechas y cálculo en el checkout de un plan.
- [ ] Crear/editar/desactivar/eliminar una cápsula y probar enlaces de YouTube, Vimeo y archivo HTTPS.
- [ ] Verificación de horarios por día y bloqueo/desbloqueo de franjas.
- [ ] Configuración de política, retención y datos bancarios.
- [ ] Cambio de PIN, bloqueo automático, cierre de sesiones y auditoría.
- [ ] Navegación responsive en móvil, tablet y escritorio.

---

## Créditos

Desarrollado para **Recovery Studio** · Santiago, Chile.
Entrena. Recupera. Rinde.
