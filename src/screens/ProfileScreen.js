import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Animated,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { useTotem } from '../context/TotemContext';
import { getTotemStats } from '../crypto/totemStorage';
import { loadTotemSecure, saveTotemSecure } from '../storage/secureStore';
import SecretPhraseModal from '../components/totem/SecretPhraseModal';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { totem, loading, setTotem } = useTotem();
  const [customName, setCustomName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [stats, setStats] = useState({
    createdAt: null,
    clannsCreated: 0,
    clannsJoined: 0,
    messagesSent: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretPhrase, setSecretPhrase] = useState(null);

  const handleExportIdentity = () => {
    navigation.navigate('TotemExport');
  };

  const handleSecurityAudit = () => {
    navigation.navigate('TotemAudit');
  };

  const handleBackup = () => {
    navigation.navigate('TotemBackup');
  };

  const handleShowRecoveryPhrase = async () => {
    try {
      // Carregar totem completo do SecureStore para obter recoveryPhrase
      const fullTotem = await loadTotemSecure();
      if (fullTotem?.recoveryPhrase) {
        // Converter recoveryPhrase (string) para array de palavras
        const words = typeof fullTotem.recoveryPhrase === 'string'
          ? fullTotem.recoveryPhrase.trim().split(/\s+/).filter(w => w.length > 0)
          : fullTotem.recoveryPhrase;
        setSecretPhrase(words);
        setShowSecretModal(true);
      } else {
        Alert.alert(
          'Frase Secreta Não Encontrada',
          'A frase de recuperação não está disponível para este Totem.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Erro ao carregar frase secreta:', error);
      Alert.alert(
        'Erro',
        'Não foi possível carregar a frase secreta.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleCopyTotemId = async () => {
    if (totem?.totemId) {
      await Clipboard.setStringAsync(totem.totemId);
      Alert.alert('Copiado', 'Totem ID copiado para a área de transferência');
    }
  };

  const handleSaveName = async () => {
    // Validar nome
    const trimmedName = customName.trim();
    if (!trimmedName || trimmedName.length === 0) {
      Alert.alert('Erro', 'Nome não pode estar vazio');
      return;
    }
    if (trimmedName.length > 50) {
      Alert.alert('Erro', 'Nome muito longo (máximo 50 caracteres)');
      return;
    }

    setSavingName(true);
    try {
      // Carregar Totem atual
      const currentTotem = await loadTotemSecure();
      if (!currentTotem) {
        Alert.alert('Erro', 'Totem não encontrado');
        return;
      }

      // Garantir que totemId não seja alterado
      if (!currentTotem.totemId) {
        Alert.alert('Erro', 'Totem inválido - totemId ausente');
        return;
      }

      // Atualizar apenas symbolicName
      const updatedTotem = {
        ...currentTotem,
        symbolicName: trimmedName,
      };

      // Salvar Totem atualizado
      await saveTotemSecure(updatedTotem);

      // Atualizar TotemContext
      setTotem(updatedTotem);

      // Limpar campo e dar feedback
      setCustomName('');
      Alert.alert('Sucesso', 'Nome do Totem atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao renomear Totem:', error);
      Alert.alert('Erro', `Não foi possível atualizar o nome: ${error.message}`);
    } finally {
      setSavingName(false);
    }
  };

  const handleViewDevices = () => {
    navigation.navigate('LinkedDevices');
  };

  const handleViewStats = () => {
    navigation.navigate('TotemStats');
  };

  const handleAboutTotem = () => {
    navigation.navigate('TotemAbout');
  };

  // Carregar estatísticas do Totem
  useEffect(() => {
    const loadStats = async () => {
      if (loading || !totem) {
        return;
      }
      
      try {
        setStatsLoading(true);
        const totemStats = await getTotemStats();
        setStats(totemStats);
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, [totem, loading]);

  // Formatar data de criação
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  // Componente reutilizável para animação de press
  const AnimatedPressable = ({ children, onPress, style }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
      Animated.spring(scale, { 
        toValue: 0.97, 
        useNativeDriver: true,
        tension: 300,
        friction: 10
      }).start();
    };

    const onPressOut = () => {
      Animated.spring(scale, { 
        toValue: 1, 
        useNativeDriver: true,
        tension: 300,
        friction: 10
      }).start();
    };

    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={onPress}
          style={style}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>Carregando Totem...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!totem) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Totem não encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayTotemId = totem.totemId ? totem.totemId.substring(0, 8).toUpperCase() + '...' : 'N/A';
  const displayPublicKey = totem.publicKey 
    ? `${totem.publicKey.substring(0, 12)}...${totem.publicKey.substring(totem.publicKey.length - 12)}`
    : 'N/A';

  return (
    <SafeAreaView style={styles.container}>
      {/* Fade indicators */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0)']}
        style={styles.fadeTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.8)']}
        style={styles.fadeBottom}
        pointerEvents="none"
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Perfil do Totem</Text>
          <Text style={styles.subtitle}>
            Informações da sua identidade digital
          </Text>
        </View>

        {/* SEÇÃO 1: Identidade do Totem */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield" size={20} color="#4a90e2" />
            <Text style={styles.sectionTitle}>Identidade do Totem</Text>
          </View>
          
          <View style={styles.card}>
            <View style={styles.totemHeader}>
              <View style={styles.totemIconContainer}>
                <Ionicons name="shield" size={40} color="#4a90e2" />
              </View>
              <Text style={styles.totemName}>{totem.symbolicName || 'Totem'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Totem ID</Text>
              <View style={styles.infoValueContainer}>
                <Text style={styles.infoValue}>{displayTotemId}</Text>
                <AnimatedPressable 
                  style={styles.copyButton}
                  onPress={handleCopyTotemId}
                >
                  <Ionicons name="copy-outline" size={16} color="#4a90e2" />
                </AnimatedPressable>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Chave Pública</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {displayPublicKey}
              </Text>
            </View>
          </View>
        </View>

        {/* SEÇÃO 2: Renomear Totem */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={20} color="#4a90e2" />
            <Text style={styles.sectionTitle}>Renomear Totem</Text>
          </View>
          
          <View style={styles.card}>
            <TextInput
              style={styles.nameInput}
              placeholder="Digite um novo nome para o Totem"
              placeholderTextColor="#666"
              value={customName}
              onChangeText={setCustomName}
              maxLength={50}
            />
            <AnimatedPressable
              style={[styles.saveButton, savingName && styles.saveButtonDisabled]}
              onPress={handleSaveName}
              disabled={savingName}
            >
              {savingName ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                  <Text style={styles.saveButtonText}>Salvar Nome</Text>
                </>
              )}
            </AnimatedPressable>
          </View>
        </View>

        {/* SEÇÃO 3: Estatísticas do Totem */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart-outline" size={20} color="#4a90e2" />
            <Text style={styles.sectionTitle}>Estatísticas</Text>
          </View>
          
          <View style={styles.card}>
            {statsLoading ? (
              <View style={styles.statsLoadingContainer}>
                <ActivityIndicator size="small" color="#4a90e2" />
                <Text style={styles.statsLoadingText}>Carregando...</Text>
              </View>
            ) : (
              <>
                <View style={styles.statRow}>
                  <Ionicons name="calendar-outline" size={18} color="#999" />
                  <Text style={styles.statLabel}>Data de criação</Text>
                  <Text style={styles.statValue}>{formatDate(stats.createdAt)}</Text>
                </View>
                <View style={styles.statRow}>
                  <Ionicons name="people-outline" size={18} color="#999" />
                  <Text style={styles.statLabel}>CLANNs criados</Text>
                  <Text style={styles.statValue}>{stats.clannsCreated}</Text>
                </View>
                <View style={styles.statRow}>
                  <Ionicons name="people-circle-outline" size={18} color="#999" />
                  <Text style={styles.statLabel}>CLANNs participando</Text>
                  <Text style={styles.statValue}>{stats.clannsJoined}</Text>
                </View>
                <View style={[styles.statRow, styles.statRowLast]}>
                  <Ionicons name="chatbubbles-outline" size={18} color="#999" />
                  <Text style={styles.statLabel}>Mensagens enviadas</Text>
                  <Text style={styles.statValue}>{stats.messagesSent}</Text>
                </View>
                
                <AnimatedPressable
                  style={styles.viewMoreButton}
                  onPress={handleViewStats}
                >
                  <Text style={styles.viewMoreText}>Ver estatísticas completas</Text>
                  <Ionicons name="chevron-forward" size={16} color="#4a90e2" />
                </AnimatedPressable>
              </>
            )}
          </View>
        </View>

        {/* SEÇÃO 4: Dispositivos Vinculados */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="phone-portrait-outline" size={20} color="#4a90e2" />
            <Text style={styles.sectionTitle}>Dispositivos Vinculados</Text>
          </View>
          
          <View style={styles.card}>
            <AnimatedPressable
              style={styles.actionButton}
              onPress={handleViewDevices}
            >
              <Ionicons name="phone-portrait-outline" size={24} color="#4a90e2" />
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonText}>Ver Dispositivos</Text>
                <Text style={styles.actionButtonSubtext}>Gerenciar dispositivos vinculados</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </AnimatedPressable>
          </View>
        </View>

        {/* SEÇÃO 5: Segurança */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed-outline" size={20} color="#4a90e2" />
            <Text style={styles.sectionTitle}>Segurança</Text>
          </View>
          
          <View style={styles.card}>
            <AnimatedPressable
              style={styles.actionButton}
              onPress={handleSecurityAudit}
            >
              <Ionicons name="shield-checkmark-outline" size={24} color="#4a90e2" />
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonText}>Auditoria de Segurança</Text>
                <Text style={styles.actionButtonSubtext}>Verificar integridade e logs</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </AnimatedPressable>
          </View>
        </View>

        {/* SEÇÃO 6: Backups */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cloud-upload-outline" size={20} color="#4a90e2" />
            <Text style={styles.sectionTitle}>Backups</Text>
          </View>
          
          <View style={styles.card}>
            <AnimatedPressable
              style={styles.actionButton}
              onPress={handleBackup}
            >
              <Ionicons name="save-outline" size={24} color="#4a90e2" />
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonText}>Criar Backup</Text>
                <Text style={styles.actionButtonSubtext}>Exportar identidade criptografada</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </AnimatedPressable>

            <AnimatedPressable
              style={styles.actionButton}
              onPress={handleExportIdentity}
            >
              <Ionicons name="download-outline" size={24} color="#4a90e2" />
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonText}>Exportar Identidade</Text>
                <Text style={styles.actionButtonSubtext}>Arquivo ou QR Code</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </AnimatedPressable>
          </View>
        </View>

        {/* SEÇÃO 7: Frase Secreta */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="key-outline" size={20} color="#4a90e2" />
            <Text style={styles.sectionTitle}>Frase Secreta</Text>
          </View>
          
          <View style={styles.card}>
            <AnimatedPressable
              style={styles.actionButton}
              onPress={handleShowRecoveryPhrase}
            >
              <Ionicons name="eye-outline" size={24} color="#4a90e2" />
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonText}>Mostrar Frase Secreta</Text>
                <Text style={styles.actionButtonSubtext}>12 palavras de recuperação</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </AnimatedPressable>
          </View>
        </View>

        {/* SEÇÃO 8: Sobre seu Totem */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color="#4a90e2" />
            <Text style={styles.sectionTitle}>Informações</Text>
          </View>
          
          <View style={styles.card}>
            <AnimatedPressable
              style={styles.actionButton}
              onPress={handleAboutTotem}
            >
              <Ionicons name="book-outline" size={24} color="#4a90e2" />
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonText}>Sobre seu Totem</Text>
                <Text style={styles.actionButtonSubtext}>Entenda o que é soberania digital</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </AnimatedPressable>
          </View>
        </View>

        {/* Espaçamento final */}
        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Modal da Frase Secreta */}
      <SecretPhraseModal
        visible={showSecretModal}
        words={secretPhrase}
        onClose={() => setShowSecretModal(false)}
      />
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
    paddingTop: 10,
    paddingBottom: 40,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 10,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 8,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 8,
    padding: 4,
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  totemHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  totemIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  totemName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#4a90e2',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  infoLabel: {
    fontSize: 14,
    color: '#999999',
    flex: 1,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  infoValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    fontFamily: 'monospace',
    marginRight: 8,
  },
  copyButton: {
    padding: 4,
  },
  nameInput: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    padding: 14,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  statRowLast: {
    borderBottomWidth: 0,
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 14,
    color: '#999999',
    marginLeft: 12,
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  statsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  statsLoadingText: {
    fontSize: 14,
    color: '#999999',
    marginLeft: 12,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    marginTop: 4,
  },
  viewMoreText: {
    fontSize: 14,
    color: '#4a90e2',
    fontWeight: '500',
    marginRight: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  actionButtonContent: {
    flex: 1,
    marginLeft: 12,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
    marginBottom: 4,
  },
  actionButtonSubtext: {
    fontSize: 12,
    color: '#666666',
  },
  footerSpacer: {
    height: 20,
  },
});


