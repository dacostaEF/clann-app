/**
 * LinkDeviceScreen - Tela para gerar QR Code de vinculação de dispositivo
 * Sprint 7 - ETAPA 1: Multidispositivo (Linked Devices)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCodeSVG from 'react-native-qrcode-svg';
import { generateLinkQRData, getLinkedDevices } from '../security/DeviceLinkManager';
import { useTotem } from '../context/TotemContext';

export default function LinkDeviceScreen() {
  const navigation = useNavigation();
  const { totem } = useTotem();
  
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkedDevices, setLinkedDevices] = useState([]);

  useEffect(() => {
    loadQRData();
    loadLinkedDevices();
  }, []);

  const loadQRData = async () => {
    try {
      setLoading(true);
      const data = await generateLinkQRData();
      setQrData(data);
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      Alert.alert('Erro', 'Não foi possível gerar o QR Code de vinculação');
    } finally {
      setLoading(false);
    }
  };

  const loadLinkedDevices = async () => {
    try {
      const devices = await getLinkedDevices();
      setLinkedDevices(devices);
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
    }
  };

  const handleRefresh = () => {
    loadQRData();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#000000', '#0A0F24', '#000000']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Vincular Dispositivo</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Instruções */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>
              Escaneie este QR Code em outro dispositivo
            </Text>
            <Text style={styles.instructionsText}>
              Use o mesmo Totem no outro dispositivo e escaneie este código para vincular os dispositivos.
            </Text>
          </View>

          {/* QR Code Card */}
          <View style={styles.qrCard}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4a90e2" />
                <Text style={styles.loadingText}>Gerando QR Code...</Text>
              </View>
            ) : qrData ? (
              <>
                <View style={styles.qrContainer}>
                  <QRCodeSVG
                    value={qrData}
                    size={250}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                    logo={null}
                  />
                </View>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={handleRefresh}
                >
                  <Text style={styles.refreshButtonText}>🔄 Atualizar QR Code</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Erro ao gerar QR Code</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={loadQRData}
                >
                  <Text style={styles.retryButtonText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Dispositivos Vinculados */}
          {linkedDevices.length > 0 && (
            <View style={styles.devicesContainer}>
              <Text style={styles.devicesTitle}>Dispositivos Vinculados</Text>
              {linkedDevices.map((device, index) => (
                <View key={device.device_id || index} style={styles.deviceItem}>
                  <Text style={styles.deviceId}>
                    📱 Dispositivo {device.device_id.substring(0, 8)}...
                  </Text>
                  <Text style={styles.deviceDate}>
                    Vinculado em {new Date(device.linked_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              ⚠️ Apenas dispositivos com o mesmo Totem podem ser vinculados.
            </Text>
            <Text style={styles.infoText}>
              🔒 A vinculação é segura e usa criptografia de ponta a ponta.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#4a90e2',
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  instructionsContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 14,
    color: '#AFAFAF',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  qrCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#AFAFAF',
    marginTop: 16,
    fontSize: 14,
  },
  refreshButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  devicesContainer: {
    marginBottom: 30,
  },
  devicesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  deviceItem: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  deviceId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  deviceDate: {
    fontSize: 12,
    color: '#AFAFAF',
  },
  infoContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  infoText: {
    fontSize: 12,
    color: '#AFAFAF',
    marginBottom: 8,
    lineHeight: 18,
  },
});

