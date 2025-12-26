/**
 * Compression Utils - Compressão Leve de Mensagens
 * Sprint 7 - ETAPA 6: Performance & Compressão
 * 
 * Compressão simples e rápida para mensagens de texto
 * Usa substituição de padrões comuns para reduzir tamanho
 */

// Padrões comuns em mensagens (palavras frequentes)
const COMMON_PATTERNS = {
  // Palavras comuns
  ' o ': ' \u0001',
  ' a ': ' \u0002',
  ' de ': ' \u0003',
  ' que ': ' \u0004',
  ' e ': ' \u0005',
  ' em ': ' \u0006',
  ' um ': ' \u0007',
  ' para ': ' \u0008',
  ' com ': ' \u0009',
  ' não ': ' \u000A',
  ' uma ': ' \u000B',
  ' por ': ' \u000C',
  ' mais ': ' \u000D',
  ' como ': ' \u000E',
  ' mas ': ' \u000F',
  
  // Emojis comuns (substituição reversível)
  '👍': '\u0010',
  '❤️': '\u0011',
  '😂': '\u0012',
  '🔥': '\u0013',
  '😮': '\u0014',
  '🙏': '\u0015',
  
  // Padrões de pontuação dupla
  '..': '\u0016',
  '!!': '\u0017',
  '??': '\u0018',
};

// Mapa reverso para descompressão
const REVERSE_PATTERNS = {};
Object.entries(COMMON_PATTERNS).forEach(([pattern, code]) => {
  REVERSE_PATTERNS[code] = pattern;
});

/**
 * Comprime texto usando substituição de padrões
 * @param {string} text - Texto original
 * @returns {string} Texto comprimido
 */
export function compressText(text) {
  if (!text || text.length < 10) {
    // Textos muito curtos não valem a pena comprimir
    return text;
  }

  let compressed = text;
  
  // Aplica substituições de padrões comuns
  Object.entries(COMMON_PATTERNS).forEach(([pattern, code]) => {
    // Usa regex global para substituir todas as ocorrências
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    compressed = compressed.replace(regex, code);
  });

  // Se a compressão não reduziu o tamanho, retorna original
  if (compressed.length >= text.length) {
    return text;
  }

  // Adiciona marcador de compressão no início
  return '\u0000' + compressed;
}

/**
 * Descomprime texto
 * @param {string} compressed - Texto comprimido
 * @returns {string} Texto original
 */
export function decompressText(compressed) {
  if (!compressed) {
    return '';
  }

  // Verifica se está comprimido (marcador no início)
  if (compressed[0] !== '\u0000') {
    // Não está comprimido, retorna como está
    return compressed;
  }

  // Remove marcador
  let decompressed = compressed.substring(1);

  // Aplica substituições reversas
  Object.entries(REVERSE_PATTERNS).forEach(([code, pattern]) => {
    const regex = new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    decompressed = decompressed.replace(regex, pattern);
  });

  return decompressed;
}

/**
 * Verifica se um texto está comprimido
 * @param {string} text - Texto a verificar
 * @returns {boolean}
 */
export function isCompressed(text) {
  return text && text[0] === '\u0000';
}

