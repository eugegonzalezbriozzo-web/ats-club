-- Torneos de varios días (ej.: Final Nacional): fecha = primer día, fecha_fin = último (opcional).
alter table public.torneos add column fecha_fin date;
alter table public.torneos add constraint torneo_fecha_fin check (fecha_fin is null or fecha_fin >= fecha);
