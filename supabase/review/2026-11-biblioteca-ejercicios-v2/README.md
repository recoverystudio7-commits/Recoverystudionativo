# Biblioteca de ejercicios v2 — 30 ejercicios de cuerpo completo

Contiene **30 ejercicios nuevos** (10 Principiante, 10 Intermedio, 10 Avanzado)
con equipamiento variado: peso corporal, banda elástica, mancuernas, barra
olímpica, pesa rusa, TRX y BOSU.

## Archivos

- `ejercicios_cuerpo_completo_30.json`: fuente con los campos solicitados
  (`nombre`, `nivel`, `grupo_muscular_principal`, `musculos_secundarios`,
  `equipamiento`, `descripcion_breve`, `prompt_imagen_inicial`,
  `prompt_imagen_final`). Los prompts están en inglés y comparten el mismo
  estilo visual para que las fotos inicial/final parezcan una secuencia.
- `../../migrations/20261113150000_biblioteca_ejercicios_v2.sql`: migración
  lista para pegar en el SQL Editor de Supabase. Solo agrega columnas nuevas
  y usa `on conflict (id) do nothing`; no borra ni modifica los 181 ejercicios
  existentes.

## Cómo aplicarla

1. Abrir el SQL Editor del proyecto:
   https://supabase.com/dashboard/project/bkvjlpdkyjrfvvokqjsx/sql/new
2. Copiar todo el contenido de
   `supabase/migrations/20261113150000_biblioteca_ejercicios_v2.sql`.
3. Ejecutar. Es seguro repetirlo.
4. Recargar la app. Los 30 ejercicios aparecerán en la biblioteca.

## Imágenes

Los prompts están guardados en la base (`prompt_image_start` y
`prompt_image_end`). Cuando generes las fotos, pega las URLs en la ficha del
ejercicio (Foto inicial / Foto final) desde el panel de administración.
