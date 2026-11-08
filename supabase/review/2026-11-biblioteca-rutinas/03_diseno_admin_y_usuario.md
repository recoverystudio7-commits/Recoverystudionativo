# Diseño – Biblioteca de ejercicios (BORRADOR)

## Objetivo
Que al armar una rutina aparezcan **imágenes** y puedas **editar descripción/indicaciones** sin reescribir cada vez. Y que el usuario vea tu **logo + nombre** siempre.

## 1) Panel Admin – Biblioteca
- Nueva vista **Admin → Biblioteca** (separada de rutinas).
- Tabla con buscador + filtro por categoría + activo/inactivo.
- Editar: nombre, categoría, músculo, material, dificultad, **foto/GIF/video (URL)**, descripción, indicaciones, errores, variantes.
- Botones: Nuevo, Editar, Activar/Desactivar, Eliminar (solo si no se usa; si se usa, mejor desactivar).
- Al editar una vez, afecta a **futuras** rutinas. Las rutinas viejas mantienen la foto que tenían (snapshot).

## 2) Panel Admin – Rutina del usuario (mejora del editor actual)
- Al escribir en el campo Ejercicio, muestra **lista desplegable con buscador** de la biblioteca (por nombre o categoría).
- Al elegir, se rellena solo: nombre + foto/GIF + indicaciones. Puedes cambiar series/reps/carga/descanso y notas por usuario.
- Igual mantienes: días, foco del día, semanas, foto inicio/final, título y objetivo.
- Si quieres un ejercicio que no está, botón **“Crear en biblioteca”** y queda para todos.

## 3) Vista del Usuario (Entrenamiento → Mi rutina)
- Encabezado siempre con: **Logo (icon-192.png) + Recovery Studio · Performance & Recovery + tu nombre (Daniel Barrueto) + Gorbea, Araucanía**.
- Tarjeta de rutina: Título, objetivo, semanas, días, fecha actualización.
- Por día: acordeón con ejercicios en **tarjetas visuales**:
  - Foto/GIF (inicio → final cuando hay 2), si no hay hay marco con icono + nombre.
  - Nombre, series/reps/carga/descanso.
  - Botón **“Ver indicaciones”** que abre descripción + pasos + errores + variantes.
  - Notas del coach para ese ejercicio y nota general de la rutina.
  - Aviso: “Ante dolor/malestar, detén y avisa a tu coach.”
- Botones: **Imprimir rutina / Guardar PDF**, **Compartir por WhatsApp**, enlace a agendar.
- En móvil: imágenes grandes, una columna.
- Si no tiene rutina: mensaje actual (“Tu rutina está en camino”) + agendar.

## 4) Flujo de datos (simple, sin romper lo actual)
- Nueva tabla: `exercise_library` (solo lectura para clientes logueados, escritura solo admin).
- `client_routines` (JSONB) se mantiene: ahora cada `item` puede guardar además `exerciseId`, `imageUrl`, `gifUrl`, `description`, `cues` como **copia del momento**. Así no se rompe si editas después.
- Carga: al entrar, la app trae biblioteca + rutina en paralelo (like services hoy). Si falla, la rutina actual sigue funcionando sin imágenes.

## 5) Imágenes – recomendación práctica
- V1: **URLs externas (GIF/foto) que tú pegas**. Liviano, sin derechos complicados si usas material libre.
- V2 opcional: **Subir tus propias fotos** a Supabase Storage (requiere bucket + permisos). No se suben a GitHub.
- Siempre hay fallback visual (icono + nombre) si el link falla o no hay imagen.

## 6) Branding en la ficha (lo que pediste)
En el encabezado de la rutina del usuario:
- Logo circular + “Recovery Studio”
- Subtítulo “Performance & Recovery”
- “Coach: Daniel Barrueto” + “Gorbea, Región de la Araucanía”
- Pie: “Ficha generada en recoverystudio.cl – Ante dolor o molestia, detén y avisa a tu coach.”
- Lista de contactos: WhatsApp/Instagram/Email (se toman de studio_settings si existen, si no se dejan fijos).

## 7) Pasos de publicación (en 1 push, cuando apruebes)
1. Aplicar SQL en Supabase SQL Editor (verificar conteo por categoría).
2. Publicar frontend: biblioteca admin + picker en rutina + vista usuario con tarjetas.
3. Probar: crear rutina con 3 ejercicios desde biblioteca, ver en usuario cliente, editar indicación en biblioteca y verificar que rutina nueva la toma.
4. Recargar con Ctrl+F5 en cliente de prueba.

## 8) Qué necesito de ti antes de publicar
- Confirma lista de categorías (o qué quitar).
- Dime si quieres que además se vean **videos de YouTube** dentro de la tarjeta (recomendado: sí, como link/embed opcional).
- Dime tu WhatsApp/Instagram para ponerlo en pie de ficha (si no, uso los que ya están en la web).
