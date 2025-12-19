import React, { useState, useEffect } from 'react';
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
import { useNavigation, useIsFocused } from '@react-navigation/native';
import ClanCard from '../components/ClanCard';
import ClanStorage from '../clans/ClanStorage';
import { getCurrentTotemId } from '../crypto/totemStorage';

/**
 * Tela de lista de chats (CLANNs)
 * Lista todos os CLANNs do usuário para acesso rápido ao chat
 */
export default function ChatsListScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  
  const [clans, setClans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadClans = async () => {
    try {
      const totemId = await getCurrentTotemId();
      
      const userClans = await ClanStorage.getUserClans(totemId);
      setClans(userClans);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar seus CLANNs');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadClans();
    }
  }, [isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    loadClans();
  };

  const handleClanPress = (clan) => {
    // Navegar para o chat do CLANN
    navigation.navigate('ClanChat', { 
      clanId: clan.id, 
      clan 
    });
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>💬</Text>
      <Text style={styles.emptyStateTitle}>Nenhum Chat</Text>
      <Text style={styles.emptyStateText}>
        Você ainda não está em nenhum CLANN
      </Text>
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={() => navigation.navigate('CreateClan')}
      >
        <Text style={styles.emptyStateButtonText}>
          Fundar seu primeiro CLANN
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.emptyStateButton, styles.secondaryButton]}
        onPress={() => navigation.navigate('JoinClan')}
      >
        <Text style={styles.emptyStateButtonText}>
          Entrar em um CLANN existente
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : (
        <FlatList
          data={clans}
          keyExtractor={(item) => item.id?.toString() || item.clanId?.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleClanPress(item)}>
              <ClanCard clan={item} onPress={() => handleClanPress(item)} />
            </TouchableOpacity>
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
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12
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

