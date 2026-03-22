alter table public.groups
add column if not exists group_key text;

update public.groups
set group_key = upper(
  regexp_replace(
    coalesce(name, ''),
    '^.*\s([A-Za-z0-9_-]+)$',
    '\\1'
  )
)
where group_key is null
   or btrim(group_key) = '';

alter table public.groups
alter column group_key set not null;
