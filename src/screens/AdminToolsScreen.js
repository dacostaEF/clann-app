/**
 * AdminToolsScreen - Ferramentas Administrativas
 * Sprint 8 - ETAPA 4
 * 
 * Tela para founder gerenciar:
 * - Exportação de dados (logs, hash-chain, rules, devices, all)
 * - Reset protegido (governance, rules, council, sync)
 * - Verificação de integridade (hash-chain, rules, council, approvals, sync)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ClanStorage from '../clans/ClanStorage';
import { getCurrentTotemId } from '../crypto/totemStorage';
import {
  exportLogs,
  exportHashChain,
  exportRules,
  exportDevices,
  exportAllData,
  resetGovernance,
  resetRules,
  resetCouncil,
  resetSync,
  checkIntegrity
} from '../admin/AdminTools';
import { canAccessAdminTools } from '../clans/permissions';
import { calculateTrustScore } from '../security/DeviceTrust';

export default function AdminToolsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { clanId, clan: clanFromParams } = route.params || {};
  
  const [clan, setClan] = useState(clanFromParams || null);
  const [currentTotemId, setCurrentTotemId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [integrityResult, setIntegrityResult] = useState(null);
  const [loadingIntegrity, setLoadingIntegrity] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [clanId, clanFromParams]);

  const loadInitialData = async () => {
    try {
      const totemId = await getCurrentTotemId();
      setCurrentTotemId(totemId);

      if (!totemId) {
        Alert.alert('Erro', 'Totem não encontrado');
        navigation.goBack();
        return;
      }

      // Busca CLANN se não veio via params
      let clanData = clan;
      if (!clan && clanId) {
        clanData = await ClanStorage.getClanById(clanId);
        setClan(clanData);
      }

      // Busca role do usuário
      if (clanData?.id || clan?.id || clanId) {
        const targetClanId = clanData?.id || clan?.id || clanId;
        const role = await ClanStorage.getUserRole(targetClanId, totemId);
        setUserRole(role);
        
        // Verifica se tem permissão (Sprint 8 - ETAPA 2)
        if (!canAccessAdminTools(role)) {
          Alert.alert(
            'Acesso Negado',
            'Apenas o founder pode acessar ferramentas administrativas.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados.');
    }
  };

  const requestPin = (action) => {
    setPendingAction(action);
    setShowPinModal(true);
    setPin('');
  };

  const handlePinSubmit = async () => {
    if (!pin || pin.length < 4) {
      Alert.alert('Erro', 'PIN inválido');
      return;
    }

    setShowPinModal(false);
    const action = pendingAction;
    setPendingAction(null);
    const pinValue = pin;
    setPin('');

    if (!action) return;

    setLoading(true);
    try {
      await action(pinValue);
    } catch (error) {
      Alert.alert('Erro', error.message || 'Operação falhou');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (exportFn, exportName) => {
    requestPin(async (pinValue) => {
      try {
        const data = await exportFn(clan.id, pinValue);
        
        // Converte para JSON string
        const jsonString = JSON.stringify(data, null, 2);
        
        // Salva arquivo temporário
        const fileName = `clann_${exportName}_${Date.now()}.json`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(fileUri, jsonString);
        
        // Compartilha arquivo
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: `Exportar ${exportName}`
          });
        } else {
          // Fallback: mostra dados em alert
          Alert.alert(
            'Exportação Concluída',
            `Dados exportados:\n\n${jsonString.substring(0, 500)}...\n\n(Arquivo salvo em: ${fileUri})`
          );
        }
        
        Alert.alert('Sucesso', `${exportName} exportado com sucesso!`);
      } catch (error) {
        throw error;
      }
    });
  };

  const handleReset = async (resetFn, resetName, description) => {
    // Confirmação dupla
    Alert.alert(
      '⚠️ ATENÇÃO',
      `Esta ação irá ${description}.\n\nEsta ação NÃO PODE ser desfeita!\n\nDeseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            // Segunda confirmação
            Alert.alert(
              '⚠️ ÚLTIMA CONFIRMAÇÃO',
              `Você tem CERTEZA que deseja ${description}?\n\nTodos os dados serão PERMANENTEMENTE apagados.`,
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'SIM, CONFIRMAR',
                  style: 'destructive',
                  onPress: () => {
                    requestPin(async (pinValue) => {
                      try {
                        await resetFn(clan.id, pinValue);
                        Alert.alert('Sucesso', `${resetName} resetado com sucesso!`);
                        // Recarrega dados se necessário
                      } catch (error) {
                        throw error;
                      }
                    });
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const handleCheckIntegrity = async () => {
    setLoadingIntegrity(true);
    try {
      const result = await checkIntegrity(clan.id);
      setIntegrityResult(result);
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível verificar integridade');
    } finally {
      setLoadingIntegrity(false);
    }
  };

  if (!clan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerIcon}>⚙️</Text>
            <Text style={styles.headerTitle}>Ferramentas Admin</Text>
          </View>
          <Text style={styles.headerSubtitle}>{clan.name}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Seção: Exportação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📤 Exportação</Text>
          <Text style={styles.sectionDescription}>
            Exporte dados do CLANN em formato JSON assinado digitalmente
          </Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleExport(exportLogs, 'Logs')}
            disabled={loading}
          >
            <Ionicons name="document-text-outline" size={24} color="#4a90e2" />
            <Text style={styles.actionButtonText}>Exportar Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleExport(exportHashChain, 'Hash-Chain')}
            disabled={loading}
          >
            <Ionicons name="link-outline" size={24} color="#4a90e2" />
            <Text style={styles.actionButtonText}>Exportar Hash-Chain</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleExport(exportRules, 'Regras')}
            disabled={loading}
          >
            <Ionicons name="document-outline" size={24} color="#4a90e2" />
            <Text style={styles.actionButtonText}>Exportar Regras</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleExport(exportDevices, 'Dispositivos')}
            disabled={loading}
          >
            <Ionicons name="phone-portrait-outline" size={24} color="#4a90e2" />
            <Text style={styles.actionButtonText}>Exportar Dispositivos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => handleExport(exportAllData, 'Todos os Dados')}
            disabled={loading}
          >
            <Ionicons name="archive-outline" size={24} color="#fff" />
            <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
              Exportar Tudo
            </Text>
          </TouchableOpacity>
        </View>

        {/* Seção: Reset */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Reset</Text>
          <Text style={styles.sectionDescription}>
            Resetar dados do CLANN (requer PIN + Device Trust)
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={() => handleReset(
              resetRules,
              'Regras',
              'apagar todas as regras do CLANN'
            )}
            disabled={loading}
          >
            <Ionicons name="trash-outline" size={24} color="#FF4444" />
            <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
              Resetar Regras
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={() => handleReset(
              resetCouncil,
              'Conselho',
              'apagar o conselho de anciões'
            )}
            disabled={loading}
          >
            <Ionicons name="people-outline" size={24} color="#FF4444" />
            <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
              Resetar Conselho
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={() => handleReset(
              resetSync,
              'Sincronização',
              'resetar dados de sincronização'
            )}
            disabled={loading}
          >
            <Ionicons name="sync-outline" size={24} color="#FF4444" />
            <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
              Resetar Sync
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.criticalButton]}
            onPress={() => handleReset(
              resetGovernance,
              'Governança',
              'apagar TODA a governança (regras + conselho + aprovações)'
            )}
            disabled={loading}
          >
            <Ionicons name="nuclear-outline" size={24} color="#FF0000" />
            <Text style={[styles.actionButtonText, styles.criticalButtonText]}>
              Resetar Governança Completa
            </Text>
          </TouchableOpacity>
        </View>

        {/* Seção: Integridade */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 Verificação de Integridade</Text>
          <Text style={styles.sectionDescription}>
            Verifica integridade de hash-chain, regras, conselho e sincronização
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, styles.infoButton]}
            onPress={handleCheckIntegrity}
            disabled={loadingIntegrity}
          >
            {loadingIntegrity ? (
              <ActivityIndicator size="small" color="#4a90e2" />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={24} color="#4a90e2" />
            )}
            <Text style={styles.actionButtonText}>
              {loadingIntegrity ? 'Verificando...' : 'Verificar Integridade'}
            </Text>
          </TouchableOpacity>

          {integrityResult && (
            <View style={styles.integrityResult}>
              <View style={[
                styles.integrityStatus,
                integrityResult.valid ? styles.integrityValid : styles.integrityInvalid
              ]}>
                <Ionicons
                  name={integrityResult.valid ? 'checkmark-circle' : 'close-circle'}
                  size={32}
                  color={integrityResult.valid ? '#4CAF50' : '#FF4444'}
                />
                <Text style={styles.integrityStatusText}>
                  {integrityResult.valid ? 'Integridade Válida' : 'Integridade Comprometida'}
                </Text>
              </View>

              {integrityResult.errors && integrityResult.errors.length > 0 && (
                <View style={styles.errorsContainer}>
                  <Text style={styles.errorsTitle}>Erros encontrados:</Text>
                  {integrityResult.errors.map((error, index) => (
                    <View key={index} style={styles.errorItem}>
                      <Text style={styles.errorType}>{error.type}</Text>
                      <Text style={styles.errorMessage}>{error.message}</Text>
                    </View>
                  ))}
                </View>
              )}

              {integrityResult.hashes && (
                <View style={styles.hashesContainer}>
                  <Text style={styles.hashesTitle}>Hashes:</Text>
                  <Text style={styles.hashItem}>
                    Rules: {integrityResult.hashes.rulesHash?.substring(0, 16)}...
                  </Text>
                  <Text style={styles.hashItem}>
                    Council: {integrityResult.hashes.councilHash?.substring(0, 16)}...
                  </Text>
                  <Text style={styles.hashItem}>
                    Approvals: {integrityResult.hashes.approvalsHash?.substring(0, 16)}...
                  </Text>
                  <Text style={styles.hashItem}>
                    Sync: {integrityResult.hashes.syncStateHash?.substring(0, 16)}...
                  </Text>
                  <Text style={[styles.hashItem, styles.clanStateHash]}>
                    CLANN State: {integrityResult.hashes.clanStateHash?.substring(0, 16)}...
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal de PIN */}
      <Modal
        visible={showPinModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPinModal(false);
          setPendingAction(null);
          setPin('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Digite seu PIN</Text>
            <Text style={styles.modalDescription}>
              Esta ação requer autenticação
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={setPin}
              placeholder="PIN"
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowPinModal(false);
                  setPendingAction(null);
                  setPin('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handlePinSubmit}
              >
                <Text style={styles.modalButtonConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Processando...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a'
  },
  header: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20
  },
  headerContent: {
    alignItems: 'center'
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 10
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10
  },
  headerIcon: {
    fontSize: 32,
    marginRight: 10
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 5
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: 20
  },
  section: {
    marginBottom: 30,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  sectionDescription: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 16
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444'
  },
  primaryButton: {
    backgroundColor: '#4a90e2',
    borderColor: '#4a90e2'
  },
  dangerButton: {
    backgroundColor: '#2a1a1a',
    borderColor: '#FF4444'
  },
  criticalButton: {
    backgroundColor: '#3a1a1a',
    borderColor: '#FF0000'
  },
  infoButton: {
    backgroundColor: '#1a2a3a',
    borderColor: '#4a90e2'
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500'
  },
  primaryButtonText: {
    color: '#fff'
  },
  dangerButtonText: {
    color: '#FF4444'
  },
  criticalButtonText: {
    color: '#FF0000',
    fontWeight: 'bold'
  },
  integrityResult: {
    marginTop: 16,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333'
  },
  integrityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  integrityValid: {
    // Estilo para válido
  },
  integrityInvalid: {
    // Estilo para inválido
  },
  integrityStatusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12
  },
  errorsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#2a1a1a',
    borderRadius: 8
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF4444',
    marginBottom: 8
  },
  errorItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  errorType: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF6666',
    marginBottom: 4
  },
  errorMessage: {
    fontSize: 12,
    color: '#aaa'
  },
  hashesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1a2a3a',
    borderRadius: 8
  },
  hashesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4a90e2',
    marginBottom: 8
  },
  hashItem: {
    fontSize: 12,
    color: '#aaa',
    fontFamily: 'monospace',
    marginBottom: 4
  },
  clanStateHash: {
    color: '#4a90e2',
    fontWeight: 'bold',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    borderWidth: 1,
    borderColor: '#333'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  modalDescription: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 20
  },
  pinInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6
  },
  modalButtonCancel: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444'
  },
  modalButtonConfirm: {
    backgroundColor: '#4a90e2'
  },
  modalButtonCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  modalButtonConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16
  }
});

