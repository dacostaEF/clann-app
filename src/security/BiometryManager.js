/**
 * Módulo de gerenciamento de biometria
 * Gerencia autenticação biométrica usando expo-local-authentication
 */

import { Platform } from 'react-native';

// Polyfills para web
let LocalAuthentication;
let SecureStore;

if (Platform.OS === 'web') {
  LocalAuthentication = {
    async hasHardwareAsync() { return false; },
    async isEnrolledAsync() { return false; },
    async supportedAuthenticationTypesAsync() { return []; },
    async authenticateAsync() { return { success: false }; },
    AuthenticationType: {
      FACIAL_RECOGNITION: 1,
      IRIS: 2,
      FINGERPRINT: 3,
    },
  };
  SecureStore = {
    async setItemAsync(key, value) { localStorage.setItem(key, value); },
    async getItemAsync(key) { return localStorage.getItem(key); },
    async deleteItemAsync(key) { localStorage.removeItem(key); },
  };
} else {
  LocalAuthentication = require('expo-local-authentication');
  SecureStore = require('expo-secure-store');
}

const BIOMETRY_ENABLED_KEY = 'biometry_enabled';
const BIOMETRY_ATTEMPTS_KEY = 'biometry_attempts';

// Máximo de tentativas antes de cair para PIN
const MAX_BIOMETRY_ATTEMPTS = 3;

/**
 * Verifica se o dispositivo suporta biometria
 * @returns {Promise<boolean>} True se suporta
 */
export async function isBiometryAvailable() {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      return false;
    }

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch (error) {
    return false;
  }
}

/**
 * Obtém o tipo de biometria disponível
 * @returns {Promise<string>} 'fingerprint', 'facial' ou 'iris'
 */
export async function getBiometryType() {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'facial';
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'iris';
    } else {
      return 'fingerprint';
    }
  } catch (error) {
    return 'fingerprint';
  }
}

/**
 * Ativa a biometria
 * @returns {Promise<void>}
 */
export async function enableBiometry() {
  const available = await isBiometryAvailable();
  if (!available) {
    throw new Error('Biometria não disponível neste dispositivo');
  }

  await SecureStore.setItemAsync(BIOMETRY_ENABLED_KEY, 'true');
  await SecureStore.deleteItemAsync(BIOMETRY_ATTEMPTS_KEY);
}

/**
 * Desativa a biometria
 * @returns {Promise<void>}
 */
export async function disableBiometry() {
  await SecureStore.deleteItemAsync(BIOMETRY_ENABLED_KEY);
  await SecureStore.deleteItemAsync(BIOMETRY_ATTEMPTS_KEY);
}

/**
 * Verifica se a biometria está ativada
 * @returns {Promise<boolean>} True se ativada
 */
export async function isBiometryEnabled() {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRY_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    return false;
  }
}

/**
 * Autentica usando biometria
 * @param {string} reason - Motivo da autenticação (opcional)
 * @returns {Promise<boolean>} True se autenticado com sucesso
 */
export async function authenticateWithBiometry(reason = 'Autentique-se para acessar o CLÃ') {
  try {
    const enabled = await isBiometryEnabled();
    if (!enabled) {
      return false;
    }

    const available = await isBiometryAvailable();
    if (!available) {
      return false;
    }

    // Verifica tentativas
    const attemptsStr = await SecureStore.getItemAsync(BIOMETRY_ATTEMPTS_KEY);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

    if (attempts >= MAX_BIOMETRY_ATTEMPTS) {
      // Reseta tentativas e retorna false para cair para PIN
      await SecureStore.deleteItemAsync(BIOMETRY_ATTEMPTS_KEY);
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });

    if (result.success) {
      // Sucesso - reseta tentativas
      await SecureStore.deleteItemAsync(BIOMETRY_ATTEMPTS_KEY);
      return true;
    } else {
      // Falha - incrementa tentativas
      await SecureStore.setItemAsync(BIOMETRY_ATTEMPTS_KEY, (attempts + 1).toString());
      return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Reseta tentativas de biometria
 * @returns {Promise<void>}
 */
export async function resetBiometryAttempts() {
  await SecureStore.deleteItemAsync(BIOMETRY_ATTEMPTS_KEY);
}

