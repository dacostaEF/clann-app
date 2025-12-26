import { Platform } from 'react-native';
import { loadTotemSecure } from '../storage/secureStore';
import ClanStorage from '../clans/ClanStorage';
import MessagesStorage from '../messages/MessagesStorage';

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

/**
 * Nome da chave usada no SecureStore
 */
const TOTEM_KEY = 'CLANN_TOTEM_DATA';

/**
 * Salva o totem no armazenamento seguro
 * @param {Object} totemData - { totemId, privateKey, publicKey, createdAt }
 */
export async function saveTotem(totemData) {
  try {
    const json = JSON.stringify(totemData);
    await SecureStore.setItemAsync(TOTEM_KEY, json);
    return true;
  } catch (error) {
    console.error('Erro ao salvar totem:', error);
    return false;
  }
}

/**
 * Carrega o totem completo
 * @returns {Object|null}
 */
export async function loadTotem() {
  try {
    const data = await SecureStore.getItemAsync(TOTEM_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao carregar totem:', error);
    return null;
  }
}

/**
 * Retorna o ID do Totem atual
 * 
 * @deprecated — usar TotemContext quando possível
 * Esta função será removida em versão futura.
 * Prefira usar: const { totem } = useTotem(); const totemId = totem?.totemId;
 * 
 * @returns {Promise<string|null>} ID do Totem ou null se não existir
 */
export async function getCurrentTotemId() {
  const stored = await loadTotemSecure();
  if (!stored || !stored.totemId) {
    return null;
  }
  return stored.totemId;
}

/**
 * Verifica se existe um totem salvo
 * @returns {boolean}
 */
export async function hasTotemSecure() {
  const totem = await loadTotem();
  return !!totem;
}

/**
 * Limpa o totem do dispositivo
 */
export async function clearTotem() {
  try {
    await SecureStore.deleteItemAsync(TOTEM_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtém estatísticas do Totem (somente leitura)
 * @returns {Promise<Object>} Estatísticas do Totem
 */
export async function getTotemStats() {
  try {
    // Carrega Totem para obter createdAt
    const totem = await loadTotemSecure();
    if (!totem || !totem.totemId) {
      return {
        createdAt: null,
        clannsCreated: 0,
        clannsJoined: 0,
        messagesSent: 0
      };
    }

    const totemId = totem.totemId;
    const createdAt = totem.createdAt || null;

    // Conta CLANNs criados e participando
    const userClans = await ClanStorage.getUserClans(totemId);
    
    const clannsCreated = userClans.filter(clan => clan.role === 'founder').length;
    const clannsJoined = userClans.length;

    // Conta mensagens enviadas pelo totemId
    let messagesSent = 0;
    
    try {
      if (Platform.OS === 'web') {
        // Na Web, busca no localStorage diretamente
        try {
          const WEB_MESSAGES_KEY = 'clann_messages';
          const data = localStorage.getItem(WEB_MESSAGES_KEY);
          if (data) {
            const allMessages = JSON.parse(data);
            messagesSent = allMessages.filter(msg => msg.author_totem === totemId).length;
          }
        } catch (error) {
          console.warn('Erro ao contar mensagens na Web:', error);
        }
      } else {
        // SQLite: conta mensagens por totemId
        const messagesStorage = new MessagesStorage();
        await messagesStorage.init();
        
        if (messagesStorage.db) {
          messagesSent = await new Promise((resolve) => {
            messagesStorage.db.transaction(tx => {
              tx.executeSql(
                `SELECT COUNT(*) as count FROM clan_messages WHERE author_totem = ?;`,
                [totemId],
                (_, { rows }) => {
                  const count = rows.length > 0 ? rows.item(0).count : 0;
                  resolve(count);
                },
                (_, error) => {
                  console.warn('Erro ao contar mensagens:', error);
                  resolve(0);
                }
              );
            });
          });
        }
      }
    } catch (error) {
      console.warn('Erro ao contar mensagens:', error);
      messagesSent = 0;
    }

    return {
      createdAt,
      clannsCreated,
      clannsJoined,
      messagesSent
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas do Totem:', error);
    return {
      createdAt: null,
      clannsCreated: 0,
      clannsJoined: 0,
      messagesSent: 0
    };
  }
}


