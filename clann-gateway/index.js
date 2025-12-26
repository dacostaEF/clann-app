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
    console.log(`📨 [${clientIp}]: ${message.toString()}`);
  });

  ws.on('close', () => {
    console.log(`🔴 Cliente desconectado: ${clientIp}`);
  });

  ws.on('error', (error) => {
    console.error(`⚠️ Erro no cliente ${clientIp}:`, error);
  });
});

console.log(`🚀 Gateway CLANN rodando em ws://0.0.0.0:${PORT}`);

