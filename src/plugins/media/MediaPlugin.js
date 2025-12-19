/**
 * MediaPlugin - Plugin de Sala de Mídia
 * Sprint 7 - ETAPA 5: Sistema de Plugins
 * 
 * Permite compartilhar e visualizar mídias dentro de um CLANN
 * (Estrutura base - implementação completa no futuro)
 */

import { BasePlugin, PLUGIN_TYPES } from '../pluginRegistry';

export class MediaPlugin extends BasePlugin {
  constructor() {
    super('media', 'Sala de Mídia', PLUGIN_TYPES.MEDIA);
  }

  async init(clanId) {
    // Inicialização do plugin de mídia
    // TODO: Criar tabela de mídias no banco
    console.log(`MediaPlugin inicializado para CLANN ${clanId}`);
  }

  getIcon() {
    return '🎬';
  }

  renderComponent(props) {
    // TODO: Implementar componente de mídia
    return null;
  }
}

