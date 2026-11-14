CREATE OR REPLACE FUNCTION public.register_patient(_name text, _phone text, _doctor_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text := btrim(coalesce(_name, ''));
  v_phone text := btrim(coalesce(_phone, ''));
  v_digits text := regexp_replace(btrim(coalesce(_phone, '')), '[^0-9]', '', 'g');
  v_today date := public.clinic_today();
  v_active integer;
  v_n integer;
  v_entry public.queue_entries;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 100 then
    raise exception 'Please enter your name (up to 100 characters).';
  end if;
  if v_phone !~ '^[0-9+() -]{6,20}$' or char_length(v_digits) < 8 then
    raise exception 'Please enter a valid phone number.';
  end if;
  if not exists (select 1 from public.doctors where id = _doctor_id and is_active) then
    raise exception 'Please choose an available doctor.';
  end if;

  -- Serialize registrations for the same phone digits so parallel requests can't bypass the limit.
  perform pg_advisory_xact_lock(hashtextextended(v_digits, 0));

  select count(*) into v_active
  from public.queue_entries
  where queue_date = v_today
    and status in ('waiting', 'called')
    and regexp_replace(phone, '[^0-9]', '', 'g') = v_digits;

  if v_active >= 3 then
    raise exception 'This phone number already has 3 active queue numbers today.';
  end if;

  insert into public.daily_counters (queue_date, last_number) values (v_today, 1)
  on conflict (queue_date) do update set last_number = public.daily_counters.last_number + 1
  returning last_number into v_n;

  insert into public.queue_entries (queue_date, number, code, patient_name, phone, doctor_id)
  values (v_today, v_n, public.format_queue_code(v_n), v_name, v_phone, _doctor_id)
  returning * into v_entry;

  return json_build_object('ticket_id', v_entry.id, 'access_token', v_entry.access_token, 'code', v_entry.code);
end;
$function$;