/**
 * PluginRegistry - Sistema de Registro de Plugins
 * Sprint 7 - ETAPA 5: Sistema de Plugins Internos
 * 
 * Gerencia registro, ativação e desativação de plugins do CLANN
 * Cada CLANN pode ter plugins específicos ativados
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

const PLUGINS_CONFIG_KEY = 'clann_plugins_config';

/**
 * Tipos de plugins disponíveis
 */
export const PLUGIN_TYPES = {
  POLLS: 'polls',           // Enquetes seguras
  EVENTS: 'events',         // Eventos
  FILES: 'files',           // Sala de documentos
  CALLS: 'calls',           // Modo Chamadas
  VOTING: 'voting',         // Votação anônima
  MEDIA: 'media',           // Sala de mídia
};

/**
 * Interface base para plugins
 * Todos os plugins devem implementar esta interface
 */
export class BasePlugin {
  constructor(pluginId, pluginName, pluginType) {
    this.id = pluginId;
    this.name = pluginName;
    this.type = pluginType;
    this.enabled = false;
    this.config = {};
  }

  /**
   * Inicializa o plugin
   * @param {number} clanId - ID do CLANN
   * @returns {Promise<void>}
   */
  async init(clanId) {
    throw new Error('init() deve ser implementado pelo plugin');
  }

  /**
   * Ativa o plugin
   * @param {number} clanId - ID do CLANN
   * @returns {Promise<void>}
   */
  async activate(clanId) {
    this.enabled = true;
    await this.saveConfig(clanId);
  }

  /**
   * Desativa o plugin
   * @param {number} clanId - ID do CLANN
   * @returns {Promise<void>}
   */
  async deactivate(clanId) {
    this.enabled = false;
    await this.saveConfig(clanId);
  }

  /**
   * Salva configuração do plugin
   * @param {number} clanId - ID do CLANN
   * @returns {Promise<void>}
   */
  async saveConfig(clanId) {
    const config = await getPluginsConfig();
    if (!config[clanId]) {
      config[clanId] = {};
    }
    config[clanId][this.id] = {
      enabled: this.enabled,
      config: this.config
    };
    await savePluginsConfig(config);
  }

  /**
   * Carrega configuração do plugin
   * @param {number} clanId - ID do CLANN
   * @returns {Promise<void>}
   */
  async loadConfig(clanId) {
    const config = await getPluginsConfig();
    if (config[clanId] && config[clanId][this.id]) {
      const pluginConfig = config[clanId][this.id];
      this.enabled = pluginConfig.enabled || false;
      this.config = pluginConfig.config || {};
    }
  }

  /**
   * Renderiza componente do plugin (para UI)
   * @param {Object} props - Props do componente
   * @returns {React.Component|null}
   */
  renderComponent(props) {
    return null; // Implementado por cada plugin
  }

  /**
   * Obtém ícone do plugin
   * @returns {string} Emoji ou nome do ícone
   */
  getIcon() {
    return '🔌'; // Ícone padrão
  }
}

/**
 * Registro global de plugins
 */
const pluginRegistry = new Map();

/**
 * Registra um plugin no sistema
 * @param {BasePlugin} plugin - Instância do plugin
 */
export function registerPlugin(plugin) {
  if (!(plugin instanceof BasePlugin)) {
    throw new Error('Plugin deve estender BasePlugin');
  }
  pluginRegistry.set(plugin.id, plugin);
}

/**
 * Obtém um plugin registrado
 * @param {string} pluginId - ID do plugin
 * @returns {BasePlugin|null}
 */
export function getPlugin(pluginId) {
  return pluginRegistry.get(pluginId) || null;
}

/**
 * Lista todos os plugins registrados
 * @returns {Array<BasePlugin>}
 */
export function getAllPlugins() {
  return Array.from(pluginRegistry.values());
}

/**
 * Lista plugins por tipo
 * @param {string} pluginType - Tipo do plugin
 * @returns {Array<BasePlugin>}
 */
export function getPluginsByType(pluginType) {
  return getAllPlugins().filter(plugin => plugin.type === pluginType);
}

/**
 * Obtém plugins ativados para um CLANN
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<Array<BasePlugin>>}
 */
export async function getActivePlugins(clanId) {
  const config = await getPluginsConfig();
  const activePlugins = [];
  
  if (config[clanId]) {
    for (const [pluginId, pluginConfig] of Object.entries(config[clanId])) {
      if (pluginConfig.enabled) {
        const plugin = getPlugin(pluginId);
        if (plugin) {
          await plugin.loadConfig(clanId);
          activePlugins.push(plugin);
        }
      }
    }
  }
  
  return activePlugins;
}

/**
 * Ativa um plugin para um CLANN
 * @param {string} pluginId - ID do plugin
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<void>}
 */
export async function activatePlugin(pluginId, clanId) {
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} não encontrado`);
  }
  
  await plugin.activate(clanId);
  await plugin.init(clanId);
}

/**
 * Desativa um plugin para um CLANN
 * @param {string} pluginId - ID do plugin
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<void>}
 */
export async function deactivatePlugin(pluginId, clanId) {
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} não encontrado`);
  }
  
  await plugin.deactivate(clanId);
}

/**
 * Verifica se um plugin está ativo para um CLANN
 * @param {string} pluginId - ID do plugin
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<boolean>}
 */
export async function isPluginActive(pluginId, clanId) {
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    return false;
  }
  
  await plugin.loadConfig(clanId);
  return plugin.enabled;
}

/**
 * Obtém configuração de todos os plugins
 * @returns {Promise<Object>}
 */
async function getPluginsConfig() {
  try {
    const configJson = await SecureStore.getItemAsync(PLUGINS_CONFIG_KEY);
    return configJson ? JSON.parse(configJson) : {};
  } catch (error) {
    console.error('Erro ao carregar configuração de plugins:', error);
    return {};
  }
}

/**
 * Salva configuração de todos os plugins
 * @param {Object} config - Configuração completa
 * @returns {Promise<void>}
 */
async function savePluginsConfig(config) {
  try {
    await SecureStore.setItemAsync(PLUGINS_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Erro ao salvar configuração de plugins:', error);
  }
}

/**
 * Inicializa todos os plugins ativos para um CLANN
 * @param {number} clanId - ID do CLANN
 * @returns {Promise<void>}
 */
export async function initPluginsForClan(clanId) {
  const activePlugins = await getActivePlugins(clanId);
  for (const plugin of activePlugins) {
    try {
      await plugin.init(clanId);
    } catch (error) {
      console.error(`Erro ao inicializar plugin ${plugin.id}:`, error);
    }
  }
}

