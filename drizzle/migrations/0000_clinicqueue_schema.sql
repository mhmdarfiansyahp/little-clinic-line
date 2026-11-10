-- Enums
create type public.app_role as enum ('admin', 'staff');
create type public.queue_status as enum ('waiting', 'called', 'done', 'skipped');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_clinic_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_clinic_member(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_clinic_member(uuid) to authenticated, service_role;

create policy "Users read own profile, admins read all" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Users read own roles, admins read all" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Clinic "today" (queue numbers reset at midnight clinic time)
create or replace function public.clinic_today()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Bangkok')::date
$$;

-- Doctors
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null default '',
  room text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.doctors to anon;
grant select, insert, update, delete on public.doctors to authenticated;
grant all on public.doctors to service_role;
alter table public.doctors enable row level security;

create policy "Anyone can see active doctors" on public.doctors
  for select to anon using (is_active);
create policy "Signed-in see active doctors, clinic members see all" on public.doctors
  for select to authenticated using (is_active or public.is_clinic_member(auth.uid()));
create policy "Admins insert doctors" on public.doctors
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update doctors" on public.doctors
  for update to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete doctors" on public.doctors
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Queue entries
create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  queue_date date not null default public.clinic_today(),
  number integer not null,
  code text not null,
  patient_name text not null,
  phone text not null,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  status public.queue_status not null default 'waiting',
  access_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  called_at timestamptz,
  finished_at timestamptz,
  unique (queue_date, number)
);
create index queue_entries_doctor_day_idx on public.queue_entries (doctor_id, queue_date, status, number);
grant select, update on public.queue_entries to authenticated;
grant all on public.queue_entries to service_role;
alter table public.queue_entries enable row level security;

create policy "Clinic members read queue" on public.queue_entries
  for select to authenticated using (public.is_clinic_member(auth.uid()));
create policy "Clinic members update queue" on public.queue_entries
  for update to authenticated using (public.is_clinic_member(auth.uid()))
  with check (public.is_clinic_member(auth.uid()));

-- Daily counter (internal only)
create table public.daily_counters (
  queue_date date primary key,
  last_number integer not null
);
grant all on public.daily_counters to service_role;
alter table public.daily_counters enable row level security;

-- Public "doorbell" for live updates (no patient data)
create table public.queue_signal (
  id integer primary key check (id = 1),
  bumped_at timestamptz not null default now()
);
grant select on public.queue_signal to anon, authenticated;
grant all on public.queue_signal to service_role;
alter table public.queue_signal enable row level security;
create policy "Anyone can read queue signal" on public.queue_signal
  for select to anon, authenticated using (true);
insert into public.queue_signal (id) values (1);
alter publication supabase_realtime add table public.queue_signal;

create or replace function public.bump_queue_signal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.queue_signal set bumped_at = now() where id = 1;
  return null;
end;
$$;
revoke execute on function public.bump_queue_signal() from public, anon, authenticated;
create trigger queue_entries_bump after insert or update or delete on public.queue_entries
  for each statement execute function public.bump_queue_signal();
create trigger doctors_bump after insert or update or delete on public.doctors
  for each statement execute function public.bump_queue_signal();

-- Queue code formatting: A001 ... A999, A1000 ...
create or replace function public.format_queue_code(_n integer)
returns text language sql immutable as $$
  select 'A' || case when _n < 1000 then lpad(_n::text, 3, '0') else _n::text end
$$;

-- Patient registration (public)
create or replace function public.register_patient(_name text, _phone text, _doctor_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(_name, ''));
  v_phone text := btrim(coalesce(_phone, ''));
  v_today date := public.clinic_today();
  v_n integer;
  v_entry public.queue_entries;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 100 then
    raise exception 'Please enter your name (up to 100 characters).';
  end if;
  if v_phone !~ '^[0-9+() -]{6,20}$' then
    raise exception 'Please enter a valid phone number.';
  end if;
  if not exists (select 1 from public.doctors where id = _doctor_id and is_active) then
    raise exception 'Please choose an available doctor.';
  end if;

  insert into public.daily_counters (queue_date, last_number) values (v_today, 1)
  on conflict (queue_date) do update set last_number = public.daily_counters.last_number + 1
  returning last_number into v_n;

  insert into public.queue_entries (queue_date, number, code, patient_name, phone, doctor_id)
  values (v_today, v_n, public.format_queue_code(v_n), v_name, v_phone, _doctor_id)
  returning * into v_entry;

  return json_build_object('ticket_id', v_entry.id, 'access_token', v_entry.access_token, 'code', v_entry.code);
end;
$$;
grant execute on function public.register_patient(text, text, uuid) to anon, authenticated;

-- Patient ticket lookup (public, needs the private token)
create or replace function public.get_ticket(_ticket_id uuid, _token uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  e public.queue_entries;
  d public.doctors;
  v_ahead integer := 0;
  v_serving text;
begin
  select * into e from public.queue_entries where id = _ticket_id and access_token = _token;
  if not found then return null; end if;
  select * into d from public.doctors where id = e.doctor_id;

  if e.status = 'waiting' then
    select count(*) into v_ahead from public.queue_entries
    where doctor_id = e.doctor_id and queue_date = e.queue_date and status = 'waiting' and number < e.number;
  end if;

  select code into v_serving from public.queue_entries
  where doctor_id = e.doctor_id and queue_date = e.queue_date and status = 'called'
  order by called_at desc limit 1;

  return json_build_object(
    'code', e.code, 'status', e.status, 'patient_name', e.patient_name,
    'doctor_name', d.name, 'doctor_specialty', d.specialty, 'room', d.room,
    'ahead', v_ahead, 'now_serving', v_serving,
    'queue_date', e.queue_date, 'is_today', e.queue_date = public.clinic_today(),
    'created_at', e.created_at, 'called_at', e.called_at
  );
end;
$$;
grant execute on function public.get_ticket(uuid, uuid) to anon, authenticated;

-- Public board for the waiting-room display (codes only, no names)
create or replace function public.get_queue_board()
returns json language sql stable security definer set search_path = public as $$
  with today as (select public.clinic_today() as d)
  select json_build_object(
    'last_called', (
      select json_build_object('code', q.code, 'doctor_name', doc.name, 'room', doc.room, 'called_at', q.called_at)
      from public.queue_entries q join public.doctors doc on doc.id = q.doctor_id, today
      where q.queue_date = today.d and q.status = 'called'
      order by q.called_at desc limit 1
    ),
    'doctors', coalesce((
      select json_agg(row_to_json(x) order by x.name)
      from (
        select doc.id, doc.name, doc.specialty, doc.room,
          (select q.code from public.queue_entries q, today
            where q.doctor_id = doc.id and q.queue_date = today.d and q.status = 'called'
            order by q.called_at desc limit 1) as current_code,
          (select count(*) from public.queue_entries q, today
            where q.doctor_id = doc.id and q.queue_date = today.d and q.status = 'waiting') as waiting_count,
          coalesce((select array_agg(s.code order by s.number) from (
            select q.code, q.number from public.queue_entries q, today
            where q.doctor_id = doc.id and q.queue_date = today.d and q.status = 'waiting'
            order by q.number limit 3) s), '{}') as next_codes
        from public.doctors doc where doc.is_active
      ) x
    ), '[]'::json)
  )
$$;
grant execute on function public.get_queue_board() to anon, authenticated;

-- Staff: call the next waiting patient for a doctor
create or replace function public.call_next(_doctor_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_today date := public.clinic_today();
  v_id uuid;
  e public.queue_entries;
begin
  if not public.is_clinic_member(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  update public.queue_entries set status = 'done', finished_at = now()
  where doctor_id = _doctor_id and queue_date = v_today and status = 'called';

  select id into v_id from public.queue_entries
  where doctor_id = _doctor_id and queue_date = v_today and status = 'waiting'
  order by number limit 1 for update skip locked;

  if v_id is null then return null; end if;

  update public.queue_entries set status = 'called', called_at = now()
  where id = v_id returning * into e;

  return json_build_object('id', e.id, 'code', e.code, 'patient_name', e.patient_name);
end;
$$;

-- Staff: change one patient's status (done / skip / recall / back to queue)
create or replace function public.set_entry_status(_entry_id uuid, _status public.queue_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  e public.queue_entries;
begin
  if not public.is_clinic_member(auth.uid()) then
    raise exception 'Not allowed';
  end if;
  select * into e from public.queue_entries where id = _entry_id for update;
  if not found then raise exception 'Patient not found'; end if;

  if _status = 'called' then
    update public.queue_entries set status = 'done', finished_at = now()
    where doctor_id = e.doctor_id and queue_date = e.queue_date and status = 'called' and id <> e.id;
    update public.queue_entries set status = 'called', called_at = now(), finished_at = null where id = e.id;
  elsif _status = 'waiting' then
    update public.queue_entries set status = 'waiting', called_at = null, finished_at = null where id = e.id;
  else
    update public.queue_entries set status = _status, finished_at = now() where id = e.id;
  end if;
end;
$$;

revoke execute on function public.call_next(uuid) from public, anon;
revoke execute on function public.set_entry_status(uuid, public.queue_status) from public, anon;
grant execute on function public.call_next(uuid) to authenticated;
grant execute on function public.set_entry_status(uuid, public.queue_status) to authenticated;

-- Setup: has any admin been created yet?
create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;
grant execute on function public.admin_exists() to anon, authenticated;
