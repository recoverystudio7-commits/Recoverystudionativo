-- ============================================================================
-- Recovery Studio — Esquema Supabase para sincronización de reservas, pagos
-- y saldos de plan
-- ============================================================================
-- Ejecutar este SQL en el Editor SQL de tu proyecto Supabase:
--   https://supabase.com/dashboard/project/bkvjlpdkyjrfvvokqjsx/editor
-- ============================================================================

-- Extensión UUID (opcional, por si se usa gen_random_uuid en el futuro)
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. Citas / reservas (mapea a state.sessions)
-- ---------------------------------------------------------------------------
create table if not exists appointments (
  id text primary key,
  user_id uuid references auth.users(id) not null,
  date text not null,           -- ISO date YYYY-MM-DD
  time text not null,           -- HH:MM
  service_id text,
  service_name text,
  duration int default 60,
  status text default 'pendiente',   -- pendiente, confirmada, completada, cancelada, no_asistio
  payment text,                  -- plan, pagado, cortesia, pendiente
  coach text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 2. Pagos (mapea a state.payments)
-- ---------------------------------------------------------------------------
create table if not exists payments (
  id text primary key,
  user_id uuid references auth.users(id) not null,
  amount numeric default 0,
  concept text,
  category text default 'Otros',
  status text default 'pendiente',   -- pendiente, aprobado, rechazado
  credits_to_add int default 0,
  credits_added int default 0,
  session_id text,
  ref text,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 3. Extender client_accounts (saldo y vigencia del plan)
--    La tabla ya existe en tu proyecto. Agregamos columnas si faltan.
-- ---------------------------------------------------------------------------
alter table client_accounts
  add column if not exists plan_start date,
  add column if not exists plan_expires date,
  add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------------
-- 4. Seguridad a nivel de fila (RLS): cada usuario solo ve sus propios datos
-- ---------------------------------------------------------------------------
alter table appointments enable row level security;
alter table payments enable row level security;
alter table client_accounts enable row level security;

-- Políticas: aut.uid() es el UUID del usuario que inició sesión en Supabase
create policy "usuarios ven sus propias citas"
  on appointments
  for all
  using (auth.uid() = user_id);

create policy "usuarios ven sus propios pagos"
  on payments
  for all
  using (auth.uid() = user_id);

create policy "usuarios ven su propia cuenta"
  on client_accounts
  for all
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Índices para consultas rápidas
-- ---------------------------------------------------------------------------
create index if not exists idx_appointments_user_id on appointments(user_id);
create index if not exists idx_appointments_date on appointments(date);
create index if not exists idx_payments_user_id on payments(user_id);
create index if not exists idx_client_accounts_user_id on client_accounts(user_id);

-- ============================================================================
-- Notas:
-- - Los usuarios creados desde el panel admin (source 'admin') no tienen UUID
--   de Supabase Auth y se quedan en localStorage de este dispositivo.
-- - Los usuarios que se registran o entran por Supabase Auth sí se sincronizan
--   entre dispositivos.
-- - localStorage sigue siendo la fuente de verdad para operar sin conexión;
--   Supabase es la réplica remota que se sube/baja al iniciar sesión.
-- ============================================================================
