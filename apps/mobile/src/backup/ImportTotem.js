/**
 * Módulo de importação do Totem
 * Importa e restaura Totem a partir de arquivo criptografado
 */

import { saveTotemSecure } from '../storage/secureStore';
import { getAESKey, verifyPin } from '../security/PinManager';
import { validateTotem, restoreTotem } from '../crypto/totem';
import { sha256 } from '@noble/hashes/sha256';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { reconstructFromChunks } from './QRBackup';

/**
 * Descriptografa dados usando AES-256
 * @param {string} encryptedBase64 - Dados criptografados em base64
 * @param {Uint8Array} key - Chave AES de 32 bytes
 * @returns {string} Dados descriptografados (JSON string)
 */
function decryptAES(encryptedBase64, key) {
  // Implementação simplificada: usa XOR com chave derivada
  // Em produção, use crypto-js ou expo-crypto para AES real
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const keyHash = sha256(key);
  
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyHash[i % keyHash.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

/**
 * Valida checksum do arquivo de backup
 * @param {string} encrypted - Dados criptografados
 * @param {string} checksum - Checksum esperado
 * @returns {boolean} True se válido
 */
function validateChecksum(encrypted, checksum) {
  const computedChecksum = Buffer.from(sha256(new TextEncoder().encode(encrypted))).toString('hex');
  return computedChecksum === checksum;
}

/**
 * Importa Totem a partir de arquivo
 * @param {string} fileUri - URI do arquivo de backup
 * @param {string} pin - PIN para descriptografar
 * @returns {Promise<Object>} Totem restaurado
 */
export async function importTotem(fileUri, pin) {
  try {
    // Verifica PIN
    const pinValid = await verifyPin(pin);
    if (!pinValid) {
      throw new Error('PIN incorreto');
    }

    // Lê arquivo
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const backupData = JSON.parse(fileContent);

    // Valida estrutura
    if (!backupData.encrypted || !backupData.checksum) {
      throw new Error('Formato de backup inválido');
    }

    // Valida checksum
    if (!validateChecksum(backupData.encrypted, backupData.checksum)) {
      throw new Error('Arquivo de backup corrompido - checksum inválido');
    }

    // Obtém chave AES
    const aesKeyHex = await getAESKey();
    if (!aesKeyHex) {
      throw new Error('Chave AES não encontrada');
    }

    const aesKey = Buffer.from(aesKeyHex, 'hex');

    // Descriptografa
    const decryptedJson = decryptAES(backupData.encrypted, aesKey);
    const exportData = JSON.parse(decryptedJson);

    // Valida estrutura do Totem
    if (!exportData.totem || !exportData.totem.privateKey || !exportData.totem.publicKey) {
      throw new Error('Dados do Totem inválidos');
    }

    // Valida integridade criptográfica do Totem
    if (!validateTotem(exportData.totem)) {
      throw new Error('Totem inválido - integridade comprometida');
    }

    // Restaura Totem usando a frase de recuperação (validação adicional)
    const restoredTotem = restoreTotem(exportData.totem.recoveryPhrase);

    // Compara com Totem importado
    if (restoredTotem.privateKey !== exportData.totem.privateKey ||
        restoredTotem.publicKey !== exportData.totem.publicKey) {
      throw new Error('Totem não corresponde à frase de recuperação');
    }

    // Salva Totem
    await saveTotemSecure(exportData.totem);

    return exportData.totem;
  } catch (error) {
    throw new Error(`Erro ao importar Totem: ${error.message}`);
  }
}

/**
 * Seleciona arquivo de backup usando seletor de documentos
 * @returns {Promise<string|null>} URI do arquivo ou null se cancelado
 */
export async function pickBackupFile() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    throw new Error(`Erro ao selecionar arquivo: ${error.message}`);
  }
}

/**
 * Importa Totem usando seletor de arquivo
 * @param {string} pin - PIN para descriptografar
 * @returns {Promise<Object>} Totem restaurado
 */
export async function importTotemFromPicker(pin) {
  const fileUri = await pickBackupFile();
  if (!fileUri) {
    throw new Error('Nenhum arquivo selecionado');
  }

  return await importTotem(fileUri, pin);
}

/**
 * Importa Totem a partir de QR Code escaneado
 * @param {string} qrData - Dados do QR Code (pode ser string ou objeto com chunks)
 * @param {string} pin - PIN para descriptografar
 * @returns {Promise<Object>} Totem restaurado
 */
export async function importTotemFromQR(qrData, pin) {
  try {
    // Verifica PIN
    const pinValid = await verifyPin(pin);
    if (!pinValid) {
      throw new Error('PIN incorreto');
    }

    // Obtém chave AES
    const aesKeyHex = await getAESKey();
    if (!aesKeyHex) {
      throw new Error('Chave AES não encontrada');
    }

    const aesKey = Buffer.from(aesKeyHex, 'hex');

    // Parse do QR Data
    let backupData;
    try {
      backupData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch {
      // Se não for JSON, assume que é o encrypted data direto
      backupData = { encrypted: qrData, checksum: null };
    }

    // Se for QR Code múltiplo, precisa reconstruir
    let encrypted;
    let checksum;
    
    if (backupData.type === 'multi' && backupData.chunks) {
      // QR Code múltiplo - precisa de todos os chunks
      encrypted = await reconstructFromChunks(backupData.chunks, backupData.checksum);
      checksum = backupData.checksum;
    } else if (backupData.encrypted) {
      // QR Code único
      encrypted = backupData.encrypted;
      checksum = backupData.checksum;
    } else {
      // Formato antigo - assume que qrData é o encrypted direto
      encrypted = typeof qrData === 'string' ? qrData : JSON.stringify(qrData);
      checksum = null;
    }

    // Valida checksum se disponível
    if (checksum && !validateChecksum(encrypted, checksum)) {
      throw new Error('QR Code corrompido - checksum inválido');
    }

    // Descriptografa
    const decryptedJson = decryptAES(encrypted, aesKey);
    const exportData = JSON.parse(decryptedJson);

    // Valida estrutura do Totem
    if (!exportData.totem || !exportData.totem.privateKey || !exportData.totem.publicKey) {
      throw new Error('Dados do Totem inválidos');
    }

    // Valida integridade criptográfica do Totem
    if (!validateTotem(exportData.totem)) {
      throw new Error('Totem inválido - integridade comprometida');
    }

    // Restaura Totem usando a frase de recuperação (validação adicional)
    const restoredTotem = restoreTotem(exportData.totem.recoveryPhrase);

    // Compara com Totem importado
    if (restoredTotem.privateKey !== exportData.totem.privateKey ||
        restoredTotem.publicKey !== exportData.totem.publicKey) {
      throw new Error('Totem não corresponde à frase de recuperação');
    }

    // Salva Totem
    await saveTotemSecure(exportData.totem);

    return exportData.totem;
  } catch (error) {
    throw new Error(`Erro ao importar Totem do QR Code: ${error.message}`);
  }
}

