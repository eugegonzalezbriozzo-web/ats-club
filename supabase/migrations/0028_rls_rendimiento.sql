-- Rendimiento: auth.uid() evaluado una vez por consulta en vez de una vez por fila (mismas reglas).
alter policy lecturas_propias on public.lecturas
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()) and public.es_miembro_de(club_id) and public.puede_ver_noticia(noticia_id)
              and club_id = (select n.club_id from public.noticias n where n.id = lecturas.noticia_id));
alter policy lecturas_ver on public.lecturas
  using (usuario_id = (select auth.uid()) or (me_gusta and public.puede_ver_noticia(noticia_id)));
alter policy votos_propios on public.votos
  using (usuario_id = (select auth.uid()) and public.encuesta_abierta(noticia_id))
  with check (usuario_id = (select auth.uid()) and public.es_miembro_de(club_id) and public.puede_ver_noticia(noticia_id)
              and public.encuesta_abierta(noticia_id) and club_id = (select n.club_id from public.noticias n where n.id = votos.noticia_id));
