/**
 * Módulo de backup via QR Code
 * Divide backup em múltiplos QR Codes se necessário
 */

import { loadTotemSecure } from '../storage/secureStore';
import { getAESKey } from '../security/PinManager';
import { validateTotem } from '../crypto/totem';
import { sha256 } from '@noble/hashes/sha256';

const MAX_QR_SIZE = 2000; // Tamanho máximo recomendado para QR Code
const CHUNK_SIZE = 1500; // Tamanho de cada chunk

/**
 * Criptografa dados usando AES-256 (simulado)
 */
function encryptAESData(data, key) {
  const dataBytes = new TextEncoder().encode(data);
  const keyHash = sha256(key);
  
  const encrypted = new Uint8Array(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ keyHash[i % keyHash.length];
  }
  
  return Buffer.from(encrypted).toString('base64');
}

/**
 * Divide dados em chunks para múltiplos QR Codes
 * @param {string} data - Dados a dividir
 * @returns {Array<string>} Array de chunks
 */
function splitIntoChunks(data) {
  const chunks = [];
  let index = 0;
  let chunkIndex = 0;

  while (index < data.length) {
    const chunk = data.substring(index, index + CHUNK_SIZE);
    chunks.push(chunk);
    index += CHUNK_SIZE;
    chunkIndex++;
  }

  return chunks;
}

/**
 * Gera dados para QR Code do backup
 * @returns {Promise<Object>} Dados do backup formatados para QR
 */
export async function generateQRBackupData() {
  try {
    // Carrega Totem
    const totem = await loadTotemSecure();
    if (!totem) {
      throw new Error('Nenhum Totem encontrado');
    }

    // Valida Totem
    if (!validateTotem(totem)) {
      throw new Error('Totem inválido - integridade comprometida');
    }

    // Obtém chave AES
    const aesKeyHex = await getAESKey();
    if (!aesKeyHex) {
      throw new Error('Chave AES não encontrada. Configure um PIN primeiro.');
    }

    const aesKey = Buffer.from(aesKeyHex, 'hex');

    // Prepara dados para exportação
    const exportData = {
      version: '1.0',
      totem: {
        privateKey: totem.privateKey,
        publicKey: totem.publicKey,
        totemId: totem.totemId,
        symbolicName: totem.symbolicName,
        recoveryPhrase: totem.recoveryPhrase,
      },
      timestamp: Date.now(),
    };

    // Serializa para JSON
    const jsonData = JSON.stringify(exportData);

    // Criptografa (usa mesma lógica do ExportTotem)
    const encrypted = encryptAESData(jsonData, aesKey);

    // Verifica se precisa dividir em chunks
    if (encrypted.length <= MAX_QR_SIZE) {
      // Cabe em um único QR Code
      return {
        type: 'single',
        data: encrypted,
        checksum: Buffer.from(sha256(new TextEncoder().encode(encrypted))).toString('hex'),
      };
    } else {
      // Precisa dividir em múltiplos QR Codes
      const chunks = splitIntoChunks(encrypted);
      const checksum = Buffer.from(sha256(new TextEncoder().encode(encrypted))).toString('hex');

      return {
        type: 'multi',
        chunks: chunks.map((chunk, index) => ({
          index,
          total: chunks.length,
          data: chunk,
        })),
        checksum,
      };
    }
  } catch (error) {
    throw new Error(`Erro ao gerar backup QR: ${error.message}`);
  }
}

/**
 * Reconstrói dados a partir de chunks de QR Code
 * @param {Array<Object>} chunks - Array de chunks recebidos
 * @param {string} checksum - Checksum esperado
 * @returns {Promise<string>} Dados reconstruídos
 */
export async function reconstructFromChunks(chunks, checksum) {
  try {
    // Ordena chunks por índice
    chunks.sort((a, b) => a.index - b.index);

    // Reconstrói dados
    const reconstructed = chunks.map(chunk => chunk.data).join('');

    // Valida checksum
    const computedChecksum = Buffer.from(sha256(new TextEncoder().encode(reconstructed))).toString('hex');
    if (computedChecksum !== checksum) {
      throw new Error('Dados corrompidos - checksum inválido');
    }

    return reconstructed;
  } catch (error) {
    throw new Error(`Erro ao reconstruir dados: ${error.message}`);
  }
}

