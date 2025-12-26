/**
 * Tela de Escolha Inicial
 * Permite ao usuário escolher como começar no CLÃ
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ChooseStartScreen({ navigation }) {
  const handleOption = (option) => {
    // Por enquanto, apenas navega para uma tela vazia (home)
    // As funcionalidades serão implementadas nas próximas sprints
    navigation.replace('Home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Como você quer começar?</Text>
          <Text style={styles.subtitle}>
            Escolha uma opção para continuar
          </Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => handleOption('found')}
              activeOpacity={0.8}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="add-circle" size={48} color="#4a90e2" />
              </View>
              <Text style={styles.optionTitle}>Fundar um novo CLÃ</Text>
              <Text style={styles.optionDescription}>
                Crie um novo CLÃ e convide membros
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => handleOption('join')}
              activeOpacity={0.8}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="people" size={48} color="#4a90e2" />
              </View>
              <Text style={styles.optionTitle}>Entrar em um CLÃ existente</Text>
              <Text style={styles.optionDescription}>
                Entre em um CLÃ usando um código de convite
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => handleOption('explore')}
              activeOpacity={0.8}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="eye" size={48} color="#4a90e2" />
              </View>
              <Text style={styles.optionTitle}>Explorar CLÃs públicos</Text>
              <Text style={styles.optionDescription}>
                Navegue por CLÃs públicos (modo visual)
              </Text>
            </TouchableOpacity>
          </View>
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
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 48,
  },
  optionsContainer: {
    gap: 20,
  },
  optionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    alignItems: 'center',
  },
  optionIcon: {
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  optionDescription: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 20,
  },
});





