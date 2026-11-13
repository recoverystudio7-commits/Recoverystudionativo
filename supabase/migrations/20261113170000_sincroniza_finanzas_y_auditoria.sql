-- Sincroniza cotizaciones, gastos, boletas y auditoría entre equipos.

-- Método de pago del gasto (la app ya lo pide en el formulario).
alter table public.expenses
  add column if not exists method text not null default 'Transferencia';

-- Identificador estable para no duplicar eventos de auditoría al reintentar.
alter table public.audit_log
  add column if not exists client_id text;
create unique index if not exists audit_log_client_id_key
  on public.audit_log (client_id);

-- El formulario público de cotizaciones puede insertar sin iniciar sesión.
drop policy if exists quotes_public_insert on public.company_quotes;
create policy quotes_public_insert on public.company_quotes
  for insert to anon, authenticated
  with check (status = 'nueva' and final_amount = 0);
grant insert on public.company_quotes to anon;

-- Cada usuario autenticado registra sus propios eventos; el admin ve todos.
drop policy if exists audit_insert_own on public.audit_log;
create policy audit_insert_own on public.audit_log
  for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    or (select public.is_studio_admin())
  );
grant insert on public.audit_log to authenticated;
