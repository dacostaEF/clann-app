# 📋 CHECKLIST DE IMPLEMENTAÇÃO - CLANN
## Para URL/Internet e Próximo Passo: APP CLANN

**Baseado em:** MANIFESTO_TECNICO_CLANN.md  
**Data:** 2025  
**Versão:** 1.0

---

## 🎯 OPINIÃO SOBRE O PROJETO

### ✅ **PONTOS FORTES**

1. **Arquitetura Revolucionária**
   - Soberania digital real (Totem local)
   - Gateway como transporte cego (sem autenticação)
   - Validação sempre local (não no servidor)
   - **Isso é diferente de 99% dos apps WEB2**

2. **Manifesto Técnico Sólido**
   - Princípios claros e imutáveis
   - Teste de conformidade bem definido
   - Proibições absolutas bem documentadas

3. **Base Local Completa**
   - Totem funcionando 100%
   - CLANN local completo
   - Chat local funcional
   - Segurança avançada

### ⚠️ **DESAFIOS**

1. **Gateway Incompleto**
   - Apenas endpoint de convites
   - Falta WebSocket para mensagens
   - Falta roteamento de mensagens

2. **Integração Cliente-Gateway**
   - Cliente ainda não envia/recebe via Gateway
   - Assinaturas não estão sendo enviadas
   - Validação de assinaturas não implementada

3. **Preparação para APP**
   - Precisa garantir compatibilidade mobile
   - Testes em dispositivos reais
   - Performance e bateria

---

## 📦 FASE 1: GATEWAY COMPLETO (URL/INTERNET)

### 🎯 **OBJETIVO**
Criar Gateway que roteia mensagens entre dispositivos via URL/Internet, mantendo 100% de conformidade com o Manifesto Técnico.

---

### ✅ **CHECKLIST: ESTRUTURA DO GATEWAY**

#### **1.1: Backend Básico (JÁ EXISTE PARCIALMENTE)**
- [x] ✅ Diretório `gateway/` criado
- [x] ✅ `package.json` configurado
- [x] ✅ Express + CORS configurado
- [x] ✅ Endpoint `/invite/:code` funcionando
- [ ] ❌ WebSocket (Socket.io) instalado e configurado
- [ ] ❌ Banco de dados (SQLite) configurado
- [ ] ❌ Estrutura de pastas completa:
  ```
  gateway/
  ├── server.js (✅ existe)
  ├── package.json (✅ existe)
  ├── config/
  │   └── database.js (❌ criar)
  ├── routes/
  │   ├── messages.js (❌ criar)
  │   └── invites.js (✅ parcial - mover lógica)
  ├── websocket/
  │   └── socketHandler.js (❌ criar)
  └── models/
      ├── Message.js (❌ criar)
      └── Invite.js (❌ criar)
  ```

#### **1.2: Banco de Dados (CRÍTICO)**
- [ ] ❌ Criar tabela `messages`:
  ```sql
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clannId TEXT NOT NULL,
    fromTotemId TEXT NOT NULL,
    payload TEXT NOT NULL,  -- JSON criptografado (opaco)
    signature TEXT NOT NULL, -- Assinatura (não validada pelo Gateway)
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
  **🔒 REGRA:** Gateway NÃO lê conteúdo do payload

- [ ] ❌ Criar tabela `invites`:
  ```sql
  CREATE TABLE invites (
    code TEXT PRIMARY KEY,
    clannId TEXT NOT NULL,
    valid BOOLEAN DEFAULT 1,
    expiresAt DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
  **🔒 REGRA:** Gateway NÃO valida Totem do convidado

- [ ] ❌ Criar tabela `clan_connections`:
  ```sql
  CREATE TABLE clan_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clannId TEXT NOT NULL,
    totemId TEXT NOT NULL,
    connectedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(clannId, totemId)
  );
  ```
  **🔒 REGRA:** Apenas para roteamento, não autenticação

- [ ] ❌ **VERIFICAR:** Nenhuma tabela de `users`, `sessions`, `auth_tokens`

#### **1.3: API REST (3 ENDPOINTS OBRIGATÓRIOS)**

##### **POST /messages** (CRÍTICO)
- [ ] ❌ Recebe: `{ clannId, fromTotemId, payload, signature, timestamp }`
- [ ] ❌ Roteia mensagem para todos Totens conectados ao `clannId` via WebSocket
- [ ] ❌ Salva no banco (apenas para Premium - persistência temporária)
- [ ] ❌ **NÃO valida assinatura**
- [ ] ❌ **NÃO autentica usuário**
- [ ] ❌ **NÃO lê conteúdo do payload**

##### **GET /messages/:clannId** (APENAS PREMIUM)
- [ ] ❌ Retorna mensagens criptografadas do `clannId`
- [ ] ❌ Gateway retorna payload opaco (não descriptografa)
- [ ] ❌ Filtro por timestamp (últimas N mensagens)
- [ ] ❌ **NÃO valida quem está pedindo**
- [ ] ❌ **NÃO autentica requisição**

##### **POST /invites/validate** (JÁ EXISTE COMO GET /invite/:code)
- [x] ✅ Valida código de convite
- [x] ✅ Retorna `clannId` e dados públicos
- [x] ✅ Verifica expiração
- [ ] ⚠️ **MELHORAR:** Mover para banco de dados (não hardcoded)
- [ ] ⚠️ **MELHORAR:** Adicionar criação de convites via API

#### **1.4: WebSocket (CRÍTICO PARA TEMPO REAL)**

##### **Conexão WebSocket**
- [ ] ❌ Instalar `socket.io` no Gateway
- [ ] ❌ Criar handler de conexão:
  ```javascript
  io.on('connection', (socket) => {
    // Zero autenticação
    // Cliente envia: { clannId, totemId }
    // Gateway registra conexão
  });
  ```

##### **Eventos WebSocket**

###### **Evento: `join_clann`**
- [ ] ❌ Cliente envia: `{ clannId, totemId }`
- [ ] ❌ Gateway registra conexão em `clan_connections`
- [ ] ❌ Gateway adiciona socket à sala `clannId`
- [ ] ❌ **NÃO valida Totem**
- [ ] ❌ **NÃO autentica**

###### **Evento: `message`**
- [ ] ❌ Cliente envia: `{ clannId, fromTotemId, payload, signature, timestamp }`
- [ ] ❌ Gateway encaminha para todos sockets na sala `clannId`
- [ ] ❌ Gateway salva no banco (se Premium)
- [ ] ❌ **NÃO valida assinatura**
- [ ] ❌ **NÃO valida permissões**

###### **Evento: `typing`** (OPCIONAL)
- [ ] ❌ Cliente envia: `{ clannId, fromTotemId, isTyping }`
- [ ] ❌ Gateway encaminha para sala `clannId`
- [ ] ❌ **NÃO valida nada**

###### **Evento: `online`** (OPCIONAL)
- [ ] ❌ Cliente envia: `{ clannId, totemId, isOnline }`
- [ ] ❌ Gateway encaminha para sala `clannId`
- [ ] ❌ **NÃO valida nada**

##### **Desconexão**
- [ ] ❌ Remover de `clan_connections` ao desconectar
- [ ] ❌ Remover socket da sala

---

## 📱 FASE 2: INTEGRAÇÃO CLIENTE-GATEWAY

### 🎯 **OBJETIVO**
Cliente envia/recebe mensagens via Gateway, mantendo validação local.

---

### ✅ **CHECKLIST: SERVIÇO DE GATEWAY (CLIENTE)**

#### **2.1: GatewayService.js** (CRIAR)
- [ ] ❌ Criar `src/services/GatewayService.js`
- [ ] ❌ Configurar URL do Gateway (variável de ambiente)
- [ ] ❌ Implementar conexão WebSocket:
  ```javascript
  connect(clannId, totemId) {
    // Conecta ao Gateway
    // Envia join_clann
    // Escuta eventos
  }
  ```

#### **2.2: Envio de Mensagens**
- [ ] ❌ Função `sendMessage(message, totem)`:
  - Assina mensagem localmente
  - Envia via WebSocket
  - Fallback para POST /messages se WebSocket falhar
- [ ] ❌ **CRÍTICO:** Assinatura sempre local (não no Gateway)

#### **2.3: Recebimento de Mensagens**
- [ ] ❌ Escutar evento `message` do WebSocket
- [ ] ❌ Validar assinatura localmente
- [ ] ❌ Verificar se `fromTotemId` está na lista local de membros
- [ ] ❌ Descartar mensagens inválidas
- [ ] ❌ Adicionar mensagens válidas ao storage local

#### **2.4: Reconexão Automática**
- [ ] ❌ Detectar desconexão
- [ ] ❌ Tentar reconectar automaticamente
- [ ] ❌ Manter fila de mensagens pendentes
- [ ] ❌ Fallback para polling se WebSocket não disponível

---

## ✍️ FASE 3: ASSINATURA DE MENSAGENS

### 🎯 **OBJETIVO**
Totem assina mensagens antes de enviar. Receptor valida localmente.

---

### ✅ **CHECKLIST: ASSINATURA E VALIDAÇÃO**

#### **3.1: Assinatura no Cliente**
- [ ] ❌ Criar função `signMessage(totem, message)` em `src/crypto/totem.js`:
  ```javascript
  export function signMessage(totem, message) {
    const messageHash = sha256(JSON.stringify(message));
    const signature = sign(messageHash, totem.privateKey);
    return signature;
  }
  ```

#### **3.2: Integração no MessagesManager**
- [ ] ❌ Modificar `addMessage()` para assinar antes de enviar
- [ ] ❌ Incluir assinatura no envelope:
  ```javascript
  {
    clannId: string,
    fromTotemId: string,
    payload: string, // Mensagem criptografada
    signature: string,
    timestamp: number
  }
  ```

#### **3.3: Validação no Receptor**
- [ ] ❌ Criar função `verifyMessage(message, fromTotemId)` em `src/crypto/totem.js`:
  ```javascript
  export async function verifyMessage(message, fromTotemId) {
    // 1. Buscar chave pública do fromTotemId (local)
    // 2. Verificar assinatura
    // 3. Verificar se fromTotemId está na lista de membros
    // 4. Retornar true/false
  }
  ```
- [ ] ❌ Integrar validação no recebimento de mensagens
- [ ] ❌ Descartar mensagens inválidas (log local apenas)

---

## 🧪 FASE 4: TESTES DE CONFORMIDADE

### 🎯 **OBJETIVO**
Garantir 100% de conformidade com Manifesto Técnico.

---

### ✅ **CHECKLIST: TESTE DE CONFORMIDADE**

#### **4.1: Testes Obrigatórios**
- [ ] ❌ **Teste 1:** Totem funciona completamente offline?
  - Criar Totem sem internet
  - Validar Totem sem internet
  - **Resultado esperado:** ✅ SIM

- [ ] ❌ **Teste 2:** Servidor pode cair sem afetar identidade?
  - Desligar Gateway
  - Totem continua funcionando localmente
  - **Resultado esperado:** ✅ SIM

- [ ] ❌ **Teste 3:** Servidor nunca conhece PIN?
  - Verificar logs do Gateway
  - Verificar banco de dados
  - **Resultado esperado:** ✅ NUNCA

- [ ] ❌ **Teste 4:** Servidor nunca valida assinatura?
  - Enviar mensagem com assinatura inválida
  - Gateway deve rotear mesmo assim
  - **Resultado esperado:** ✅ NUNCA

- [ ] ❌ **Teste 5:** Servidor nunca autentica usuário?
  - Verificar código do Gateway
  - Não deve haver middleware de autenticação
  - **Resultado esperado:** ✅ NUNCA

- [ ] ❌ **Teste 6:** Governança funciona localmente?
  - Aplicar regra de governança
  - Desligar Gateway
  - Regra deve continuar funcionando
  - **Resultado esperado:** ✅ SIM

- [ ] ❌ **Teste 7:** Mensagens são validadas pelo receptor?
  - Enviar mensagem com assinatura inválida
  - Receptor deve descartar localmente
  - Gateway não deve rejeitar
  - **Resultado esperado:** ✅ SIM

---

## 📱 FASE 5: PREPARAÇÃO PARA APP CLANN

### 🎯 **OBJETIVO**
Garantir que o sistema funcione perfeitamente em app mobile.

---

### ✅ **CHECKLIST: APP CLANN**

#### **5.1: Compatibilidade Mobile**
- [ ] ❌ Testar em iOS (Expo)
- [ ] ❌ Testar em Android (Expo)
- [ ] ❌ Verificar SecureStore funcionando
- [ ] ❌ Verificar SQLite funcionando
- [ ] ❌ Verificar WebSocket em mobile

#### **5.2: Performance**
- [ ] ❌ Otimizar queries SQLite
- [ ] ❌ Implementar paginação de mensagens
- [ ] ❌ Lazy loading de mensagens antigas
- [ ] ❌ Cache de chaves públicas de Totens

#### **5.3: Bateria e Recursos**
- [ ] ❌ WebSocket com keep-alive otimizado
- [ ] ❌ Desconectar quando app em background
- [ ] ❌ Reconectar quando app volta ao foreground
- [ ] ❌ Limitar sincronização em background

#### **5.4: Notificações Push**
- [ ] ❌ Configurar expo-notifications
- [ ] ❌ Gateway envia notificação quando mensagem chega
- [ ] ❌ Notificação local se Gateway offline
- [ ] ❌ Badge de não lidas

#### **5.5: Permissões Mobile**
- [ ] ❌ Solicitar permissão de notificações
- [ ] ❌ Solicitar permissão de câmera (para mídia)
- [ ] ❌ Solicitar permissão de galeria (para mídia)
- [ ] ❌ Solicitar permissão de microfone (para áudio)

#### **5.6: Build e Deploy**
- [ ] ❌ Configurar EAS Build (Expo)
- [ ] ❌ Build para iOS (TestFlight)
- [ ] ❌ Build para Android (Play Store)
- [ ] ❌ Configurar variáveis de ambiente
- [ ] ❌ Configurar URL do Gateway em produção

---

## 🚨 REGRAS DE OURO (SEMPRE VERIFICAR)

Antes de implementar QUALQUER coisa, responder:

1. ✅ **Totem funciona offline?**
2. ✅ **Servidor pode cair sem afetar identidade?**
3. ✅ **Servidor nunca conhece PIN?**
4. ✅ **Servidor nunca valida assinatura?**
5. ✅ **Servidor nunca autentica usuário?**
6. ✅ **Governança funciona localmente?**
7. ✅ **Mensagens são validadas pelo receptor?**

**Se QUALQUER resposta for "NÃO", NÃO IMPLEMENTAR.**

---

## 📊 PRIORIZAÇÃO

### **🔴 CRÍTICO (Fazer Primeiro)**
1. WebSocket no Gateway
2. GatewayService no Cliente
3. Assinatura de mensagens
4. Validação de assinaturas
5. Testes de conformidade

### **🟡 IMPORTANTE (Fazer Depois)**
1. Banco de dados completo
2. Persistência Premium
3. Reconexão automática
4. Fallback para polling

### **🟢 OPCIONAL (Fazer Por Último)**
1. Notificações push
2. Mídia (fotos/vídeos)
3. Perfis de usuário
4. Busca de mensagens

---

## 🎯 RESULTADO ESPERADO

Após completar Fases 1-4:

✅ **CLANN totalmente funcional entre dispositivos via URL/Internet**  
✅ **Soberania digital 100% preservada**  
✅ **Gateway como transporte cego (zero autenticação)**  
✅ **Validação sempre local**  
✅ **Conformidade total com Manifesto Técnico**  
✅ **Pronto para APP CLANN**

---

## 📚 REFERÊNCIAS

- **MANIFESTO_TECNICO_CLANN.md** - Constituição técnica (OBRIGATÓRIO)
- **ROADMAP_IMPLEMENTACAO_CLANN.md** - Plano detalhado
- **SEQUENCIA_DETALHADA_IMPLEMENTACAO.md** - Passo a passo
- **gateway/server.js** - Gateway atual (parcial)

---

**Frase-âncora para todas as decisões:**

> *"No CLANN, o servidor não confia em ninguém — e ninguém confia no servidor."*

---

**Fim do Checklist de Implementação**

