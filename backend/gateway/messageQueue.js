// Armazenamento em memória VOLÁTIL (reinicia com o servidor)
// Para produção, substituir por Redis ou banco
const messageQueues = new Map();
const MESSAGE_TTL = 24 * 60 * 60 * 1000; // 24 horas

class MessageQueue {
  addToQueue(recipientTotemId, message) {
    if (!messageQueues.has(recipientTotemId)) {
      messageQueues.set(recipientTotemId, []);
    }
    
    const queue = messageQueues.get(recipientTotemId);
    queue.push({
      ...message,
      storedAt: Date.now()
    });
    
    // Limpar mensagens antigas
    this.cleanup();
  }

  getPending(recipientTotemId) {
    if (!messageQueues.has(recipientTotemId)) {
      return [];
    }
    
    const queue = messageQueues.get(recipientTotemId);
    messageQueues.delete(recipientTotemId); // Limpar após entrega
    
    // Filtrar mensagens não expiradas
    const now = Date.now();
    return queue.filter(msg => now - msg.storedAt < MESSAGE_TTL);
  }

  cleanup() {
    const now = Date.now();
    for (const [totemId, queue] of messageQueues.entries()) {
      const filtered = queue.filter(msg => now - msg.storedAt < MESSAGE_TTL);
      if (filtered.length === 0) {
        messageQueues.delete(totemId);
      } else {
        messageQueues.set(totemId, filtered);
      }
    }
  }
}

export default MessageQueue;

