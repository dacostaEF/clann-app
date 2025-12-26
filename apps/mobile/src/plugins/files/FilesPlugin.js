/**
 * FilesPlugin - Plugin de Sala de Documentos
 * Sprint 7 - ETAPA 5: Sistema de Plugins
 * 
 * Permite compartilhar e gerenciar documentos dentro de um CLANN
 * (Estrutura base - implementação completa no futuro)
 */

import { BasePlugin, PLUGIN_TYPES } from '../pluginRegistry';

export class FilesPlugin extends BasePlugin {
  constructor() {
    super('files', 'Sala de Documentos', PLUGIN_TYPES.FILES);
  }

  async init(clanId) {
    // Inicialização do plugin de arquivos
    // TODO: Criar tabela de arquivos no banco
    console.log(`FilesPlugin inicializado para CLANN ${clanId}`);
  }

  getIcon() {
    return '📁';
  }

  renderComponent(props) {
    // TODO: Implementar componente de arquivos
    return null;
  }
}

