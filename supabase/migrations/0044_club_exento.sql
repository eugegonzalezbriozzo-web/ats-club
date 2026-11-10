-- Exceptuar a un club del abono (lo decide la plataforma):
-- exento_indefinido = no paga mientras esté marcado; exento_meses = meses sueltos sin cargo (YYYY-MM); exento_nota = por qué.
alter table public.clubes
  add column exento_indefinido boolean not null default false,
  add column exento_meses text[] not null default '{}' check (cardinality(exento_meses) = 0 or array_to_string(exento_meses, ',') ~ '^\d{4}-\d{2}(,\d{4}-\d{2})*$'),
  add column exento_nota text not null default '' check (length(exento_nota) <= 200);
