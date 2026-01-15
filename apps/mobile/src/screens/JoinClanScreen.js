import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import QRScannerModal from '../components/QRScannerModal';
import ClanManager from '../clans/ClanManager';
import ClanStorage from '../clans/ClanStorage';
import { getCurrentTotemId } from '../crypto/totemStorage';
import { loadTotemSecure } from '../storage/secureStore';
import MessagesManager from '../messages/MessagesManager';
import KeyExchangeService from '../services/KeyExchangeService';

export default function JoinClanScreen() {
  const navigation = useNavigation();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Inicializar KeyExchangeService quando Gateway estiver disponível
  useEffect(() => {
    if (MessagesManager.gatewayClient) {
      KeyExchangeService.init(MessagesManager.gatewayClient);
    }
  }, []);

  const handleJoinByCode = async () => {
    const code = inviteCode.toUpperCase().replace(/\s/g, '');
    
    if (!code.match(/^[A-Z0-9]{6}$/)) {
      Alert.alert('Código inválido', 'Use 6 letras ou números');
      return;
    }

    setLoading(true);
    setStatusMessage('Entrando no CLANN...');
    
    try {
      const totemId = await getCurrentTotemId(); 
      
      // 1. Primeiro, fazer o join local (adiciona como membro)
      const clan = await ClanManager.joinClan(code, totemId);
      
      // 2. MVP 1: Tentar Key Exchange via Gateway (se disponível)
      let keyExchangeSuccess = false;
      if (MessagesManager.isGatewayAvailable() && MessagesManager.gatewayClient) {
        try {
          setStatusMessage('Obtendo chave do grupo...');
          
          // Inicializar KeyExchangeService se necessário
          KeyExchangeService.init(MessagesManager.gatewayClient);
          
          // Iniciar fluxo de key exchange
          await KeyExchangeService.initiateJoin(code, clan.id);
          keyExchangeSuccess = true;
          
          console.log('[JoinClan] Key Exchange concluído com sucesso');
        } catch (keyExchangeError) {
          // Key Exchange falhou, mas join local foi bem-sucedido
          console.warn('[JoinClan] Key Exchange falhou (fundador pode estar offline):', keyExchangeError.message);
          // Não bloqueia o join - a chave será obtida quando o fundador estiver online
        }
      }
      
      setStatusMessage('');
      
      const successMessage = keyExchangeSuccess 
        ? `Bem-vindo(a) ao "${clan.name}"` 
        : `Bem-vindo(a) ao "${clan.name}"\n\n(Chave do grupo será sincronizada quando o fundador estiver online)`;
      
      Alert.alert(
        'Entrou no CLANN!',
        successMessage,
        [
          {
            text: 'Ir para CLANN',
            onPress: () => {
              navigation.navigate('ClanDetail', { clanId: clan.id });
              setInviteCode('');
            }
          }
        ]
      );
      
    } catch (error) {
      setStatusMessage('');
      Alert.alert('Erro ao entrar', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQRScanned = (data) => {
    setShowQRScanner(false);
    
    const match = data.match(/CLANN:([A-Z0-9]{6})/);
    if (match) {
      setInviteCode(match[1]);
    } else {
      Alert.alert('QR Code inválido', 'Este não é um código de CLANN válido');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Entrar em um CLANN</Text>
            <Text style={styles.subtitle}>
              Use um código de convite ou escaneie o QR Code
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Código de Convite</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: ABC123"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              maxLength={6}
              editable={!loading}
              placeholderTextColor="#666"
            />
            
            <TouchableOpacity
              style={[
                styles.button,
                (!inviteCode.trim() || loading) && styles.buttonDisabled
              ]}
              onPress={handleJoinByCode}
              disabled={!inviteCode.trim() || loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Entrando...' : '🎯 Entrar com Código'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Escanear QR Code</Text>
            
            <TouchableOpacity
              style={styles.qrButton}
              onPress={() => setShowQRScanner(true)}
              disabled={loading}
            >
              <Text style={styles.qrButtonText}>📷 Abrir Scanner</Text>
              <Text style={styles.qrButtonSubtext}>
                Aponte para o QR Code do CLANN
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.publicButton}
            onPress={() => Alert.alert('Em breve', 'Exploração de CLANNs públicos na próxima versão')}
          >
            <Text style={styles.publicButtonText}>
              🔍 Explorar CLANNs Públicos
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanned={handleQRScanned}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a'
  },
  keyboardView: {
    flex: 1
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center'
  },
  header: {
    alignItems: 'center',
    marginBottom: 40
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center'
  },
  section: {
    marginBottom: 30
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 18,
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 4,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20
  },
  button: {
    backgroundColor: '#27ae60',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center'
  },
  buttonDisabled: {
    backgroundColor: '#2a2a2a',
    opacity: 0.5
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333'
  },
  dividerText: {
    color: '#666',
    paddingHorizontal: 20,
    fontSize: 16
  },
  qrButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed'
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8
  },
  qrButtonSubtext: {
    color: '#888',
    fontSize: 14
  },
  publicButton: {
    marginTop: 20,
    padding: 16,
    alignItems: 'center',
    opacity: 0.7
  },
  publicButtonText: {
    color: '#4a90e2',
    fontSize: 16
  }
});

