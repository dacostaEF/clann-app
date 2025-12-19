/**
 * Tela de Auditoria de Segurança
 * Exibe informações de segurança e integridade do Totem
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getSecurityInfo } from '../security/SecurityAudit';

export default function SecurityAuditScreen({ navigation }) {
  const [securityInfo, setSecurityInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSecurityInfo();
  }, []);

  const loadSecurityInfo = async () => {
    try {
      const info = await getSecurityInfo();
      setSecurityInfo(info);
    } catch (error) {
      console.error('Erro ao carregar informações de segurança:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSecurityInfo();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('pt-BR');
    } catch (error) {
      return dateString;
    }
  };

  const renderInfoRow = (label, value, icon, color = '#ffffff') => {
    return (
      <View style={styles.infoRow}>
        <View style={styles.infoRowLeft}>
          {icon && <Ionicons name={icon} size={20} color={color} style={styles.infoIcon} />}
          <Text style={styles.infoLabel}>{label}</Text>
        </View>
        <Text style={[styles.infoValue, { color }]}>{value}</Text>
      </View>
    );
  };

  const renderStatusBadge = (status, label) => {
    const color = status ? '#4ade80' : '#f87171';
    return (
      <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!securityInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Não foi possível carregar informações</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4a90e2" />
          }
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="shield-checkmark" size={64} color="#4a90e2" />
              <Text style={styles.title}>Auditoria de Segurança</Text>
              <Text style={styles.subtitle}>
                Informações sobre a segurança e integridade do seu Totem
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Acesso</Text>
              {renderInfoRow('Último acesso', formatDate(securityInfo.lastAccess), 'time-outline')}
              {renderInfoRow('Total de acessos', securityInfo.accessCount.toString(), 'stats-chart-outline')}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Totem</Text>
              {renderInfoRow(
                'Integridade',
                securityInfo.totemValid ? 'Válido' : 'Inválido',
                'shield-checkmark',
                securityInfo.totemValid ? '#4ade80' : '#f87171'
              )}
              {securityInfo.totemId && renderInfoRow('ID do Totem', securityInfo.totemId, 'finger-print-outline')}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PIN</Text>
              {renderInfoRow(
                'Status',
                securityInfo.hasPin ? 'Configurado' : 'Não configurado',
                'lock-closed-outline',
                securityInfo.hasPin ? '#4ade80' : '#f87171'
              )}
              {securityInfo.hasPin && (
                <>
                  {renderInfoRow(
                    'Tentativas restantes',
                    securityInfo.pinRemainingAttempts.toString(),
                    'key-outline'
                  )}
                  {securityInfo.pinLockRemaining > 0 && (
                    renderInfoRow(
                      'Bloqueado por',
                      `${securityInfo.pinLockRemaining} segundos`,
                      'lock-closed-outline',
                      '#f87171'
                    )
                  )}
                  {renderInfoRow(
                    'Tentativas falhadas',
                    securityInfo.pinFailedAttempts.toString(),
                    'close-circle-outline',
                    securityInfo.pinFailedAttempts > 0 ? '#f87171' : '#4ade80'
                  )}
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Biometria</Text>
              {renderInfoRow(
                'Disponível',
                securityInfo.biometryAvailable ? 'Sim' : 'Não',
                'finger-print-outline',
                securityInfo.biometryAvailable ? '#4ade80' : '#a0a0a0'
              )}
              {securityInfo.biometryAvailable && (
                <>
                  {renderInfoRow(
                    'Tipo',
                    securityInfo.biometryType || 'Desconhecido',
                    'body-outline'
                  )}
                  {renderInfoRow(
                    'Status',
                    securityInfo.biometryEnabled ? 'Ativada' : 'Desativada',
                    'checkmark-circle-outline',
                    securityInfo.biometryEnabled ? '#4ade80' : '#a0a0a0'
                  )}
                  {renderInfoRow(
                    'Tentativas falhadas',
                    securityInfo.biometryFailedAttempts.toString(),
                    'close-circle-outline'
                  )}
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Autodestruição</Text>
              {renderInfoRow(
                'Tentativas de invasão',
                securityInfo.selfDestructAttempts.toString(),
                'warning-outline',
                securityInfo.selfDestructAttempts > 0 ? '#f87171' : '#4ade80'
              )}
              {renderInfoRow(
                'Tentativas restantes',
                securityInfo.selfDestructRemaining.toString(),
                'shield-outline',
                securityInfo.selfDestructRemaining < 5 ? '#f87171' : '#4ade80'
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dispositivo</Text>
              {renderInfoRow('Hash do dispositivo', securityInfo.deviceHash || 'N/A', 'phone-portrait-outline')}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Backup</Text>
              {renderInfoRow(
                'Criptografia',
                securityInfo.backupEncrypted ? 'Ativada' : 'Não configurada',
                'lock-closed-outline',
                securityInfo.backupEncrypted ? '#4ade80' : '#a0a0a0'
              )}
            </View>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
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
  section: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a90e2',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#2a2a3e',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

