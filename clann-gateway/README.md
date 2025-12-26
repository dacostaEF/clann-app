# Gateway CLANN - DOSE 1

Backend WebSocket mínimo para aceitar conexões do app CLANN.

## 🚀 Como rodar

```bash
node index.js
```

O servidor iniciará na porta 8080 (ou na porta definida pela variável `PORT`).

## 📋 Configuração do App CLANN

No arquivo `.env` do projeto CLANN, adicione:

```
EXPO_PUBLIC_GATEWAY_URL=ws://SEU_IP_LOCAL:8080
```

**⚠️ IMPORTANTE:** Use o IP local da sua máquina, não `localhost` (para funcionar no celular).

Exemplo:
```
EXPO_PUBLIC_GATEWAY_URL=ws://192.168.15.90:8080
```

## ✅ Validação

Quando o app CLANN conectar, você verá no terminal:

```
🟢 Cliente conectado: <IP_DO_CELULAR>
```

## 🛑 Escopo DOSE 1

- ✅ Aceita conexões WebSocket
- ✅ Envia mensagem de boas-vindas
- ✅ Loga mensagens recebidas
- ❌ Sem autenticação
- ❌ Sem lógica de negócio
- ❌ Sem persistência

