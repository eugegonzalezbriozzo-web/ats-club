import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Avatar } from '../../src/FotoPerfil';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { ARCOS, Arco, CATEGORIAS, MAX_SOBRE_MI, Categoria, DIVISIONES, Division, Funcion, LATERALIDADES, Lateralidad, Usuario } from '../../src/types';
import { CampoFecha } from '../../src/CampoFecha';
import { Aviso, Boton, Campo, CampoCalculado, CampoFederado, CampoFunciones, Chip, MensajeError, Pantalla, Pildoras, Tarjeta, Titulo, Txt } from '../../src/ui';
import { FotoPerfil } from '../../src/FotoPerfil';
import { armarNombreCompleto, confirmar, edad, hoyISO } from '../../src/util';

const NOMBRE_ROL = { usuario: 'Usuario', admin: 'Admin' } as const;

export default function Perfil() {
  const { usuario, club, esSuperadmin, refrescar, logout } = useAuth();
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [alias, setAlias] = useState('');
  const [sobreMi, setSobreMi] = useState('');
  const [redes, setRedes] = useState({ instagram: '', facebook: '', tiktok: '' });
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [arco, setArco] = useState<Arco>('Recurvo');
  const [division, setDivision] = useState<Division>('Hombre');
  const [categoria, setCategoria] = useState<Categoria>('Senior');
  const [lateralidad, setLateralidad] = useState<Lateralidad>('Derecho');
  const [federado, setFederado] = useState(false);
  const [funciones, setFunciones] = useState<Funcion[]>(['arquero']);
  const [nacimiento, setNacimiento] = useState('');
  const [menores, setMenores] = useState<Usuario[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (usuario && !usuario.esSuperadmin) repo.menoresACargo(usuario.id).then(setMenores).catch(() => setMenores([]));
    }, [usuario]),
  );
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    setNombre(usuario.nombre);
    setApellido(usuario.apellido);
    setAlias(usuario.alias ?? '');
    setSobreMi(usuario.sobreMi ?? '');
    setRedes({ instagram: usuario.instagram ?? '', facebook: usuario.facebook ?? '', tiktok: usuario.tiktok ?? '' });
    setDni(usuario.dni);
    setTelefono(usuario.telefono ?? '');
    setCiudad(usuario.ciudad ?? '');
    setLocalidad(usuario.localidad ?? '');
    setDireccion(usuario.direccion ?? '');
    setArco(usuario.arco);
    setDivision(usuario.division);
    setCategoria(usuario.categoria);
    setLateralidad(usuario.lateralidad);
    setFederado(!!usuario.federado);
    setFunciones(usuario.funciones?.length ? usuario.funciones : ['arquero']);
    setNacimiento(usuario.nacimiento ?? '');
  }, [usuario]);

  if (!usuario) return null;

  const guardar = async () => {
    setError(null);
    setGuardado(false);
    if (!nombre.trim() || !apellido.trim()) return setError('Nombre y apellido son obligatorios.');
    setEnviando(true);
    try {
      await repo.actualizarPerfil(usuario.id, { nombre: nombre.trim(), apellido: apellido.trim(), alias: alias.trim(), dni: dni.trim(), telefono: telefono.trim(), ciudad: ciudad.trim(), localidad: localidad.trim(), direccion: direccion.trim(), sobreMi: sobreMi.trim(), instagram: redes.instagram.trim(), facebook: redes.facebook.trim(), tiktok: redes.tiktok.trim(), federado, arco, division, categoria, lateralidad, funciones, nacimiento });
      await refrescar();
      setGuardado(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Pantalla>
      <Titulo>Datos personales</Titulo>
      <FotoPerfil
        foto={usuario.foto ?? ''}
        nombre={usuario.nombre}
        apellido={usuario.apellido}
        onChange={async (f) => {
          await repo.actualizarPerfil(usuario.id, { foto: f });
          await refrescar();
        }}
      />
      <Txt muted>
        {usuario.email} · {esSuperadmin ? 'Plataforma' : `${NOMBRE_ROL[usuario.rol]} · ${club?.nombre ?? ''}`}
      </Txt>
      <Campo label="Nombre" value={nombre} onChangeText={setNombre} />
      <Campo label="Apellido" value={apellido} onChangeText={setApellido} />
      <CampoCalculado label="Nombre completo" valor={armarNombreCompleto(nombre, apellido)} vacio="Se completa con nombre y apellido" ayuda="Se arma solo con los dos campos de arriba." />
      <Campo label="Alias (opcional)" value={alias} onChangeText={setAlias} placeholder="Cómo te dicen en el club" autoComplete="nickname" />
      <Campo label="DNI" value={dni} onChangeText={setDni} keyboardType="number-pad" />
      <CampoFecha label="Fecha de nacimiento (opcional)" valor={nacimiento} onChange={setNacimiento} min="1900-01-01" max={hoyISO()} opcional
        ayuda={edad(nacimiento) !== null ? `Edad: ${edad(nacimiento)} años · La ven solo vos y los admins del club.` : 'La ven solo vos y los admins del club.'} />
      <Campo label="WhatsApp (opcional)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" autoComplete="tel" placeholder="Ej.: 351 555 1234 (sin 0 ni 15)" />
      <Campo label="Ciudad (opcional)" value={ciudad} onChangeText={setCiudad} autoComplete="postal-address-locality" />
      <Campo label="Localidad (opcional)" value={localidad} onChangeText={setLocalidad} />
      <Campo label="Dirección (opcional)" value={direccion} onChangeText={setDireccion} autoComplete="street-address" placeholder="Calle y número" />
      <Campo
        label="Algo sobre mí (opcional)"
        value={sobreMi}
        onChangeText={setSobreMi}
        multiline
        maxLength={MAX_SOBRE_MI}
        placeholder="Contale al club quién sos: desde cuándo tirás, qué te gusta, tus logros…"
      />
      <Txt muted style={{ fontSize: 12 }}>Lo ven los socios de tu club en la pestaña Arqueros.</Txt>
      <Campo label="Instagram (opcional)" value={redes.instagram} onChangeText={(v) => setRedes((r) => ({ ...r, instagram: v }))} placeholder="@usuario o el link" autoCapitalize="none" />
      <Campo label="Facebook (opcional)" value={redes.facebook} onChangeText={(v) => setRedes((r) => ({ ...r, facebook: v }))} placeholder="Usuario o el link" autoCapitalize="none" />
      <Campo label="TikTok (opcional)" value={redes.tiktok} onChangeText={(v) => setRedes((r) => ({ ...r, tiktok: v }))} placeholder="@usuario o el link" autoCapitalize="none" />
      <Txt muted style={{ fontSize: 12 }}>Tus redes las ven los socios de tu club en tu perfil.</Txt>

      <Titulo style={{ marginTop: 8 }}>En el club</Titulo>
      <CampoFunciones valor={funciones} onChange={setFunciones} />
      {funciones.includes('arquero') ? (
        <>
          <Titulo style={{ marginTop: 8 }}>Datos de arquero</Titulo>
          <Txt muted>Se cargan por defecto cada vez que te inscribís a un torneo.</Txt>
          <Pildoras label="Arco" opciones={ARCOS} valor={arco} onChange={setArco} />
          <Pildoras label="División" opciones={DIVISIONES} valor={division} onChange={setDivision} />
          <Pildoras label="Categoría" opciones={CATEGORIAS} valor={categoria} onChange={setCategoria} />
          <Pildoras label="Lateralidad" opciones={LATERALIDADES} valor={lateralidad} onChange={setLateralidad} />
          <CampoFederado valor={federado} onChange={setFederado} />
        </>
      ) : null}

      <MensajeError texto={error} />
      {guardado ? <Aviso tipo="ok" texto="Perfil actualizado." /> : null}
      <Boton titulo="Guardar cambios" onPress={guardar} cargando={enviando} />
      {!esSuperadmin ? (
        <>
          <Titulo style={{ marginTop: 8 }}>Menores a cargo</Titulo>
          <Txt muted style={{ fontSize: 13 }}>
            Chicos y chicas menores de 16 no tienen cuenta propia: los sumás vos y los manejás desde acá (inscripciones a torneos y pagos).
          </Txt>
          {menores.map((m) => (
            <Tarjeta key={m.id} onPress={() => router.push(`/cuenta/menor?id=${m.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar foto={m.foto} nombre={m.nombre} apellido={m.apellido} size={44} />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt style={{ fontWeight: '700', fontSize: 16 }}>{m.alias || m.nombreCompleto}</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {edad(m.nacimiento) !== null ? <Chip texto={`${edad(m.nacimiento)} años`} /> : null}
                  <Chip texto={m.arco} relleno />
                  {m.estado === 'pendiente' ? <Chip texto="Esperando aprobación" /> : null}
                  {m.estado === 'baja' ? <Chip texto="Dado de baja" /> : null}
                  {m.estado === 'rechazado' ? <Chip texto="Rechazado" /> : null}
                  {m.bajaPedida ? <Chip texto="Baja pedida" /> : null}
                </View>
              </View>
            </Tarjeta>
          ))}
          <Boton titulo="Sumar menor a cargo" variante="secundario" icono="person-add-outline" onPress={() => router.push('/cuenta/menor')} />
        </>
      ) : null}
      <Titulo style={{ marginTop: 8 }}>Cuenta</Titulo>
      <Txt muted style={{ fontSize: 13 }}>Ingresás con {usuario.email}</Txt>
      <Boton titulo="Cambiar email" variante="secundario" icono="mail-outline" onPress={() => router.push('/cuenta/email')} />
      <Boton titulo="Cambiar contraseña" variante="secundario" icono="key-outline" onPress={() => router.push('/cuenta/contrasena')} />
      <Boton titulo="Cerrar sesión" variante="secundario" icono="log-out-outline" onPress={logout} />
      {!esSuperadmin && usuario.rol !== 'admin' ? (
        <Boton
          titulo={usuario.bajaPedida ? 'Ver mi pedido de baja' : 'Pedir la baja del club'}
          variante="peligro"
          icono="exit-outline"
          onPress={() => router.push('/cuenta/baja')}
        />
      ) : null}
    </Pantalla>
  );
}
