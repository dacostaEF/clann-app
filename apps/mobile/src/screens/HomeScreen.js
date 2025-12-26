/**
 * Tela Home
 * Tela principal do app com acesso às funcionalidades
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTotem } from '../context/TotemContext';
import { useClan } from '../context/ClanContext';

export default function HomeScreen({ navigation }) {
  const { totem, loading: totemLoading } = useTotem();
  const { myClans, loading: clansLoading, loadMyClans } = useClan();

  useEffect(() => {
    if (totem && totem.totemId) {
      loadMyClans(totem.totemId);
    }
  }, [totem]);
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>CLÃ</Text>
              <Text style={styles.subtitle}>
                Identidade Soberana e Segurança Absoluta
              </Text>
            </View>

            <View style={styles.menuContainer}>
              <Text style={styles.menuTitle}>Meus CLANNs</Text>
              
              {clansLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#4a90e2" />
                  <Text style={styles.loadingText}>Carregando CLANNs...</Text>
                </View>
              ) : myClans.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color="#666" />
                  <Text style={styles.emptyText}>Você ainda não está em nenhum CLANN</Text>
                </View>
              ) : (
                myClans.map((clan) => (
                  <TouchableOpacity
                    key={clan.clanId}
                    style={styles.clanCard}
                    onPress={() => {
                      // Navegação será implementada no Sprint 3
                      console.log('CLANN selecionado:', clan.clanId);
                    }}
                  >
                    <Ionicons name="people" size={24} color="#4a90e2" />
                    <View style={styles.clanCardText}>
                      <Text style={styles.clanCardTitle}>{clan.name}</Text>
                      <Text style={styles.clanCardDescription}>
                        {clan.memberCount} / {clan.maxMembers} membros
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                ))
              )}

              <View style={styles.clanActions}>
                <TouchableOpacity
                  style={styles.clanActionButton}
                  onPress={() => {
                    // Navegação será implementada no Sprint 3
                    console.log('Criar CLANN');
                  }}
                >
                  <Ionicons name="add-circle-outline" size={24} color="#4a90e2" />
                  <Text style={styles.clanActionText}>Criar CLANN</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.clanActionButton}
                  onPress={() => {
                    // Navegação será implementada no Sprint 3
                    console.log('Entrar em CLANN');
                  }}
                >
                  <Ionicons name="log-in-outline" size={24} color="#4a90e2" />
                  <Text style={styles.clanActionText}>Entrar em CLANN</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.menuContainer}>
              <Text style={styles.menuTitle}>Segurança (Sprint 2)</Text>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('ExportIdentity')}
              >
                <Ionicons name="download-outline" size={32} color="#4a90e2" />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Exportar Identidade</Text>
                  <Text style={styles.menuItemDescription}>
                    Fazer backup do Totem criptografado
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('ImportIdentity')}
              >
                <Ionicons name="cloud-upload-outline" size={32} color="#4a90e2" />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Importar Identidade</Text>
                  <Text style={styles.menuItemDescription}>
                    Restaurar Totem a partir de backup
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('SecurityAudit')}
              >
                <Ionicons name="shield-checkmark" size={32} color="#4a90e2" />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Auditoria de Segurança</Text>
                  <Text style={styles.menuItemDescription}>
                    Verificar integridade e status de segurança
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={24} color="#4a90e2" />
              <Text style={styles.infoText}>
                Sprint 2 implementado: Segurança, PIN, Biometria e Backup.
                Funcionalidades de CLANNs serão implementadas nas próximas sprints.
              </Text>
            </View>
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
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
  },
  menuContainer: {
    marginBottom: 32,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4a90e2',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  menuItemText: {
    flex: 1,
    marginLeft: 16,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 12,
    padding: 16,
    marginTop: 'auto',
  },
  infoText: {
    flex: 1,
    color: '#a0a0a0',
    fontSize: 12,
    marginLeft: 12,
    lineHeight: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#a0a0a0',
    marginTop: 8,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  emptyText: {
    color: '#a0a0a0',
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  clanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  clanCardText: {
    flex: 1,
    marginLeft: 12,
  },
  clanCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  clanCardDescription: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  clanActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  clanActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  clanActionText: {
    color: '#4a90e2',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});





