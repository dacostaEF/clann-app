/**
 * SessionFortress - Sistema de Proteção de Sessão
 * Sprint 8 - ETAPA 3
 * 
 * Protege sessão do usuário detectando:
 * - App indo para background (AppState)
 * - Mudança de rede (NetInfo)
 * - Inconsistência de hash de sessão
 * 
 * Ações:
 * - Invalidar sessão
 * - Pedir PIN novamente
 * - Bloquear ações sensíveis
 */

import { Platform, AppState } from 'react-native';
import { sha256 } from '@noble/hashes/sha256';
import { Buffer } from 'buffer';
import { calculateTrustScore, shouldRequirePin, shouldBlockSensitiveActions } from './DeviceTrust';

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

const SESSION_TOKEN_KEY = 'clann_session_token';
const SESSION_HASH_KEY = 'clann_session_hash';
const SESSION_START_KEY = 'clann_session_start';
const SESSION_VALID_KEY = 'clann_session_valid';
const LAST_NETWORK_STATE_KEY = 'clann_last_network_state';

let appStateListener = null;
let networkListener = null;
let sessionValid = false;

/**
 * Gera token de sessão único
 * @returns {string} Token de sessão
 */
function generateSessionToken() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${random}`;
}

/**
 * Gera hash do token de sessão
 * @param {string} token - Token de sessão
 * @returns {Promise<string>} Hash do token
 */
async function hashSessionToken(token) {
  const hash = sha256(new TextEncoder().encode(token));
  return Buffer.from(hash).toString('hex');
}

/**
 * Inicia uma nova sessão
 * @returns {Promise<string>} Token de sessão
 */
export async function startSession() {
  try {
    const token = generateSessionToken();
    const hash = await hashSessionToken(token);
    const startTime = Date.now();
    
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    await SecureStore.setItemAsync(SESSION_HASH_KEY, hash);
    await SecureStore.setItemAsync(SESSION_START_KEY, startTime.toString());
    await SecureStore.setItemAsync(SESSION_VALID_KEY, 'true');
    
    sessionValid = true;
    
    console.log('[SessionFortress] Sessão iniciada');
    return token;
  } catch (error) {
    console.error('Erro ao iniciar sessão:', error);
    throw error;
  }
}

/**
 * Encerra a sessão atual
 * @returns {Promise<void>}
 */
export async function endSession() {
  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    await SecureStore.deleteItemAsync(SESSION_HASH_KEY);
    await SecureStore.deleteItemAsync(SESSION_START_KEY);
    await SecureStore.deleteItemAsync(SESSION_VALID_KEY);
    
    sessionValid = false;
    
    console.log('[SessionFortress] Sessão encerrada');
  } catch (error) {
    console.error('Erro ao encerrar sessão:', error);
  }
}

/**
 * Verifica se sessão é válida
 * @returns {Promise<boolean>} True se válida
 */
export async function isSessionValid() {
  try {
    if (!sessionValid) {
      return false;
    }
    
    const validStr = await SecureStore.getItemAsync(SESSION_VALID_KEY);
    if (validStr !== 'true') {
      return false;
    }
    
    // Verifica integridade do hash
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    const storedHash = await SecureStore.getItemAsync(SESSION_HASH_KEY);
    
    if (!token || !storedHash) {
      return false;
    }
    
    const computedHash = await hashSessionToken(token);
    if (computedHash !== storedHash) {
      // Hash inconsistente - sessão inválida
      await endSession();
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
    return false;
  }
}

/**
 * Verifica se deve exigir PIN novamente
 * @returns {Promise<boolean>} True se deve exigir PIN
 */
export async function shouldRequirePinAgain() {
  try {
    // Verifica Device Trust Score
    const trustScore = await calculateTrustScore();
    
    if (shouldRequirePin(trustScore) || shouldBlockSensitiveActions(trustScore)) {
      return true;
    }
    
    // Verifica se sessão é válida
    const isValid = await isSessionValid();
    if (!isValid) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao verificar se deve exigir PIN:', error);
    // Em caso de erro, exige PIN (mais seguro)
    return true;
  }
}

/**
 * Trata mudança de estado do app (background/foreground)
 * @param {string} nextAppState - Novo estado do app
 * @returns {Promise<void>}
 */
export async function handleAppStateChange(nextAppState) {
  try {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App foi para background - marca sessão como suspeita
      console.log('[SessionFortress] App foi para background');
      
      // Reduz trust score levemente
      const { reduceTrustScore } = await import('./DeviceTrust');
      await reduceTrustScore(5);
      
      // Não invalida sessão imediatamente, mas marca como suspeita
      // Sessão será invalidada quando app voltar se houver problemas
    } else if (nextAppState === 'active') {
      // App voltou para foreground - verifica sessão
      console.log('[SessionFortress] App voltou para foreground');
      
      // Verifica Device Trust Score
      const trustScore = await calculateTrustScore();
      
      if (shouldBlockSensitiveActions(trustScore)) {
        // Score muito baixo - invalida sessão
        console.log('[SessionFortress] Score muito baixo, invalidando sessão');
        await endSession();
      } else if (shouldRequirePin(trustScore)) {
        // Score médio - marca sessão como requerendo PIN
        console.log('[SessionFortress] Score médio, requerendo PIN');
        await SecureStore.setItemAsync(SESSION_VALID_KEY, 'require_pin');
      }
    }
  } catch (error) {
    console.error('Erro ao tratar mudança de AppState:', error);
  }
}

/**
 * Trata mudança de rede
 * @param {Object} state - Estado da rede
 * @returns {Promise<void>}
 */
export async function handleNetworkChange(state) {
  try {
    const lastNetworkState = await SecureStore.getItemAsync(LAST_NETWORK_STATE_KEY);
    
    if (lastNetworkState) {
      try {
        const lastState = JSON.parse(lastNetworkState);
        
        // Verifica se tipo de rede mudou significativamente
        const networkTypeChanged = lastState.type !== state.type;
        const connectionLost = lastState.isConnected && !state.isConnected;
        
        if (networkTypeChanged || connectionLost) {
          console.log('[SessionFortress] Mudança de rede detectada');
          
          // Reduz trust score
          const { reduceTrustScore } = await import('./DeviceTrust');
          await reduceTrustScore(10);
          
          // Se desconectou, marca sessão como suspeita
          if (connectionLost) {
            await SecureStore.setItemAsync(SESSION_VALID_KEY, 'require_pin');
          }
        }
      } catch (e) {
        // Erro ao parsear, ignora
      }
    }
    
    // Salva estado atual
    await SecureStore.setItemAsync(LAST_NETWORK_STATE_KEY, JSON.stringify({
      type: state.type,
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Erro ao tratar mudança de rede:', error);
  }
}

/**
 * Inicializa listeners de eventos
 * @returns {Promise<void>}
 */
export async function initListeners() {
  try {
    // Listener de AppState
    if (Platform.OS !== 'web') {
      appStateListener = AppState.addEventListener('change', handleAppStateChange);
    }
    
    // Listener de NetInfo
    if (Platform.OS !== 'web') {
      try {
        const NetInfo = require('@react-native-community/netinfo');
        networkListener = NetInfo.addEventListener(handleNetworkChange);
      } catch (e) {
        console.warn('NetInfo não disponível:', e);
      }
    }
    
    console.log('[SessionFortress] Listeners inicializados');
  } catch (error) {
    console.error('Erro ao inicializar listeners:', error);
  }
}

/**
 * Remove listeners de eventos
 * @returns {Promise<void>}
 */
export async function removeListeners() {
  try {
    if (appStateListener) {
      appStateListener.remove();
      appStateListener = null;
    }
    
    if (networkListener) {
      networkListener();
      networkListener = null;
    }
    
    console.log('[SessionFortress] Listeners removidos');
  } catch (error) {
    console.error('Erro ao remover listeners:', error);
  }
}

/**
 * Verifica integridade da sessão e exige PIN se necessário
 * @returns {Promise<boolean>} True se sessão é válida e não precisa de PIN
 */
export async function checkSessionIntegrity() {
  try {
    // Verifica se sessão é válida
    const isValid = await isSessionValid();
    if (!isValid) {
      return false;
    }
    
    // Verifica se deve exigir PIN
    const requirePin = await shouldRequirePinAgain();
    if (requirePin) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao verificar integridade da sessão:', error);
    return false;
  }
}

/**
 * Inicializa Session Fortress
 * @returns {Promise<void>}
 */
export async function init() {
  try {
    // Inicia sessão se não existe
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
      await startSession();
    } else {
      sessionValid = true;
    }
    
    // Inicializa listeners
    await initListeners();
    
    console.log('[SessionFortress] Inicializado');
  } catch (error) {
    console.error('Erro ao inicializar Session Fortress:', error);
  }
}

