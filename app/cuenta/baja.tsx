import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { Aviso, Boton, Campo, Check, MensajeError, Pantalla, Tarjeta, Txt } from '../../src/ui';
import { confirmar, fechaCorta } from '../../src/util';

/**
 * Mi perfil → Pedir la baja: el socio lo pide (y opcionalmente que se borren sus datos);
 * un admin del club lo revisa (cuotas, pagos) y lo resuelve.
 */
export default function PedirBaja() {
  const { t } = useTema();
  const { usuario, club, refrescar } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [borrar, setBorrar] = useState(false);
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!usuario || !club) return null;
  const pedido = usuario.bajaPedida;

  const ejecutar = async (f: () => Promise<void>) => {
    setError(null);
    setEnviando(true);
    try {
      await f();
      await refrescar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (pedido) {
    return (
      <Pantalla pie={<Boton titulo="Cancelar mi pedido" variante="secundario" onPress={() => ejecutar(repo.cancelarPedidoBaja)} cargando={enviando} />}>
        <Aviso icono="time-outline" texto={`Pediste la baja de ${club.nombre} el ${fechaCorta(pedido.el.slice(0, 10))}. Un admin del club lo va a revisar.`} />
        {pedido.borrar ? <Txt>También pediste que se eliminen tu cuenta y tus datos.</Txt> : null}
        {pedido.motivo ? <Txt muted>Motivo: {pedido.motivo}</Txt> : null}
        <Txt muted style={{ fontSize: 13 }}>Si tenés cuotas o pagos pendientes, el club te puede pedir que los regularices antes. Mientras tanto seguís siendo socio.</Txt>
        <MensajeError texto={error} />
      </Pantalla>
    );
  }

  const pedir = async () => {
    if (!pass) return setError('Escribí tu contraseña.');
    const ok = await confirmar(
      'Pedir la baja',
      borrar ? `Le pedís a ${club.nombre} la baja y que eliminen tu cuenta y tus datos.` : `Le pedís a ${club.nombre} la baja del club.`,
      'Pedir la baja',
    );
    if (ok) await ejecutar(() => repo.pedirBajaDelClub(usuario, pass, motivo, borrar));
  };

  const seBorra = [
    'Tu cuenta y tu perfil (nombre, DNI, teléfono, dirección, foto, redes y datos de arquero).',
    'Tus inscripciones a torneos, respuestas a encuestas y "me gusta".',
    'Los pagos que informaste y sus comprobantes.',
  ];
  return (
    <Pantalla pie={<Boton titulo="Pedir la baja" variante="peligro" icono="exit-outline" onPress={pedir} cargando={enviando} />}>
      <Txt>
        Tu pedido les llega a los admins de {club.nombre}. Ellos revisan si quedan cuotas o pagos pendientes y te dan de baja.
      </Txt>
      <Campo label="Motivo (opcional)" value={motivo} onChangeText={setMotivo} multiline maxLength={300} placeholder="Ej.: me mudo, dejo de entrenar…" />
      <Check label="Quiero que además eliminen mi cuenta y todos mis datos" valor={borrar} onChange={setBorrar} />
      {borrar ? (
        <Tarjeta style={{ gap: 8 }}>
          <Txt style={{ fontWeight: '700' }}>Cuando el admin lo apruebe, se borra y no se puede recuperar:</Txt>
          {seBorra.map((b) => (
            <View key={b} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: t.accent, fontWeight: '800' }}>•</Text>
              <Text style={{ color: t.text, flex: 1, fontSize: 15 }}>{b}</Text>
            </View>
          ))}
        </Tarjeta>
      ) : (
        <Txt muted style={{ fontSize: 13 }}>Si no lo marcás, tus datos quedan guardados y el club te puede reactivar más adelante.</Txt>
      )}
      <Campo label="Tu contraseña *" value={pass} onChangeText={setPass} secureTextEntry autoComplete="current-password" />
      <MensajeError texto={error} />
    </Pantalla>
  );
}
