import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🟢 Cliente conectado: ${clientIp}`);

  ws.send(JSON.stringify({
    type: 'WELCOME',
    status: 'connected',
    message: 'Gateway CLANN ativo'
  }));

  ws.on('message', (message) => {
    let data;

    try {
      data = JSON.parse(message.toString());
    } catch (e) {
      console.log(`📨 [${clientIp}] Mensagem não-JSON recebida`);
      return;
    }

    console.log(`📨 [${clientIp}]:`, data);

    if (data.type === 'auth') {
      console.log(`🔐 Auth recebido do Totem ${data.payload?.totemId}`);

      ws.send(JSON.stringify({
        type: 'AUTH_OK',
        status: 'accepted'
      }));

      console.log(`✅ AUTH_OK enviado`);

      // Confirmação final do Totem (DOSE 3)
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'TOTEM_READY',
          payload: {
            status: 'active'
          }
        }));

        console.log('🟣 TOTEM_READY enviado');
      }, 500);
    }
  });

  ws.on('close', () => {
    console.log(`🔴 Cliente desconectado: ${clientIp}`);
  });

  ws.on('error', (error) => {
    console.error(`⚠️ Erro no cliente ${clientIp}:`, error);
  });
});

console.log(`🚀 Gateway CLANN rodando em ws://0.0.0.0:${PORT}`);

