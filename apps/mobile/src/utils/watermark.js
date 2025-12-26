/**
 * Watermark Utils - Sistema Anti-vazamento
 * Sprint 7 - ETAPA 2: Watermark invisível
 * 
 * Injeta marca d'água invisível nas mensagens para identificar vazadores
 */

// Zero-width space (caractere invisível)
const ZERO_WIDTH_SPACE = '\u200B';
// Zero-width non-joiner (outro caractere invisível)
const ZERO_WIDTH_NON_JOINER = '\u200C';
// Zero-width joiner
const ZERO_WIDTH_JOINER = '\u200D';

/**
 * Converte um totemId em uma sequência de caracteres invisíveis
 * @param {string} totemId - ID do Totem (16 caracteres hex)
 * @returns {string} Sequência de caracteres invisíveis
 */
function totemIdToInvisibleSequence(totemId) {
  if (!totemId || totemId.length < 4) {
    return '';
  }

  // Pega os primeiros 4 caracteres do totemId
  const shortId = totemId.substring(0, 4).toUpperCase();
  
  // Converte cada caractere hex em uma sequência de caracteres invisíveis
  // Usa uma combinação de zero-width spaces para codificar
  let sequence = '';
  
  for (let i = 0; i < shortId.length; i++) {
    const char = shortId[i];
    const code = char.charCodeAt(0);
    
    // Codifica usando zero-width characters
    // Cada dígito hex (0-F) é mapeado para uma combinação única
    const hexValue = parseInt(char, 16); // 0-15
    
    // Cria sequência baseada no valor hex
    for (let j = 0; j < hexValue; j++) {
      sequence += ZERO_WIDTH_SPACE;
    }
    sequence += ZERO_WIDTH_NON_JOINER; // Separador entre dígitos
  }
  
  return sequence;
}

/**
 * Injeta watermark invisível no texto
 * @param {string} text - Texto original
 * @param {string} totemId - ID do Totem do usuário atual
 * @returns {string} Texto com watermark invisível
 */
export function injectWatermark(text, totemId) {
  if (!text || !totemId) {
    return text || '';
  }

  // Gera sequência invisível baseada no totemId
  const invisibleSequence = totemIdToInvisibleSequence(totemId);
  
  if (!invisibleSequence) {
    return text;
  }

  // Adiciona marca d'água no final do texto
  // Formato: texto + zero-width space + sequência invisível + marcador visível (opcional)
  // O marcador visível "·ED8A·" é opcional e pode ser removido se quiser totalmente invisível
  const shortId = totemId.substring(0, 4).toUpperCase();
  const visibleMarker = `·${shortId}·`; // Marcador visível (pode ser removido)
  
  // Retorna texto com watermark invisível + marcador visível (opcional)
  // Para totalmente invisível, remover visibleMarker
  return text + ZERO_WIDTH_SPACE + invisibleSequence + ZERO_WIDTH_NON_JOINER;
}

/**
 * Extrai watermark de um texto (para análise/debug)
 * @param {string} text - Texto com possível watermark
 * @returns {string|null} TotemId extraído ou null
 */
export function extractWatermark(text) {
  if (!text) {
    return null;
  }

  // Procura por sequências de zero-width characters
  // Esta é uma função de debug/análise
  const zeroWidthPattern = /[\u200B\u200C\u200D]+/g;
  const matches = text.match(zeroWidthPattern);
  
  if (!matches || matches.length === 0) {
    return null;
  }

  // Tenta decodificar (implementação simplificada)
  // Em produção, isso seria mais complexo
  return 'EXTRACTED'; // Placeholder
}

/**
 * Remove watermark de um texto (para testes)
 * @param {string} text - Texto com watermark
 * @returns {string} Texto sem watermark
 */
export function removeWatermark(text) {
  if (!text) {
    return '';
  }

  // Remove todos os caracteres zero-width
  return text.replace(/[\u200B\u200C\u200D]/g, '').replace(/·[A-F0-9]{4}·/g, '');
}

