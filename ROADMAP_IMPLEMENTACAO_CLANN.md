# 🗺️ ROADMAP DE IMPLEMENTAÇÃO - CLANN
## Plano de Ação para Conclusão do Sistema de Soberania Digital

**Versão:** 1.0  
**Data:** 2025  
**Baseado em:** MANIFESTO_TECNICO_CLANN.md

---

## 📊 STATUS ATUAL DO PROJETO

### ✅ **O QUE JÁ ESTÁ FUNCIONANDO (100% Local)**

#### **1. TOTEM (Soberania Digital)**
- ✅ Geração de Totem (chaves criptográficas)
- ✅ Armazenamento seguro local (SecureStore)
- ✅ Validação local
- ✅ PIN local (validação, bloqueio, tentativas)
- ✅ Fluxo de onboarding completo
- ✅ Persistência local

#### **2. CLANN (Estrutura Local)**
- ✅ Criação de CLANN
- ✅ Entrada por código de convite (local)
- ✅ Armazenamento local (SQLite)
- ✅ Membros e roles
- ✅ Governança local (regras, conselho, aprovações)
- ✅ Permissões granulares

#### **3. CHAT (Local)**
- ✅ Envio/recebimento de mensagens (local)
- ✅ Interface tipo WhatsApp
- ✅ Reações em mensagens
- ✅ Editar/Deletar mensagens
- ✅ Status de entrega (local)
- ✅ Self-destruct (timer)
- ✅ Burn-after-read
- ✅ Criptografia E2E (simplificada)
- ✅ Sincronização local (polling)

#### **4. SEGURANÇA**
- ✅ Watermark invisível
- ✅ Panic Mode
- ✅ Device Trust Score
- ✅ Session Fortress
- ✅ Security Log (hash-chain)
- ✅ Self-Destruct

#### **5. PLUGINS (Estrutura)**
- ✅ Sistema de plugins
- ⚠️ MediaPlugin (estrutura, não implementado)
- ⚠️ CallsPlugin (estrutura, não implementado)
- ⚠️ PollsPlugin (estrutura, não implementado)

---

## ❌ **O QUE FALTA PARA FUNCIONAR ENTRE DISPOSITIVOS**

### **1. GATEWAY CLANN (Backend)**
- ❌ Servidor não existe
- ❌ API REST não existe
- ❌ WebSocket não existe
- ❌ Roteamento de mensagens não existe
- ❌ Validação de convites no servidor não existe

### **2. INTEGRAÇÃO CLIENTE-GATEWAY**
- ❌ Cliente não envia mensagens para Gateway
- ❌ Cliente não recebe mensagens do Gateway
- ❌ Assinatura de mensagens não está sendo enviada
- ❌ Validação de assinaturas no receptor não está implementada

### **3. FUNCIONALIDADES AVANÇADAS**
- ❌ Mídia (fotos, vídeos, áudios)
- ❌ Notificações push
- ❌ Perfis de usuário
- ❌ Busca de mensagens

---

## 🎯 FASES DE IMPLEMENTAÇÃO

---

## **FASE 1: GATEWAY CLANN (Backend)**
**Objetivo:** Criar servidor que roteia mensagens sem autenticar

**Tempo estimado:** 2-3 semanas

### **PASSO 1.1: Estrutura do Backend**
- [ ] Criar diretório `backend/`
- [ ] Configurar `package.json` (Express, Socket.io, SQLite)
- [ ] Criar estrutura de pastas:
  ```
  backend/
  ├── server.js
  ├── config/
  │   └── database.js
  ├── routes/
  │   ├── messages.js
  │   └── invites.js
  ├── websocket/
  │   └── socketHandler.js
  └── models/
      ├── Message.js
      └── Invite.js
  ```

### **PASSO 1.2: Banco de Dados (Mínimo)**
- [ ] Criar tabela `messages` (apenas para roteamento)
  - `id`, `clannId`, `fromTotemId`, `payload`, `signature`, `timestamp`
- [ ] Criar tabela `invites` (validação de convites)
  - `code`, `clannId`, `valid`, `expiresAt`
- [ ] Criar tabela `clan_connections` (Totens conectados)
  - `clannId`, `totemId`, `connectedAt`
- [ ] **IMPORTANTE:** Nenhuma tabela de usuários/autenticação

### **PASSO 1.3: API REST (3 Endpoints)**
- [ ] **POST /messages**
  - Recebe: `{ clannId, fromTotemId, payload, signature }`
  - Roteia para Totens conectados ao `clannId`
  - Não valida assinatura
  - Não autentica usuário
- [ ] **GET /messages/:clannId** (apenas Premium)
  - Retorna mensagens criptografadas (payload opaco)
  - Gateway não lê conteúdo
- [ ] **POST /invites/validate**
  - Recebe: `{ code }`
  - Verifica se código existe e está válido
  - Retorna: `{ clannId }` ou erro
  - Não valida Totem

### **PASSO 1.4: WebSocket (Roteamento)**
- [ ] Evento `message`: Recebe mensagem, encaminha para Totens do `clannId`
- [ ] Evento `typing`: Encaminha indicador de digitação (opcional)
- [ ] Evento `online`: Encaminha status online/offline (opcional)
- [ ] **IMPORTANTE:** Zero autenticação, zero sessão

### **PASSO 1.5: Testes do Gateway**
- [ ] Testar roteamento de mensagens
- [ ] Testar validação de convites
- [ ] Verificar que Gateway não valida assinaturas
- [ ] Verificar que Gateway não autentica usuários

---

## **FASE 2: ASSINATURA DE MENSAGENS**
**Objetivo:** Totem assina mensagens antes de enviar

**Tempo estimado:** 3-5 dias

### **PASSO 2.1: Assinatura no Cliente**
- [ ] Criar função `signMessage(totem, message)` em `src/crypto/totem.js`
- [ ] Usar chave privada do Totem para assinar
- [ ] Incluir assinatura no envelope da mensagem
- [ ] Formato: `{ clannId, fromTotemId, payload, signature, timestamp }`

### **PASSO 2.2: Integração no MessagesManager**
- [ ] Modificar `addMessage()` para assinar antes de enviar
- [ ] Incluir assinatura no payload enviado ao Gateway
- [ ] Manter compatibilidade com armazenamento local

### **PASSO 3.3: Validação no Receptor**
- [ ] Criar função `verifyMessage(message, fromTotemId)` em `src/crypto/totem.js`
- [ ] Validar assinatura usando chave pública do `fromTotemId`
- [ ] Verificar se `fromTotemId` está na lista local de membros
- [ ] Descartar mensagens inválidas localmente
- [ ] **IMPORTANTE:** Validação sempre local, nunca no Gateway

---

## **FASE 3: INTEGRAÇÃO CLIENTE-GATEWAY**
**Objetivo:** Cliente envia/recebe mensagens via Gateway

**Tempo estimado:** 1 semana

### **PASSO 3.1: Serviço de Gateway (Cliente)**
- [ ] Criar `src/services/GatewayService.js`
- [ ] Implementar conexão WebSocket
- [ ] Implementar envio de mensagens assinadas
- [ ] Implementar recebimento de mensagens
- [ ] Implementar reconexão automática
- [ ] **IMPORTANTE:** Sem autenticação, sem sessão

### **PASSO 3.2: Integração no MessagesManager**
- [ ] Modificar `addMessage()` para enviar ao Gateway
- [ ] Manter fallback local (offline-first)
- [ ] Integrar recebimento de mensagens do Gateway
- [ ] Validar assinaturas no receptor

### **PASSO 3.3: Integração no SyncManager**
- [ ] Substituir polling local por WebSocket
- [ ] Manter polling como fallback
- [ ] Implementar delta updates via WebSocket

### **PASSO 3.4: Integração no JoinClanScreen**
- [ ] Modificar `handleJoinByCode()` para validar convite no Gateway
- [ ] Gateway retorna `clannId`
- [ ] Cliente adiciona membro localmente
- [ ] **IMPORTANTE:** Gateway não valida Totem

---

## **FASE 4: AJUSTES E REFINAMENTOS**
**Objetivo:** Garantir conformidade com Manifesto Técnico

**Tempo estimado:** 3-5 dias

### **PASSO 4.1: Revisão de Conformidade**
- [ ] Verificar que Totem funciona offline
- [ ] Verificar que servidor pode cair sem afetar identidade
- [ ] Verificar que servidor nunca conhece PIN
- [ ] Verificar que servidor nunca valida assinatura
- [ ] Verificar que servidor nunca autentica usuário
- [ ] Verificar que governança funciona localmente
- [ ] Verificar que mensagens são validadas pelo receptor

### **PASSO 4.2: Testes de Integração**
- [ ] Testar comunicação entre 2 dispositivos
- [ ] Testar offline/online
- [ ] Testar reconexão
- [ ] Testar validação de assinaturas
- [ ] Testar descarte de mensagens inválidas

### **PASSO 4.3: Documentação**
- [ ] Documentar arquitetura do Gateway
- [ ] Documentar fluxo de mensagens
- [ ] Documentar validação de assinaturas
- [ ] Atualizar README

---

## **FASE 5: FUNCIONALIDADES AVANÇADAS (Opcional)**
**Objetivo:** Completar funcionalidades para chat completo

**Tempo estimado:** 2-3 semanas

### **PASSO 5.1: Mídia (Fotos/Vídeos/Áudios)**
- [ ] Implementar `MediaPlugin.js`
- [ ] Integrar câmera e galeria
- [ ] Compressão de mídia
- [ ] Upload para Gateway (payload opaco)
- [ ] Download e exibição

### **PASSO 5.2: Notificações Push**
- [ ] Configurar expo-notifications
- [ ] Integrar com Gateway
- [ ] Notificações locais
- [ ] Badge de não lidas

### **PASSO 5.3: Perfis de Usuário**
- [ ] Criar sistema de perfis locais
- [ ] Nome de exibição (opcional)
- [ ] Avatar (opcional)
- [ ] Mostrar em mensagens

### **PASSO 5.4: Busca de Mensagens**
- [ ] Implementar busca local
- [ ] Filtros (data, autor)
- [ ] Highlight de resultados

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### **Fase 1: Gateway (Crítico)**
- [ ] Backend criado e funcionando
- [ ] API REST (3 endpoints)
- [ ] WebSocket (roteamento)
- [ ] Banco de dados (mínimo)
- [ ] Testes básicos

### **Fase 2: Assinatura (Crítico)**
- [ ] Assinatura de mensagens
- [ ] Validação no receptor
- [ ] Integração no MessagesManager

### **Fase 3: Integração (Crítico)**
- [ ] GatewayService criado
- [ ] Envio de mensagens
- [ ] Recebimento de mensagens
- [ ] Validação de convites

### **Fase 4: Ajustes (Importante)**
- [ ] Conformidade com Manifesto
- [ ] Testes de integração
- [ ] Documentação

### **Fase 5: Avançado (Opcional)**
- [ ] Mídia
- [ ] Notificações
- [ ] Perfis
- [ ] Busca

---

## 🚨 REGRAS DE OURO (Sempre Verificar)

Antes de implementar qualquer coisa, verificar:

1. ✅ **Totem funciona offline?**
2. ✅ **Servidor pode cair sem afetar identidade?**
3. ✅ **Servidor nunca conhece PIN?**
4. ✅ **Servidor nunca valida assinatura?**
5. ✅ **Servidor nunca autentica usuário?**
6. ✅ **Governança funciona localmente?**
7. ✅ **Mensagens são validadas pelo receptor?**

Se qualquer resposta for "NÃO", **NÃO IMPLEMENTAR**.

---

## 📝 ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

1. **Fase 1** → Gateway básico (roteamento cego)
2. **Fase 2** → Assinatura de mensagens
3. **Fase 3** → Integração cliente-Gateway
4. **Fase 4** → Ajustes e conformidade
5. **Fase 5** → Funcionalidades avançadas (opcional)

---

## 🎯 RESULTADO ESPERADO

Após completar as Fases 1-4:

✅ **CLANN totalmente funcional entre dispositivos**  
✅ **Soberania digital preservada**  
✅ **Gateway como transporte cego**  
✅ **Validação sempre local**  
✅ **Conformidade total com Manifesto Técnico**

---

## 📚 REFERÊNCIAS

- **MANIFESTO_TECNICO_CLANN.md** - Constituição técnica
- **src/crypto/totem.js** - Geração e validação de Totem
- **src/messages/MessagesManager.js** - Gerenciamento de mensagens
- **src/sync/SyncManager.js** - Sincronização local

---

**Fim do Roadmap de Implementação**















