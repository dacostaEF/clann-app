/**
 * ScanLinkScreen - Tela para escanear QR Code de vinculação de dispositivo
 * Sprint 7 - ETAPA 1: Multidispositivo (Linked Devices)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import QRScannerModal from '../components/QRScannerModal';
import { processLinkQR } from '../security/DeviceLinkManager';

export default function ScanLinkScreen() {
  const navigation = useNavigation();
  
  const [scannerVisible, setScannerVisible] = useState(true);
  const [processing, setProcessing] = useState(false);

  const handleQRScanned = async (data) => {
    if (processing) return; // Evita processamento duplicado
    
    try {
      setProcessing(true);
      setScannerVisible(false);

      // Processa QR Code
      const result = await processLinkQR(data);
      
      Alert.alert(
        'Dispositivo Vinculado!',
        'Este dispositivo foi vinculado com sucesso ao seu Totem.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao processar QR Code:', error);
      
      Alert.alert(
        'Erro ao Vincular',
        error.message || 'Não foi possível vincular o dispositivo. Verifique se o QR Code é válido e corresponde ao seu Totem.',
        [
          {
            text: 'Tentar Novamente',
            onPress: () => {
              setProcessing(false);
              setScannerVisible(true);
            },
          },
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setScannerVisible(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#000000', '#0A0F24', '#000000']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleClose}
          >
            <Text style={styles.backButtonText}>✕ Cancelar</Text>
          </TouchableOpacity>
        </View>

        {/* Instruções */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>
            Escaneie o QR Code
          </Text>
          <Text style={styles.instructionsText}>
            Aponte a câmera para o QR Code exibido no outro dispositivo para vincular este dispositivo ao seu Totem.
          </Text>
        </View>

        {/* Processing Indicator */}
        {processing && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#4a90e2" />
            <Text style={styles.processingText}>
              Processando vinculação...
            </Text>
          </View>
        )}

        {/* QR Scanner */}
        <QRScannerModal
          visible={scannerVisible}
          onClose={handleClose}
          onScanned={handleQRScanned}
        />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsContainer: {
    padding: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  instructionsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
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
  processingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  processingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
});

