import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { activate as activatePanicMode } from '../security/panicMode';
import { canUseAdminTools } from '../clans/permissions';
import { getCurrentTotemId } from '../crypto/totemStorage';
import ClanStorage from '../clans/ClanStorage';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [panicLoading, setPanicLoading] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  
  // Verificar se tem acesso a admin tools (Sprint 8 - ETAPA 2)
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const totemId = await getCurrentTotemId();
        if (!totemId) return;
        
        // Verifica se é founder de algum CLANN (acesso a admin tools)
        const userClans = await ClanStorage.getUserClans(totemId);
        const isFounder = userClans.some(clan => {
          const role = clan.role || 'member';
          return role === 'founder';
        });
        
        setHasAdminAccess(isFounder);
      } catch (error) {
        console.error('Erro ao verificar acesso admin:', error);
      }
    };
    
    checkAdminAccess();
  }, []);

  const handleThemeChange = () => {
    Alert.alert('Tema', 'Funcionalidade em desenvolvimento');
  };

  const handleLanguageChange = () => {
    Alert.alert('Idioma', 'Funcionalidade em desenvolvimento');
  };

  const handleLinkDevice = () => {
    navigation.navigate('LinkDevice');
  };

  const handleScanLink = () => {
    navigation.navigate('ScanLink');
  };

  const handleAbout = () => {
    Alert.alert('Sobre o App', 'CLANN App v1.0.0\n\nAplicativo de gerenciamento de CLANNs');
  };

  const handlePrivacyPolicy = () => {
    Alert.alert('Política de Privacidade', 'Funcionalidade em desenvolvimento');
  };

  const handlePanicMode = () => {
    Alert.alert(
      '🚨 MODO PANIC',
      'ATENÇÃO: Esta ação irá:\n\n' +
      '• Apagar todas as mensagens locais\n' +
      '• Apagar todas as chaves de criptografia\n' +
      '• Desvincular todos os dispositivos\n' +
      '• Deslogar você do aplicativo\n' +
      '• Ativar PIN de emergência\n\n' +
      'Esta ação NÃO PODE ser desfeita!\n\n' +
      'Deseja continuar?',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'ATIVAR PANIC',
          style: 'destructive',
          onPress: async () => {
            // Confirmação final
            Alert.alert(
              '⚠️ ÚLTIMA CONFIRMAÇÃO',
              'Você tem CERTEZA que deseja ativar o Modo PANIC?\n\n' +
              'Todos os dados locais serão PERMANENTEMENTE apagados.',
              [
                {
                  text: 'Cancelar',
                  style: 'cancel'
                },
                {
                  text: 'SIM, ATIVAR',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setPanicLoading(true);
                      await activatePanicMode();
                      
                      Alert.alert(
                        '✅ Modo PANIC Ativado',
                        'Todos os dados locais foram apagados.\n\n' +
                        'O aplicativo será reiniciado.',
                        [
                          {
                            text: 'OK',
                            onPress: () => {
                              // Reinicia o app (navega para AuthCheck)
                              navigation.reset({
                                index: 0,
                                routes: [{ name: 'AuthCheck' }],
                              });
                            }
                          }
                        ]
                      );
                    } catch (error) {
                      Alert.alert(
                        'Erro',
                        `Não foi possível ativar o Modo PANIC:\n${error.message}`
                      );
                    } finally {
                      setPanicLoading(false);
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Configurações</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aparência</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleThemeChange}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>🌓</Text>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Tema</Text>
                <Text style={styles.settingValue}>Escuro</Text>
              </View>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Geral</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleLanguageChange}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>🌐</Text>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Idioma</Text>
                <Text style={styles.settingValue}>Português</Text>
              </View>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dispositivos</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleLinkDevice}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>📱</Text>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Gerar QR de Vinculação</Text>
                <Text style={styles.settingValue}>Vincular outro dispositivo</Text>
              </View>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleScanLink}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>📷</Text>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Escanear QR Code</Text>
                <Text style={styles.settingValue}>Vincular este dispositivo</Text>
              </View>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Segurança</Text>
          
          <TouchableOpacity
            style={[styles.settingItem, styles.panicButton]}
            onLongPress={handlePanicMode}
            disabled={panicLoading}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>🚨</Text>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>
                  {panicLoading ? 'Ativando Modo PANIC...' : 'Modo PANIC (Long Press)'}
                </Text>
                <Text style={styles.settingValue}>
                  Autodestruição global de emergência
                </Text>
              </View>
            </View>
            {panicLoading ? (
              <ActivityIndicator size="small" color="#FF6B6B" />
            ) : (
              <Text style={styles.settingArrow}>›</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Opções Avançadas - apenas para founders (Sprint 8 - ETAPA 2) */}
        {hasAdminAccess && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Avançado</Text>
            
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                // Navegar para AdminToolsScreen (Sprint 8 - ETAPA 4)
                // Precisa de clanId - por enquanto mostra alert
                Alert.alert(
                  'Ferramentas Administrativas',
                  'Acesse as ferramentas administrativas através da tela de Governança de um CLANN que você fundou.',
                  [{ text: 'OK' }]
                );
              }}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>⚙️</Text>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Ferramentas Administrativas</Text>
                  <Text style={styles.settingValue}>
                    Exportar dados, reset, integridade
                  </Text>
                </View>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleAbout}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>ℹ️</Text>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Sobre o App</Text>
              </View>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handlePrivacyPolicy}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>🔒</Text>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Política de Privacidade</Text>
              </View>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 14,
    color: '#999999',
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 24,
    color: '#666666',
    marginLeft: 12,
  },
  panicButton: {
    borderColor: '#FF6B6B',
    borderWidth: 2,
  },
});


