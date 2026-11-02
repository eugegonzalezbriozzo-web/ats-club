import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import type { Inscripcion, Torneo, Usuario } from './types';

type Fila = Inscripcion & { usuario: Usuario };

const fecha = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return isNaN(d.getTime()) ? '' : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/**
 * Exporta los inscriptos de un torneo a Excel (.xlsx).
 * Web: descarga el archivo. Celular: abre el menú para compartir/guardar.
 */
export async function exportarInscriptosExcel(torneo: Torneo, filas: Fila[]) {
  const datos = filas.map((f) => ({
    'Categoría': f.categoria,
    Apellido: f.usuario.apellido,
    Nombre: f.usuario.nombre,
    Alias: f.usuario.alias ?? '',
    DNI: f.usuario.dni ?? '',
    WhatsApp: f.usuario.telefono ?? '',
    Email: f.usuario.email,
    Arco: f.arco,
    'División': f.division,
    Lateralidad: f.lateralidad,
    Federado: f.usuario.federado ? 'Sí' : 'No',
    Estado: f.estado === 'confirmada' ? 'Confirmada' : 'Pendiente',
    'Inscripto el': fecha(f.creadoEl),
    Ciudad: f.usuario.ciudad ?? '',
    Localidad: f.usuario.localidad ?? '',
    'Dirección': f.usuario.direccion ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [11, 16, 16, 12, 12, 15, 28, 12, 10, 11, 9, 12, 12, 14, 14, 26].map((wch) => ({ wch }));
  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inscriptos');
  const nombre = `Inscriptos - ${torneo.nombre}.xlsx`.replace(/[\\/:*?"<>|]/g, '');

  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, nombre);
    return;
  }
  const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const destino = `${FileSystem.cacheDirectory}${nombre.replace(/\s+/g, '_')}`;
  await FileSystem.writeAsStringAsync(destino, b64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destino, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
      dialogTitle: nombre,
    });
  }
}

/** Respuestas de una encuesta a Excel (para la comisión). */
export async function exportarEncuestaExcel(titulo: string, opciones: string[], conAcompanantes: boolean, votos: import('./data/repo').VotoConPersona[]) {
  const datos = votos
    .map((v) => ({
      Apellido: v.persona.apellido,
      Nombre: v.persona.nombre,
      Alias: v.persona.alias,
      Respuesta: v.opciones.map((i) => opciones[i]).join(', '),
      ...(conAcompanantes ? { 'Acompañantes': v.acompanantes || 0 } : {}),
      Federado: v.persona.federado ? 'Sí' : 'No',
      WhatsApp: v.persona.telefono,
      'Respondió el': fecha(v.creadoEl),
    }))
    .sort((a, b) => a.Apellido.localeCompare(b.Apellido));
  const ws = XLSX.utils.json_to_sheet(datos.length ? datos : [{ Apellido: 'Sin respuestas' }]);
  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Respuestas');
  await guardarLibro(wb, `Encuesta - ${titulo}.xlsx`.replace(/[\\/:*?"<>|]/g, ''));
}

/** Web: descarga. Celular: menú para compartir/guardar. */
async function guardarLibro(wb: XLSX.WorkBook, nombre: string) {
  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, nombre);
    return;
  }
  const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const destino = `${FileSystem.cacheDirectory}${nombre.replace(/\s+/g, '_')}`;
  await FileSystem.writeAsStringAsync(destino, b64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destino, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
      dialogTitle: nombre,
    });
  }
}

/** Pagos del club + estado de cuotas de los socios (para tesorería). */
export async function exportarPagosExcel(
  club: string,
  pagos: { apellido: string; nombre: string; concepto: string; monto: number; fecha: string; cuenta: string; estado: string; motivo: string; informado: string; admin: boolean }[],
  cuotas: { apellido: string; nombre: string; tipo: string; alDia: boolean; meses: string; total: number; whatsapp: string }[],
) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    pagos.length
      ? pagos.map((p) => ({
          Apellido: p.apellido, Nombre: p.nombre, Concepto: p.concepto, Monto: p.monto, 'Fecha transferencia': p.fecha, Cuenta: p.cuenta,
          Estado: p.estado, 'Motivo rechazo': p.motivo, 'Informado el': p.informado, 'Registrado por admin': p.admin ? 'Sí' : 'No',
        }))
      : [{ Apellido: 'Sin pagos' }],
  );
  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
  XLSX.utils.book_append_sheet(wb, ws, 'Pagos');
  if (cuotas.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(cuotas.map((c) => ({ Apellido: c.apellido, Nombre: c.nombre, 'Tipo de cuota': c.tipo, Estado: c.alDia ? 'Al día' : 'Debe', 'Meses adeudados': c.meses, 'Total adeudado': c.total, WhatsApp: c.whatsapp }))),
      'Cuotas',
    );
  }
  await guardarLibro(wb, `Pagos - ${club}.xlsx`.replace(/[\\/:*?"<>|]/g, ''));
}
