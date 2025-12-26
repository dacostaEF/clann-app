/**
 * MessageCache - Cache de Última Mensagem por CLANN
 * Sprint 7 - ETAPA 6: Performance & Compressão
 * 
 * Armazena cache da última mensagem de cada CLANN para preview rápido
 */

import { Platform } from 'react-native';

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

const CACHE_KEY = 'clann_message_cache';

/**
 * Obtém cache de última mensagem
 * @returns {Promise<Object>} Cache de mensagens por CLANN
 */
async function getCache() {
  try {
    const cacheJson = await SecureStore.getItemAsync(CACHE_KEY);
    return cacheJson ? JSON.parse(cacheJson) : {};
  } catch (error) {
    console.error('Erro ao carregar cache:', error);
    return {};
  }
}

/**
 * Salva cache de última mensagem
 * @param {Object} cache - Cache completo
 * @returns {Promise<void>}
 */
async function saveCache(cache) {
  try {
    await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Erro ao salvar cache:', error);
  }
}

/**
 * Atualiza cache da última mensagem de um CLANN
 * @param {number} clanId - ID do CLANN
 * @param {Object} message - Objeto da mensagem
 * @returns {Promise<void>}
 */
export async function updateLastMessage(clanId, message) {
  try {
    const cache = await getCache();
    cache[clanId] = {
      message: message.message || message.text || '',
      timestamp: message.timestamp || Date.now(),
      authorTotem: message.authorTotem || message.author_totem || '',
      edited: message.edited || false,
      deleted: message.deleted || false
    };
    await saveCache(cache);
  } catch (error) {
    console.error('Erro ao atualizar cache:', error);
  }
}

/**
 * Obtém última mensagem de um CLANN do cache
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<Object|null>} Última mensagem ou null
 */
export async function getLastMessage(clanId) {
  try {
    const cache = await getCache();
    return cache[clanId] || null;
  } catch (error) {
    console.error('Erro ao obter cache:', error);
    return null;
  }
}

/**
 * Obtém últimas mensagens de múltiplos CLANNs
 * @param {Array<number>} clanIds - IDs dos CLANNs
 * @returns {Promise<Object>} Mapa de clanId -> última mensagem
 */
export async function getLastMessages(clanIds) {
  try {
    const cache = await getCache();
    const result = {};
    clanIds.forEach(clanId => {
      if (cache[clanId]) {
        result[clanId] = cache[clanId];
      }
    });
    return result;
  } catch (error) {
    console.error('Erro ao obter cache múltiplo:', error);
    return {};
  }
}

/**
 * Limpa cache de um CLANN
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<void>}
 */
export async function clearCache(clanId) {
  try {
    const cache = await getCache();
    delete cache[clanId];
    await saveCache(cache);
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
  }
}

/**
 * Limpa todo o cache
 * @returns {Promise<void>}
 */
export async function clearAllCache() {
  try {
    await SecureStore.deleteItemAsync(CACHE_KEY);
  } catch (error) {
    console.error('Erro ao limpar todo o cache:', error);
  }
}

