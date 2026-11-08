# Checklist de pruebas — Cupos/precios autoritativos

## Seguridad
- [ ] RPC solo ejecutable por authenticated.
- [ ] RPC valida servicio activo y precio del servidor.
- [ ] RPC valida usuario activo.
- [ ] No expone datos sensibles.

## Backend
- [ ] Aplicar SQL borrador en entorno de prueba/staging.
- [ ] Verificar constraint `exclude using gist` sigue funcionando.
- [ ] Probar RPC con cupo libre: crea sesión OK.
- [ ] Probar RPC con cupo ocupado: devuelve `slot_taken`.
- [ ] Probar RPC con servicio inactivo: devuelve `service_inactive`.
- [ ] Probar RPC con precio diferente al frontend: usa precio del servidor.

## Concurrencia
- [ ] Dos dispositivos intentan el mismo horario simultáneamente: solo uno crea sesión.
- [ ] El segundo recibe `slot_taken`.

## Frontend (después de pruebas backend)
- [ ] Reemplazar creación directa por RPC en `book-confirm` (user.js).
- [ ] Reemplazar creación/edición en `admin-session` (admin-base.js).
- [ ] Manejar errores: `slot_taken`, `price_changed`, `service_inactive`.
- [ ] Mostrar precio del servidor (no del frontend).
- [ ] Bump de versiones y publicar.

## Regresión
- [ ] Login, agendar, comprobante, admin, recordatorios, lista de espera, eliminación de usuario siguen funcionando.
- [ ] Datos reales existentes intactos.
- [ ] No se tocan políticas/datos clínicos o de salud del paciente.