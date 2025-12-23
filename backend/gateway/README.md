# Gateway CLANN - WebSocket Cego

Gateway mínimo para roteamento de mensagens criptografadas entre Totems.

## 🚀 Iniciar

```bash
npm install
npm start
```

## 🔐 Princípios

- **Gateway Cego**: Não descriptografa, não interpreta conteúdo
- **Apenas Roteamento**: Encaminha payloads criptografados
- **Fila Volátil**: Mensagens offline em memória (TTL 24h)
- **Sem Persistência**: Reiniciar o servidor perde mensagens pendentes

## 📡 Protocolo

### Autenticação
```json
{
  "type": "auth",
  "payload": {
    "totemId": "...",
    "publicKey": "..."
  }
}
```

### Enviar Mensagem
```json
{
  "type": "relay",
  "payload": {
    "clannId": "...",
    "recipientTotemId": "...",
    "encryptedPayload": "...",
    "messageId": "..."
  }
}
```

### Receber Mensagem
```json
{
  "type": "message",
  "payload": {
    "clannId": "...",
    "senderTotemId": "...",
    "encryptedPayload": "...",
    "messageId": "...",
    "timestamp": 1234567890
  }
}
```

## ⚙️ Variáveis de Ambiente

- `PORT`: Porta do servidor (padrão: 8080)

