# 📋 SEQUÊNCIA DETALHADA DE IMPLEMENTAÇÃO - CLANN
## Passo a Passo para Conclusão do Projeto

**Versão:** 1.0  
**Data:** 2025  
**Baseado em:** ROADMAP_IMPLEMENTACAO_CLANN.md + MANIFESTO_TECNICO_CLANN.md

---

## 🎯 OBJETIVO FINAL

Ter um CLANN totalmente funcional (Web + App) onde:
- ✅ Totens conversam entre dispositivos diferentes
- ✅ Soberania digital preservada (Totem local)
- ✅ Gateway como transporte cego (sem autenticação)
- ✅ Validação sempre local (assinaturas)

---

## 📦 FASE 1: GATEWAY CLANN (Backend)

### **ETAPA 1.1: Criar Estrutura do Backend**

#### **Passo 1.1.1: Criar Diretório e Configuração Inicial**
```
1. Criar pasta backend/ na raiz do projeto
2. Criar backend/package.json com:
   - express
   - socket.io
   - sqlite3 (ou postgresql)
   - cors
   - dotenv
3. Criar backend/.env com:
   - PORT=3000
   - NODE_ENV=development
   - DATABASE_PATH=./data/clann.db
```

#### **Passo 1.1.2: Criar Estrutura de Pastas**
```
backend/
├── server.js              # Servidor principal
├── package.json
├── .env
├── .gitignore
├── config/
│   └── database.js        # Configuração do banco
├── routes/
│   ├── messages.js       # Rotas de mensagens
│   └── invites.js        # Rotas de convites
├── websocket/
│   └── socketHandler.js  # Handler WebSocket
├── models/
│   ├── Message.js        # Modelo de mensagem
│   └── Invite.js         # Modelo de convite
└── data/
    └── clann.db          # Banco SQLite (criado automaticamente)
```

**Arquivos a criar:**
- `backend/server.js`
- `backend/config/database.js`
- `backend/routes/messages.js`
- `backend/routes/invites.js`
- `backend/websocket/socketHandler.js`

---

### **ETAPA 1.2: Banco de Dados (Mínimo)**

#### **Passo 1.2.1: Configurar Banco de Dados**
**Arquivo:** `backend/config/database.js`

```javascript
// Estrutura mínima do banco
// Tabelas:
// 1. messages - apenas para roteamento
// 2. invites - validação de convites
// 3. clan_connections - Totens conectados

// IMPORTANTE: Nenhuma tabela de usuários/autenticação
```

**Tabelas necessárias:**
1. **messages**
   - `id` (INTEGER PRIMARY KEY)
   - `clannId` (TEXT) - para roteamento
   - `fromTotemId` (TEXT) - público, não verificado
   - `payload` (TEXT) - opaco, criptografado
   - `signature` (TEXT) - não validada pelo Gateway
   - `timestamp` (INTEGER)

2. **invites**
   - `code` (TEXT PRIMARY KEY)
   - `clannId` (TEXT)
   - `valid` (INTEGER) - 0 ou 1
   - `expiresAt` (INTEGER) - opcional

3. **clan_connections**
   - `clannId` (TEXT)
   - `totemId` (TEXT)
   - `connectedAt` (INTEGER)
   - UNIQUE(clannId, totemId)

---

### **ETAPA 1.3: API REST (3 Endpoints)**

#### **Passo 1.3.1: POST /messages**
**Arquivo:** `backend/routes/messages.js`

**Funcionalidade:**
- Recebe: `{ clannId, fromTotemId, payload, signature, timestamp }`
- Roteia para Totens conectados ao `clannId` via WebSocket
- Não valida assinatura
- Não autentica usuário
- Apenas encaminha

**Código base:**
```javascript
router.post('/', async (req, res) => {
  const { clannId, fromTotemId, payload, signature, timestamp } = req.body;
  
  // Validar campos obrigatórios
  if (!clannId || !fromTotemId || !payload) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }
  
  // Encaminhar via WebSocket para Totens do clannId
  // (implementar no socketHandler)
  
  res.json({ success: true });
});
```

#### **Passo 1.3.2: GET /messages/:clannId** (Premium)
**Arquivo:** `backend/routes/messages.js`

**Funcionalidade:**
- Retorna mensagens criptografadas (payload opaco)
- Gateway não lê conteúdo
- Apenas para CLANN Premium
- Persistência temporária

#### **Passo 1.3.3: POST /invites/validate**
**Arquivo:** `backend/routes/invites.js`

**Funcionalidade:**
- Recebe: `{ code }`
- Verifica se código existe e está válido
- Retorna: `{ clannId }` ou erro
- Não valida Totem
- Não autentica usuário

**Código base:**
```javascript
router.post('/validate', async (req, res) => {
  const { code } = req.body;
  
  // Buscar convite no banco
  const invite = await db.get('SELECT * FROM invites WHERE code = ? AND valid = 1', [code]);
  
  if (!invite) {
    return res.status(404).json({ error: 'Código inválido' });
  }
  
  // Verificar expiração (se houver)
  if (invite.expiresAt && invite.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Código expirado' });
  }
  
  // Retornar clannId
  res.json({ clannId: invite.clannId });
});
```

---

### **ETAPA 1.4: WebSocket (Roteamento)**

#### **Passo 1.4.1: Configurar WebSocket**
**Arquivo:** `backend/websocket/socketHandler.js`

**Funcionalidade:**
- Conectar Totens ao `clannId`
- Rotear mensagens para Totens conectados
- Eventos: `message`, `typing`, `online`
- Zero autenticação, zero sessão

**Código base:**
```javascript
// Mapa de conexões: clannId -> Set<socketId>
const connections = new Map();

io.on('connection', (socket) => {
  // Totem se conecta a um CLANN
  socket.on('join_clann', ({ clannId, totemId }) => {
    if (!connections.has(clannId)) {
      connections.set(clannId, new Set());
    }
    connections.get(clannId).add(socket.id);
    socket.clannId = clannId;
    socket.totemId = totemId;
  });
  
  // Receber mensagem e rotear
  socket.on('message', (data) => {
    const { clannId, fromTotemId, payload, signature } = data;
    
    // Encaminhar para todos os Totens do clannId (exceto o remetente)
    const clanSockets = connections.get(clannId) || new Set();
    clanSockets.forEach(socketId => {
      if (socketId !== socket.id) {
        io.to(socketId).emit('new_message', {
          clannId,
          fromTotemId,
          payload,
          signature,
          timestamp: Date.now()
        });
      }
    });
  });
  
  // Desconexão
  socket.on('disconnect', () => {
    if (socket.clannId) {
      const clanSockets = connections.get(socket.clannId);
      if (clanSockets) {
        clanSockets.delete(socket.id);
      }
    }
  });
});
```

---

## 📦 FASE 2: ASSINATURA DE MENSAGENS

### **ETAPA 2.1: Assinatura no Cliente**

#### **Passo 2.1.1: Criar Função de Assinatura**
**Arquivo:** `src/crypto/totem.js`

**Adicionar função:**
```javascript
/**
 * Assina uma mensagem com a chave privada do Totem
 * @param {Object} totem - Objeto Totem completo
 * @param {string} message - Mensagem a assinar
 * @returns {string} Assinatura em hex
 */
export function signMessage(totem, message) {
  // Usar chave privada do Totem
  // Assinar mensagem
  // Retornar assinatura em hex
}
```

#### **Passo 2.1.2: Integrar no MessagesManager**
**Arquivo:** `src/messages/MessagesManager.js`

**Modificar `addMessage()`:**
```javascript
async addMessage(clanId, authorTotem, text, options = {}) {
  // ... validações existentes ...
  
  // Assinar mensagem antes de enviar
  const totem = await loadTotemSecure();
  const signature = signMessage(totem, text);
  
  // Incluir assinatura no envelope
  const envelope = {
    clannId: parseInt(clanId),
    fromTotemId: authorTotem,
    payload: encryptedText,
    signature: signature,
    timestamp: Date.now()
  };
  
  // Enviar ao Gateway (Fase 3)
  // Salvar localmente (manter compatibilidade)
}
```

---

### **ETAPA 2.2: Validação no Receptor**

#### **Passo 2.2.1: Criar Função de Validação**
**Arquivo:** `src/crypto/totem.js`

**Adicionar função:**
```javascript
/**
 * Valida assinatura de mensagem
 * @param {string} message - Mensagem original
 * @param {string} signature - Assinatura em hex
 * @param {string} fromTotemId - ID do Totem remetente
 * @param {string} publicKey - Chave pública do remetente
 * @returns {boolean} True se assinatura válida
 */
export function verifyMessage(message, signature, fromTotemId, publicKey) {
  // Validar assinatura usando chave pública
  // Retornar true/false
}
```

#### **Passo 2.2.2: Integrar Validação no Receptor**
**Arquivo:** `src/messages/MessagesManager.js`

**Modificar `getMessages()`:**
```javascript
async getMessages(clanId) {
  // ... código existente ...
  
  // Para cada mensagem recebida:
  // 1. Obter chave pública do fromTotemId (lista local de membros)
  // 2. Validar assinatura
  // 3. Se inválida, descartar localmente
  // 4. Se válida, processar normalmente
}
```

---

## 📦 FASE 3: INTEGRAÇÃO CLIENTE-GATEWAY

### **ETAPA 3.1: Serviço de Gateway (Cliente)**

#### **Passo 3.1.1: Criar GatewayService**
**Arquivo:** `src/services/GatewayService.js` (NOVO)

**Funcionalidade:**
- Conexão WebSocket
- Envio de mensagens assinadas
- Recebimento de mensagens
- Reconexão automática
- Zero autenticação

**Estrutura:**
```javascript
class GatewayService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }
  
  connect() {
    // Conectar WebSocket
    // Sem autenticação
  }
  
  sendMessage(envelope) {
    // Enviar mensagem assinada
  }
  
  onMessage(handler) {
    // Escutar novas mensagens
  }
  
  joinClann(clannId, totemId) {
    // Conectar ao CLANN
  }
}
```

#### **Passo 3.1.2: Integrar no MessagesManager**
**Arquivo:** `src/messages/MessagesManager.js`

**Modificar `addMessage()`:**
```javascript
async addMessage(clanId, authorTotem, text, options = {}) {
  // ... código existente ...
  
  // Enviar ao Gateway
  GatewayService.sendMessage(envelope);
  
  // Salvar localmente (fallback)
  await this.storage.addMessage(...);
}
```

#### **Passo 3.1.3: Integrar Recebimento**
**Arquivo:** `src/screens/ClanChatScreen.js`

**Adicionar:**
```javascript
useEffect(() => {
  // Escutar mensagens do Gateway
  GatewayService.onMessage((envelope) => {
    if (envelope.clannId === clan?.id) {
      // Validar assinatura localmente
      // Adicionar à lista de mensagens
    }
  });
}, [clan?.id]);
```

---

### **ETAPA 3.2: Integração no JoinClanScreen**

#### **Passo 3.2.1: Modificar Validação de Convite**
**Arquivo:** `src/screens/JoinClanScreen.js`

**Modificar `handleJoinByCode()`:**
```javascript
const handleJoinByCode = async () => {
  // ... código existente ...
  
  // Validar convite no Gateway
  const response = await fetch(`${GATEWAY_URL}/invites/validate`, {
    method: 'POST',
    body: JSON.stringify({ code })
  });
  
  const { clannId } = await response.json();
  
  // Adicionar membro localmente
  await ClanStorage.joinClan(clannId, totemId);
  
  // Conectar ao CLANN via WebSocket
  GatewayService.joinClann(clannId, totemId);
};
```

---

## 📦 FASE 4: AJUSTES E REFINAMENTOS

### **ETAPA 4.1: Revisão de Conformidade**

#### **Checklist de Conformidade:**
- [ ] Totem funciona offline? ✅
- [ ] Servidor pode cair sem afetar identidade? ✅
- [ ] Servidor nunca conhece PIN? ✅
- [ ] Servidor nunca valida assinatura? ✅
- [ ] Servidor nunca autentica usuário? ✅
- [ ] Governança funciona localmente? ✅
- [ ] Mensagens são validadas pelo receptor? ✅

---

## 📋 ORDEM DE EXECUÇÃO

### **Semana 1-2: Fase 1 (Gateway)**
1. Criar estrutura do backend
2. Configurar banco de dados
3. Implementar API REST (3 endpoints)
4. Implementar WebSocket
5. Testes básicos

### **Semana 3: Fase 2 (Assinatura)**
1. Criar função de assinatura
2. Integrar no MessagesManager
3. Criar função de validação
4. Integrar validação no receptor

### **Semana 4: Fase 3 (Integração)**
1. Criar GatewayService
2. Integrar envio de mensagens
3. Integrar recebimento de mensagens
4. Integrar validação de convites

### **Semana 5: Fase 4 (Ajustes)**
1. Revisão de conformidade
2. Testes de integração
3. Correções
4. Documentação

---

## 🎯 RESULTADO ESPERADO

Após completar todas as fases:

✅ **CLANN funcional entre dispositivos**  
✅ **Soberania digital preservada**  
✅ **Gateway como transporte cego**  
✅ **Validação sempre local**  
✅ **Conformidade total com Manifesto Técnico**

---

**Fim da Sequência Detalhada de Implementação**















