import * as repo from './data/repo';
import { confirmar } from './util';

/** Pide confirmación y da de baja al socio. Devuelve true si se hizo. */
export async function pedirBaja(clubId: string, clubNombre: string, adminId: string, u: { id: string; nombre: string; apellido: string }) {
  const futuras = await repo.inscripcionesFuturas(clubId, u.id);
  const ok = await confirmar(
    'Dar de baja del club',
    `${u.nombre} ${u.apellido} no va a poder entrar a ${clubNombre} ni va a aparecer en Arqueros.` +
      (futuras ? ` Se cancelan sus ${futuras} inscripci${futuras === 1 ? 'ón' : 'ones'} a torneos que vienen.` : '') +
      ' Su historial queda guardado y lo podés reactivar desde Socios y roles.',
    'Dar de baja',
  );
  if (!ok) return false;
  await repo.darDeBaja(clubId, adminId, u.id);
  return true;
}
