/**
 * Tela de Exportação de Identidade
 * Permite exportar Totem criptografado
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { exportAndShareTotem, exportTotem } from '../backup/ExportTotem';
import { generateQRBackupData } from '../backup/QRBackup';

export default function ExportIdentityScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [exportMethod, setExportMethod] = useState(null); // 'file' ou 'qr'

  const handleExportFile = async () => {
    setLoading(true);
    try {
      await exportAndShareTotem();
      Alert.alert('Sucesso', 'Backup exportado com sucesso!');
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível exportar o backup');
    } finally {
      setLoading(false);
    }
  };

  const handleExportQR = async () => {
    setLoading(true);
    try {
      const qrData = await generateQRBackupData();
      
      if (qrData.type === 'single') {
        Alert.alert(
          'QR Code Gerado',
          'O QR Code será exibido na próxima tela. Escaneie com outro dispositivo para fazer backup.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navegaria para tela de QR Code (não implementada no Sprint 2)
                Alert.alert('Info', 'Visualização de QR Code será implementada em sprint futura');
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Múltiplos QR Codes',
          `O backup foi dividido em ${qrData.chunks.length} QR Codes. Todos devem ser escaneados para restaurar.`,
          [
            {
              text: 'OK',
              onPress: () => {
                Alert.alert('Info', 'Visualização de QR Codes será implementada em sprint futura');
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível gerar QR Code');
    } finally {
      setLoading(false);
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
              <Ionicons name="download-outline" size={64} color="#4a90e2" />
              <Text style={styles.title}>Exportar Identidade</Text>
              <Text style={styles.subtitle}>
                Exporte seu Totem criptografado para fazer backup. O arquivo será protegido com seu PIN.
              </Text>
            </View>

            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={24} color="#fbbf24" />
              <Text style={styles.warningText}>
                Mantenha o backup em local seguro. Qualquer pessoa com acesso ao arquivo e seu PIN poderá restaurar seu Totem.
              </Text>
            </View>

            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[styles.optionButton, loading && styles.optionButtonDisabled]}
                onPress={handleExportFile}
                disabled={loading}
              >
                <Ionicons name="document-text-outline" size={32} color="#4a90e2" />
                <Text style={styles.optionTitle}>Exportar Arquivo</Text>
                <Text style={styles.optionDescription}>
                  Salva como arquivo .cln criptografado
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionButton, loading && styles.optionButtonDisabled]}
                onPress={handleExportQR}
                disabled={loading}
              >
                <Ionicons name="qr-code-outline" size={32} color="#4a90e2" />
                <Text style={styles.optionTitle}>Exportar QR Code</Text>
                <Text style={styles.optionDescription}>
                  Gera QR Code(s) para backup visual
                </Text>
              </TouchableOpacity>
            </View>

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4a90e2" />
                <Text style={styles.loadingText}>Processando...</Text>
              </View>
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
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#2a1a0a',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  warningText: {
    flex: 1,
    color: '#fbbf24',
    fontSize: 14,
    marginLeft: 12,
    lineHeight: 20,
  },
  optionsContainer: {
    marginBottom: 32,
  },
  optionButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  optionButtonDisabled: {
    opacity: 0.5,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  loadingText: {
    color: '#a0a0a0',
    marginTop: 12,
    fontSize: 16,
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

