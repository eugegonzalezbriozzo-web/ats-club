-- La base trabaja en hora de Argentina: current_date (cierre de inscripciones, encuestas, avisos del calendario,
-- tarea diaria) cambia de día a la medianoche argentina y no a las 21 h.
-- Las fechas con hora se siguen guardando igual (timestamptz); solo cambia cómo se calcula "hoy".
-- pg_cron sigue en hora universal: "13 12 * * *" = 9:13 de Argentina.
alter database postgres set timezone to 'America/Argentina/Buenos_Aires';
