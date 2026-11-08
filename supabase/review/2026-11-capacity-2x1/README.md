# Capacidad 2x1 con Sauna (2 personas por bloque)

**Estado:** BORRADOR. No aplicado en Supabase. No publicado en la web.

## Regla
- **2x1 con Sauna** (`srv_mw2p0nensgwl9s`): hasta 2 personas en el mismo bloque de 60 min.
- **Resto de servicios:** horario exclusivo, como hoy.
- Un bloque 2x1 no puede solaparse parcialmente con otro servicio (el coach está ocupado).

## Archivos
- `01_DRAFT_capacity.sql`: columna `services.capacity`, quita la restricción de solapamiento de `sessions`, agrega el trigger `sessions_capacity_guard` y actualiza `create_booking_if_available` (ya no bloquea por solapamiento general; lo hace el trigger).
- `02_TEST_capacity.sql`: prueba que se revierte sola.

## Orden de ejecución
1. Revisar `01_DRAFT_capacity.sql`.
2. Ejecutar `01_DRAFT_capacity.sql` en SQL Editor. Debe decir "Success".
3. Ejecutar `02_TEST_capacity.sql`. Esperado en el mensaje de error:
   - `2x1_1`: `ok: true`
   - `2x1_2`: `ok: true`
   - `2x1_3`: `ok: false`, `slot_taken`
   - `exclusivo_en_bloque_2x1`: `ok: false`, `slot_taken`
   - `asesoria_otro_horario`: `ok: true`
4. Confirmar que no quedaron reservas de prueba:
   `select count(*) from public.sessions where id like 'ses_cap_test_%';` debe dar 0.

## Pendiente (solo después de aplicar la base)
- **Frontend**: la disponibilidad local (`RS.data.availableSlots`) y la validación de `book-confirm` bloquean un horario ocupado aunque sea 2x1. Hay que permitir hasta `capacity` personas y mostrar "1 lugar disponible" / "Completo".
- **Panel admin**: las sesiones creadas por admin pasan por el mismo trigger (protección en base de datos), pero el aviso en pantalla debe mostrar el mismo mensaje.

## Riesgos
- Quitar la restricción de solapamiento y reemplazarla por trigger: si el trigger tuviera un error, un horario podría quedar doble. Por eso la prueba es obligatoria antes de usarlo.
- Las sesiones existentes no se revisan al crear el trigger. Antes de aplicar, conviene confirmar que no hay bloques solapados hoy.
