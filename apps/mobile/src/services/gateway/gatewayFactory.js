/**
 * 🏭 GatewayFactory - GERENCIADOR DE INSTÂNCIAS
 * 
 * Gerencia múltiplas instâncias de GatewayClient
 * Permite troca de identidade, múltiplos perfis, etc.
 */

import { GatewayClient } from './GatewayClient';

class GatewayFactory {
  constructor() {
    this.instances = new Map(); // totemId → GatewayClient
    this.defaultInstance = null;
  }

  /**
   * Cria uma nova instância de GatewayClient
   */
  createClient(options = {}) {
    const client = new GatewayClient(options);
    return client;
  }

  /**
   * Registra uma instância para um Totem específico
   */
  registerInstance(totemId, client) {
    if (this.instances.has(totemId)) {
      console.warn(`⚠️ Substituindo instância existente para Totem ${totemId}`);
    }

    this.instances.set(totemId, client);

    // Se é a primeira, torna padrão
    if (!this.defaultInstance) {
      this.defaultInstance = client;
    }

    return () => this.unregisterInstance(totemId);
  }

  unregisterInstance(totemId) {
    const client = this.instances.get(totemId);
    if (client) {
      client.disconnect();
      this.instances.delete(totemId);

      // Ajustar defaultInstance se necessário
      if (this.defaultInstance === client) {
        this.defaultInstance = this.instances.values().next().value || null;
      }
    }
  }

  /**
   * Obtém instância para um Totem específico
   */
  getInstance(totemId) {
    return this.instances.get(totemId);
  }

  /**
   * Obtém instância padrão (para compatibilidade temporária)
   * ⚠️ AVISO: Migrar para getInstance() específico
   */
  getDefaultInstance() {
    if (!this.defaultInstance) {
      console.warn('⚠️ Criando instância padrão sob demanda - migre para getInstance() específico');
      this.defaultInstance = this.createClient();
    }
    return this.defaultInstance;
  }

  /**
   * Desconecta todas as instâncias
   */
  disconnectAll() {
    for (const [totemId, client] of this.instances) {
      client.disconnect();
    }
    this.instances.clear();
    this.defaultInstance = null;
  }

  /**
   * Lista todas as instâncias ativas
   */
  listInstances() {
    return Array.from(this.instances.entries()).map(([totemId, client]) => ({
      totemId,
      isConnected: client.isConnected,
      isAuthenticated: client.isAuthenticated,
      metrics: client.getMetrics(),
    }));
  }
}

// Exportar singleton da factory (esta sim pode ser singleton)
export const gatewayFactory = new GatewayFactory();

// Exportar classe também (para testes ou casos especiais)
export { GatewayFactory };

// Funções helper para compatibilidade (deprecated - usar gatewayFactory)
export function createGatewayClient(options = {}) {
  return gatewayFactory.createClient(options);
}

export function createDefaultGatewayClient() {
  return gatewayFactory.getDefaultInstance();
}

