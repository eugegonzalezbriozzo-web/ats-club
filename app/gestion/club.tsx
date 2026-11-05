import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useAuth } from '../../src/auth';
import { CampoLogo } from '../../src/CampoLogo';
import * as repo from '../../src/data/repo';
import { Boton, Campo, MensajeError, Pantalla, Txt } from '../../src/ui';

/** Admin del club: logo, teléfono, email y redes. Nombre, colores y link son de la plataforma. */
export default function ContactoClubForm() {
  const { club, refrescar } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ email: club?.email ?? '', telefono: club?.telefono ?? '', instagram: club?.instagram ?? '', facebook: club?.facebook ?? '', tiktok: club?.tiktok ?? '' });
  const [logo, setLogo] = useState(club?.logo ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const guardar = async () => {
    if (!club) return;
    setError(null);
    setEnviando(true);
    try {
      if (logo !== (club.logo ?? '')) await repo.cambiarLogoClub(club.id, logo);
      await repo.actualizarContactoClub(club.id, f);
      await refrescar();
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };
  return (
    <Pantalla pie={<Boton titulo="Guardar" onPress={guardar} cargando={enviando} />}>
      <Txt muted>Lo ven los socios del club. El nombre, los colores y el link del club los cambia la plataforma (ATS).</Txt>
      {club ? <CampoLogo logo={logo} club={club} onChange={setLogo} /> : null}
      <Campo label="Email del club" value={f.email} onChangeText={set('email')} placeholder="comision@miclub.com" keyboardType="email-address" autoCapitalize="none" />
      <Campo label="Teléfono / WhatsApp del club" value={f.telefono} onChangeText={set('telefono')} placeholder="Ej.: 351 555 1234 (sin 0 ni 15)" keyboardType="phone-pad" />
      <Campo label="Instagram" value={f.instagram} onChangeText={set('instagram')} placeholder="@miclub o el link" autoCapitalize="none" />
      <Campo label="Facebook" value={f.facebook} onChangeText={set('facebook')} placeholder="Nombre de la página o el link" autoCapitalize="none" />
      <Campo label="TikTok" value={f.tiktok} onChangeText={set('tiktok')} placeholder="@miclub o el link" autoCapitalize="none" />
      <Txt muted style={{ fontSize: 12 }}>Podés pegar el link completo o escribir solo el usuario.</Txt>
      <MensajeError texto={error} />
    </Pantalla>
  );
}
