import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Cliente de Supabase (proyecto ats-club).
 * La URL y la clave publicable son públicas por diseño: la seguridad la dan las reglas RLS.
 * Se leen de .env (EXPO_PUBLIC_...); si faltan, se usan las del proyecto.
 */
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dejlrychouxdyfjtbkqw.supabase.co';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_Her99JRs0OUaCYLfYVQOvQ_ibWRrm7f';

/**
 * "Olvidé mi contraseña": aplicación web de Apps Script en la cuenta de Gmail de ATS (apps-script/recuperar.gs).
 * Manda por mail el código de recuperación. Se puede cambiar con EXPO_PUBLIC_RECUPERAR_URL en .env.
 */
export const RECUPERAR_URL = process.env.EXPO_PUBLIC_RECUPERAR_URL || 'https://script.google.com/macros/s/AKfycbwS8UPKHQnAEXs56p7UW-MDVZNrkndPj3NhqRciRL8vkw8wKslE0pWJY2xWNsJBkqxBPA/exec';

export const supabase = createClient(URL, KEY, {
  auth: {
    // En web, la sesión va en localStorage (por defecto); en el celular, en AsyncStorage.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
