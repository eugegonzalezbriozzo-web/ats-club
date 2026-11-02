import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as repo from './data/repo';
import type { Club, Usuario } from './types';

interface AuthCtx {
  usuario: Usuario | null;
  /** Club en el que se está trabajando: el del socio, o el que la plataforma eligió mirar. */
  club: Club | null;
  /** Club del link de registro (/c/<slug>), antes de iniciar sesión. */
  clubDelLink: Club | null;
  /** Club cuya identidad visual se aplica ahora (club activo, o el del link en el login). */
  clubTema: Club | null;
  cargando: boolean;
  esSuperadmin: boolean;
  /** Admin del club actual (o la plataforma mirando un club). */
  esAdmin: boolean;
  /** El usuario es socio del club actual (puede inscribirse). */
  esSocio: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Devuelve true si hay que confirmar el email antes de ingresar. */
  registrar: (d: repo.DatosRegistro) => Promise<boolean>;
  logout: () => Promise<void>;
  refrescar: () => Promise<void>;
  usarLink: (slug: string | null) => Promise<boolean>;
  entrarAClub: (clubId: string) => Promise<void>;
  salirDeClub: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [clubVistaId, setClubVistaId] = useState<string | null>(null);
  const [clubDelLink, setClubDelLink] = useState<Club | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarClub = useCallback(async (u: Usuario | null, vistaId: string | null) => {
    if (!u) return setClub(null);
    const id = u.esSuperadmin ? vistaId : u.clubId;
    setClub(id ? await repo.obtenerClub(id) : null);
  }, []);

  const refrescar = useCallback(async () => {
    const u = await repo.usuarioActual();
    setUsuario(u);
    await cargarClub(u, clubVistaId);
  }, [cargarClub, clubVistaId]);

  useEffect(() => {
    refrescar().finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esSuperadmin = !!usuario?.esSuperadmin;
  const value: AuthCtx = {
    usuario,
    club,
    clubDelLink,
    clubTema: club ?? (!usuario ? clubDelLink : null),
    cargando,
    esSuperadmin,
    esAdmin: !!usuario && !!club && (esSuperadmin || usuario.rol === 'admin'),
    esSocio: !!usuario && !!club && usuario.clubId === club.id,
    login: async (e, p) => {
      const u = await repo.login(e, p);
      setClubVistaId(null);
      setUsuario(u);
      await cargarClub(u, null);
    },
    registrar: async (d) => {
      if (!clubDelLink) throw new repo.ErrorApp('Para crear tu cuenta, abrí el link de registro de tu club.');
      const u = await repo.registrar(clubDelLink, d);
      if (!u) return true;
      setUsuario(u);
      await cargarClub(u, null);
      return false;
    },
    logout: async () => {
      await repo.logout();
      setUsuario(null);
      setClub(null);
      setClubVistaId(null);
    },
    refrescar,
    usarLink: async (slug) => {
      const c = slug ? await repo.clubPorSlug(slug) : null;
      setClubDelLink(c);
      return !!c;
    },
    entrarAClub: async (clubId) => {
      setClubVistaId(clubId);
      setClub(await repo.obtenerClub(clubId));
    },
    salirDeClub: () => {
      setClubVistaId(null);
      setClub(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}
