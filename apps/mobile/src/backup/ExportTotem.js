/**
 * Módulo de exportação do Totem
 * Exporta Totem criptografado com AES-256
 */

import { loadTotemSecure } from '../storage/secureStore';
import { getAESKey } from '../security/PinManager';
import { validateTotem } from '../crypto/totem';
import { sha256 } from '@noble/hashes/sha256';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Criptografa dados usando AES-256 (simulado com XOR + SHA256)
 * Nota: Em produção, use uma biblioteca de criptografia adequada
 * @param {string} data - Dados a criptografar (JSON string)
 * @param {Uint8Array} key - Chave AES de 32 bytes
 * @returns {string} Dados criptografados em base64
 */
function encryptAES(data, key) {
  // Implementação simplificada: usa XOR com chave derivada
  // Em produção, use crypto-js ou expo-crypto para AES real
  const dataBytes = new TextEncoder().encode(data);
  const keyHash = sha256(key);
  
  const encrypted = new Uint8Array(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ keyHash[i % keyHash.length];
  }
  
  return Buffer.from(encrypted).toString('base64');
}

/**
 * Exporta Totem para arquivo JSON criptografado
 * @returns {Promise<string>} Caminho do arquivo exportado
 */
export async function exportTotem() {
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
      checksum: null, // Será calculado após criptografia
    };

    // Serializa para JSON
    const jsonData = JSON.stringify(exportData);

    // Criptografa
    const encrypted = encryptAES(jsonData, aesKey);

    // Calcula checksum
    const checksum = Buffer.from(sha256(new TextEncoder().encode(encrypted))).toString('hex');

    // Adiciona checksum ao objeto final
    const finalData = {
      encrypted,
      checksum,
      version: '1.0',
    };

    // Salva arquivo
    const fileName = 'clan-backup.cln';
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(finalData), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return fileUri;
  } catch (error) {
    throw new Error(`Erro ao exportar Totem: ${error.message}`);
  }
}

/**
 * Compartilha arquivo de backup
 * @param {string} fileUri - URI do arquivo
 * @returns {Promise<void>}
 */
export async function shareBackupFile(fileUri) {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Compartilhamento não disponível neste dispositivo');
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Exportar backup do CLÃ',
    });
  } catch (error) {
    throw new Error(`Erro ao compartilhar arquivo: ${error.message}`);
  }
}

/**
 * Exporta e compartilha Totem em uma única operação
 * @returns {Promise<void>}
 */
export async function exportAndShareTotem() {
  const fileUri = await exportTotem();
  await shareBackupFile(fileUri);
}

