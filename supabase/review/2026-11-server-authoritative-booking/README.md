# Cupos y precios autoritativos en servidor

**Estado:** BORRADOR PARA REVISIÓN Y PRUEBAS. **No aplicar en producción** hasta completar pruebas y dar confirmación explícita.

## Qué logra
La base de datos/función decide si el cupo está libre y qué precio aplica, evitando que dos personas tomen el mismo horario o que el precio se manipule en el navegador.

## Qué incluye
- `01_DRAFT_booking_rpc.sql`: RPC transaccional `create_booking_if_available` + constraints/índices (borrador).
- `frontend-draft/`: referencia de cómo llamar la RPC desde el frontend.
- `CHECKLIST_PRUEBAS.md`: casos de prueba (incluyendo concurrencia).

## Lo que NO hace este borrador
- No aplica migraciones.
- No modifica frontend publicado.
- No toca políticas/datos clínicos o de salud del paciente.

## Problema actual
- El frontend calcula disponibilidad y precio; el servidor solo valida parcialmente.
- Dos dispositivos pueden tomar el mismo horario (race condition).
- El precio podría manipularse en el navegador (aunque se valida parcialmente).

## Solución propuesta
1. **RPC transaccional** `create_booking_if_available(...)` que:
   - Verifica que el servicio esté activo y obtiene el precio vigente del servidor.
   - Verifica que el horario no esté ocupado (usando el constraint `exclude using gist` existente).
   - Inserta la sesión de forma atómica.
   - Devuelve `{ ok, sessionId, price, error }`.
2. **Frontend** llama la RPC en vez de insertar directamente; maneja errores `slot_taken`, `price_changed`, `service_inactive`.
3. **Constraint existente** (`exclude using gist (during with &&) where (status <> 'cancelada')`) ya previene solapamientos a nivel DB; la RPC lo aprovecha.

## Pasos para aplicar (cuando confirmes)
1. Revisar el borrador SQL (compatibilidad con esquema actual).
2. Probar en entorno de prueba/staging.
3. Actualizar frontend para usar la RPC.
4. Pruebas de concurrencia (dos dispositivos, mismo horario).
5. Publicar frontend solo después de pruebas OK.

## Riesgos
- Constraints mal definidas pueden bloquear reservas legítimas.
- Cambios en el modelo de datos pueden romper reservas existentes.
- Requiere despliegue coordinado (SQL + app).