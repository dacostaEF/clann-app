/**
 * Módulo de auditoria de segurança
 * Registra eventos de segurança localmente
 */

import { Platform } from 'react-native';
import { validateTotem } from '../crypto/totem';
import { loadTotemSecure } from '../storage/secureStore';
import { hasPin, getRemainingAttempts, getLockRemainingTime } from './PinManager';
import { isBiometryEnabled, isBiometryAvailable, getBiometryType } from './BiometryManager';
import { getFailedAttempts, getRemainingAttempts as getSelfDestructRemaining } from './SelfDestruct';
import { sha256 } from '@noble/hashes/sha256';

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

const AUDIT_KEY = 'security_audit';
const LAST_ACCESS_KEY = 'last_access';

/**
 * Registra um evento de acesso
 * @returns {Promise<void>}
 */
export async function recordAccess() {
  try {
    const timestamp = Date.now();
    await SecureStore.setItemAsync(LAST_ACCESS_KEY, timestamp.toString());
    
    // Atualiza auditoria
    const audit = await getAuditData();
    audit.lastAccess = new Date(timestamp).toISOString();
    audit.accessCount = (audit.accessCount || 0) + 1;
    await saveAuditData(audit);
  } catch (error) {
    console.error('Erro ao registrar acesso:', error);
  }
}

/**
 * Obtém dados de auditoria
 * @returns {Promise<Object>} Dados de auditoria
 */
export async function getAuditData() {
  try {
    const auditJson = await SecureStore.getItemAsync(AUDIT_KEY);
    if (auditJson) {
      return JSON.parse(auditJson);
    }
  } catch (error) {
    console.error('Erro ao carregar auditoria:', error);
  }

  // Retorna estrutura padrão
  return {
    lastAccess: null,
    accessCount: 0,
    pinFailedAttempts: 0,
    biometryFailedAttempts: 0,
    totemValidated: false,
    deviceHash: null,
    backupEncrypted: false,
  };
}

/**
 * Salva dados de auditoria
 * @param {Object} audit - Dados de auditoria
 * @returns {Promise<void>}
 */
async function saveAuditData(audit) {
  try {
    await SecureStore.setItemAsync(AUDIT_KEY, JSON.stringify(audit));
  } catch (error) {
    console.error('Erro ao salvar auditoria:', error);
  }
}

/**
 * Registra tentativa de PIN falhada
 * @returns {Promise<void>}
 */
export async function recordPinFailure() {
  const audit = await getAuditData();
  audit.pinFailedAttempts = (audit.pinFailedAttempts || 0) + 1;
  await saveAuditData(audit);
}

/**
 * Registra tentativa de biometria falhada
 * @returns {Promise<void>}
 */
export async function recordBiometryFailure() {
  const audit = await getAuditData();
  audit.biometryFailedAttempts = (audit.biometryFailedAttempts || 0) + 1;
  await saveAuditData(audit);
}

/**
 * Obtém informações completas de segurança
 * @returns {Promise<Object>} Informações de segurança
 */
export async function getSecurityInfo() {
  try {
    const audit = await getAuditData();
    const lastAccessStr = await SecureStore.getItemAsync(LAST_ACCESS_KEY);
    const lastAccess = lastAccessStr ? new Date(parseInt(lastAccessStr, 10)).toISOString() : null;

    // Valida Totem
    let totemValid = false;
    let totemId = null;
    try {
      const totem = await loadTotemSecure();
      if (totem) {
        totemValid = validateTotem(totem);
        totemId = totem.totemId;
      }
    } catch (error) {
      console.error('Erro ao validar Totem:', error);
    }

    // Verifica PIN
    const hasPinConfigured = await hasPin();
    const pinRemainingAttempts = await getRemainingAttempts();
    const pinLockRemaining = await getLockRemainingTime();

    // Verifica biometria
    const biometryEnabled = await isBiometryEnabled();
    const biometryAvailable = await isBiometryAvailable();
    const biometryType = biometryAvailable ? await getBiometryType() : null;

    // Verifica autodestruição
    const selfDestructAttempts = await getFailedAttempts();
    const selfDestructRemaining = await getSelfDestructRemaining();

    // Gera hash do dispositivo
    const deviceHash = await generateDeviceHash();

    // Verifica se backup está criptografado (verifica se existe chave AES)
    const { getAESKey } = await import('./PinManager');
    const aesKey = await getAESKey();
    const backupEncrypted = aesKey !== null;

    return {
      lastAccess,
      accessCount: audit.accessCount || 0,
      pinFailedAttempts: audit.pinFailedAttempts || 0,
      biometryFailedAttempts: audit.biometryFailedAttempts || 0,
      totemValid,
      totemId,
      hasPin: hasPinConfigured,
      pinRemainingAttempts,
      pinLockRemaining,
      biometryEnabled,
      biometryAvailable,
      biometryType,
      selfDestructAttempts,
      selfDestructRemaining,
      deviceHash,
      backupEncrypted,
    };
  } catch (error) {
    console.error('Erro ao obter informações de segurança:', error);
    return {
      lastAccess: null,
      accessCount: 0,
      pinFailedAttempts: 0,
      biometryFailedAttempts: 0,
      totemValid: false,
      totemId: null,
      hasPin: false,
      pinRemainingAttempts: 0,
      pinLockRemaining: 0,
      biometryEnabled: false,
      biometryAvailable: false,
      biometryType: null,
      selfDestructAttempts: 0,
      selfDestructRemaining: 10,
      deviceHash: null,
      backupEncrypted: false,
    };
  }
}

/**
 * Gera hash único do dispositivo
 * @returns {Promise<string>} Hash do dispositivo
 */
async function generateDeviceHash() {
  try {
    // Usa informações da plataforma para gerar hash
    const deviceInfo = {
      platform: Platform.OS || 'unknown',
      version: Platform.Version || 'unknown',
    };

    const infoString = JSON.stringify(deviceInfo);
    const hash = sha256(new TextEncoder().encode(infoString));
    return Buffer.from(hash).toString('hex').substring(0, 16);
  } catch (error) {
    return 'unknown';
  }
}

