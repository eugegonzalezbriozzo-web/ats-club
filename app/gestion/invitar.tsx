import React from 'react';
import { useAuth } from '../../src/auth';
import { LinkClub } from '../../src/LinkClub';
import { Pantalla, Tarjeta, Titulo, Txt } from '../../src/ui';

/** Admin del club: link para que los socios se registren o ingresen al club. */
export default function InvitarSocios() {
  const { club } = useAuth();
  if (!club) return null;
  return (
    <Pantalla>
      <Titulo>Link del club</Titulo>
      <Txt muted>
        Compartilo en los grupos de WhatsApp del club. Quien entra por este link ve la app con los colores de {club.nombre}:
        si no tiene cuenta se registra y queda pendiente hasta que un admin la apruebe; si ya tiene, ingresa.
      </Txt>
      <Tarjeta style={{ gap: 12 }}>
        <LinkClub club={club} />
      </Tarjeta>
      <Txt muted style={{ fontSize: 13 }}>Las cuentas nuevas aparecen en Más → Solicitudes.</Txt>
    </Pantalla>
  );
}
