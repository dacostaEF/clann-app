/**
 * ⚠️ GATEWAY CLANN - SERVIDOR WEB SOCKET CEGO
 * 
 * PRINCÍPIO FUNDAMENTAL: O Gateway é CEGO
 * - Não lê conteúdo das mensagens
 * - Não armazena chaves de criptografia
 * - Apenas roteia payloads opacos
 * 
 * 🔐 LIMITAÇÃO DE AUTENTICAÇÃO (FASE 2)
 * Atualmente: Autenticação por identificação apenas
 *   { totemId, publicKey } → identificam, mas não autenticam criptograficamente
 * 
 * 🚀 EVOLUÇÃO PLANEJADA (FASE 3):
 * 1. Challenge-response com nonce
 * 2. Assinatura digital da sessão
 * 3. Renovação periódica de tokens
 * 
 * 📨 LIMITAÇÃO DE COMUNICAÇÃO (FASE 2)
 * Atualmente: Apenas 1:1 (Totem → Totem)
 * Futuro: Broadcast eficiente para Clanns
 * 
 * ⚠️ ESTE É UM MVP - NÃO PARA PRODUÇÃO EM LARGA ESCALA
 */

import { WebSocketServer } from 'ws';
import ConnectionManager from './connectionManager.js';
import MessageQueue from './messageQueue.js';

const PORT = process.env.PORT || 8080;

// Inicializar gerenciadores
const connectionManager = new ConnectionManager();
const messageQueue = new MessageQueue();

const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 Gateway CLANN rodando na porta ${PORT}`);
console.log(`⚠️  FASE 2 - Autenticação por identificação apenas (não criptográfica)`);

// Função de autenticação (identificação)
function handleAuthentication(message, ws) {
  const { totemId, publicKey } = message.payload || {};

  // ⚠️ AVISO: Esta é APENAS identificação, não autenticação forte
  console.log(`🔑 Identificação (NÃO autenticação forte): ${totemId}`);
  console.log(`   ⚠️ QUALQUER UM com esta publicKey pode se passar por ${totemId}`);

  if (!totemId || !publicKey) {
    ws.close(4001, 'Faltam credenciais de identificação');
    return false;
  }

  // ✅ Registro para roteamento (identificação aceita)
  connectionManager.register(totemId, ws);
  ws.totemId = totemId; // Associar totemId ao WebSocket para uso posterior
  console.log(`✅ Totem identificado: ${totemId.substring(0, 15)}...`);

  // ⚠️ IMPORTANTE: Não há verificação criptográfica aqui
  // Na Fase 3, adicionar:
  // 1. Enviar challenge com nonce
  // 2. Esperar assinatura do challenge
  // 3. Validar assinatura com publicKey

  // Entregar mensagens pendentes
  const pending = messageQueue.getPending(totemId);
  if (pending.length > 0) {
    console.log(`   📨 Entregando ${pending.length} mensagens pendentes`);
    pending.forEach(msg => {
      ws.send(JSON.stringify(msg));
    });
  }

  // Enviar confirmação de autenticação
  ws.send(JSON.stringify({
    type: 'auth_success',
    payload: { totemId }
  }));

  return true;
}

wss.on('connection', (ws, request) => {
  console.log('🔗 Nova conexão estabelecida');

  // DEBUG: Logar IP de origem
  const clientIp = request.socket.remoteAddress;
  console.log(`   📍 Origem: ${clientIp}`);
  
  // Variável para controlar se já autenticou
  let isAuthenticated = false;
  let currentTotemId = null;

  // Handler para TODAS as mensagens desta conexão
  ws.on('message', (rawData) => {
    try {
      const dataString = rawData.toString();
      console.log(`📨 Dados recebidos (${dataString.length} bytes):`);
      console.log(`   "${dataString}"`);
      
      const message = JSON.parse(dataString);
      console.log('📦 JSON parseado com sucesso');
      console.log('   Tipo:', message.type);
      
      // PRIMEIRA MENSAGEM DEVE SER 'auth'
      if (!isAuthenticated) {
        if (message.type === 'auth') {
          console.log('🔑 Tentativa de identificação');
          
          const { totemId, publicKey } = message.payload || {};
          
          console.log('   TotemId recebido:', totemId);
          console.log('   PublicKey recebida:', publicKey ? 'SIM' : 'NÃO');
          
          // Usar função de autenticação refatorada
          if (handleAuthentication(message, ws)) {
            currentTotemId = totemId;
            isAuthenticated = true;
          }
          
        } else {
          console.log(`❌ Primeira mensagem não é 'auth', é: ${message.type}`);
          console.log('   Fechando conexão não autenticada');
          ws.close(4002, 'Autenticação requerida primeiro');
        }
        
      } else {
        // Já autenticado - processar mensagens normais
        console.log(`🔄 Totem ${currentTotemId.substring(0, 10)}... enviou: ${message.type}`);
        
        if (message.type === 'relay') {
          handleRouting.call(ws, rawData);
        } else {
          console.warn(`⚠️ Tipo de mensagem desconhecido após auth: ${message.type}`);
        }
      }
      
    } catch (error) {
      console.error('❌ ERRO CRÍTICO no processamento:');
      console.error('   Mensagem:', error.message);
      console.error('   Stack:', error.stack);
      
      if (!isAuthenticated) {
        ws.close(4000, 'Formato de mensagem inválido');
      }
    }
  });

  // Handler para desconexão
  ws.on('close', (code, reason) => {
    console.log(`👋 Conexão fechada: ${currentTotemId || 'não autenticada'} | Código: ${code} | Razão: ${reason}`);
    
    if (currentTotemId) {
      connectionManager.unregister(ws);
    }
  });

  // Handler para erros
  ws.on('error', (error) => {
    console.error(`💥 ERRO na conexão ${currentTotemId || 'desconhecida'}:`, error.message);
  });
});

// Função de roteamento de mensagens
function handleRouting(rawData) {
  try {
    const message = JSON.parse(rawData.toString());
    
    // VALIDAÇÃO: A mensagem deve ter esta estrutura
    if (!message.type || message.type !== 'relay' || !message.payload) {
      console.warn(`⚠️ [${this.totemId?.substring(0, 10)}...] Mensagem com formato inválido, ignorando.`);
      return;
    }

    const { clannId, recipientTotemId, encryptedPayload, messageId } = message.payload;

    // 🔥 PRINCÍPIO DO GATEWAY CEGO:
    // NÃO validamos/conhecemos o conteúdo de `encryptedPayload`
    // Apenas roteamos o pacote opaco

    // Estrutura da mensagem a ser retransmitida
    const relayMessage = {
      type: 'message',
      payload: {
        clannId,
        senderTotemId: this.totemId, // Usar totemId da conexão
        encryptedPayload, // Dados criptografados (opaco para nós)
        messageId,
        timestamp: Date.now()
      }
    };

    console.log(`📤 [${this.totemId?.substring(0, 10)}... → ${recipientTotemId?.substring(0, 10)}...] Roteando mensagem ${messageId}`);

    // 1. Tentar entregar diretamente se o destinatário estiver online
    const recipientWs = connectionManager.getConnection(recipientTotemId);
    
    if (recipientWs && recipientWs.readyState === 1) { // WebSocket.OPEN = 1
      recipientWs.send(JSON.stringify(relayMessage));
      console.log(`   ✅ Entregue diretamente para ${recipientTotemId.substring(0, 10)}...`);
      
      // Confirmar entrega ao remetente
      this.send(JSON.stringify({
        type: 'status',
        payload: {
          messageId,
          status: 'delivered',
          recipient: recipientTotemId
        }
      }));
    } else {
      // 2. Destinatário offline -> colocar na fila
      messageQueue.addToQueue(recipientTotemId, relayMessage);
      console.log(`   💾 Armazenada para ${recipientTotemId.substring(0, 10)}... (offline)`);
      
      // Notificar o remetente sobre o status (opcional)
      this.send(JSON.stringify({
        type: 'status',
        payload: {
          messageId,
          status: 'pending',
          recipient: recipientTotemId
        }
      }));
    }

  } catch (error) {
    console.error(`❌ [${this.totemId?.substring(0, 10)}...] Erro no roteamento:`, error.message);
  }
}

// Limpeza periódica da fila (a cada hora)
setInterval(() => {
  messageQueue.cleanup();
  console.log('🧹 Limpeza periódica da fila executada');
}, 60 * 60 * 1000);

