import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ClanCard from '../components/ClanCard';
import ClanStorage from '../clans/ClanStorage';
import { getCurrentTotemId } from '../crypto/totemStorage';

export default function ClanListScreen() {
  const navigation = useNavigation();
  
  const [clans, setClans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadClans = async () => {
    try {
      setLoading(true);
      
      // 1. Garantir inicialização do banco ANTES de buscar dados
      await ClanStorage.init();
      console.log('🔍 Banco SQLite inicializado');
      
      // 2. Implementar retry controlado para getCurrentTotemId()
      let totemId = await getCurrentTotemId();
      let attempts = 0;
      
      while (!totemId && attempts < 5) {
        console.log(`🔍 Tentativa ${attempts + 1}/5: TotemId não disponível, aguardando...`);
        await new Promise(resolve => setTimeout(resolve, 300));
        totemId = await getCurrentTotemId();
        attempts++;
      }
      
      if (!totemId) {
        console.error('❌ TotemId não disponível após retry');
        Alert.alert('Erro', 'Totem não encontrado. Por favor, gere um Totem primeiro.');
        setClans([]);
        return;
      }
      
      // 🔍 LOG DIAGNÓSTICO: TotemId encontrado após retry
      console.log('🔍 [DEBUG_CLANLIST] TotemId encontrado para busca:', totemId);
      console.log('🔍 [DEBUG_CLANLIST] TotemId é null?', totemId === null);
      
      // 🔎 LOG DIAGNÓSTICO FINAL: TotemId para busca
      console.log('🔎 [LISTA] TotemId para busca:', totemId);
      
      console.log('🔍 LISTAGEM - totemId:', totemId);
      
      // 3. Só então buscar CLANNs
      const userClans = await ClanStorage.getUserClans(totemId);
      
      // 🔎 LOG DIAGNÓSTICO FINAL: CLANNs retornados do banco
      console.log('🔎 [LISTA] CLANNs retornados do banco:', userClans.length, userClans);
      
      // 🔍 LOG DIAGNÓSTICO: Resultado da query
      console.log('🔍 [DEBUG_CLANLIST] Número de CLANNs retornado pela query:', userClans.length);
      if (userClans.length > 0) {
        console.log('🔍 [DEBUG_CLANLIST] Primeiro CLANN encontrado:', userClans[0].id, userClans[0].name);
      } else {
        console.log('🔍 [DEBUG_CLANLIST] Array de CLANNs está VAZIO.');
      }
      
      console.log('🔍 CLANNs encontrados:', userClans.length);
      console.log('🔍 COMPARAÇÃO - IDs são consistentes? Verificar logs anteriores de criação');
      
      setClans(userClans);
    } catch (error) {
      console.error('❌ Erro ao carregar CLANNs:', error);
      Alert.alert('Erro', 'Não foi possível carregar seus CLANNs');
      setClans([]);
    } finally {
      // 4. Melhorar UX com loading state - garantir parada
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Recarregar CLANNs sempre que a tela receber foco
  useFocusEffect(
    useCallback(() => {
      loadClans();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadClans();
  };

  // PASSO 3 — ENTRADA DIRETA NO CLANN (NÃO BLOQUEANTE)
  const handleClanPress = (clan) => {
    if (!clan || !clan.id) {
      console.warn('[ENTER_CLANN] CLANN inválido:', clan);
      return;
    }

    console.log('🚪 Entrando no CLANN diretamente:', clan.id);

    // 🔥 NAVEGAÇÃO DIRETA — SEM DEPENDÊNCIAS
    // Não aguarda Gateway, Security, RuleEnforcement, DeviceTrust, ou qualquer .transaction()
    navigation.navigate('ClanChat', {
      clanId: clan.id,
      clanName: clan.name,
      clan: clan, // Passa o objeto completo para evitar busca no banco
      role: clan.role || 'member'
    });
  };

  const renderEmptyState = () => {
    // ✅ Só renderizar empty state se não estiver carregando E lista estiver vazia
    if (loading) {
      return null; // Enquanto carrega, não mostra empty state
    }
    
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>
          Você ainda não faz parte de nenhum espaço CLANN.{'\n'}
          Aqui é onde seus ambientes de coordenação e diálogo seguro irão aparecer.
        </Text>
        <TouchableOpacity
          style={styles.emptyStateButton}
          onPress={() => navigation.navigate('CreateClan')}
        >
          <Text style={styles.emptyStateButtonText}>
            Fundar um novo CLANN
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.emptyStateButton, styles.secondaryButton]}
          onPress={() => navigation.navigate('JoinClan')}
        >
          <Text style={styles.emptyStateButtonText}>
            Entrar em um CLANN por convite
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Seus Espaços CLANN</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateClan')}
        >
          <Text style={styles.createButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : (
        <FlatList
          data={clans}
          extraData={clans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClanCard clan={item} onPress={handleClanPress} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center'
  },
  createButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: -2
  },
  listContent: {
    padding: 16,
    flexGrow: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#888',
    fontSize: 16
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20
  },
  emptyStateText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22
  },
  emptyStateButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    padding: 18,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4a90e2'
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});

