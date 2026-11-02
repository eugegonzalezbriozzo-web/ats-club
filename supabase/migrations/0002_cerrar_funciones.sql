-- Funciones de triggers: nadie las llama por API.
revoke execute on function public.al_registrarse(), public.al_aprobar_pago(), public.proteger_perfil(),
  public.proteger_membresia(), public.proteger_inscripcion() from public, anon, authenticated;

-- Funciones que usan las reglas de seguridad o la app: solo usuarios con sesión.
revoke execute on function public.es_superadmin(), public.mi_club_id(), public.es_miembro_de(uuid), public.es_admin_de(uuid),
  public.puede_ver_noticia(uuid), public.encuesta_abierta(uuid), public.arqueros_del_club(),
  public.cambiar_federado(uuid, boolean) from public, anon;
grant execute on function public.es_superadmin(), public.mi_club_id(), public.es_miembro_de(uuid), public.es_admin_de(uuid),
  public.puede_ver_noticia(uuid), public.encuesta_abierta(uuid), public.arqueros_del_club(),
  public.cambiar_federado(uuid, boolean) to authenticated;

-- club_por_slug sigue abierta a propósito: la usa el link de registro antes de tener cuenta.
revoke execute on function public.club_por_slug(text) from public;
grant execute on function public.club_por_slug(text) to anon, authenticated;
