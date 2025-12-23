// Mapeia totemId -> WebSocket connection
const activeConnections = new Map();

class ConnectionManager {
  register(totemId, ws) {
    // Associar o totemId ao WebSocket
    ws.totemId = totemId;
    activeConnections.set(totemId, ws);
    
    console.log(`📝 [ConnectionManager] Totem registrado: ${totemId.substring(0, 15)}...`);
    console.log(`   Conexões ativas: ${activeConnections.size}`);
  }

  unregister(ws) {
    if (ws.totemId) {
      activeConnections.delete(ws.totemId);
      console.log(`📝 [ConnectionManager] Totem removido: ${ws.totemId.substring(0, 15)}...`);
      console.log(`   Conexões ativas: ${activeConnections.size}`);
    }
  }

  getConnection(totemId) {
    const connection = activeConnections.get(totemId);
    console.log(`📝 [ConnectionManager] Buscando ${totemId.substring(0, 15)}...: ${connection ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
    return connection;
  }

  isOnline(totemId) {
    const online = activeConnections.has(totemId);
    console.log(`📝 [ConnectionManager] ${totemId.substring(0, 15)}... online? ${online}`);
    return online;
  }
  
  // Método para debug
  listConnections() {
    console.log('📝 [ConnectionManager] Conexões ativas:');
    for (const [totemId, ws] of activeConnections.entries()) {
      console.log(`   - ${totemId.substring(0, 20)}... (readyState: ${ws.readyState})`);
    }
  }
}

export default ConnectionManager;

