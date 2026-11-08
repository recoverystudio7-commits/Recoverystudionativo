# Biblioteca de ejercicios – Checklist

## Archivos de este borrador
- `01_biblioteca_ejercicios.sql` — crea tabla + RLS + seed de 181 ejercicios
- `02_lista_y_categorias.md` — lista legible por categoría
- `03_diseno_admin_y_usuario.md` — cómo se ve en admin y en usuario

## Antes de aplicar (no tocar producción aún)
- [ ] Revisar categorías y conteo (181 en 9 grupos)
- [ ] Decidir: ¿video YouTube embed sí/no?
- [ ] Definir WhatsApp/Instagram para pie de ficha
- [ ] Aplicar SQL en SQL Editor y verificar `select category, count(*) ...` por categoría
- [ ] Probar en cliente de prueba: rutina con imágenes + indicaciones
- [ ] Recién ahí publicar frontend en un push

> No se borra ni altera `client_routines` ni datos de usuarios. Es solo tabla nueva aditiva.
