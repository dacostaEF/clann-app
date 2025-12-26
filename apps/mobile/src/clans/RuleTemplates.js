/**
 * RuleTemplates - Sistema de Templates de Regras
 * Sprint 7 - Governança - ETAPA 2
 * 
 * Gerencia templates pré-definidos de regras que podem ser usados
 * para criar novas regras rapidamente
 */

import { Platform } from 'react-native';
import ClanStorage from './ClanStorage';

// Categorias de regras disponíveis
export const RULE_CATEGORIES = {
  CONDUCT: 'conduct',
  PRIVACY: 'privacy',
  SECURITY: 'security',
  COMMUNICATION: 'communication',
  MEMBERSHIP: 'membership',
  CONTENT: 'content',
  OTHER: 'other'
};

export const RULE_CATEGORY_LABELS = {
  [RULE_CATEGORIES.CONDUCT]: 'Conduta',
  [RULE_CATEGORIES.PRIVACY]: 'Privacidade',
  [RULE_CATEGORIES.SECURITY]: 'Segurança',
  [RULE_CATEGORIES.COMMUNICATION]: 'Comunicação',
  [RULE_CATEGORIES.MEMBERSHIP]: 'Membros',
  [RULE_CATEGORIES.CONTENT]: 'Conteúdo',
  [RULE_CATEGORIES.OTHER]: 'Outros'
};

// Templates pré-definidos
const DEFAULT_TEMPLATES = [
  {
    template_id: 'template_respect',
    name: 'Respeito e Civilidade',
    text: 'Todos os membros devem tratar uns aos outros com respeito e civilidade. Comportamento tóxico, assédio ou discriminação não serão tolerados.',
    category: RULE_CATEGORIES.CONDUCT,
    description: 'Regra básica de conduta e respeito'
  },
  {
    template_id: 'template_privacy',
    name: 'Privacidade',
    text: 'Informações compartilhadas neste CLANN são confidenciais. Não compartilhe conteúdo fora do CLANN sem autorização explícita.',
    category: RULE_CATEGORIES.PRIVACY,
    description: 'Proteção de informações privadas'
  },
  {
    template_id: 'template_security',
    name: 'Segurança',
    text: 'Mantenha suas credenciais seguras. Não compartilhe senhas, chaves ou informações de acesso com terceiros.',
    category: RULE_CATEGORIES.SECURITY,
    description: 'Regras de segurança e proteção de dados'
  },
  {
    template_id: 'template_spam',
    name: 'Anti-Spam',
    text: 'Evite spam, mensagens repetitivas ou conteúdo não relacionado ao propósito do CLANN. Mantenha as conversas relevantes.',
    category: RULE_CATEGORIES.COMMUNICATION,
    description: 'Prevenção de spam e conteúdo irrelevante'
  },
  {
    template_id: 'template_content',
    name: 'Conteúdo Apropriado',
    text: 'Conteúdo ofensivo, ilegal ou inadequado não é permitido. Use o bom senso ao compartilhar materiais.',
    category: RULE_CATEGORIES.CONTENT,
    description: 'Diretrizes sobre conteúdo permitido'
  }
];

/**
 * Inicializa templates padrão no banco de dados
 */
export async function initDefaultTemplates() {
  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    // Na Web, salva no localStorage
    const templates = getWebTemplates();
    const existingIds = templates.map(t => t.template_id);
    
    DEFAULT_TEMPLATES.forEach(template => {
      if (!existingIds.includes(template.template_id)) {
        templates.push({
          ...template,
          id: Date.now() + Math.random(),
          created_at: Date.now()
        });
      }
    });
    
    saveWebTemplates(templates);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      let completed = 0;
      const total = DEFAULT_TEMPLATES.length;

      DEFAULT_TEMPLATES.forEach(template => {
        tx.executeSql(
          `INSERT OR IGNORE INTO rule_templates (template_id, name, text, category, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [
            template.template_id,
            template.name,
            template.text,
            template.category,
            template.description,
            Date.now()
          ],
          () => {
            completed++;
            if (completed === total) {
              resolve();
            }
          },
          (_, err) => {
            console.error('Erro ao inserir template:', err);
            completed++;
            if (completed === total) {
              resolve(); // Continua mesmo com erros
            }
          }
        );
      });
    });
  });
}

/**
 * Obtém todos os templates disponíveis
 */
export async function getTemplates(category = null) {
  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    const templates = getWebTemplates();
    if (category) {
      return Promise.resolve(templates.filter(t => t.category === category));
    }
    return Promise.resolve(templates);
  }

  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM rule_templates ORDER BY created_at DESC;`;
    let params = [];

    if (category) {
      sql = `SELECT * FROM rule_templates WHERE category = ? ORDER BY created_at DESC;`;
      params = [category];
    }

    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (_, { rows }) => resolve(rows._array),
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Obtém um template por ID
 */
export async function getTemplate(templateId) {
  const db = ClanStorage.getDB();
  if (Platform.OS === 'web' || !db) {
    const templates = getWebTemplates();
    const template = templates.find(t => t.template_id === templateId);
    return Promise.resolve(template || null);
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM rule_templates WHERE template_id = ?;`,
        [templateId],
        (_, { rows }) => {
          if (rows.length > 0) {
            resolve(rows.item(0));
          } else {
            resolve(null);
          }
        },
        (_, err) => reject(err)
      );
    });
  });
}

/**
 * Cria um template personalizado
 */
export async function createTemplate(name, text, category, description = null) {
  const templateId = `template_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const db = ClanStorage.getDB();

  if (Platform.OS === 'web' || !db) {
    const templates = getWebTemplates();
    const newTemplate = {
      id: Date.now(),
      template_id: templateId,
      name,
      text,
      category,
      description,
      created_at: Date.now()
    };
    templates.push(newTemplate);
    saveWebTemplates(templates);
    return Promise.resolve(newTemplate);
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO rule_templates (template_id, name, text, category, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [templateId, name, text, category, description, Date.now()],
        (_, result) => {
          resolve({
            id: result.insertId,
            template_id: templateId,
            name,
            text,
            category,
            description,
            created_at: Date.now()
          });
        },
        (_, err) => reject(err)
      );
    });
  });
}

// Helpers para localStorage na Web
const WEB_TEMPLATES_KEY = 'clann_rule_templates';

function getWebTemplates() {
  if (Platform.OS !== 'web') return [];
  try {
    const data = localStorage.getItem(WEB_TEMPLATES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveWebTemplates(templates) {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(WEB_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Erro ao salvar templates no localStorage:', error);
  }
}

