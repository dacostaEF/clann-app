/**
 * Módulo de gerenciamento de PIN
 * Gerencia criação, validação e hash de PIN
 * Gera chave AES para criptografia de backup
 */

import { Platform } from 'react-native';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '../utils/randomBytes';

// Polyfill para web usando localStorage
let SecureStore;
if (Platform.OS === 'web') {
  console.log("[PinManager] ✅ Usando polyfill Web para SecureStore");
  SecureStore = {
    async setItemAsync(key, value) {
      console.log("[SecureStore WEB] Gravando:", key, value?.substring(0, 20) + "...");
      localStorage.setItem(key, value);
      const test = localStorage.getItem(key);
      console.log("[SecureStore WEB] ✅ Confirmado salvo:", test ? "SIM" : "NÃO");
    },
    async getItemAsync(key) {
      const val = localStorage.getItem(key);
      console.log("[SecureStore WEB] Lendo:", key, val?.substring?.(0, 20) + "...");
      return val;
    },
    async deleteItemAsync(key) {
      console.log("[SecureStore WEB] Apagando:", key);
      localStorage.removeItem(key);
    },
  };
} else {
  SecureStore = require('expo-secure-store');
}

const PIN_KEY = 'pin_hash';
const PIN_SALT_KEY = 'pin_salt';
const AES_KEY_KEY = 'aes_key';
const PIN_ATTEMPTS_KEY = 'pin_attempts';
const PIN_LOCKED_UNTIL_KEY = 'pin_locked_until';

// Tempo de bloqueio após 5 tentativas (5 minutos) - Sprint 8 - ETAPA 3
const LOCK_DURATION = 5 * 60 * 1000; // 5 minutos em milissegundos

/**
 * Valida o formato do PIN (4-6 dígitos)
 * @param {string} pin - PIN a validar
 * @returns {boolean} True se válido
 */
export function validatePinFormat(pin) {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Gera hash do PIN usando SHA256 com salt (iterações múltiplas)
 * @param {string} pin - PIN em texto plano
 * @param {Uint8Array} salt - Salt aleatório
 * @returns {Promise<string>} Hash do PIN em hex
 */
async function hashPin(pin, salt) {
  const pinBytes = new TextEncoder().encode(pin);
  // Combina PIN + salt
  const combined = new Uint8Array(pinBytes.length + salt.length);
  combined.set(pinBytes, 0);
  combined.set(salt, pinBytes.length);
  
  // Aplica SHA256 múltiplas vezes (simula PBKDF2)
  let hash = combined;
  for (let i = 0; i < 100000; i++) {
    hash = sha256(hash);
  }
  
  // Garante que o hash sempre retorne em minúsculas
  return Buffer.from(hash).toString('hex').toLowerCase();
}

/**
 * Gera chave AES-256 a partir do PIN
 * @param {string} pin - PIN do usuário
 * @param {Uint8Array} salt - Salt (pode ser o mesmo do PIN ou diferente)
 * @returns {Promise<Uint8Array>} Chave AES de 32 bytes
 */
export async function generateAESKeyFromPin(pin, salt) {
  const pinBytes = new TextEncoder().encode(pin);
  // Combina PIN + salt
  const combined = new Uint8Array(pinBytes.length + salt.length);
  combined.set(pinBytes, 0);
  combined.set(salt, pinBytes.length);
  
  // Aplica SHA256 múltiplas vezes para derivar chave
  let hash = combined;
  for (let i = 0; i < 100000; i++) {
    hash = sha256(hash);
  }
  
  // Retorna 32 bytes (256 bits) para AES-256
  return hash.slice(0, 32);
}

/**
 * Cria e salva um novo PIN
 * @param {string} pin - PIN em texto plano (4-6 dígitos)
 * @returns {Promise<void>}
 */
export async function createPin(pin) {
  if (!validatePinFormat(pin)) {
    throw new Error('PIN deve ter entre 4 e 6 dígitos');
  }

  // Gera salt aleatório
  const salt = randomBytes(16);
  const saltHex = Buffer.from(salt).toString('hex').toLowerCase();

  // Gera hash do PIN
  const pinHash = await hashPin(pin, salt);

  // Gera chave AES para backup
  const aesKey = await generateAESKeyFromPin(pin, salt);
  const aesKeyHex = Buffer.from(aesKey).toString('hex');

  // Salva tudo no SecureStore
  try {
    // Salva PIN
    await SecureStore.setItemAsync(PIN_KEY, pinHash);
    console.log("[PinManager] PIN salvo:", PIN_KEY, pinHash);

    // Salva SALT
    await SecureStore.setItemAsync(PIN_SALT_KEY, saltHex);
    console.log("[PinManager] SALT salvo:", PIN_SALT_KEY, saltHex);

    // Salva AES KEY
    await SecureStore.setItemAsync(AES_KEY_KEY, aesKeyHex);
    console.log("[PinManager] AES KEY salva:", AES_KEY_KEY, aesKeyHex);

    // Testes de leitura imediata
    const testPin = await SecureStore.getItemAsync(PIN_KEY);
    const testSalt = await SecureStore.getItemAsync(PIN_SALT_KEY);

    console.log("[PinManager] ✅ Teste leitura PIN:", testPin ? "OK" : "FALHOU");
    console.log("[PinManager] ✅ Teste leitura SALT:", testSalt ? "OK" : "FALHOU");

    // Reset tentativas de erro
    await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY);
    await SecureStore.deleteItemAsync(PIN_LOCKED_UNTIL_KEY);
    console.log("[PinManager] Tentativas resetadas.");

  } catch (err) {
    console.error("[PinManager] ❌ ERRO AO SALVAR PIN:", err);
    throw new Error(`Falha ao salvar PIN: ${err.message}`);
  }
}

/**
 * Verifica se o PIN está correto
 * @param {string} pin - PIN a verificar
 * @returns {Promise<boolean>} True se correto
 */
export async function verifyPin(pin) {
  try {
    // Valida formato do PIN antes de processar
    if (!validatePinFormat(pin)) {
      console.log("[PIN VERIFY] ❌ Formato de PIN inválido");
      return false;
    }

    // Verifica se está bloqueado
    const lockedUntil = await SecureStore.getItemAsync(PIN_LOCKED_UNTIL_KEY);
    if (lockedUntil) {
      const lockTime = parseInt(lockedUntil, 10);
      if (Date.now() < lockTime) {
        const remainingSeconds = Math.ceil((lockTime - Date.now()) / 1000);
        throw new Error(`PIN bloqueado. Tente novamente em ${remainingSeconds} segundos.`);
      }
      // Desbloqueia se o tempo passou
      await SecureStore.deleteItemAsync(PIN_LOCKED_UNTIL_KEY);
      console.log("[PIN VERIFY] ✅ Bloqueio expirado, desbloqueado automaticamente");
    }

    // Carrega hash e salt
    const storedHash = await SecureStore.getItemAsync(PIN_KEY);
    const saltHex = await SecureStore.getItemAsync(PIN_SALT_KEY);

    if (!storedHash || !saltHex) {
      console.log("[PIN VERIFY] ❌ PIN ou SALT não encontrado no storage");
      console.log("[PIN VERIFY] storedHash existe:", !!storedHash);
      console.log("[PIN VERIFY] saltHex existe:", !!saltHex);
      return false;
    }

    // Limpa e normaliza saltHex
    const cleanSaltHex = saltHex.trim().toLowerCase();
    console.log("[PIN VERIFY] Salt lido (original):", saltHex);
    console.log("[PIN VERIFY] Salt lido (limpo):", cleanSaltHex);

    // Converte salt para Buffer
    const salt = Buffer.from(cleanSaltHex, 'hex');
    
    // Valida tamanho do salt (deve ser 16 bytes = 32 caracteres hex)
    if (salt.length !== 16) {
      console.log("[PIN VERIFY] ❌ Salt inválido (tamanho incorreto):", salt.length, "esperado: 16");
      return false;
    }

    // Calcula hash do PIN
    const computedHash = await hashPin(pin, salt);
    
    // Normaliza ambos os hashes para comparação
    const normalizedStored = storedHash.trim().toLowerCase();
    const normalizedComputed = computedHash.trim().toLowerCase();

    // Logs detalhados para diagnóstico
    console.log("[PIN VERIFY] Hash salvo (original):", storedHash);
    console.log("[PIN VERIFY] Hash salvo (normalizado):", normalizedStored);
    console.log("[PIN VERIFY] Hash calculado (original):", computedHash);
    console.log("[PIN VERIFY] Hash calculado (normalizado):", normalizedComputed);
    console.log("[PIN VERIFY] Igualdade (comparação direta):", storedHash === computedHash);
    console.log("[PIN VERIFY] Igualdade (normalizado):", normalizedStored === normalizedComputed);

    if (normalizedStored === normalizedComputed) {
      // PIN correto - reseta tentativas
      console.log("[PIN VERIFY] ✅ PIN correto!");
      await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY);
      await SecureStore.deleteItemAsync(PIN_LOCKED_UNTIL_KEY);
      return true;
    } else {
      // PIN incorreto - incrementa tentativas
      console.log("[PIN VERIFY] ❌ PIN incorreto - hashes não coincidem");
      await incrementPinAttempts();
      return false;
    }
  } catch (error) {
    if (error.message.includes('bloqueado')) {
      throw error;
    }
    console.error("[PIN VERIFY] ❌ Erro ao verificar PIN:", error);
    return false;
  }
}

/**
 * Incrementa contador de tentativas de PIN
 * Bloqueia após 5 tentativas
 */
async function incrementPinAttempts() {
  const attemptsStr = await SecureStore.getItemAsync(PIN_ATTEMPTS_KEY);
  let attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
  attempts += 1;

  if (attempts >= 5) {
    // Bloqueia por 5 minutos - Sprint 8 - ETAPA 3
    const lockUntil = Date.now() + LOCK_DURATION;
    await SecureStore.setItemAsync(PIN_LOCKED_UNTIL_KEY, lockUntil.toString());
    await SecureStore.setItemAsync(PIN_ATTEMPTS_KEY, '0'); // Reseta contador
    const minutes = Math.ceil(LOCK_DURATION / (60 * 1000));
    throw new Error(`Muitas tentativas incorretas. PIN bloqueado por ${minutes} minutos.`);
  } else {
    await SecureStore.setItemAsync(PIN_ATTEMPTS_KEY, attempts.toString());
  }
}

/**
 * Obtém a chave AES salva (para backup)
 * @returns {Promise<string|null>} Chave AES em hex ou null
 */
export async function getAESKey() {
  try {
    return await SecureStore.getItemAsync(AES_KEY_KEY);
  } catch (error) {
    return null;
  }
}

/**
 * Verifica se existe um PIN configurado
 * @returns {Promise<boolean>} True se existe PIN
 */
export async function hasPin() {
  try {
    const pinHash = await SecureStore.getItemAsync(PIN_KEY);
    return pinHash !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Obtém o número de tentativas de PIN restantes
 * @returns {Promise<number>} Tentativas restantes (5 - tentativas atuais)
 */
export async function getRemainingAttempts() {
  try {
    const attemptsStr = await SecureStore.getItemAsync(PIN_ATTEMPTS_KEY);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
    return Math.max(0, 5 - attempts);
  } catch (error) {
    return 5;
  }
}

/**
 * Obtém o tempo restante de bloqueio (em segundos)
 * @returns {Promise<number>} Segundos restantes ou 0 se não bloqueado
 */
export async function getLockRemainingTime() {
  try {
    const lockedUntil = await SecureStore.getItemAsync(PIN_LOCKED_UNTIL_KEY);
    if (!lockedUntil) {
      return 0;
    }
    const lockTime = parseInt(lockedUntil, 10);
    const remaining = Math.max(0, Math.ceil((lockTime - Date.now()) / 1000));
    return remaining;
  } catch (error) {
    return 0;
  }
}

/**
 * Valida PIN para ações sensíveis (Sprint 8 - ETAPA 3)
 * @param {string} pin - PIN a validar
 * @returns {Promise<boolean>} True se PIN é válido
 */
export async function validatePinForSensitiveAction(pin) {
  try {
    // Verifica se PIN está configurado
    const hasPinConfigured = await hasPin();
    if (!hasPinConfigured) {
      throw new Error('PIN não configurado. Configure um PIN primeiro.');
    }
    
    // Verifica PIN
    const isValid = await verifyPin(pin);
    if (!isValid) {
      throw new Error('PIN incorreto');
    }
    
    return true;
  } catch (error) {
    if (error.message.includes('bloqueado') || error.message.includes('incorreto')) {
      throw error;
    }
    throw new Error(`Erro ao validar PIN: ${error.message}`);
  }
}

/**
 * Verifica se PIN é necessário para uma ação
 * @param {string} action - Tipo de ação (export, reset, admin, etc)
 * @returns {Promise<boolean>} True se PIN é necessário
 */
export async function isPinRequiredForAction(action) {
  try {
    // Ações que sempre requerem PIN
    const sensitiveActions = ['export', 'reset', 'admin', 'advanced_settings'];
    
    if (sensitiveActions.includes(action)) {
      return true;
    }
    
    // Verifica Device Trust Score
    const { calculateTrustScore, shouldRequirePin, shouldBlockSensitiveActions } = await import('./DeviceTrust');
    const trustScore = await calculateTrustScore();
    
    if (shouldBlockSensitiveActions(trustScore) || shouldRequirePin(trustScore)) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao verificar se PIN é necessário:', error);
    // Em caso de erro, exige PIN (mais seguro)
    return true;
  }
}

