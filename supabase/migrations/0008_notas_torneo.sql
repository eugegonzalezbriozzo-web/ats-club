-- Notas del torneo (opcional): horarios, lugar, qué llevar, etc. Las ven los socios del club.
alter table public.torneos add column notas text not null default '' check (length(notas) <= 1000);
