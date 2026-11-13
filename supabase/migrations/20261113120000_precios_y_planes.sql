-- ==========================================================================
-- Recovery Studio · Actualización de precios y planes (Gorbea)
-- Renombra servicios para conectar con el cliente, agrega el sauna como
-- servicio reservable y reemplaza los packs por mensualidades de frecuencia.
-- ==========================================================================

-- 1) Sesiones: renombrar y mejorar descripciones
update public.services set
  name = 'Evaluación inicial + plan personalizado',
  description = 'Punto de partida: evaluamos tu movilidad, fuerza y objetivos, y te llevas una pauta hecha a tu medida.',
  features = '["Evaluación funcional", "Pauta de entrenamiento", "Definición de maximales"]'::jsonb,
  updated_at = now()
where id = 'srv-eval';

update public.services set
  name = 'Recuperación muscular',
  description = 'Masoterapia deportiva y movilidad asistida para soltar la tensión, bajar el dolor y volver a entrenar mejor.',
  features = '["Evaluación rápida del día", "Masoterapia + movilidad", "Recomendaciones post sesión"]'::jsonb,
  updated_at = now()
where id = 'srv-recovery';

update public.services set
  name = 'Entrenamiento personal',
  description = 'Entrenamiento 1:1 en sala, con corrección técnica en cada repetición para que progreses seguro.',
  features = '["Plan de la sesión", "Corrección técnica", "Registro de cargas"]'::jsonb,
  updated_at = now()
where id = 'srv-training';

update public.services set
  name = 'Asesoría a distancia',
  description = 'Videollamada para resolver dudas de tu rutina, cargas o recuperación, estés donde estés.',
  features = '["Videollamada 30 min", "Resumen escrito", "Seguimiento por WhatsApp"]'::jsonb,
  updated_at = now()
where id = 'srv-online';

-- 2) Sauna húmedo como servicio reservable
insert into public.services (id, name, kind, price, duration, sessions, company_price, description, features, active, popular)
values ('srv-sauna', 'Sauna húmedo', 'Sesión', 10000, 30, 1, 0,
        'Sesión de calor húmedo con protocolo de hidratación y tiempos controlados para soltar tensión y descansar.',
        '["Protocolo de hidratación", "Tiempos controlados"]'::jsonb, true, false)
on conflict (id) do update set
  name = excluded.name, price = excluded.price, duration = excluded.duration,
  description = excluded.description, features = excluded.features, updated_at = now();

-- 3) Desactivar planes antiguos (se conservan por historial, ya no se venden)
update public.services set active = false, updated_at = now()
where id in ('plan-recovery-8', 'plan-performance-12');

-- 4) Nuevos planes mensuales por frecuencia
insert into public.services (id, name, kind, price, duration, sessions, company_price, description, features, active, popular)
values
  ('plan-inicio', 'Plan Inicio', 'Plan', 45000, 60, 4, 0,
   'Para crear el hábito: 1 entrenamiento a la semana, a tu ritmo.',
   '["1 vez por semana", "Vigencia 30 días", "Seguimiento de progreso"]'::jsonb, true, false),
  ('plan-progreso', 'Plan Progreso', 'Plan', 80000, 60, 8, 0,
   'El favorito: 2 entrenamientos por semana para ver cambios reales.',
   '["2 veces por semana", "Vigencia 30 días", "Prioridad de agenda", "Seguimiento de progreso"]'::jsonb, true, true),
  ('plan-libre', 'Plan Libre', 'Plan', 120000, 60, 12, 0,
   'Entrena 3 veces por semana y lleva tu progreso al máximo.',
   '["3 veces por semana", "Vigencia 30 días", "Rutina actualizada", "Asesoría por WhatsApp"]'::jsonb, true, false),
  ('plan-dupla', 'Plan Dupla', 'Plan', 120000, 60, 8, 0,
   'Entrena en pareja: 2 personas, 2 veces por semana. Más barato que ir por separado.',
   '["2 personas", "2 veces por semana", "Vigencia 30 días"]'::jsonb, true, false),
  ('plan-full-inicio', 'Full Inicio', 'Plan', 65000, 60, 4, 0,
   '1 entrenamiento a la semana + sauna después de cada sesión.',
   '["1 vez por semana", "Sauna después de cada sesión", "Vigencia 30 días"]'::jsonb, true, false),
  ('plan-full-progreso', 'Full Progreso', 'Plan', 120000, 60, 8, 0,
   '2 entrenamientos por semana + sauna después de cada sesión.',
   '["2 veces por semana", "Sauna después de cada sesión", "Vigencia 30 días"]'::jsonb, true, false),
  ('plan-full-libre', 'Full Libre', 'Plan', 180000, 60, 12, 0,
   '3 entrenamientos por semana + sauna después de cada sesión. El plan completo.',
   '["3 veces por semana", "Sauna después de cada sesión", "Vigencia 30 días", "Rutina actualizada"]'::jsonb, true, false)
on conflict (id) do update set
  name = excluded.name, price = excluded.price, duration = excluded.duration,
  sessions = excluded.sessions, description = excluded.description,
  features = excluded.features, active = excluded.active, popular = excluded.popular,
  updated_at = now();
