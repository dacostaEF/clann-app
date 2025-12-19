/**
 * Tela de Importação de Identidade
 * Permite importar Totem a partir de backup criptografado
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { importTotemFromPicker, importTotemFromQR } from '../backup/ImportTotem';
import { hasTotemSecure } from '../storage/secureStore';
import { useTotem } from '../context/TotemContext';
import QRScannerModal from '../components/QRScannerModal';

export default function ImportIdentityScreen({ navigation }) {
  const { setTotem } = useTotem();
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [importMode, setImportMode] = useState(null); // 'file' ou 'qr'
  const [qrChunks, setQrChunks] = useState([]);
  const [qrChecksum, setQrChecksum] = useState(null);

  const handleImport = async () => {
    if (!pin || pin.length < 4) {
      Alert.alert('Atenção', 'Digite o PIN usado para criptografar o backup');
      return;
    }

    setLoading(true);
    try {
      // Verifica se já existe Totem
      const hasTotem = await hasTotemSecure();
      if (hasTotem) {
        Alert.alert(
          'Atenção',
          'Já existe um Totem configurado. A importação irá substituí-lo. Deseja continuar?',
          [
            {
              text: 'Cancelar',
              style: 'cancel',
            },
            {
              text: 'Continuar',
              style: 'destructive',
              onPress: async () => {
                await performImport();
              },
            },
          ]
        );
      } else {
        await performImport();
      }
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível importar o backup');
      setLoading(false);
    }
  };

  const performImport = async () => {
    try {
      let totem;
      
      if (importMode === 'qr') {
        // Importar via QR Code
        const qrData = qrChunks.length > 0 
          ? { type: 'multi', chunks: qrChunks, checksum: qrChecksum }
          : qrChunks[0] || null;
        
        if (!qrData) {
          throw new Error('Nenhum QR Code escaneado');
        }
        
        totem = await importTotemFromQR(qrData, pin);
      } else {
        // Importar via arquivo
        totem = await importTotemFromPicker(pin);
      }
      
      // Atualizar TotemContext
      setTotem(totem);
      
      Alert.alert(
        'Sucesso',
        `Totem "${totem.symbolicName}" importado com sucesso!`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navegar para CreatePin conforme Dose 3
              navigation.replace('CreatePin');
            },
          },
        ]
      );
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
      setPin('');
      setShowPinInput(false);
      setImportMode(null);
      setQrChunks([]);
      setQrChecksum(null);
    }
  };

  const handleSelectFile = () => {
    setImportMode('file');
    setShowPinInput(true);
  };

  const handleScanQR = () => {
    setImportMode('qr');
    setShowQRScanner(true);
  };

  const handleQRScanned = (data) => {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.type === 'multi' && parsed.chunks) {
        // QR Code múltiplo
        const existingChunk = qrChunks.find(c => c.index === parsed.chunks[0].index);
        if (!existingChunk) {
          setQrChunks([...qrChunks, ...parsed.chunks]);
          setQrChecksum(parsed.checksum);
          
          if (parsed.chunks.length === parsed.chunks[0].total) {
            // Todos os chunks foram escaneados
            setShowQRScanner(false);
            setShowPinInput(true);
            Alert.alert('Sucesso', 'Todos os QR Codes foram escaneados. Digite o PIN.');
          } else {
            Alert.alert('QR Code escaneado', `Escaneado ${qrChunks.length + parsed.chunks.length} de ${parsed.chunks[0].total}. Continue escaneando.`);
          }
        } else {
          Alert.alert('QR Code já escaneado', 'Este QR Code já foi escaneado.');
        }
      } else {
        // QR Code único
        setQrChunks([parsed]);
        setShowQRScanner(false);
        setShowPinInput(true);
        Alert.alert('QR Code escaneado', 'Digite o PIN para descriptografar.');
      }
    } catch (error) {
      // Se não for JSON, assume que é o encrypted data direto
      setQrChunks([{ data, index: 0, total: 1 }]);
      setShowQRScanner(false);
      setShowPinInput(true);
      Alert.alert('QR Code escaneado', 'Digite o PIN para descriptografar.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="cloud-upload-outline" size={64} color="#4a90e2" />
              <Text style={styles.title}>Importar Identidade</Text>
              <Text style={styles.subtitle}>
                Restaure seu Totem a partir de um backup criptografado. Você precisará do PIN usado na exportação.
              </Text>
            </View>

            {!showPinInput ? (
              <>
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={24} color="#4a90e2" />
                  <Text style={styles.infoText}>
                    Escolha como deseja importar seu Totem: via arquivo ou QR Code.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.importButton, loading && styles.importButtonDisabled]}
                  onPress={handleSelectFile}
                  disabled={loading}
                >
                  <Ionicons name="folder-open-outline" size={32} color="#ffffff" />
                  <Text style={styles.importButtonText}>Importar de Arquivo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.importButton, styles.importButtonQR, loading && styles.importButtonDisabled]}
                  onPress={handleScanQR}
                  disabled={loading}
                >
                  <Ionicons name="qr-code-outline" size={32} color="#ffffff" />
                  <Text style={styles.importButtonText}>Escanear QR Code</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.pinContainer}>
                  <Text style={styles.pinLabel}>Digite o PIN do backup:</Text>
                  <TextInput
                    style={styles.pinInput}
                    value={pin}
                    onChangeText={setPin}
                    placeholder="PIN (4-6 dígitos)"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={6}
                  />
                </View>

                <View style={styles.buttonsContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => {
                      setShowPinInput(false);
                      setPin('');
                    }}
                    disabled={loading}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.importButton, loading && styles.importButtonDisabled]}
                    onPress={handleImport}
                    disabled={loading || pin.length < 4}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.importButtonText}>Importar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => {
          setShowQRScanner(false);
          if (qrChunks.length === 0) {
            setImportMode(null);
          }
        }}
        onScanned={handleQRScanned}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    color: '#a0a0a0',
    fontSize: 14,
    marginLeft: 12,
    lineHeight: 20,
  },
  importButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  importButtonQR: {
    backgroundColor: '#2a2a3e',
    borderWidth: 1,
    borderColor: '#4a90e2',
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  pinContainer: {
    marginBottom: 32,
  },
  pinLabel: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
  },
  pinInput: {
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#2a2a3e',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2a2a3e',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#2a2a3e',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

