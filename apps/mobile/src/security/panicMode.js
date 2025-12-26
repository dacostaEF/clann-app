/**
 * PanicMode - Modo de Emergência (Self-Destruct Global)
 * Sprint 7 - ETAPA 4: Modo PANIC
 * 
 * Sistema de autodestruição global que:
 * - Apaga mensagens locais
 * - Apaga GroupKeys locais
 * - Desloga usuário (limpa Totem)
 * - Ativa PIN de emergência
 * - Notifica administradores (futuro)
 */

import { Platform } from 'react-native';
import MessagesStorage from '../messages/MessagesStorage';
import KeyManager from './keyManager';
import { clearTotem } from '../crypto/totemStorage';
import { logSecurityEvent, SECURITY_EVENTS } from './SecurityLog';
import { getCurrentTotemId } from '../crypto/totemStorage';
import ClanStorage from '../clans/ClanStorage';

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

const PANIC_MODE_KEY = 'panic_mode_activated';
const PANIC_TIMESTAMP_KEY = 'panic_timestamp';

/**
 * Ativa o modo PANIC - autodestruição global
 * @param {Object} options - Opções de limpeza
 * @param {boolean} options.clearMessages - Limpar mensagens (padrão: true)
 * @param {boolean} options.clearKeys - Limpar chaves (padrão: true)
 * @param {boolean} options.clearTotem - Limpar Totem/deslogar (padrão: true)
 * @param {boolean} options.requireEmergencyPin - Ativar PIN de emergência (padrão: true)
 * @returns {Promise<Object>} Resultado da operação
 */
export async function activate(options = {}) {
  const {
    clearMessages = true,
    clearKeys = true,
    clearTotem = true,
    requireEmergencyPin = true
  } = options;

  try {
    // Obtém totemId antes de limpar (para auditoria)
    const totemId = await getCurrentTotemId();

    // 1. Limpar mensagens locais
    if (clearMessages) {
      await clearAllMessages();
    }

    // 2. Limpar GroupKeys locais
    if (clearKeys) {
      await clearAllGroupKeys();
    }

    // 3. Limpar dispositivos vinculados
    if (totemId) {
      await clearLinkedDevices(totemId);
    }

    // 4. Ativar PIN de emergência
    if (requireEmergencyPin) {
      await activateEmergencyPin();
    }

    // 5. Registra evento de auditoria (ANTES de limpar Totem)
    if (totemId) {
      try {
        await logSecurityEvent(SECURITY_EVENTS.PANIC_MODE_ACTIVATED, {
          clearMessages,
          clearKeys,
          clearTotem,
          requireEmergencyPin
        }, totemId);
      } catch (error) {
        console.error('Erro ao registrar evento de auditoria:', error);
        // Não falha se auditoria falhar
      }
    }

    // 6. Marcar modo PANIC como ativado
    await SecureStore.setItemAsync(PANIC_MODE_KEY, 'true');
    await SecureStore.setItemAsync(PANIC_TIMESTAMP_KEY, Date.now().toString());

    // 7. Limpar Totem (deslogar usuário) - ÚLTIMO PASSO
    if (clearTotem) {
      await clearTotem();
    }

    return {
      success: true,
      cleared: {
        messages: clearMessages,
        keys: clearKeys,
        totem: clearTotem,
        linkedDevices: true
      },
      emergencyPinActivated: requireEmergencyPin
    };
  } catch (error) {
    console.error('Erro ao ativar modo PANIC:', error);
    throw new Error(`Erro ao ativar modo PANIC: ${error.message}`);
  }
}

/**
 * Limpa todas as mensagens locais
 * @returns {Promise<void>}
 */
async function clearAllMessages() {
  try {
    if (Platform.OS === 'web') {
      // Na Web, limpa localStorage
      localStorage.removeItem('clann_messages');
      return;
    }

    // No SQLite, deleta todas as mensagens
    if (Platform.OS !== 'web') {
      try {
        const SQLite = require('expo-sqlite');
        const db = await SQLite.openDatabaseAsync('clans.db');
        await db.execAsync(`DELETE FROM clan_messages;`);
        return;
      } catch (error) {
        console.error('Erro ao limpar mensagens via SQLite:', error);
        // Continua mesmo com erro
      }
    }
  } catch (error) {
    console.error('Erro ao limpar mensagens:', error);
    // Continua mesmo com erro
  }
}

/**
 * Limpa todas as GroupKeys locais
 * @returns {Promise<void>}
 */
async function clearAllGroupKeys() {
  try {
    if (Platform.OS === 'web') {
      // Na Web, limpa localStorage
      localStorage.removeItem('clann_clan_keys');
      return;
    }

    // No SQLite, deleta todas as chaves diretamente do banco
    // Usa o mesmo banco que KeyManager
    if (Platform.OS !== 'web') {
      try {
        const SQLite = require('expo-sqlite');
        const db = await SQLite.openDatabaseAsync('clans.db');
        await db.execAsync(`DELETE FROM clan_keys;`);
        return;
      } catch (error) {
        console.error('Erro ao limpar chaves via SQLite:', error);
        // Tenta método alternativo: obtém CLANNs e deleta chaves uma a uma
        try {
          const totemId = await getCurrentTotemId();
          if (totemId) {
            const clans = await ClanStorage.getUserClans(totemId);
            for (const clan of clans) {
              await KeyManager.deleteGroupKey(clan.id);
            }
          }
        } catch (err) {
          console.error('Erro ao limpar chaves via método alternativo:', err);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao limpar chaves:', error);
    // Continua mesmo com erro
  }
}

/**
 * Limpa dispositivos vinculados
 * @param {string} totemId - ID do Totem
 * @returns {Promise<void>}
 */
async function clearLinkedDevices(totemId) {
  try {
    const devices = await ClanStorage.getLinkedDevices(totemId);
    for (const device of devices) {
      await ClanStorage.removeLinkedDevice(device.device_id);
    }
  } catch (error) {
    console.error('Erro ao limpar dispositivos vinculados:', error);
    // Continua mesmo com erro
  }
}

/**
 * Ativa PIN de emergência
 * @returns {Promise<void>}
 */
async function activateEmergencyPin() {
  try {
    // Marca que PIN de emergência está ativo
    await SecureStore.setItemAsync('emergency_pin_required', 'true');
    await SecureStore.setItemAsync('emergency_pin_timestamp', Date.now().toString());
    
    // Limpa tentativas de PIN anteriores
    await SecureStore.deleteItemAsync('pin_attempts');
    await SecureStore.deleteItemAsync('pin_locked_until');
  } catch (error) {
    console.error('Erro ao ativar PIN de emergência:', error);
    // Continua mesmo com erro
  }
}

/**
 * Verifica se modo PANIC está ativo
 * @returns {Promise<boolean>}
 */
export async function isPanicModeActive() {
  try {
    const panicMode = await SecureStore.getItemAsync(PANIC_MODE_KEY);
    return panicMode === 'true';
  } catch (error) {
    return false;
  }
}

/**
 * Desativa modo PANIC (após recuperação)
 * @returns {Promise<void>}
 */
export async function deactivate() {
  try {
    await SecureStore.deleteItemAsync(PANIC_MODE_KEY);
    await SecureStore.deleteItemAsync(PANIC_TIMESTAMP_KEY);
    await SecureStore.deleteItemAsync('emergency_pin_required');
    await SecureStore.deleteItemAsync('emergency_pin_timestamp');
  } catch (error) {
    console.error('Erro ao desativar modo PANIC:', error);
  }
}

/**
 * Obtém timestamp da última ativação do modo PANIC
 * @returns {Promise<number|null>}
 */
export async function getPanicTimestamp() {
  try {
    const timestamp = await SecureStore.getItemAsync(PANIC_TIMESTAMP_KEY);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (error) {
    return null;
  }
}

