import { Link } from 'expo-router';
import React, { useState } from 'react';
import { useTema } from '../src/theme';
import { useAuth } from '../src/auth';
import { ClaseAdaptada, DatosArquero, Modalidad, Arco, Categoria, Division, Funcion, Lateralidad } from '../src/types';
import { CampoFecha } from '../src/CampoFecha';
import { CamposArquero } from '../src/CamposArquero';
import { FotoPerfil } from '../src/FotoPerfil';
import { armarNombreCompleto, edad, hoyISO } from '../src/util';
import { View } from 'react-native';
import * as repo from '../src/data/repo';
import { Aviso, Boton, Campo, CampoCalculado, CampoFederado, CampoFunciones, LogoClub, MensajeError, Pantalla, Titulo, Txt } from '../src/ui';

export default function Registro() {
  const { registrar, clubDelLink } = useAuth();
  const [revisaMail, setRevisaMail] = useState<string | null>(null);
  const { t } = useTema();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [alias, setAlias] = useState('');
  const [foto, setFoto] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [arco, setArco] = useState<Arco>('Recurvo');
  const [division, setDivision] = useState<Division>('Hombre');
  const [categoria, setCategoria] = useState<Categoria | null>('Senior');
  const [lateralidad, setLateralidad] = useState<Lateralidad>('Derecho');
  const [modalidad, setModalidad] = useState<Modalidad>('convencional');
  const [claseAdaptada, setClaseAdaptada] = useState<ClaseAdaptada | null>(null);
  const datosArq: DatosArquero = { arco, division, categoria, lateralidad, modalidad, claseAdaptada };
  const setDatosArq = (d: DatosArquero) => {
    setArco(d.arco);
    setDivision(d.division);
    setCategoria(d.categoria);
    setLateralidad(d.lateralidad);
    setModalidad(d.modalidad ?? 'convencional');
    setClaseAdaptada(d.claseAdaptada ?? null);
  };
  const [federado, setFederado] = useState(false);
  const [funciones, setFunciones] = useState<Funcion[]>(['arquero']);
  const [nacimiento, setNacimiento] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setError(null);
    if (!nombre.trim() || !apellido.trim() || !email.trim()) return setError('Completá nombre, apellido y email.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('El email no parece válido.');
    const ec = repo.errorContacto(telefono, direccion);
    if (ec) return setError(ec);
    if (pass.length < 6) return setError('La contraseña tiene que tener al menos 6 caracteres.');
    if (pass !== pass2) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    try {
      const confirmar = await registrar({ nombre, apellido, alias, foto, dni, telefono, ciudad, localidad, direccion, email, password: pass, arco, division, categoria, lateralidad, modalidad, claseAdaptada, federado, funciones, nacimiento });
      if (confirmar) setRevisaMail(email.trim().toLowerCase());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (revisaMail) {
    return (
      <Pantalla>
        <Aviso tipo="ok" icono="mail-outline" texto={`¡Listo! Te mandamos un mail a ${revisaMail} para confirmar tu cuenta. Abrilo (revisá también el spam), confirmá y después ingresá con tu email y contraseña.`} />
        <Txt muted>Cuando ingreses, tu cuenta va a quedar pendiente hasta que el club la apruebe.</Txt>
        <Link href="/login" style={{ color: t.accent, fontWeight: '700' }}>Ir a ingresar</Link>
      </Pantalla>
    );
  }

  if (!clubDelLink) {
    return (
      <Pantalla>
        <Aviso icono="link-outline" texto="Para crear tu cuenta, abrí el link de registro que te pasó tu club." />
      </Pantalla>
    );
  }

  return (
    <Pantalla pie={<Boton titulo="Enviar solicitud" onPress={enviar} cargando={enviando} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <LogoClub club={clubDelLink} size={44} />
        <View style={{ flex: 1 }}>
          <Txt muted style={{ fontSize: 13 }}>Te estás registrando en</Txt>
          <Txt style={{ fontWeight: '700', fontSize: 17 }}>{clubDelLink.nombre}</Txt>
        </View>
      </View>
      <Titulo>Tus datos</Titulo>
      <FotoPerfil foto={foto} nombre={nombre} apellido={apellido} onChange={setFoto} />
      <Campo label="Nombre" value={nombre} onChangeText={setNombre} autoComplete="given-name" />
      <Campo label="Apellido" value={apellido} onChangeText={setApellido} autoComplete="family-name" />
      <CampoCalculado label="Nombre completo" valor={armarNombreCompleto(nombre, apellido)} vacio="Se completa con nombre y apellido" ayuda="Se arma solo con los dos campos de arriba." />
      <Campo label="Alias (opcional)" value={alias} onChangeText={setAlias} placeholder="Cómo te dicen en el club" autoComplete="nickname" />
      <Campo label="DNI" value={dni} onChangeText={setDni} keyboardType="number-pad" />
      <CampoFecha label="Fecha de nacimiento (opcional)" valor={nacimiento} onChange={setNacimiento} min="1900-01-01" max={hoyISO()} opcional
        ayuda={edad(nacimiento) !== null ? `Edad: ${edad(nacimiento)} años · La ven solo vos y los admins del club.` : 'La ven solo vos y los admins del club.'} />
      {edad(nacimiento) !== null && edad(nacimiento)! < 16 ? (
        <Aviso icono="people-outline" texto="Con menos de 16 años no se crea cuenta propia: pedile a tu mamá, papá o tutor/a que te sume desde su cuenta, en Mi perfil → Menores a cargo." />
      ) : null}
      <Campo label="WhatsApp" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" autoComplete="tel" placeholder="Ej.: 351 555 1234 (sin 0 ni 15)" />
      <Campo label="Ciudad (opcional)" value={ciudad} onChangeText={setCiudad} autoComplete="postal-address-locality" />
      <Campo label="Localidad (opcional)" value={localidad} onChangeText={setLocalidad} />
      <Campo label="Dirección" value={direccion} onChangeText={setDireccion} autoComplete="street-address" placeholder="Calle y número" />
      <Campo label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Campo label="Contraseña" value={pass} onChangeText={setPass} secureTextEntry />
      <Campo label="Repetir contraseña" value={pass2} onChangeText={setPass2} secureTextEntry />

      <Titulo style={{ marginTop: 8 }}>En el club</Titulo>
      <CampoFunciones valor={funciones} onChange={setFunciones} />
      {funciones.includes('arquero') ? (
        <>
          <Titulo style={{ marginTop: 8 }}>Datos de arquero</Titulo>
          <Txt muted>Se usan por defecto al inscribirte a torneos. Podés cambiarlos después.</Txt>
          <CamposArquero d={datosArq} onChange={setDatosArq} />
          <CampoFederado valor={federado} onChange={setFederado} />
        </>
      ) : null}
      <Txt muted style={{ fontSize: 13 }}>
        Al enviar la solicitud aceptás la{' '}
        <Link href="/privacidad" style={{ color: t.accent, fontWeight: '700' }}>Política de privacidad</Link>: tus datos los ven los socios y los admins de tu club.
      </Txt>
      <MensajeError texto={error} />
    </Pantalla>
  );
}
