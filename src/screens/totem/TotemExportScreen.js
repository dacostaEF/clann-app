import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import QRCodeSVG from 'react-native-qrcode-svg';
import { exportTotem, shareBackupFile } from '../../backup/ExportTotem';
import { generateQRBackupData } from '../../backup/QRBackup';
import { loadTotemSecure } from '../../storage/secureStore';
import { getAESKey } from '../../security/PinManager';

export default function TotemExportScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState(null);

  const handleExportFile = async () => {
    setExporting(true);
    try {
      // Verificar se Totem existe
      const totem = await loadTotemSecure();
      if (!totem) {
        Alert.alert('Erro', 'Nenhum Totem encontrado');
        return;
      }

      // Verificar se PIN está configurado
      const aesKey = await getAESKey();
      if (!aesKey) {
        Alert.alert('Erro', 'Configure um PIN primeiro para exportar o Totem');
        return;
      }

      // Exportar Totem
      const fileUri = await exportTotem();
      
      // Compartilhar arquivo
      await shareBackupFile(fileUri);
      
      Alert.alert('Sucesso', 'Totem exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Totem:', error);
      Alert.alert('Erro', `Não foi possível exportar o Totem: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportQR = async () => {
    setLoading(true);
    try {
      // Verificar se Totem existe
      const totem = await loadTotemSecure();
      if (!totem) {
        Alert.alert('Erro', 'Nenhum Totem encontrado');
        return;
      }

      // Verificar se PIN está configurado
      const aesKey = await getAESKey();
      if (!aesKey) {
        Alert.alert('Erro', 'Configure um PIN primeiro para exportar o Totem');
        return;
      }

      // Gerar dados do QR Code
      const qrBackupData = await generateQRBackupData();
      
      // Se for QR Code múltiplo, mostrar aviso
      if (qrBackupData.type === 'multi') {
        Alert.alert(
          'QR Code Múltiplo',
          `O backup é muito grande e foi dividido em ${qrBackupData.chunks.length} QR Codes. Escaneie todos na ordem.`,
          [{ text: 'OK', onPress: () => setShowQRModal(true) }]
        );
      } else {
        setShowQRModal(true);
      }
      
      setQrData(qrBackupData);
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      Alert.alert('Erro', `Não foi possível gerar o QR Code: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.title}>Exportar Identidade</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.emoji}>📤</Text>
          </View>

          <Text style={styles.subtitle}>
            Exporte seu Totem de forma segura para fazer backup ou restaurar em outro dispositivo.
          </Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.exportButton, (loading || exporting) && styles.exportButtonDisabled]}
              onPress={handleExportFile}
              disabled={loading || exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={24} color="#ffffff" />
                  <Text style={styles.exportButtonText}>Exportar como Arquivo</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportButton, styles.exportButtonQR, (loading || exporting) && styles.exportButtonDisabled]}
              onPress={handleExportQR}
              disabled={loading || exporting}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="qr-code-outline" size={24} color="#ffffff" />
                  <Text style={styles.exportButtonText}>Exportar como QR Code</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#4a90e2" />
            <Text style={styles.infoText}>
              O backup é criptografado com seu PIN. Mantenha-o seguro e não compartilhe com ninguém.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Modal de QR Code */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>QR Code do Backup</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowQRModal(false)}
              >
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {qrData && (
              <View style={styles.qrContainer}>
                {qrData.type === 'single' ? (
                  <>
                    <QRCodeSVG
                      value={qrData.data}
                      size={250}
                      color="#000000"
                      backgroundColor="#ffffff"
                    />
                    <Text style={styles.qrInfo}>
                      Escaneie este QR Code para restaurar seu Totem
                    </Text>
                  </>
                ) : (
                  <View style={styles.multiQRContainer}>
                    <Text style={styles.multiQRTitle}>
                      QR Code {qrData.chunks.length} de {qrData.chunks.length}
                    </Text>
                    <Text style={styles.multiQRInfo}>
                      O backup foi dividido em múltiplos QR Codes. Escaneie todos na ordem.
                    </Text>
                    {qrData.chunks.map((chunk, index) => (
                      <View key={index} style={styles.qrChunkContainer}>
                        <Text style={styles.qrChunkLabel}>QR Code {chunk.index + 1}</Text>
                        <QRCodeSVG
                          value={chunk.data}
                          size={200}
                          color="#000000"
                          backgroundColor="#ffffff"
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.modalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 8,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  emoji: {
    fontSize: 64,
  },
  subtitle: {
    fontSize: 18,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
  },
  listContainer: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  listText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 12,
    flex: 1,
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  exportButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  exportButtonQR: {
    backgroundColor: '#2a2a3e',
    borderWidth: 1,
    borderColor: '#4a90e2',
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    color: '#a0a0a0',
    fontSize: 14,
    marginLeft: 12,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalCloseButton: {
    padding: 4,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrInfo: {
    marginTop: 16,
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
  },
  multiQRContainer: {
    width: '100%',
  },
  multiQRTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  multiQRInfo: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 24,
  },
  qrChunkContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrChunkLabel: {
    fontSize: 14,
    color: '#4a90e2',
    marginBottom: 12,
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

