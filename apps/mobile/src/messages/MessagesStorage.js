import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import ClanStorage, { getDatabase as getClanDatabase } from '../clans/ClanStorage';

// Chave para localStorage na Web
const WEB_MESSAGES_KEY = 'clann_messages';

// ✅ DOSE 1C: Usar a mesma instância de banco que ClanStorage
// MessagesStorage NÃO cria DB, ele RECEBE DB do ClanStorage
export const getDatabase = async () => {
  // Reutilizar a mesma instância do ClanStorage (mesmo banco 'clann.db')
  const db = await getClanDatabase();
  console.log('[DOSE 1C] MessagesStorage.getDatabase() - usando instância do ClanStorage');
  console.log('[DOSE 1C] Instância do banco:', db);
  return db;
};

export const initializeDatabase = async () => {
  const db = await getDatabase();
};

/**
 * Camada de acesso ao SQLite para mensagens dos CLANNs
 * Gerencia persistência de mensagens localmente
 * 
 * Sprint 4: Chat básico funcional
 */
class MessagesStorage {
  constructor() {
    // ✅ DOSE 1C.2: this.db será inicializado UMA vez via ensureDb() que usa a mesma instância do ClanStorage
    this.db = null; // Será inicializado via ensureDb() que reutiliza instância do ClanStorage
    this.dbInitPromise = null; // Lock para evitar corridas de inicialização
  }

  // ---------------------------------------------------------
  // ✅ DOSE 1C.2: Garantir inicialização única do DB (com lock)
  // ---------------------------------------------------------
  async ensureDb() {
    // Se já está inicializado, retorna imediatamente
    if (this.db) {
      return this.db;
    }

    // Se não há promise de inicialização, cria uma (lock)
    if (!this.dbInitPromise) {
      this.dbInitPromise = (async () => {
        const db = await getClanDatabase();
        if (!db) {
          throw new Error('[FATAL] DB não inicializado - getClanDatabase() retornou null');
        }
        this.db = db;
        console.log('[DOSE 1C.2] MessagesStorage inicializado (1x) via ClanStorage');
        console.log('[DOSE 1C.2] Instância do banco:', this.db);
        return db;
      })();
    }

    // Aguarda a promise de inicialização (mesma para todas as chamadas simultâneas)
    return await this.dbInitPromise;
  }

  // ---------------------------------------------------------
  // Helpers para localStorage na Web
  // ---------------------------------------------------------
  _getWebMessages() {
    if (Platform.OS !== 'web') return [];
    try {
      const data = localStorage.getItem(WEB_MESSAGES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveWebMessages(messages) {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(WEB_MESSAGES_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Erro ao salvar mensagens no localStorage:', error);
    }
  }

  // ---------------------------------------------------------
  // Inicialização (tabela já criada em ClanStorage.init())
  // ---------------------------------------------------------
  async init() {
    if (Platform.OS === 'web') {
      // No web, não há banco de dados (usa localStorage)
      return Promise.resolve(true);
    }
    
    // Tabela já foi criada em ClanStorage.init()
    // Garantir que coluna status existe (migration defensiva)
    try {
      const db = await this.ensureDb();
      if (db && typeof db.execAsync === 'function') {
        // Tentar adicionar coluna status se não existir (idempotente)
        await db.execAsync(`ALTER TABLE clan_messages ADD COLUMN status TEXT DEFAULT 'sent';`);
      }
    } catch (error) {
      // Ignora erro se coluna já existe (comportamento esperado)
      const errorMessage = error?.message || String(error);
      if (!errorMessage.includes('duplicate column') && 
          !errorMessage.includes('already exists')) {
        // Outro tipo de erro - logar mas não bloquear
        console.warn('[MessagesStorage] Aviso ao verificar coluna status:', errorMessage);
      }
    }
    
    return Promise.resolve(true);
  }

  // ---------------------------------------------------------
  // Adicionar mensagem
  // ---------------------------------------------------------
  async addMessage(clanId, authorTotem, text, options = {}) {
    // 🔍 [TRACE] de Entrada: Logar payload completo no início
    console.log('[TRACE] MessagesStorage.addMessage() CHAMADO');
    console.log('[TRACE] Payload completo:', {
      clanId,
      authorTotem,
      textLength: text?.length || 0,
      textPreview: text?.substring(0, 50) || 'N/A',
      options
    });
    
    const { selfDestructAt = null, burnAfterRead = false, status = 'sent' } = options; // PASSO 2: Extrair status
    
    if (Platform.OS === 'web') {
      console.log('[TRACE][EXIT] Saindo de addMessage em: Platform.OS === web (usando localStorage)');
      console.log('[TRACE][EXIT] Platform.OS:', Platform.OS);
      // Na Web, salva no localStorage
      const messages = this._getWebMessages();
      const newMessage = {
        id: Date.now(),
        clan_id: parseInt(clanId),
        author_totem: authorTotem,
        message: text,
        timestamp: Date.now(),
        self_destruct_at: selfDestructAt,
        burn_after_read: burnAfterRead ? 1 : 0,
        reactions: null, // Reações serão inicializadas quando necessário
        delivered_to: JSON.stringify([]), // Sprint 6 - ETAPA 4
        read_by: JSON.stringify([]), // Sprint 6 - ETAPA 4
        edited: 0, // Sprint 6 - ETAPA 5
        deleted: 0, // Sprint 6 - ETAPA 5
        original_content: null, // Sprint 6 - ETAPA 5
        edited_at: null, // Sprint 6 - ETAPA 5
        status: status // PASSO 2: Persistir status
      };
      messages.push(newMessage);
      this._saveWebMessages(messages);
      return Promise.resolve(newMessage);
    }

    // ✅ DOSE 1C.2: Garantir inicialização única do DB (com lock)
    let db;
    try {
      db = await this.ensureDb();
    } catch (err) {
      console.log('[TRACE][EXIT] Saindo de addMessage em: erro ao inicializar DB');
      console.log('[TRACE][EXIT] Erro:', err);
      console.error('[FATAL] MessagesStorage sem DB - ensureDb() falhou:', err?.message || err);
      return Promise.reject(new Error('SQLite database não disponível'));
    }
    
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (typeof db.execAsync !== 'function') {
      console.log('[TRACE][EXIT] Saindo de addMessage em: execAsync não é função');
      console.log('[TRACE][EXIT] typeof db.execAsync:', typeof db.execAsync);
      console.warn('SQLite async API não disponível — ignorando operação MessagesStorage.addMessage');
      return Promise.reject(new Error('SQLite async API não disponível'));
    }
    
    // 🔍 DIAGNÓSTICO TEMPORÁRIO: Logar schema da tabela clan_messages (usando getAllAsync)
    try {
      const schema = await db.getAllAsync('PRAGMA table_info(clan_messages);');
      console.log('🧱 SCHEMA clan_messages:', schema);
    } catch (error) {
      console.error('❌ ERRO AO LER SCHEMA clan_messages:', error);
    }
    
    // Migration defensiva: garantir que coluna status existe antes de inserir
    try {
      await db.execAsync(`ALTER TABLE clan_messages ADD COLUMN status TEXT DEFAULT 'sent';`);
    } catch (migrationError) {
      // Ignora erro se coluna já existe (comportamento esperado)
      const errorMessage = migrationError?.message || String(migrationError);
      if (!errorMessage.includes('duplicate column') && 
          !errorMessage.includes('already exists')) {
        // Outro tipo de erro - logar mas continuar (migration pode ter falhado, mas tentar INSERT mesmo assim)
        console.warn('[MessagesStorage] Aviso ao verificar coluna status:', errorMessage);
      }
    }
    
    // 🔍 AUDITORIA SQLite: Log antes do INSERT
    console.log('[AUDITORIA SQLite] MessagesStorage.addMessage() - ANTES do INSERT');
    console.log('[AUDITORIA SQLite] Instância do banco:', db);
    console.log('[AUDITORIA SQLite] clanId:', clanId);
    console.log('[AUDITORIA SQLite] authorTotem:', authorTotem);
    console.log('[AUDITORIA SQLite] message:', text);
    console.log('[AUDITORIA SQLite] status:', status);
    
    // 🔍 [TRACE] do Banco: Logar caminho físico ANTES do INSERT
    try {
      // Logar databasePath (caminho absoluto do arquivo .db)
      const dbPath = db?.databasePath || db?.name || 'N/A';
      console.log('[TRACE] DB path (ANTES INSERT):', dbPath);
      console.log('[TRACE] Instância do banco:', db);
      
      // Logar PRAGMA database_list para ver caminho físico do banco
      const dbList = await db.getAllAsync('PRAGMA database_list;');
      console.log('[DIAGNÓSTICO DEFINITIVO] PRAGMA database_list (ANTES INSERT):', JSON.stringify(dbList, null, 2));
      
      // 🔍 Garantir que o campo 'file' (caminho físico) seja exibido claramente
      if (dbList && dbList.length > 0) {
        dbList.forEach((dbInfo, index) => {
          console.log(`[DIAGNÓSTICO DEFINITIVO] Database ${index} - name: ${dbInfo.name}, file: ${dbInfo.file || 'N/A'}`);
        });
      } else {
        console.warn('[DIAGNÓSTICO DEFINITIVO] PRAGMA database_list retornou vazio ou null');
      }
      
      // Logar tabelas existentes
      const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
      console.log('[DIAGNÓSTICO DEFINITIVO] Tabelas no banco (ANTES INSERT):', tables.map(t => t.name));
      const clanMessagesExists = tables.some(t => t.name === 'clan_messages');
      console.log('[DIAGNÓSTICO DEFINITIVO] Tabela clan_messages existe?', clanMessagesExists);
      
      // Contar mensagens antes do INSERT
      const countBefore = await db.getFirstAsync('SELECT COUNT(*) as count FROM clan_messages WHERE clan_id = ?;', [clanId]);
      console.log('[DIAGNÓSTICO DEFINITIVO] COUNT(*) ANTES do INSERT (clanId=' + clanId + '):', countBefore?.count || 0);
    } catch (diagError) {
      console.warn('[DIAGNÓSTICO DEFINITIVO] Erro ao executar diagnósticos antes do INSERT:', diagError);
    }
    
    // ✅ PERSISTÊNCIA REAL: Usar runAsync() ao invés de transaction()
    console.log('[TRACE][FLOW] Antes do bloco do INSERT');
    try {
      const timestamp = Date.now();
      console.log('[TRACE] Executando db.runAsync() para INSERT...');
      const result = await db.runAsync(
        `INSERT INTO clan_messages (clan_id, author_totem, message, timestamp, self_destruct_at, burn_after_read, reactions, delivered_to, read_by, edited, deleted, original_content, edited_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          clanId, 
          authorTotem, 
          text, 
          timestamp, 
          selfDestructAt, 
          burnAfterRead ? 1 : 0, 
          null,
          JSON.stringify([]), // Sprint 6 - ETAPA 4: delivered_to
          JSON.stringify([]), // Sprint 6 - ETAPA 4: read_by
          0, // Sprint 6 - ETAPA 5: edited
          0, // Sprint 6 - ETAPA 5: deleted
          null, // Sprint 6 - ETAPA 5: original_content
          null, // Sprint 6 - ETAPA 5: edited_at
          status // PASSO 2: Incluir status no INSERT
        ]
      );
      
      // 🔍 [PERSISTÊNCIA OK] de Confirmação: Logar resultado imediatamente após runAsync
      console.log('[PERSISTÊNCIA OK] INSERT lastInsertRowId:', result.lastInsertRowId);
      console.log('[PERSISTÊNCIA OK] INSERT rowsAffected (changes):', result.changes);
      console.log('[AUDITORIA SQLite] MessagesStorage.addMessage() - DEPOIS do INSERT');
      console.log('[AUDITORIA SQLite] INSERT bem-sucedido!');
      
      // 🔍 DIAGNÓSTICO DEFINITIVO: Verificar banco físico DEPOIS do INSERT
      try {
        // Contar mensagens depois do INSERT
        const countAfter = await db.getFirstAsync('SELECT COUNT(*) as count FROM clan_messages WHERE clan_id = ?;', [clanId]);
        console.log('[DIAGNÓSTICO DEFINITIVO] COUNT(*) DEPOIS do INSERT (clanId=' + clanId + '):', countAfter?.count || 0);
        
        // Verificar se a mensagem inserida realmente existe
        const insertedMsg = await db.getFirstAsync('SELECT id, clan_id, author_totem, message, status FROM clan_messages WHERE id = ?;', [result.lastInsertRowId]);
        console.log('[DIAGNÓSTICO DEFINITIVO] Mensagem inserida confirmada no banco?', insertedMsg ? 'SIM' : 'NÃO');
        if (insertedMsg) {
          console.log('[DIAGNÓSTICO DEFINITIVO] Dados da mensagem confirmada:', {
            id: insertedMsg.id,
            clan_id: insertedMsg.clan_id,
            author_totem: insertedMsg.author_totem,
            message: insertedMsg.message?.substring(0, 50),
            status: insertedMsg.status
          });
        }
      } catch (diagError) {
        console.warn('[DIAGNÓSTICO DEFINITIVO] Erro ao executar diagnósticos depois do INSERT:', diagError);
      }
      
      // Retornar mensagem no formato esperado
      return {
        id: result.lastInsertRowId,
        clan_id: clanId,
        author_totem: authorTotem,
        message: text,
        timestamp: timestamp,
        self_destruct_at: selfDestructAt,
        burn_after_read: burnAfterRead ? 1 : 0,
        reactions: null,
        delivered_to: JSON.stringify([]),
        read_by: JSON.stringify([]),
        edited: 0,
        deleted: 0,
        original_content: null,
        edited_at: null,
        status: status // PASSO 2: Retornar status
      };
    } catch (err) {
      // 🔍 Catch Barulhento: Transformar qualquer falha em erro audível
      console.log('[TRACE][EXIT] Saindo de addMessage em: ERRO no try/catch do INSERT');
      console.error('❌ [ERRO INSERT clan_messages] FALHA CRÍTICA NO INSERT');
      console.error('[ERRO INSERT clan_messages] Erro completo:', err);
      console.error('[ERRO INSERT clan_messages] Stack trace:', err?.stack || 'N/A');
      console.error('[ERRO INSERT clan_messages] Mensagem:', err?.message || String(err));
      console.error('[AUDITORIA SQLite] MessagesStorage.addMessage() - ERRO no INSERT');
      console.error('[AUDITORIA SQLite] Erro:', err);
      throw err;
    }
  }

  // ---------------------------------------------------------
  // Buscar mensagens desde um timestamp (Sprint 6 - ETAPA 6)
  // ---------------------------------------------------------
  async getMessagesSince(clanId, lastTimestamp) {
    const now = Date.now();
    
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const messages = this._getWebMessages();
      const clanMessages = messages
        .filter(m => {
          // Filtra por CLANN
          if (m.clan_id !== parseInt(clanId)) return false;
          
          // Filtra por timestamp (apenas mensagens mais recentes)
          if (m.timestamp <= lastTimestamp) return false;
          
          // Remove mensagens expiradas (self-destruct)
          if (m.self_destruct_at && m.self_destruct_at <= now) return false;
          
          return true;
        })
        .sort((a, b) => a.timestamp - b.timestamp); // Ordena ASC
      
      return Promise.resolve(clanMessages);
    }

    const db = await this.ensureDb();
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (typeof db.getAllAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação MessagesStorage.getMessagesSince');
      return Promise.resolve([]);
    }
    
    // ✅ DOSE FINAL: Caso A - SELECT usando getAllAsync (sem transaction)
    try {
      const rows = await db.getAllAsync(
        `SELECT * FROM clan_messages 
         WHERE clan_id = ? 
         AND timestamp > ?
         AND (self_destruct_at IS NULL OR self_destruct_at > ?)
         ORDER BY timestamp ASC;`,
        [clanId, lastTimestamp, now]
      );
      return rows ?? [];
    } catch (err) {
      console.error('[UPDATES] Falha no SELECT async (getMessagesSince):', err);
      throw err;
    }
  }

  // ---------------------------------------------------------
  // Buscar mensagens de um CLANN (filtra expiradas)
  // ---------------------------------------------------------
  async getMessages(clanId) {
    const now = Date.now();
    
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, busca no localStorage
      const messages = this._getWebMessages();
      const clanMessages = messages
        .filter(m => {
          // Filtra por CLANN
          if (m.clan_id !== parseInt(clanId)) return false;
          
          // Remove mensagens expiradas (self-destruct)
          if (m.self_destruct_at && m.self_destruct_at <= now) return false;
          
          return true;
        })
        .sort((a, b) => a.timestamp - b.timestamp); // Ordena ASC (mais antigo primeiro)
      
      return Promise.resolve(clanMessages);
    }

    // ✅ DOSE 1C.2: Garantir inicialização única do DB (com lock)
    let db;
    try {
      db = await this.ensureDb();
    } catch (err) {
      console.error('[FATAL] MessagesStorage sem DB - ensureDb() falhou:', err?.message || err);
      return Promise.resolve([]);
    }
    
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (typeof db.execAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação MessagesStorage.getMessages');
      return Promise.resolve([]);
    }
    
    // 🔍 [TRACE] do Banco (SELECT): Logar caminho físico no início
    try {
      const dbPath = db?.databasePath || db?.name || 'N/A';
      console.log('[TRACE] DB path (SELECT):', dbPath);
      console.log('[AUDITORIA SQLite] MessagesStorage.getMessages() - ANTES do SELECT');
      console.log('[AUDITORIA SQLite] Instância do banco:', db);
      console.log('[AUDITORIA SQLite] clanId:', clanId);
      
      // Logar PRAGMA database_list para ver caminho físico do banco
      const dbList = await db.getAllAsync('PRAGMA database_list;');
      console.log('[DIAGNÓSTICO DEFINITIVO] PRAGMA database_list (ANTES SELECT):', JSON.stringify(dbList, null, 2));
      
      // 🔍 Garantir que o campo 'file' (caminho físico) seja exibido claramente
      if (dbList && dbList.length > 0) {
        dbList.forEach((dbInfo, index) => {
          console.log(`[DIAGNÓSTICO DEFINITIVO] Database ${index} - name: ${dbInfo.name}, file: ${dbInfo.file || 'N/A'}`);
        });
      } else {
        console.warn('[DIAGNÓSTICO DEFINITIVO] PRAGMA database_list retornou vazio ou null');
      }
      
      // Logar tabelas existentes
      const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
      console.log('[DIAGNÓSTICO DEFINITIVO] Tabelas no banco (ANTES SELECT):', tables.map(t => t.name));
      const clanMessagesExists = tables.some(t => t.name === 'clan_messages');
      console.log('[DIAGNÓSTICO DEFINITIVO] Tabela clan_messages existe?', clanMessagesExists);
      
      // Contar mensagens antes do SELECT
      const countBefore = await db.getFirstAsync('SELECT COUNT(*) as count FROM clan_messages WHERE clan_id = ?;', [clanId]);
      console.log('[DIAGNÓSTICO DEFINITIVO] COUNT(*) ANTES do SELECT (clanId=' + clanId + '):', countBefore?.count || 0);
    } catch (diagError) {
      console.warn('[DIAGNÓSTICO DEFINITIVO] Erro ao executar diagnósticos antes do SELECT:', diagError);
    }
    
    // ✅ PERSISTÊNCIA REAL: Usar runAsync() para DELETE e getAllAsync() para SELECT
    try {
      // Remove mensagens expiradas primeiro
      try {
        await db.runAsync(
          `DELETE FROM clan_messages 
           WHERE clan_id = ? 
           AND self_destruct_at IS NOT NULL 
           AND self_destruct_at <= ?;`,
          [clanId, now]
        );
      } catch (deleteError) {
        console.warn('Erro ao limpar mensagens expiradas:', deleteError);
      }

      // Busca mensagens não expiradas
      console.log('[TRACE] Executando db.getAllAsync() para SELECT...');
      const rows = await db.getAllAsync(
        `SELECT * FROM clan_messages 
         WHERE clan_id = ? 
         AND (self_destruct_at IS NULL OR self_destruct_at > ?)
         ORDER BY timestamp ASC;`,
        [clanId, now]
      );
      
      // 🔍 [PERSISTÊNCIA OK] da Leitura: Logar número frio de registros retornados
      console.log('[PERSISTÊNCIA OK] SELECT mensagens (rows.length):', rows.length);
      console.log('[AUDITORIA SQLite] MessagesStorage.getMessages() - DEPOIS do SELECT');
      console.log('[AUDITORIA SQLite] Quantidade de mensagens retornadas:', rows.length);
      if (rows.length > 0) {
        console.log('[AUDITORIA SQLite] Primeira mensagem:', {
          id: rows[0].id,
          clan_id: rows[0].clan_id,
          author_totem: rows[0].author_totem,
          message: rows[0].message?.substring(0, 50),
          status: rows[0].status
        });
      }
      
      // 🔍 DIAGNÓSTICO DEFINITIVO: Verificar banco físico DEPOIS do SELECT
      try {
        // Contar mensagens depois do SELECT
        const countAfter = await db.getFirstAsync('SELECT COUNT(*) as count FROM clan_messages WHERE clan_id = ?;', [clanId]);
        console.log('[DIAGNÓSTICO DEFINITIVO] COUNT(*) DEPOIS do SELECT (clanId=' + clanId + '):', countAfter?.count || 0);
        console.log('[DIAGNÓSTICO DEFINITIVO] Mensagens retornadas pelo SELECT:', rows.length);
        console.log('[DIAGNÓSTICO DEFINITIVO] Diferença (COUNT - retornadas):', (countAfter?.count || 0) - rows.length);
      } catch (diagError) {
        console.warn('[DIAGNÓSTICO DEFINITIVO] Erro ao executar diagnósticos depois do SELECT:', diagError);
      }
      
      return rows;
    } catch (err) {
      // 🔍 AUDITORIA SQLite: Log de erro no SELECT
      console.error('[ERRO SELECT clan_messages]', err);
      console.error('[AUDITORIA SQLite] MessagesStorage.getMessages() - ERRO no SELECT');
      console.error('[AUDITORIA SQLite] Erro:', err);
      return [];
    }
  }

  // ---------------------------------------------------------
  // Atualizar mensagem (Sprint 6 - ETAPA 5)
  // ---------------------------------------------------------
  async updateMessage(messageId, updates) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, atualiza no localStorage
      const messages = this._getWebMessages();
      const index = messages.findIndex(m => m.id === parseInt(messageId));
      
      if (index === -1) {
        return Promise.reject(new Error('Mensagem não encontrada'));
      }

      // Aplicar atualizações
      messages[index] = { ...messages[index], ...updates };
      this._saveWebMessages(messages);
      return Promise.resolve(true);
    }

    const db = await this.ensureDb();
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (typeof db.runAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação MessagesStorage.updateMessage');
      return Promise.reject(new Error('SQLite async API não disponível'));
    }
    
    // ✅ DOSE FINAL: Caso B - UPDATE usando runAsync (sem transaction)
    try {
      // Construir query dinamicamente baseado nos updates
      const fields = [];
      const values = [];

      if (updates.message !== undefined) {
        fields.push('message = ?');
        values.push(updates.message);
      }
      if (updates.original_content !== undefined) {
        fields.push('original_content = ?');
        values.push(updates.original_content);
      }
      if (updates.edited !== undefined) {
        fields.push('edited = ?');
        values.push(updates.edited);
      }
      if (updates.deleted !== undefined) {
        fields.push('deleted = ?');
        values.push(updates.deleted);
      }
      if (updates.edited_at !== undefined) {
        fields.push('edited_at = ?');
        values.push(updates.edited_at);
      }

      if (fields.length === 0) {
        return Promise.resolve(true);
      }

      values.push(messageId);

      const result = await db.runAsync(
        `UPDATE clan_messages SET ${fields.join(', ')} WHERE id = ?;`,
        values
      );
      
      return result.changes > 0;
    } catch (err) {
      console.error('[UPDATES] Falha no RUN async (updateMessage):', err);
      throw err;
    }
  }

  // ---------------------------------------------------------
  // Batch Insert - Inserir múltiplas mensagens (Sprint 7 - ETAPA 6)
  // ---------------------------------------------------------
  async batchInsertMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return Promise.resolve([]);
    }

    if (Platform.OS === 'web' || !this.db) {
      // Na Web, salva no localStorage
      const allMessages = this._getWebMessages();
      const newMessages = messages.map(msg => ({
        id: Date.now() + Math.random(), // ID único
        clan_id: parseInt(msg.clanId),
        author_totem: msg.authorTotem,
        message: msg.text,
        timestamp: msg.timestamp || Date.now(),
        self_destruct_at: msg.selfDestructAt || null,
        burn_after_read: msg.burnAfterRead ? 1 : 0,
        reactions: msg.reactions || null,
        delivered_to: msg.deliveredTo ? JSON.stringify(msg.deliveredTo) : JSON.stringify([]),
        read_by: msg.readBy ? JSON.stringify(msg.readBy) : JSON.stringify([]),
        edited: msg.edited || 0,
        deleted: msg.deleted || 0,
        original_content: msg.originalContent || null,
        edited_at: msg.editedAt || null
      }));
      
      allMessages.push(...newMessages);
      this._saveWebMessages(allMessages);
      return Promise.resolve(newMessages);
    }

    // No SQLite, usa runAsync para inserir todas (sem transaction)
    const db = await this.ensureDb();
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (typeof db.runAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação MessagesStorage.bulkAddMessages');
      return Promise.reject(new Error('SQLite async API não disponível'));
    }
    
    // ✅ DOSE FINAL: Caso C - várias queries (substitui transaction por loop sequencial)
    try {
      const insertedMessages = [];
      
      for (const msg of messages) {
        try {
          const result = await db.runAsync(
            `INSERT INTO clan_messages (clan_id, author_totem, message, timestamp, self_destruct_at, burn_after_read, reactions, delivered_to, read_by, edited, deleted, original_content, edited_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              msg.clanId,
              msg.authorTotem,
              msg.text,
              msg.timestamp || Date.now(),
              msg.selfDestructAt || null,
              msg.burnAfterRead ? 1 : 0,
              msg.reactions || null,
              msg.deliveredTo ? JSON.stringify(msg.deliveredTo) : JSON.stringify([]),
              msg.readBy ? JSON.stringify(msg.readBy) : JSON.stringify([]),
              msg.edited || 0,
              msg.deleted || 0,
              msg.originalContent || null,
              msg.editedAt || null
            ]
          );
          
          insertedMessages.push({
            id: result.lastInsertRowId,
            clan_id: msg.clanId,
            author_totem: msg.authorTotem,
            message: msg.text,
            timestamp: msg.timestamp || Date.now(),
            self_destruct_at: msg.selfDestructAt || null,
            burn_after_read: msg.burnAfterRead ? 1 : 0,
            reactions: msg.reactions || null,
            delivered_to: msg.deliveredTo ? JSON.stringify(msg.deliveredTo) : JSON.stringify([]),
            read_by: msg.readBy ? JSON.stringify(msg.readBy) : JSON.stringify([]),
            edited: msg.edited || 0,
            deleted: msg.deleted || 0,
            original_content: msg.originalContent || null,
            edited_at: msg.editedAt || null
          });
        } catch (error) {
          console.error(`Erro ao inserir mensagem no batch:`, error);
          // Continua com próxima mensagem
        }
      }
      
      return insertedMessages;
    } catch (err) {
      console.error('[UPDATES] Falha em sequência async (bulkAddMessages):', err);
      throw err;
    }
  }

  // ---------------------------------------------------------
  // Atualizar status de uma mensagem (PASSO 3/5: Status de envio)
  // ---------------------------------------------------------
  async updateMessageStatus(messageId, newStatus) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, atualiza no localStorage
      const messages = this._getWebMessages();
      const index = messages.findIndex(m => m.id === parseInt(messageId));
      
      if (index === -1) {
        // CORREÇÃO: Não lançar erro, apenas logar warning (status é metadata, não crítico)
        console.warn(`[MessagesStorage] Mensagem ${messageId} não encontrada no localStorage para atualizar status`);
        return Promise.resolve(false);
      }

      messages[index].status = newStatus;
      this._saveWebMessages(messages);
      return Promise.resolve(true);
    }

    const db = await this.ensureDb();
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (typeof db.runAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação MessagesStorage.updateMessageStatus');
      // CORREÇÃO: Não rejeitar, apenas retornar false (não quebrar fluxo)
      return Promise.resolve(false);
    }
    
    // ✅ DOSE FINAL: Caso B - UPDATE usando runAsync (sem transaction)
    try {
      const result = await db.runAsync(
        `UPDATE clan_messages SET status = ? WHERE id = ?;`,
        [newStatus, messageId]
      );
      
      // CORREÇÃO: Verificar rowsAffected - se 0, mensagem não foi encontrada
      const rowsAffected = result?.changes ?? 0;
      if (rowsAffected === 0) {
        // Mensagem não encontrada - não é erro crítico (status é metadata)
        console.warn(`[MessagesStorage] Mensagem ${messageId} não encontrada para atualizar status (rowsAffected: 0)`);
        return false; // Retorna false, mas não quebra fluxo
      }
      
      return true;
    } catch (err) {
      // CORREÇÃO: Não rejeitar em caso de erro - apenas logar e retornar false
      // Envio local não pode falhar por erro de atualização de status
      console.warn(`[MessagesStorage] Erro ao atualizar status da mensagem ${messageId}:`, err?.message || err);
      return false; // Retorna false, mas não quebra fluxo
    }
  }

  // ---------------------------------------------------------
  // Deletar mensagem fisicamente (para uso interno)
  // ---------------------------------------------------------
  async deleteMessage(messageId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, remove do localStorage
      const messages = this._getWebMessages();
      const filtered = messages.filter(m => m.id !== parseInt(messageId));
      this._saveWebMessages(filtered);
      return Promise.resolve(true);
    }

    const db = await this.ensureDb();
    // ✅ DOSE FINAL: Caso B - DELETE usando runAsync (sem transaction)
    try {
      const result = await db.runAsync(
        `DELETE FROM clan_messages WHERE id = ?;`,
        [messageId]
      );
      return result.changes > 0;
    } catch (err) {
      console.error('[UPDATES] Falha no RUN async (deleteMessage):', err);
      throw err;
    }
  }

  // ---------------------------------------------------------
  // Obter banco de dados (para uso externo)
  // ---------------------------------------------------------
  getDB() {
    return this.db;
  }

  // ---------------------------------------------------------
  // Limpar todas as mensagens de um CLANN
  // ---------------------------------------------------------
  async clearMessages(clanId) {
    if (Platform.OS === 'web' || !this.db) {
      // Na Web, remove do localStorage
      const messages = this._getWebMessages();
      const filtered = messages.filter(m => m.clan_id !== parseInt(clanId));
      this._saveWebMessages(filtered);
      return Promise.resolve(true);
    }

    const db = await this.ensureDb();
    // ✅ BLOQUEIO DEFENSIVO: Verificar se API async está disponível
    if (typeof db.runAsync !== 'function') {
      console.warn('SQLite async API não disponível — ignorando operação MessagesStorage.clearMessages');
      return Promise.resolve(true);
    }
    
    // ✅ DOSE FINAL: Caso B - DELETE usando runAsync (sem transaction)
    try {
      await db.runAsync(
        `DELETE FROM clan_messages WHERE clan_id = ?;`,
        [clanId]
      );
      return true;
    } catch (err) {
      console.error('[UPDATES] Falha no RUN async (clearMessages):', err);
      throw err;
    }
  }
}

// ============================================================
// PASSO 4 — FUNÇÕES ASYNC PARA HISTÓRICO DE MENSAGENS
// ============================================================

/**
 * Helper para obter DB de forma segura (soft-fail)
 * @returns {Object|null} Database instance ou null
 */
function getDBOrNull() {
  try {
    const db = ClanStorage.getDB?.();
    if (!db || typeof db.runAsync !== 'function' || typeof db.getAllAsync !== 'function') {
      console.warn('[SOFT-FAIL][MessagesStorage] DB async indisponível');
      return null;
    }
    return db;
  } catch (err) {
    console.warn('[SOFT-FAIL][MessagesStorage] getDBOrNull:', err?.message || err);
    return null;
  }
}

/**
 * Garante que a tabela de mensagens existe (async)
 * @returns {Promise<boolean|null>} true se criada, null se erro
 */
export async function ensureMessagesTable() {
  try {
    const db = getDBOrNull();
    if (!db) return null;

    // A tabela já existe em ClanStorage, apenas garantir que está criada
    // Usar estrutura compatível com a tabela existente
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS clan_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clan_id INTEGER NOT NULL,
        author_totem TEXT,
        message TEXT,
        timestamp INTEGER,
        self_destruct_at INTEGER,
        burn_after_read INTEGER,
        reactions TEXT,
        delivered_to TEXT,
        read_by TEXT,
        edited INTEGER,
        deleted INTEGER,
        original_content TEXT,
        edited_at INTEGER,
        status TEXT DEFAULT 'sent'
      );
      CREATE INDEX IF NOT EXISTS idx_clan_messages_clan_id ON clan_messages (clan_id);
      CREATE INDEX IF NOT EXISTS idx_clan_messages_timestamp ON clan_messages (timestamp);
    `);

    return true;
  } catch (err) {
    console.warn('[SOFT-FAIL][MessagesStorage] ensureMessagesTable:', err?.message || err);
    return null;
  }
}

/**
 * Salva uma mensagem no banco (async)
 * @param {Object} params - { clanId, messageId, senderTotem, content, createdAt }
 * @returns {Promise<boolean|null>} true se salvo, null se erro
 */
export async function saveClanMessage({ clanId, messageId, senderTotem, content, createdAt }) {
  try {
    const db = getDBOrNull();
    if (!db) return null;

    await ensureMessagesTable();

    await db.runAsync(
      `INSERT INTO clan_messages (clan_id, author_totem, message, timestamp)
       VALUES (?, ?, ?, ?)`,
      [
        clanId,
        senderTotem || null,
        content || '',
        createdAt ? new Date(createdAt).getTime() : Date.now(),
      ]
    );

    return true;
  } catch (err) {
    console.warn('[SOFT-FAIL][MessagesStorage] saveClanMessage:', err?.message || err);
    return null;
  }
}

/**
 * Carrega histórico de mensagens de um CLANN (async)
 * @param {number} clanId - ID do CLANN
 * @param {number} limit - Limite de mensagens (padrão: 200)
 * @returns {Promise<Array>} Array de mensagens
 */
export async function loadClanMessages(clanId, limit = 200) {
  try {
    const db = getDBOrNull();
    if (!db) return [];

    await ensureMessagesTable();

    const rows = await db.getAllAsync(
      `SELECT id, clan_id, author_totem, message, timestamp
       FROM clan_messages
       WHERE clan_id = ? AND deleted = 0
       ORDER BY timestamp ASC
       LIMIT ?`,
      [clanId, limit]
    );

    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn('[SOFT-FAIL][MessagesStorage] loadClanMessages:', err?.message || err);
    return [];
  }
}

export default new MessagesStorage();

