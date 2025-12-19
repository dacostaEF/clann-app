/**
 * Módulo de autodestruição por segurança
 * Detecta tentativas de invasão e destrói dados do Totem
 */

import { Platform } from 'react-native';
import { deleteTotemSecure } from '../storage/secureStore';

// Polyfill para web usando localStorage
let SecureStore;
if (Platform.OS === 'web') {
  SecureStore = {
    async setItemAsync(key, value) {
      localStorage.setItem(key, value);
    },
    async getItemAsync(key) {
      return localStorage.getItem(key);
    },
    async deleteItemAsync(key) {
      localStorage.removeItem(key);
    },
  };
} else {
  SecureStore = require('expo-secure-store');
}

const SELF_DESTRUCT_ATTEMPTS_KEY = 'self_destruct_attempts';
const MAX_ATTEMPTS_BEFORE_DESTRUCT = 10;

/**
 * Registra uma tentativa de PIN incorreta
 * @returns {Promise<boolean>} True se deve autodestruir
 */
export async function recordFailedAttempt() {
  try {
    const attemptsStr = await SecureStore.getItemAsync(SELF_DESTRUCT_ATTEMPTS_KEY);
    let attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
    attempts += 1;

    await SecureStore.setItemAsync(SELF_DESTRUCT_ATTEMPTS_KEY, attempts.toString());

    if (attempts >= MAX_ATTEMPTS_BEFORE_DESTRUCT) {
      await executeSelfDestruct();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Erro ao registrar tentativa:', error);
    return false;
  }
}

/**
 * Executa a autodestruição do Totem
 * Remove todos os dados sensíveis e volta para tela de boas-vindas
 * @returns {Promise<void>}
 */
export async function executeSelfDestruct() {
  try {
    // Deleta Totem
    await deleteTotemSecure();

    // Deleta PIN e dados relacionados
    await SecureStore.deleteItemAsync('pin_hash');
    await SecureStore.deleteItemAsync('pin_salt');
    await SecureStore.deleteItemAsync('aes_key');
    await SecureStore.deleteItemAsync('pin_attempts');
    await SecureStore.deleteItemAsync('pin_locked_until');

    // Deleta biometria
    await SecureStore.deleteItemAsync('biometry_enabled');
    await SecureStore.deleteItemAsync('biometry_attempts');

    // Deleta contador de autodestruição
    await SecureStore.deleteItemAsync(SELF_DESTRUCT_ATTEMPTS_KEY);

    // Deleta dados de auditoria
    await SecureStore.deleteItemAsync('security_audit');
  } catch (error) {
    console.error('Erro na autodestruição:', error);
    // Continua mesmo com erro para garantir limpeza máxima
  }
}

/**
 * Reseta o contador de tentativas (quando PIN é acertado)
 * @returns {Promise<void>}
 */
export async function resetFailedAttempts() {
  try {
    await SecureStore.deleteItemAsync(SELF_DESTRUCT_ATTEMPTS_KEY);
  } catch (error) {
    console.error('Erro ao resetar tentativas:', error);
  }
}

/**
 * Obtém o número de tentativas de autodestruição
 * @returns {Promise<number>} Número de tentativas
 */
export async function getFailedAttempts() {
  try {
    const attemptsStr = await SecureStore.getItemAsync(SELF_DESTRUCT_ATTEMPTS_KEY);
    return attemptsStr ? parseInt(attemptsStr, 10) : 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Obtém tentativas restantes antes da autodestruição
 * @returns {Promise<number>} Tentativas restantes
 */
export async function getRemainingAttempts() {
  const attempts = await getFailedAttempts();
  return Math.max(0, MAX_ATTEMPTS_BEFORE_DESTRUCT - attempts);
}

