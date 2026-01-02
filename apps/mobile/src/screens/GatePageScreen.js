/**
 * Gate Page - Página de orientação para visitantes sem convite
 * DOSE 2: Adiciona orientação mínima sem alterar fluxo existente
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

export default function GatePageScreen() {
  const navigation = useNavigation();

  const handleHaveInvite = () => {
    // Direciona para o fluxo existente de convite
    // O WelcomeScreen já detecta convites na URL automaticamente
    navigation.navigate('Welcome');
  };

  const handleCreateClann = () => {
    // Placeholder por enquanto
    // Pode ser apenas um alerta ou rota vazia
    navigation.navigate('Welcome');
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Logo CLANN */}
            <Image
              source={require('../../assets/LogoClann.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* Título principal */}
            <Text style={styles.title}>Comunicação Corporativa Soberana</Text>

            {/* Subtítulo */}
            <Text style={styles.subtitle}>
              Controle total sobre dados estratégicos. Sem servidores centrais. Sem intermediários.
            </Text>

            {/* Bloco de orientação */}
            <View style={styles.infoBlock}>
              <Text style={styles.infoTitle}>Arquitetura de Segurança</Text>
              <View style={styles.infoList}>
                <Text style={styles.infoItem}>✓ Rede privada por convite</Text>
                <Text style={styles.infoItem}>✓ Criptografia ponta-a-ponta descentralizada</Text>
                <Text style={styles.infoItem}>✓ Identidade soberana vinculada ao dispositivo</Text>
              </View>
            </View>

            {/* Ações disponíveis */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleHaveInvite}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Acessar com Convite</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleCreateClann}
                activeOpacity={0.8}
              >
                <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                  Requisitar Acesso Corporativo
                </Text>
              </TouchableOpacity>
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
    paddingHorizontal: 32,
    paddingVertical: 48,
    paddingTop: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 32,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaaaaa',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  infoBlock: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    padding: 24,
    marginBottom: 40,
    width: '100%',
    maxWidth: 400,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a90e2',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoList: {
    gap: 12,
  },
  infoItem: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
    paddingLeft: 8,
  },
  actionsContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4a90e2',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#4a90e2',
  },
  microcopy: {
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

