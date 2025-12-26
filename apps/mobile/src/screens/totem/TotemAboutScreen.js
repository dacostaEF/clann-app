/**
 * Tela "Sobre seu Totem"
 * Tela educativa que explica o conceito de Totem e soberania digital
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

export default function TotemAboutScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.title}>Sobre seu Totem</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Ícone principal */}
            <View style={styles.iconContainer}>
              <Ionicons name="shield" size={64} color="#4a90e2" />
            </View>

            {/* Frase-chave */}
            <View style={styles.keyPhraseContainer}>
              <Text style={styles.keyPhrase}>
                "Você não tem uma conta.{'\n'}Você tem soberania."
              </Text>
            </View>

            {/* Seções educativas */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle" size={24} color="#4a90e2" />
                <Text style={styles.sectionTitle}>O que é o Totem?</Text>
              </View>
              <Text style={styles.sectionText}>
                O Totem é sua identidade digital soberana. Diferente de uma conta tradicional, 
                você não depende de servidores ou empresas. Suas chaves criptográficas são geradas 
                e armazenadas apenas no seu dispositivo, dando a você controle total sobre sua identidade.
              </Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="lock-closed" size={24} color="#4a90e2" />
                <Text style={styles.sectionTitle}>Por que ele protege você?</Text>
              </View>
              <Text style={styles.sectionText}>
                O Totem usa criptografia de ponta a ponta. Suas mensagens são criptografadas 
                antes de sair do seu dispositivo e só podem ser descriptografadas pelos destinatários. 
                Nem mesmo o CLANN tem acesso ao conteúdo das suas mensagens.
              </Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="git-branch" size={24} color="#4a90e2" />
                <Text style={styles.sectionTitle}>Diferença entre Totem e conta comum</Text>
              </View>
              <View style={styles.comparisonContainer}>
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonLabel}>Conta comum:</Text>
                  <Text style={styles.comparisonText}>
                    • Dados armazenados em servidores{'\n'}
                    • Empresa controla sua identidade{'\n'}
                    • Pode ser bloqueada ou suspensa{'\n'}
                    • Depende de internet constante
                  </Text>
                </View>
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonLabel}>Totem:</Text>
                  <Text style={styles.comparisonText}>
                    • Dados apenas no seu dispositivo{'\n'}
                    • Você controla sua identidade{'\n'}
                    • Não pode ser bloqueado{'\n'}
                    • Funciona offline
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="key" size={24} color="#4a90e2" />
                <Text style={styles.sectionTitle}>Sua frase de recuperação</Text>
              </View>
              <Text style={styles.sectionText}>
                Quando você cria um Totem, recebe 12 palavras de recuperação. Essas palavras são 
                a única forma de restaurar seu Totem em outro dispositivo. Mantenha-as seguras e 
                nunca compartilhe com ninguém.
              </Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="shield-checkmark" size={24} color="#4a90e2" />
                <Text style={styles.sectionTitle}>Soberania digital</Text>
              </View>
              <Text style={styles.sectionText}>
                Com o Totem, você não precisa confiar em terceiros. Sua identidade é sua, 
                suas mensagens são suas, e você decide com quem compartilhar. Isso é soberania digital.
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
    backgroundColor: '#000000',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 8,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderRadius: 50,
  },
  keyPhraseContainer: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#4a90e2',
    borderRadius: 12,
    padding: 24,
    marginBottom: 32,
    width: '100%',
  },
  keyPhrase: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a90e2',
    textAlign: 'center',
    lineHeight: 32,
    fontStyle: 'italic',
  },
  section: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 12,
  },
  sectionText: {
    fontSize: 16,
    color: '#a0a0a0',
    lineHeight: 24,
  },
  comparisonContainer: {
    marginTop: 12,
  },
  comparisonItem: {
    marginBottom: 16,
  },
  comparisonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a90e2',
    marginBottom: 8,
  },
  comparisonText: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 22,
  },
});







