/**
 * DeviceTrust - Sistema de Confiança de Dispositivo
 * Sprint 8 - ETAPA 3
 * 
 * Calcula score de confiança do dispositivo baseado em:
 * - Device ID / Hardware ID
 * - Sistema operacional
 * - Mudanças de rede (IP/WiFi/4G)
 * - Consistência de fingerprint
 * 
 * Score: 0-100
 * > 70: Normal
 * 40-70: Exigir PIN
 * < 40: Bloquear ações sensíveis
 */

import { Platform } from 'react-native';
import { sha256 } from '@noble/hashes/sha256';
import { Buffer } from 'buffer';
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

const DEVICE_ID_KEY = 'clann_device_id';
const DEVICE_FINGERPRINT_KEY = 'clann_device_fingerprint';
const LAST_NETWORK_KEY = 'clann_last_network';
const LAST_SCORE_KEY = 'clann_last_trust_score';

// Thresholds
const SCORE_NORMAL = 70;
const SCORE_REQUIRE_PIN = 40;
const SCORE_BLOCK = 40;

/**
 * Gera ou obtém ID único do dispositivo
 * @returns {Promise<string>} Device ID
 */
async function getOrCreateDeviceId() {
  try {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Gera novo ID baseado em informações do dispositivo
      const deviceInfo = {
        platform: Platform.OS || 'unknown',
        version: Platform.Version || 'unknown',
        timestamp: Date.now(),
        random: Math.random().toString(36)
      };
      
      const infoString = JSON.stringify(deviceInfo);
      const hash = sha256(new TextEncoder().encode(infoString));
      deviceId = Buffer.from(hash).toString('hex').substring(0, 32);
      
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Erro ao obter/criar device ID:', error);
    // Fallback: ID baseado em timestamp
    return `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Gera fingerprint do dispositivo
 * @returns {Promise<string>} Fingerprint hash
 */
async function generateDeviceFingerprint() {
  try {
    const deviceInfo = {
      platform: Platform.OS || 'unknown',
      version: Platform.Version || 'unknown',
      // Em produção, poderia incluir mais informações (modelo, etc)
    };
    
    const infoString = JSON.stringify(deviceInfo);
    const hash = sha256(new TextEncoder().encode(infoString));
    return Buffer.from(hash).toString('hex');
  } catch (error) {
    console.error('Erro ao gerar fingerprint:', error);
    return 'unknown';
  }
}

/**
 * Obtém informações de rede atuais
 * @returns {Promise<Object>} Informações de rede
 */
async function getNetworkInfo() {
  try {
    // Tenta usar NetInfo se disponível
    let NetInfo;
    if (Platform.OS !== 'web') {
      try {
        NetInfo = require('@react-native-community/netinfo');
      } catch (e) {
        // NetInfo não instalado, usa fallback
      }
    }
    
    if (NetInfo) {
      const state = await NetInfo.fetch();
      return {
        type: state.type || 'unknown',
        isConnected: state.isConnected || false,
        isInternetReachable: state.isInternetReachable || false,
        // IP não disponível diretamente no NetInfo, mas podemos usar type
        networkType: state.type
      };
    }
    
    // Fallback: informações básicas
    return {
      type: Platform.OS === 'web' ? 'wifi' : 'unknown',
      isConnected: true,
      isInternetReachable: true,
      networkType: Platform.OS === 'web' ? 'wifi' : 'unknown'
    };
  } catch (error) {
    console.error('Erro ao obter informações de rede:', error);
    return {
      type: 'unknown',
      isConnected: false,
      isInternetReachable: false,
      networkType: 'unknown'
    };
  }
}

/**
 * Calcula score de confiança do dispositivo
 * @param {Object} options - Opções de cálculo
 * @returns {Promise<number>} Score de 0 a 100
 */
export async function calculateTrustScore(options = {}) {
  try {
    const { checkNetwork = true, checkFingerprint = true } = options;
    
    let score = 100; // Começa com score máximo
    
    // 1. Verifica consistência do Device ID (peso: 30 pontos)
    const deviceId = await getOrCreateDeviceId();
    const storedDeviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (storedDeviceId && storedDeviceId !== deviceId) {
      score -= 30; // Device ID mudou (muito suspeito)
    }
    
    // 2. Verifica consistência do fingerprint (peso: 25 pontos)
    if (checkFingerprint) {
      const currentFingerprint = await generateDeviceFingerprint();
      const storedFingerprint = await SecureStore.getItemAsync(DEVICE_FINGERPRINT_KEY);
      
      if (storedFingerprint) {
        if (storedFingerprint !== currentFingerprint) {
          score -= 25; // Fingerprint mudou (SO mudou ou dispositivo diferente)
        }
      } else {
        // Primeira vez, salva fingerprint
        await SecureStore.setItemAsync(DEVICE_FINGERPRINT_KEY, currentFingerprint);
      }
    }
    
    // 3. Verifica mudanças de rede (peso: 20 pontos)
    if (checkNetwork) {
      const networkInfo = await getNetworkInfo();
      const lastNetwork = await SecureStore.getItemAsync(LAST_NETWORK_KEY);
      
      if (lastNetwork) {
        try {
          const lastNetworkData = JSON.parse(lastNetwork);
          const networkChanged = lastNetworkData.type !== networkInfo.type;
          
          if (networkChanged) {
            // Mudança de rede reduz score, mas não muito (normal trocar WiFi/4G)
            score -= 10;
          }
          
          // Se desconectado, reduz score
          if (!networkInfo.isConnected) {
            score -= 10;
          }
        } catch (e) {
          // Erro ao parsear, ignora
        }
      }
      
      // Salva rede atual
      await SecureStore.setItemAsync(LAST_NETWORK_KEY, JSON.stringify(networkInfo));
    }
    
    // 4. Verifica histórico de scores (peso: 15 pontos)
    const lastScore = await SecureStore.getItemAsync(LAST_SCORE_KEY);
    if (lastScore) {
      const lastScoreNum = parseInt(lastScore, 10);
      if (lastScoreNum < SCORE_REQUIRE_PIN) {
        // Se score anterior era baixo, reduz um pouco
        score -= 5;
      }
    }
    
    // 5. Verifica se dispositivo está vinculado (peso: 10 pontos)
    // Se não está vinculado, reduz score (dispositivo não confiável)
    // Isso será verificado quando houver totemId
    
    // Garante que score está entre 0 e 100
    score = Math.max(0, Math.min(100, score));
    
    // Salva score atual
    await SecureStore.setItemAsync(LAST_SCORE_KEY, score.toString());
    
    return Math.round(score);
  } catch (error) {
    console.error('Erro ao calcular trust score:', error);
    // Em caso de erro, retorna score baixo (mais seguro)
    return SCORE_REQUIRE_PIN;
  }
}

/**
 * Obtém score de confiança atual (sem recalcular)
 * @returns {Promise<number>} Score atual ou null se não existe
 */
export async function getCurrentTrustScore() {
  try {
    const scoreStr = await SecureStore.getItemAsync(LAST_SCORE_KEY);
    return scoreStr ? parseInt(scoreStr, 10) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Verifica se score é suficiente para ação normal
 * @param {number} score - Score a verificar
 * @returns {boolean} True se score > 70
 */
export function isScoreNormal(score) {
  return score > SCORE_NORMAL;
}

/**
 * Verifica se deve exigir PIN
 * @param {number} score - Score a verificar
 * @returns {boolean} True se score entre 40-70
 */
export function shouldRequirePin(score) {
  return score >= SCORE_REQUIRE_PIN && score <= SCORE_NORMAL;
}

/**
 * Verifica se deve bloquear ações sensíveis
 * @param {number} score - Score a verificar
 * @returns {boolean} True se score < 40
 */
export function shouldBlockSensitiveActions(score) {
  return score < SCORE_BLOCK;
}

/**
 * Reduz score por atividade suspeita
 * @param {number} reduction - Quantidade a reduzir (padrão: 10)
 * @returns {Promise<number>} Novo score
 */
export async function reduceTrustScore(reduction = 10) {
  try {
    const currentScore = await getCurrentTrustScore();
    const newScore = Math.max(0, (currentScore || 100) - reduction);
    
    await SecureStore.setItemAsync(LAST_SCORE_KEY, newScore.toString());
    
    // Salva no banco também (se disponível)
    await saveTrustScoreToDB(newScore);
    
    return newScore;
  } catch (error) {
    console.error('Erro ao reduzir trust score:', error);
    return SCORE_REQUIRE_PIN;
  }
}

/**
 * Salva score no banco de dados
 * @param {number} score - Score a salvar
 * @returns {Promise<void>}
 */
async function saveTrustScoreToDB(score) {
  try {
    const deviceId = await getOrCreateDeviceId();
    const db = ClanStorage.getDB();
    
    if (!db || Platform.OS === 'web') {
      // No web, salva no localStorage
      const scores = JSON.parse(localStorage.getItem('clann_device_trust_scores') || '[]');
      const existingIndex = scores.findIndex(s => s.device_id === deviceId);
      
      const scoreData = {
        device_id: deviceId,
        score: score,
        last_seen: Date.now()
      };
      
      if (existingIndex >= 0) {
        scores[existingIndex] = scoreData;
      } else {
        scores.push(scoreData);
      }
      
      localStorage.setItem('clann_device_trust_scores', JSON.stringify(scores));
      return;
    }
    
    // SQLite
    return new Promise((resolve) => {
      db.transaction(tx => {
        tx.executeSql(
          `INSERT OR REPLACE INTO device_trust_scores (device_id, score, last_seen)
           VALUES (?, ?, ?);`,
          [deviceId, score, Date.now()],
          () => resolve(),
          (_, err) => {
            console.warn('Erro ao salvar trust score no banco:', err);
            resolve(); // Não falha
          }
        );
      });
    });
  } catch (error) {
    console.warn('Erro ao salvar trust score no banco:', error);
  }
}

/**
 * Obtém score do banco de dados
 * @param {string} deviceId - ID do dispositivo
 * @returns {Promise<number|null>} Score ou null
 */
export async function getTrustScoreFromDB(deviceId) {
  try {
    const db = ClanStorage.getDB();
    
    if (!db || Platform.OS === 'web') {
      // No web, busca no localStorage
      const scores = JSON.parse(localStorage.getItem('clann_device_trust_scores') || '[]');
      const deviceScore = scores.find(s => s.device_id === deviceId);
      return deviceScore ? deviceScore.score : null;
    }
    
    // SQLite
    return new Promise((resolve) => {
      db.transaction(tx => {
        tx.executeSql(
          `SELECT score FROM device_trust_scores WHERE device_id = ?;`,
          [deviceId],
          (_, result) => {
            if (result.rows.length > 0) {
              resolve(result.rows.item(0).score);
            } else {
              resolve(null);
            }
          },
          () => resolve(null) // Em caso de erro, retorna null
        );
      });
    });
  } catch (error) {
    console.warn('Erro ao obter trust score do banco:', error);
    return null;
  }
}

/**
 * Verifica se pode executar ação sensível
 * @param {Object} options - Opções
 * @returns {Promise<boolean>} True se pode executar
 */
export async function canExecuteSensitiveAction(options = {}) {
  try {
    const score = await calculateTrustScore(options);
    
    if (shouldBlockSensitiveActions(score)) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao verificar se pode executar ação sensível:', error);
    // Em caso de erro, bloqueia (mais seguro)
    return false;
  }
}

/**
 * Inicializa sistema de Device Trust
 * Cria tabela no banco se necessário
 * @returns {Promise<void>}
 */
export async function init() {
  try {
    const db = ClanStorage.getDB();
    
    if (!db || Platform.OS === 'web') {
      // No web, não precisa criar tabela
      return;
    }
    
    // Cria tabela se não existir
    return new Promise((resolve) => {
      db.transaction(tx => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS device_trust_scores (
            device_id TEXT PRIMARY KEY,
            score INTEGER NOT NULL,
            last_seen INTEGER NOT NULL
          );`,
          [],
          () => resolve(),
          (_, err) => {
            console.warn('Erro ao criar tabela device_trust_scores:', err);
            resolve(); // Não falha
          }
        );
      });
    });
  } catch (error) {
    console.error('Erro ao inicializar Device Trust:', error);
  }
}

