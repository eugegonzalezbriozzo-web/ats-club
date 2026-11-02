import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '../../src/auth';
import { Cargando } from '../../src/ui';

/**
 * Link de registro de un club: .../c/<slug>
 * Guarda el club del link (para pintar login y registro con su identidad) y
 * manda al login. Si el link no es válido, el login muestra un aviso.
 */
export default function LinkDeClub() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { usarLink } = useAuth();
  const router = useRouter();

  useEffect(() => {
    usarLink(slug ?? null).then((ok) => router.replace(ok ? '/login' : '/login?link=invalido'));
  }, [slug, usarLink, router]);

  return <Cargando />;
}
