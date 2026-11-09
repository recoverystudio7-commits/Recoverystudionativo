-- ==========================================================================
-- Recovery Studio · Biblioteca de ejercicios (BORRADOR PARA REVISIÓN)
-- No aplicado aún. Revisar antes de copiar en SQL Editor.
-- --------------------------------------------------------------------------
-- Objetivo: tabla reutilizable de ejercicios para que el admin arma rutinas
-- eligiendo de una lista. Las rutinas actuales (client_routines JSONB) NO se
-- tocan ni se borran. Al usar un ejercicio, la rutina guarda una foto del
-- nombre + imagen (snapshot), así si después editas la biblioteca, las
-- rutinas pasadas no se rompen.
-- Compatible con: Supabase project bkvjlpdkyjrfvvokqjsx
-- ==========================================================================
begin;

create table if not exists public.exercise_library (
  id text primary key,
  name text not null,
  category text not null default 'Musculación'
    check (category in ('Musculación','Peso corporal','CrossFit','Kettlebell','Halterofilia','Cardio','Movilidad','Core','Agilidad')),
  muscle_group text not null default '',
  equipment text not null default 'Sin material',
  difficulty text not null default 'Principiante'
    check (difficulty in ('Principiante','Intermedio','Avanzado')),
  description text not null default '',
  cues text not null default '',
  common_errors text not null default '',
  variants text not null default '',
  image_url text not null default '',
  gif_url text not null default '',
  video_url text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.exercise_library enable row level security;

create index if not exists exercise_library_category_idx on public.exercise_library (category, sort_order, name);
create index if not exists exercise_library_active_idx on public.exercise_library (is_active, category);

-- Trigger de.updated_at (reusa touch_updated_at de migraciones base)
create or replace function public.touch_exercise_library_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists touch_exercise_library_updated_at on public.exercise_library;
create trigger touch_exercise_library_updated_at
  before insert or update on public.exercise_library
  for each row execute function public.touch_exercise_library_updated_at();

-- RLS: lectura para usuarios logueados de ejercicios activos, gestión solo admin
drop policy if exists exercise_library_read_active on public.exercise_library;
create policy exercise_library_read_active on public.exercise_library
  for select to authenticated
  using (is_active or (select public.is_studio_admin()));

drop policy if exists exercise_library_admin_manage on public.exercise_library;
create policy exercise_library_admin_manage on public.exercise_library
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

grant usage on schema public to anon, authenticated;
grant select on public.exercise_library to authenticated;
grant insert, update, delete on public.exercise_library to authenticated;

-- --------------------------------------------------------------------------
-- Seed inicial: 181 ejercicios (solo inserta si no existe el id).
-- Imágenes/GIFs quedan vacíos en v1: la app muestra marco con nombre.
-- El admin puede pegar URLs después sin tocar la base.
-- --------------------------------------------------------------------------

-- Musculación (25)
insert into public.exercise_library (id, name, category, muscle_group, equipment, difficulty, description, cues, common_errors, sort_order) values
('ex-mus-01','Sentadilla con barra','Musculación','Cuádriceps / Glúteo','Barra','Intermedio','Fuerza empuje de tren inferior con carga axial.','Barra sobre trapecio, pies ancho cadera, cadera entre talones, pecho arriba.','—',10),
('ex-mus-02','Prensa de piernas 45°','Musculación','Cuádriceps / Glúteo','Máquina','Principiante','Alternativa de sentadilla para cargas altas.','Espalda apoyada, pies medio plataforma, rodillas alineadas con punta de pie.','—',20),
('ex-mus-03','Sentadilla búlgara con mancuernas','Musculación','Cuádriceps / Glúteo','Mancuernas','Intermedio','Unilateral de fuerza y control.','Pie trasero elevado, torso leve inclinación, baja controlado.','—',30),
('ex-mus-04','Peso muerto rumano','Musculación','Isquios / Glúteo','Barra','Intermedio','Bisagra de cadera para cadena posterior.','Cadera atrás, espalda neutra, barra pegada a piernas, rodilla leve flexion.','—',40),
('ex-mus-05','Peso muerto convencional','Musculación','Cadena posterior','Barra','Avanzado','Levantamiento pesado de tracción total.','Barra sobre medio pie, dorsiflexión, empuja suelo, cadera y rodilla a la vez.','—',50),
('ex-mus-06','Hip thrust con barra','Musculación','Glúteo','Barra / Banca','Intermedio','Extensión de cadera para glúteo.','Apoya omóplatos en banca, mentón retraído, empuja talones.','—',60),
('ex-mus-07','Curl femoral acostado','Musculación','Isquios','Máquina','Principiante','Flexión de rodilla asistida.','Cadera pegada a banca, baja lento, sin despegar glúteo.','—',70),
('ex-mus-08','Extensión de cuádriceps','Musculación','Cuádriceps','Máquina','Principiante','Aislamiento de cuádriceps.','Eje de rodilla alineado, sin hiperextensión brusca arriba.','—',80),
('ex-mus-09','Elevación de pantorrillas de pie','Musculación','Pantorrillas','Máquina / Barra','Principiante','Fuerza de gastrocnemio.','Rango completo, pausa arriba 1 s, baja lento.','—',90),
('ex-mus-10','Press banca con barra','Musculación','Pecho / Tríceps','Barra / Banca','Intermedio','Empuje horizontal principal.','Hombros abajo y atrás, muñecas verticales, codos 45°.','—',100),
('ex-mus-11','Press banca con mancuernas','Musculación','Pecho','Mancuernas','Principiante','Empuje con mayor rango.','Baja hasta línea de pecho con control, sin rebotar.','—',110),
('ex-mus-12','Press banca inclinado','Musculación','Pecho superior','Barra / Banca','Intermedio','Énfasis clavicular.','Banco 30-45°, misma alineación que press plano.','—',120),
('ex-mus-13','Fondos en paralelas','Musculación','Pecho / Tríceps','Paralelas','Avanzado','Empuje vertical de torso.','Hombros abajo, tronco leve inclinación, codos cerca de costillas.','—',130),
('ex-mus-14','Remo con barra','Musculación','Espalda','Barra','Intermedio','Tirón horizontal de espalda.','Pecho arriba, remo a costillas, dorsales dirigen.','—',140),
('ex-mus-15','Remo con mancuerna a una mano','Musculación','Espalda','Mancuerna / Banca','Principiante','Unilateral de espalda.','Espalda plana, codo cerca de costilla, sin rotar.','—',150),
('ex-mus-16','Remo en polea baja','Musculación','Espalda','Polea','Principiante','Tirón guiado de espalda.','Pecho alto, escápulas juntas, baja controlado.','—',160),
('ex-mus-17','Dominadas asistidas','Musculación','Espalda / Bíceps','Máquina / Banda','Intermedio','Progresión a dominadas.','Tirano desde abajo, pecho a barra, sin columpio.','—',170),
('ex-mus-18','Curl de bíceps con mancuernas','Musculación','Bíceps','Mancuernas','Principiante','Flexión de codo.','Codos pegados, sin balancear torso.','—',180),
('ex-mus-19','Curl predicador','Musculación','Bíceps','Barra Z / Máquina','Principiante','Aislamiento de bíceps.','Brazo apoyado, rango completo sin despegar.','—',190),
('ex-mus-20','Extensión de tríceps en polea','Musculación','Tríceps','Polea','Principiante','Extensión aislada de tríceps.','Codos pegados, extiende todo sin mover hombro.','—',200),
('ex-mus-21','Press militar de pie','Musculación','Hombros','Barra / Mancuernas','Intermedio','Empuje vertical de hombro.','Glúteos apretados, barra a clavícula, empuje vertical.','—',210),
('ex-mus-22','Elevaciones laterales','Musculación','Deltoides medio','Mancuernas','Principiante','Ancho de hombro.','Ligeras mancuernas, eleva a 90° sin encoger trapecio.','—',220),
('ex-mus-23','Reverse fly (pájaros inversos)','Musculación','Hombro posterior','Mancuernas','Principiante','Postura de hombro.','Bisagra de cadera, abre a los lados con omóplatos juntos.','—',230),
('ex-mus-24','Jalón al pecho en polea alta','Musculación','Dorsal','Polea','Principiante','Tirón vertical de espalda.','Pecho alto, codos a costillas, sin inclinar tronco.','—',240),
('ex-mus-25','Face pull con cuerda','Musculación','Hombro posterior / Rotadores','Polea','Principiante','Salud de hombro.','Cuerda a frente, pulgares atrás, codos altos.','—',250)
on conflict (id) do nothing;

-- Peso corporal (20)
insert into public.exercise_library (id, name, category, muscle_group, equipment, difficulty, description, cues, common_errors, sort_order) values
('ex-pes-01','Flexiones','Peso corporal','Pecho / Tríceps','Sin material','Principiante','Empuje horizontal con peso corporal.','Manos bajo pecho, cuerpo en línea, baja pecho a 5 cm del suelo.','—',10),
('ex-pes-02','Flexiones diamante','Peso corporal','Tríceps','Sin material','Intermedio','Énfasis en tríceps.','Manos bajo esternón en forma de diamante, codos pegados.','—',20),
('ex-pes-03','Flexiones inclinadas','Peso corporal','Pecho','Banca / Silla','Principiante','Regresión de flexiones.','Manos elevadas, cuerpo en línea, baja controlado.','—',30),
('ex-pes-04','Sentadilla con peso corporal','Peso corporal','Pierna','Sin material','Principiante','Patrón base de sentadilla.','Pies cadera, cadera atrás y abajo, talones apoyados.','—',40),
('ex-pes-05','Zancadas','Peso corporal','Pierna / Glúteo','Sin material','Principiante','Fuerza unilateral.','Paso largo, torso alto, rodilla trasera baja vertical.','—',50),
('ex-pes-06','Zancadas caminando','Peso corporal','Pierna','Sin material','Principiante','Zancada dinámica.','Cadencia continua, sin rebotar.','—',60),
('ex-pes-07','Puente de glúteo','Peso corporal','Glúteo','Sin material','Principiante','Extensión de cadera en suelo.','Talones cerca de glúteo, eleva cadera hasta hombros.','—',70),
('ex-pes-08','Sentadilla isométrica en pared','Peso corporal','Cuádriceps','Sin material','Principiante','Isométrico de cuádriceps.','Rodillas 90°, espalda apoyada, respira.','—',80),
('ex-pes-09','Remo invertido australiano','Peso corporal','Espalda','Barra baja','Intermedio','Tirón horizontal corporal.','Cuerpo en línea, pecho a barra, cuerpo rígido.','—',90),
('ex-pes-10','Dominadas','Peso corporal','Espalda / Bíceps','Barra','Avanzado','Tirón vertical corporal.','Agarre prono, pecho a barra, sin columpio.','—',100),
('ex-pes-11','Pike push-ups','Peso corporal','Hombros','Sin material','Intermedio','Empuje vertical progresión HSPU.','Cadera alta, baja cabeza entre manos.','—',110),
('ex-pes-12','Fondos entre bancos','Peso corporal','Tríceps','Bancos','Principiante','Extensión de codo con apoyo.','Codos atrás, hombros abajo.','—',120),
('ex-pes-13','Elevación de pantorrillas','Peso corporal','Pantorrillas','Sin material','Principiante','Fuerza de pantorrilla corporal.','Rango completo, pausa arriba.','—',130),
('ex-pes-14','Superman','Peso corporal','Espalda baja','Sin material','Principiante','Extensión de espalda.','Eleva pecho y piernas sin hiperextender cuello.','—',140),
('ex-pes-15','Hollow body hold','Peso corporal','Core / Abdomen','Sin material','Intermedio','Estabilidad anterior.','Parte baja pegada al suelo, brazos y piernas en línea.','—',150),
('ex-pes-16','Sentadilla con salto','Peso corporal','Pierna / Potencia','Sin material','Intermedio','Potencia corporal.','Aterriza suave, rodillas alineadas.','—',160),
('ex-pes-17','Zancada lateral','Peso corporal','Glúteo / Aductores','Sin material','Principiante','Movilidad y fuerza lateral.','Cadera atrás, rodilla alineada, peso en talón.','—',170),
('ex-pes-18','Estocada inversa alternada','Peso corporal','Pierna','Sin material','Principiante','Unilateral controlada.','Paso atrás, baja vertical.','—',180),
('ex-pes-19','Plancha con toque de hombro','Peso corporal','Core','Sin material','Principiante','Estabilidad anti-rotación.','Cadera quieta, toca hombro opuesto.','—',190),
('ex-pes-20','Escaladores lentos','Peso corporal','Core / Cardio','Sin material','Principiante','Core dinámico.','Cadera baja, lleva rodilla a pecho sin saltar.','—',200)
on conflict (id) do nothing;

-- CrossFit (25)
insert into public.exercise_library (id, name, category, muscle_group, equipment, difficulty, description, cues, common_errors, sort_order) values
('ex-cf-01','Burpees','CrossFit','Cuerpo completo','Sin material','Intermedio','Acondicionamiento de cuerpo completo.','Baja a plancha, pecho a suelo, salta de pie.','—',10),
('ex-cf-02','Thrusters','CrossFit','Cuerpo completo','Barra / Mancuernas','Avanzado','Front squat + push press.','Desde rack, sentadilla completa y empuje vertical.','—',20),
('ex-cf-03','Wall balls','CrossFit','Pierna / Hombros','Balón medicinal','Intermedio','Sentadilla con lanzamiento.','Sentadilla completa, lanza a objetivo alto.','—',30),
('ex-cf-04','Box jumps','CrossFit','Potencia de pierna','Cajón','Intermedio','Salto a cajón.','Aterriza con cadera y rodilla flexionada, alto completo.','—',40),
('ex-cf-05','Toes to bar','CrossFit','Core / Dorsal','Barra','Avanzado','Elevación de piernas colgado.','Colgado activo, puntas a barra sin columpio grande.','—',50),
('ex-cf-06','Kipping pull-ups','CrossFit','Espalda','Barra','Avanzado','Pull-up dinámico con balanceo.','Usa la cadera, pecho a la barra.','—',60),
('ex-cf-07','Double unders','CrossFit','Cardio / Salto','Cuerda','Avanzado','Salto doble con cuerda.','Salto alto, dos vueltas de cuerda.','—',70),
('ex-cf-08','Single unders','CrossFit','Cardio','Cuerda','Principiante','Salto simple con cuerda.','Muñecas giran, salto bajo.','—',80),
('ex-cf-09','Air bike (bici de asalto)','CrossFit','Cuerpo completo','Bici asalto','Intermedio','Intervalos de potencia aeróbica.','Empuja con brazos y piernas, cadencia alta.','—',90),
('ex-cf-10','RemoErg','CrossFit','Cuerpo completo','Remadora','Intermedio','Remo indoor para acondicionamiento.','Piernas inician, espalda neutra, brazos terminan.','—',100),
('ex-cf-11','Push press','CrossFit','Hombros / Pierna','Barra','Avanzado','Empuje con impulso de piernas.','Dip-drive de piernas, bloquea arriba.','—',110),
('ex-cf-12','Push jerk','CrossFit','Hombros','Barra','Avanzado','Jerk con impulso.','Dip-drive y recepción en media sentadilla.','—',120),
('ex-cf-13','Hang power clean','CrossFit','Cadena posterior','Barra','Avanzado','Clean desde colgado.','Bisagra, explosión de cadera, recepción en front rack.','—',130),
('ex-cf-14','Shuttle runs','CrossFit','Agilidad','Sin material','Principiante','Carrera con cambios de dirección.','Toca línea con mano, giro rápido.','—',140),
('ex-cf-15','Farmer carry','CrossFit','Agarre / Core','Mancuernas pesadas','Principiante','Caminata con carga.','Hombros abajo, core rígido, pasos cortos.','—',150),
('ex-cf-16','Sled push','CrossFit','Pierna','Trineo','Intermedio','Empuje con carga.','Inclinación, pasos cortos, cadera alta.','—',160),
('ex-cf-17','Sled pull','CrossFit','Cadena posterior','Trineo','Intermedio','Tirón con carga.','Tira con correas, cadera baja.','—',170),
('ex-cf-18','Rope climb','CrossFit','Torso / Agarre','Cuerda','Avanzado','Ascenso en cuerda.','Piernas ayudan, no solo brazos.','—',180),
('ex-cf-19','Pistol squat asistida','CrossFit','Pierna','Cajón / Banda','Avanzado','Sentadilla a una pierna asistida.','Talón apoyado, baja controlado.','—',190),
('ex-cf-20','Deadlift sumo','CrossFit','Cadena posterior','Barra','Intermedio','Tirón pesado ancho.','Pies anchos, pecho arriba, empuja suelo.','—',200),
('ex-cf-21','Handstand push-ups (progresión)','CrossFit','Hombros / Tríceps','Pared','Avanzado','Empuje vertical invertido.','Pared, codos 45°, baja cabeza suave.','—',210),
('ex-cf-22','Overhead squat','CrossFit','Cuerpo completo','Barra','Avanzado','Sentadilla con barra arriba.','Barra bloqueada, cadera entre talones.','—',220),
('ex-cf-23','Muscle-up (progresión)','CrossFit','Torso','Anillas / Barra','Avanzado','Transición pull-up a dip.','Pull explosivo, transición rápida.','—',230),
('ex-cf-24','SkiErg','CrossFit','Cuerpo completo','Remadora vertical','Intermedio','Esquí erg para cardio.','Tira desde arriba, cadera ayuda.','—',240),
('ex-cf-25','Turkish get-up','CrossFit','Cuerpo completo','Kettlebell','Intermedio','Levántate con carga.','Mira la carga, pasa por codo y rodilla.','—',250)
on conflict (id) do nothing;

-- Kettlebell (18)
insert into public.exercise_library (id, name, category, muscle_group, equipment, difficulty, description, cues, common_errors, sort_order) values
('ex-kb-01','Swing a dos manos','Kettlebell','Cadera / Glúteo','Kettlebell','Intermedio','Balanceo de cadera con KB.','Bisagra, KB flota a pecho sin agacharse.','—',10),
('ex-kb-02','Swing a una mano','Kettlebell','Cadera','Kettlebell','Intermedio','Swing unilateral.','Mismo patrón, cambia de mano en el aire.','—',20),
('ex-kb-03','Goblet squat con kettlebell','Kettlebell','Pierna','Kettlebell','Principiante','Sentadilla copa.','KB a pecho, codos entre rodillas.','—',30),
('ex-kb-04','Kettlebell clean','Kettlebell','Cadera / Brazo','Kettlebell','Intermedio','Subida a rack.','Pasa por muñeca sin golpear.','—',40),
('ex-kb-05','Kettlebell snatch','Kettlebell','Cuerpo completo','Kettlebell','Avanzado','Arranque con KB.','Tirón explosivo, recepción suave.','—',50),
('ex-kb-06','Kettlebell press','Kettlebell','Hombro','Kettlebell','Intermedio','Empuje vertical KB.','Rack fuerte, empuje sin inclinar.','—',60),
('ex-kb-07','Kettlebell push press','Kettlebell','Hombro / Pierna','Kettlebell','Intermedio','Empuje con impulso.','Dip-drive y bloqueo.','—',70),
('ex-kb-08','Kettlebell jerk','Kettlebell','Cuerpo completo','Kettlebell','Avanzado','Jerk con KB.','Doble impulso y recepción.','—',80),
('ex-kb-09','Kettlebell high pull','Kettlebell','Hombro / Trapecio','Kettlebell','Intermedio','Tirón alto.','Codo arriba, KB a clavícula.','—',90),
('ex-kb-10','Deadlift con kettlebell','Kettlebell','Cadena posterior','Kettlebell','Principiante','Peso muerto caminante.','Bisagra con KB entre piernas.','—',100),
('ex-kb-11','Halo con kettlebell','Kettlebell','Hombro / Movilidad','Kettlebell','Principiante','Movilidad de hombro con carga.','Círculo lento alrededor de cabeza.','—',110),
('ex-kb-12','Windmill con kettlebell','Kettlebell','Core / Movilidad','Kettlebell','Intermedio','Inclinación lateral controlada.','KB arriba, mira arriba, cadera en contra.','—',120),
('ex-kb-13','Turkish get-up con KB','Kettlebell','Cuerpo completo','Kettlebell','Intermedio','Levántate con KB.','Mira la KB, transiciones lentas.','—',130),
('ex-kb-14','Bottoms-up carry','Kettlebell','Estabilidad de hombro','Kettlebell','Avanzado','Caminata con KB invertida.','Codo abajo, muñeca firme, camina lento.','—',140),
('ex-kb-15','Suitcase carry KB','Kettlebell','Core','Kettlebell','Principiante','Caminata unilateral.','Hombro abajo, sin inclinar tronco.','—',150),
('ex-kb-16','KB sumo deadlift','Kettlebell','Cadena posterior','Kettlebell','Principiante','Peso muerto sumo KB.','Pies anchos, pecho arriba.','—',160),
('ex-kb-17','KB Russian twist','Kettlebell','Core','Kettlebell','Principiante','Rotación de tronco.','Gira desde hígado, no solo brazos.','—',170),
('ex-kb-18','Renegade row con KB','Kettlebell','Espalda / Core','Kettlebell','Intermedio','Remo en plancha.','Pies anchos, sin balancear cadera.','—',180)
on conflict (id) do nothing;

-- Halterofilia (15)
insert into public.exercise_library (id, name, category, muscle_group, equipment, difficulty, description, cues, common_errors, sort_order) values
('ex-hal-01','Snatch completo','Halterofilia','Cuerpo completo','Barra','Avanzado','Arranque completo.','Tirón explosivo, recepción overhead en sentadilla.','—',10),
('ex-hal-02','Power snatch','Halterofilia','Cuerpo completo','Barra','Avanzado','Arranque de potencia.','Recepción alta sin sentadilla completa.','—',20),
('ex-hal-03','Hang snatch','Halterofilia','Cuerpo completo','Barra','Avanzado','Arranque desde colgado.','Barra sobre rodillas, tirón y recepción.','—',30),
('ex-hal-04','Snatch pull','Halterofilia','Cadena posterior','Barra','Intermedio','Tirón de arranque.','Mismo tirón sin recibir.','—',40),
('ex-hal-05','Clean completo','Halterofilia','Cuerpo completo','Barra','Avanzado','Envión suelo a rack.','Segunda halada y recepción en front rack.','—',50),
('ex-hal-06','Power clean','Halterofilia','Cuerpo completo','Barra','Avanzado','Clean de potencia.','Recepción alta.','—',60),
('ex-hal-07','Hang clean','Halterofilia','Cuerpo completo','Barra','Avanzado','Clean desde colgado.','Barra sobre rodilla, tirón y rack.','—',70),
('ex-hal-08','Clean & Jerk','Halterofilia','Cuerpo completo','Barra','Avanzado','Doble tiempo olímpico.','Clean y luego jerk.','—',80),
('ex-hal-09','Front squat olímpica','Halterofilia','Pierna','Barra','Avanzado','Sentadilla frontal alta.','Codos altos, talones apoyados.','—',90),
('ex-hal-10','Overhead squat','Halterofilia','Cuerpo completo','Barra','Avanzado','Sentadilla overhead.','Barra bloqueada.','—',100),
('ex-hal-11','Split jerk','Halterofilia','Cuerpo completo','Barra','Avanzado','Jerk en tijera.','Dip-drive, tijera y bloqueo.','—',110),
('ex-hal-12','Push jerk olímpico','Halterofilia','Cuerpo completo','Barra','Avanzado','Jerk con media sentadilla.','Dip-drive y recepción.','—',120),
('ex-hal-13','Snatch balance','Halterofilia','Estabilidad overhead','Barra','Avanzado','Equilibrio en bajada.','Recibe en overhead y baja a sentadilla.','—',130),
('ex-hal-14','Clean pull','Halterofilia','Cadena posterior','Barra','Intermedio','Tirón de clean.','Tirón completo sin recibir.','—',140),
('ex-hal-15','Jerk drive','Halterofilia','Pierna / Hombro','Barra','Intermedio','Impulso de jerk.','Dip-drive y tijera sin barra arriba.','—',150)
on conflict (id) do nothing;

-- Cardio (20)
insert into public.exercise_library (id, name, category, muscle_group, equipment, difficulty, description, cues, common_errors, sort_order) values
('ex-car-01','Jumping jacks','Cardio','Cuerpo completo','Sin material','Principiante','Cardio de impacto bajo-medio.','Salta abriendo piernas y brazos, cierra en centro.','—',10),
('ex-car-02','Trote en el lugar','Cardio','Cardio','Sin material','Principiante','Trote estacionario.','Rodillas a media altura, braceo suave.','—',20),
('ex-car-03','High knees','Cardio','Cardio / Pierna','Sin material','Principiante','Rodillas altas.','Rodilla a cadera, ritmo rápido.','—',30),
('ex-car-04','Mountain climbers','Cardio','Core / Cardio','Sin material','Principiante','Escaladores rápidos.','Plancha alta, lleva rodillas a pecho alternado.','—',40),
('ex-car-05','Ciclismo estacionario','Cardio','Pierna','Bici estacionaria','Principiante','Bici indoor.','Cadencia constante, postura estable.','—',50),
('ex-car-06','Cinta inclinada caminando','Cardio','Pierna','Cinta','Principiante','Caminata inclinada.','Inclina 8-12°, camina rápido sin correr.','—',60),
('ex-car-07','Elíptica','Cardio','Cuerpo completo','Elíptica','Principiante','Cardio guiado.','Postura erguida, cadencia constante.','—',70),
('ex-car-08','Skipping A','Cardio','Técnica de carrera','Sin material','Intermedio','Skipping de talón.','Rodilla arriba, talón a glúteo.','—',80),
('ex-car-09','Butt kicks','Cardio','Pierna','Sin material','Principiante','Talón a glúteo.','Ritmo alto, talón a glúteo.','—',90),
('ex-car-10','Step touch','Cardio','Cardio','Sin material','Principiante','Cardio lateral.','Paso lateral y junta pies, bombear brazos.','—',100),
('ex-car-11','Lateral shuffle','Cardio','Agilidad','Sin material','Principiante','Desplazamiento lateral.','Pies en crossover, cadera baja.','—',110),
('ex-car-12','Skaters','Cardio','Pierna','Sin material','Principiante','Salto lateral tipo patinador.','Salta de lado a lado, aterriza en una pierna.','—',120),
('ex-car-13','Shadow boxing','Cardio','Cuerpo completo','Sin material','Principiante','Boxeo sin contacto.','Trabaja jab-cross, pasos ligeros.','—',130),
('ex-car-14','Salto con cuerda','Cardio','Cardio','Cuerda','Principiante','Cuerda simple.','Salto bajo, muñecas giran.','—',140),
('ex-car-15','Marching rápido en el lugar','Cardio','Cardio','Sin material','Principiante','Marcha enérgica.','Rodilla a media altura, braceo.','—',150),
('ex-car-16','Rodilla a pecho alternada','Cardio','Core / Cardio','Sin material','Principiante','Cardio con core.','Lleva rodilla a pecho con rotación.','—',160),
('ex-car-17','Skipping lateral','Cardio','Agilidad','Sin material','Intermedio','Skipping lateral.','Rodilla arriba hacia lado.','—',170),
('ex-car-18','Heisman steps','Cardio','Cardio','Sin material','Intermedio','Pasos tipo Heisman.','Rodilla arriba y talón atrás suave.','—',180),
('ex-car-19','Caminata rápida en rollers','Cardio','Pierna','Sin material','Principiante','Caminata con rodilla alta.','Marcha rápida sin salto.','—',190),
('ex-car-20','Intervalos de trote','Cardio','Cardio','Sin material / Cinta','Principiante','Trote por intervalos.','Alterna trote y caminata.','—',200)
on conflict (id) do nothing;

-- Movilidad (20)
insert into public.exercise_library (id, name, category, muscle_group, equipment, difficulty, description, cues, common_errors, sort_order) values
('ex-mov-01','Rotación 90/90 cadera','Movilidad','Cadera','Sin material','Principiante','Movilidad rotacional de cadera.','Siéntate, gira cadera sin mover torso.','—',10),
('ex-mov-02','Greatest stretch','Movilidad','Cuerpo completo','Sin material','Principiante','Estiramiento global.','Zancada con giro torácico.','—',20),
('ex-mov-03','Cat-cow','Movilidad','Columna','Sin material','Principiante','Movilidad espinal.','Alterna flexión y extensión suave.','—',30),
('ex-mov-04','Apertura torácica en foam','Movilidad','Torácica','Foam roller','Principiante','Extensión torácica.','Pasa sobre roller a nivel torácico.','—',40),
('ex-mov-05','Pike stretch','Movilidad','Isquios','Sin material','Principiante','Estiramiento posterior.','Bisagra con piernas rectas, busca dedos.','—',50),
('ex-mov-06','Couch stretch','Movilidad','Flexor de cadera','Sin material','Principiante','Flexor de cadera.','Rodilla contra pared, glúteo contraído.','—',60),
('ex-mov-07','Sentadilla profunda','Movilidad','Tobillo / Cadera','Sin material','Principiante','Movilidad de sentadilla.','Baja profundo con talones apoyados.','—',70),
('ex-mov-08','Rock de dorsiflexión','Movilidad','Tobillo','Sin material','Principiante','Movilidad de tobillo.','Rodilla a pared sin levantar talón.','—',80),
('ex-mov-09','Dislocados con palo','Movilidad','Hombro','Palo / Banda','Principiante','Movilidad de hombro.','Pasa palo de frente a atrás con brazos rectos.','—',90),
('ex-mov-10','Band pull-aparts','Movilidad','Hombro','Banda','Principiante','Activación de hombro.','Banda a pecho, pulgares con el cuerpo.','—',100),
('ex-mov-11','Wall slides','Movilidad','Hombro','Sin material','Principiante','Control escapular.','Espalda a pared, eleva brazos.','—',110),
('ex-mov-12','Flexor de cadera de pie','Movilidad','Cadera','Sin material','Principiante','Estiramiento de flexor.','Glúteo contraído, cadera al frente.','—',120),
('ex-mov-13','Paloma','Movilidad','Glúteo','Sin material','Principiante','Apertura de cadera.','Pierna cruzada, baja cadera.','—',130),
('ex-mov-14','Mariposa','Movilidad','Aductores','Sin material','Principiante','Estiramiento de aductores.','Plantas juntas, baja rodillas.','—',140),
('ex-mov-15','Pantorrilla contra pared','Movilidad','Pantorrilla','Sin material','Principiante','Estiramiento de pantorrilla.','Talón apoyado, estira posterior.','—',150),
('ex-mov-16','Estiramiento antebrazo','Movilidad','Antebrazo','Sin material','Principiante','Muñeca y antebrazo.','Extiende muñeca suave.','—',160),
('ex-mov-17','Estiramiento lateral de cuello','Movilidad','Cuello','Sin material','Principiante','Cuello lateral.','Oreja a hombro sin encoger.','—',170),
('ex-mov-18','Circulos de muñeca','Movilidad','Muñeca','Sin material','Principiante','Movilidad articular.','Círculos lentos.','—',180),
('ex-mov-19','Rotación torácica cuadrupedia','Movilidad','Torácica','Sin material','Principiante','Rotación torácica.','Mano tras cabeza, abre codo al techo.','—',190),
('ex-mov-20','Balanceo de cadera','Movilidad','Cadera','Sin material','Principiante','Movilidad dinámica.','Círculos de cadera amplios.','—',200)
on conflict (id) do nothing;

-- Core (18)
insert into public.exercise_library (id, name, category, muscle_group, equipment, difficulty, description, cues, common_errors, sort_order) values
('ex-cor-01','Plancha frontal','Core','Core','Sin material','Principiante','Estabilidad anterior.','Codos bajo hombros, cuerpo en línea.','—',10),
('ex-cor-02','Plancha lateral','Core','Oblicuos','Sin material','Principiante','Estabilidad lateral.','Codo bajo hombro, cadera alta.','—',20),
('ex-cor-03','Dead bug','Core','Core','Sin material','Principiante','Control anti-extensión.','Parte baja pegada, exhala al extender.','—',30),
('ex-cor-04','Bird dog','Core','Core / Espalda','Sin material','Principiante','Estabilidad cruzada.','Mano y rodilla opuesta sin mover cadera.','—',40),
('ex-cor-05','Hollow body rocks','Core','Core','Sin material','Intermedio','Balanceo hueco.','Vientre dentro, balancea sin perder forma.','—',50),
('ex-cor-06','V-ups','Core','Abdomen','Sin material','Intermedio','Flexión de tronco.','Toca puntas, piernas rectas.','—',60),
('ex-cor-07','Russian twist','Core','Oblicuos','Sin material','Principiante','Rotación de tronco.','Gira tronco, no solo brazos.','—',70),
('ex-cor-08','Pallof press con banda','Core','Oblicuos','Banda','Intermedio','Anti-rotación con banda.','Banda a pecho, extiende sin girar.','—',80),
('ex-cor-09','Suitcase carry','Core','Core','Mancuerna','Principiante','Caminata unilateral.','Hombro abajo, sin inclinar.','—',90),
('ex-cor-10','Plank shoulder taps','Core','Core','Sin material','Principiante','Estabilidad en plancha.','Toca hombro sin mover cadera.','—',100),
('ex-cor-11','Reverse crunch','Core','Abdomen bajo','Sin material','Principiante','Flexión de cadera supina.','Eleva cadera sin balancear.','—',110),
('ex-cor-12','Abdominal crunch','Core','Abdomen','Sin material','Principiante','Flexión de tronco corta.','Baja omóplatos sin tensar cuello.','—',120),
('ex-cor-13','Pike en suelo','Core','Abdomen','Sin material','Intermedio','Pike corporal.','Manos y pies, cadera a techo.','—',130),
('ex-cor-14','Side plank dips','Core','Oblicuos','Sin material','Intermedio','Dinámico lateral.','Baja cadera sin colapsar.','—',140),
('ex-cor-15','Plank up-downs','Core','Core','Sin material','Intermedio','Transición de plancha.','Alterna codo y mano sin mover cadera.','—',150),
('ex-cor-16','Curl-up McGill','Core','Core','Sin material','Principiante','Flexión parcial controlada.','Apoya parte baja, levanta solo hombros.','—',160),
('ex-cor-17','Hanging knee raises','Core','Abdomen','Barra','Intermedio','Elevación colgado.','Colgado activo, rodillas a pecho.','—',170),
('ex-cor-18','Farmer carry para core','Core','Core','Mancuernas','Principiante','Caminata con carga para core.','Respira, core firme.','—',180)
on conflict (id) do nothing;

-- Agilidad (20)
insert into public.exercise_library (id, name, category, muscle_group, equipment, difficulty, description, cues, common_errors, sort_order) values
('ex-agi-01','Tuck jumps','Agilidad','Potencia','Sin material','Intermedio','Salto con rodillas a pecho.','Aterriza suave, explota arriba.','—',10),
('ex-agi-02','Broad jump','Agilidad','Potencia','Sin material','Principiante','Salto horizontal.','Impulsa con brazos, aterriza en ambos pies.','—',20),
('ex-agi-03','Split jumps','Agilidad','Potencia','Sin material','Intermedio','Salto en tijera.','Alterna piernas en aire.','—',30),
('ex-agi-04','Lunge jumps','Agilidad','Potencia','Sin material','Intermedio','Zancada con salto.','Cambia piernas en aire.','—',40),
('ex-agi-05','Squat jumps','Agilidad','Potencia','Sin material','Principiante','Sentadilla con salto.','Baja y salta, aterriza suave.','—',50),
('ex-agi-06','Depth jump','Agilidad','Potencia','Cajón','Avanzado','Salto desde cajón.','Baja de cajón y salta inmediato.','—',60),
('ex-agi-07','Lateral bounds','Agilidad','Pierna','Sin material','Intermedio','Saltos laterales.','Salta de lado, aterriza en una pierna.','—',70),
('ex-agi-08','Salto a una pierna','Agilidad','Pierna','Sin material','Principiante','Salto unipodal.','Aterriza en una pierna estable.','—',80),
('ex-agi-09','Lanzamiento con balón medicinal','Agilidad','Potencia','Balón medicinal','Principiante','Lanzamiento explosivo.','Extiende cadera y lanza.','—',90),
('ex-agi-10','Chest pass con MB','Agilidad','Pecho','Balón medicinal','Principiante','Pase de pecho.','Lanza desde pecho con potencia.','—',100),
('ex-agi-11','Slam ball','Agilidad','Cuerpo completo','Balón medicinal','Principiante','Golpeo al suelo.','Eleva sobre cabeza y azota al suelo.','—',110),
('ex-agi-12','Russian twist con MB','Agilidad','Core','Balón medicinal','Principiante','Rotación con carga.','Gira tronco, controla.','—',120),
('ex-agi-13','Escalera de agilidad','Agilidad','Agilidad','Escalera','Principiante','Pasos rápidos en escalera.','Pies ligeros, cadera baja.','—',130),
('ex-agi-14','Carrera con conos','Agilidad','Agilidad','Conos','Intermedio','Shuttle con conos.','Toca cono y gira.','—',140),
('ex-agi-15','Sprint de 10 m','Agilidad','Velocidad','Sin material','Intermedio','Aceleración corta.','Sal de triple extensión, braceo fuerte.','—',150),
('ex-agi-16','Backpedal','Agilidad','Agilidad','Sin material','Principiante','Carrera de espaldas.','Pasos rápidos atrás.','—',160),
('ex-agi-17','Frenada y arranque','Agilidad','Agilidad','Sin material','Intermedio','Desaceleración y aceleración.','Frena con cadera y reacelera.','—',170),
('ex-agi-18','5-10-5 (pro agility)','Agilidad','Agilidad','Conos','Avanzado','Cambio de dirección.','Sprint 5, 10 y 5.','—',180),
('ex-agi-19','Balance a una pierna con alcance','Agilidad','Estabilidad','Sin material','Principiante','Equilibrio dinámico.','Alcanza sin perder balance.','—',190),
('ex-agi-20','Caminata con carga overhead','Agilidad','Estabilidad','Mancuerna','Intermedio','Caminata con carga arriba.','Brazo bloqueado, camina lento.','—',200)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

-- Verificación
select category, count(*) as total from public.exercise_library group by category order by category;

commit;
