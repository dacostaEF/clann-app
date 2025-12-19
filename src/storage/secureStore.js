/**
 * Módulo de armazenamento seguro usando expo-secure-store
 * Todos os dados do Totem são armazenados de forma criptografada localmente
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

const TOTEM_KEY = 'totem_data';

/**
 * Salva os dados do Totem de forma segura
 * @param {Object} totemData - Dados do Totem a serem salvos
 * @returns {Promise<void>}
 */
export async function saveTotemSecure(totemData) {
  try {
    console.log("[SecureStore] Salvando Totem...");
    // Converte o objeto para JSON e salva de forma segura
    const jsonData = JSON.stringify(totemData);
    await SecureStore.setItemAsync(TOTEM_KEY, jsonData);
    console.log("[SecureStore] Totem salvo com sucesso:", jsonData);

    // PATCH: LIMPEZA AUTOMÁTICA DE PIN ANTIGO
    await SecureStore.deleteItemAsync("pin_hash");
    await SecureStore.deleteItemAsync("pin_salt");
    await SecureStore.deleteItemAsync("pin_attempts");
    await SecureStore.deleteItemAsync("self_destruct_attempts");

    console.log("[SecureStore] PIN antigo removido após criar um novo Totem.");

    return true;
  } catch (error) {
    console.error("[SecureStore] Erro ao salvar Totem:", error);
    throw new Error(`Erro ao salvar Totem: ${error.message}`);
  }
}

/**
 * Carrega os dados do Totem de forma segura
 * @returns {Promise<Object|null>} Dados do Totem ou null se não existir
 */
export async function loadTotemSecure() {
  try {
    console.log("[SecureStore] Lendo chave:", TOTEM_KEY);
    const jsonData = await SecureStore.getItemAsync(TOTEM_KEY);
    console.log("[SecureStore] Valor encontrado:", jsonData);
    if (!jsonData) {
      return null;
    }
    return JSON.parse(jsonData);
  } catch (error) {
    throw new Error(`Erro ao carregar Totem: ${error.message}`);
  }
}

/**
 * Deleta todos os dados do Totem
 * @returns {Promise<void>}
 */
export async function deleteTotemSecure() {
  try {
    await SecureStore.deleteItemAsync(TOTEM_KEY);
  } catch (error) {
    throw new Error(`Erro ao deletar Totem: ${error.message}`);
  }
}

/**
 * Verifica se existe um Totem salvo
 * @returns {Promise<boolean>} True se existe um Totem salvo
 */
export async function hasTotemSecure() {
  try {
    const data = await SecureStore.getItemAsync(TOTEM_KEY);
    return data !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Obtém lista de dispositivos vinculados (somente leitura)
 * @returns {Promise<Array>} Lista de dispositivos vinculados
 */
export async function getLinkedDevices() {
  try {
    const data = await SecureStore.getItemAsync('linked_devices');
    if (!data) {
      return [];
    }
    const devices = JSON.parse(data);
    // Garante formato correto: [{ id, name, linkedAt }]
    return Array.isArray(devices) ? devices.map(device => ({
      id: device.id || device.device_id || '',
      name: device.name || 'Dispositivo',
      linkedAt: device.linkedAt || device.linked_at || ''
    })) : [];
  } catch (error) {
    console.warn('Erro ao ler dispositivos vinculados:', error);
    return [];
  }
}





