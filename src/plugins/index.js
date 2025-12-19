/**
 * Plugins Index - Exporta todos os plugins
 * Sprint 7 - ETAPA 5: Sistema de Plugins
 * 
 * Centraliza exportação e registro de todos os plugins disponíveis
 */

import { registerPlugin } from './pluginRegistry';
import { PollsPlugin } from './polls/PollsPlugin';
import { EventsPlugin } from './events/EventsPlugin';
import { FilesPlugin } from './files/FilesPlugin';
import { CallsPlugin } from './calls/CallsPlugin';
import { VotingPlugin } from './voting/VotingPlugin';
import { MediaPlugin } from './media/MediaPlugin';

// Instancia todos os plugins
const pollsPlugin = new PollsPlugin();
const eventsPlugin = new EventsPlugin();
const filesPlugin = new FilesPlugin();
const callsPlugin = new CallsPlugin();
const votingPlugin = new VotingPlugin();
const mediaPlugin = new MediaPlugin();

// Registra todos os plugins
registerPlugin(pollsPlugin);
registerPlugin(eventsPlugin);
registerPlugin(filesPlugin);
registerPlugin(callsPlugin);
registerPlugin(votingPlugin);
registerPlugin(mediaPlugin);

// Exporta plugins individuais
export { PollsPlugin } from './polls/PollsPlugin';
export { EventsPlugin } from './events/EventsPlugin';
export { FilesPlugin } from './files/FilesPlugin';
export { CallsPlugin } from './calls/CallsPlugin';
export { VotingPlugin } from './voting/VotingPlugin';
export { MediaPlugin } from './media/MediaPlugin';

// Exporta registry
export * from './pluginRegistry';

/**
 * Inicializa todos os plugins do sistema
 * Deve ser chamado no App.js ou em um ponto de inicialização
 */
export function initAllPlugins() {
  // Plugins já são registrados automaticamente ao importar este arquivo
  console.log('Sistema de plugins inicializado');
}

