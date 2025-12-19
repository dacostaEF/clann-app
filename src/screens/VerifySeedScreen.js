/**
 * Tela de Verificação da Seed
 * Usuário deve digitar todas as 12 palavras para confirmar
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { loadTotemSecure } from '../storage/secureStore';

const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 30 * 1000; // 30 segundos

/**
 * Verifica se a frase de recuperação está correta
 * @param {string} input - Frase digitada pelo usuário
 * @param {string} original - Frase original do Totem
 * @returns {boolean} True se correta
 */
export function verifyRecoveryPhrase(input, original) {
  const A = original.trim().split(" ");
  const B = input.trim().split(" ");
  if (A.length !== 12 || B.length !== 12) return false;
  for (let i = 0; i < 12; i++) {
    if (A[i] !== B[i]) return false;
  }
  return true;
}

export default function VerifySeedScreen({ navigation, route }) {
  const [input, setInput] = useState('');
  const [originalPhrase, setOriginalPhrase] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTime, setLockTime] = useState(0);
  const [isCorrect, setIsCorrect] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOriginalPhrase();
  }, []);

  useEffect(() => {
    if (isLocked) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, lockTime - Date.now());
        if (remaining <= 0) {
          setIsLocked(false);
          setLockTime(0);
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isLocked, lockTime]);

  const loadOriginalPhrase = async () => {
    try {
      const totem = await loadTotemSecure();
      if (totem && totem.recoveryPhrase) {
        setOriginalPhrase(totem.recoveryPhrase);
      } else if (route?.params?.recoveryPhrase) {
        setOriginalPhrase(route.params.recoveryPhrase);
      } else {
        Alert.alert('Erro', 'Frase de recuperação não encontrada');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar a frase de recuperação');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => {
    if (!input.trim()) {
      Alert.alert('Atenção', 'Digite a frase de recuperação completa');
      return;
    }

    const words = input.trim().split(' ').filter(w => w.length > 0);
    if (words.length !== 12) {
      Alert.alert('Atenção', 'A frase deve conter exatamente 12 palavras');
      setIsCorrect(false);
      return;
    }

    const correct = verifyRecoveryPhrase(input, originalPhrase);

    if (correct) {
      setIsCorrect(true);
      // Navega para próxima tela após um breve delay
      setTimeout(() => {
        navigation.navigate('CreatePin');
      }, 1000);
    } else {
      setIsCorrect(false);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        // Trava por 30 segundos
        const lockUntil = Date.now() + LOCK_DURATION;
        setIsLocked(true);
        setLockTime(lockUntil);
        setAttempts(0);
        Alert.alert(
          'Muitas tentativas',
          'Você errou 5 vezes. A tela será bloqueada por 30 segundos.'
        );
      } else {
        Alert.alert(
          'Frase incorreta',
          `Tentativa ${newAttempts} de ${MAX_ATTEMPTS}. Verifique as palavras e tente novamente.`
        );
      }
    }
  };

  const getRemainingLockTime = () => {
    if (!isLocked) return 0;
    return Math.max(0, Math.ceil((lockTime - Date.now()) / 1000));
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

  const remainingLock = getRemainingLockTime();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="shield-checkmark" size={64} color="#4a90e2" />
              <Text style={styles.title}>Verifique sua frase</Text>
              <Text style={styles.subtitle}>
                Digite todas as 12 palavras na ordem correta para confirmar que você salvou sua frase de recuperação.
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  isCorrect === true && styles.inputCorrect,
                  isCorrect === false && styles.inputIncorrect,
                ]}
                value={input}
                onChangeText={(text) => {
                  setInput(text);
                  setIsCorrect(null);
                }}
                placeholder="Digite as 12 palavras separadas por espaço"
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                editable={!isLocked}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {isCorrect === true && (
                <View style={styles.feedbackContainer}>
                  <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
                  <Text style={styles.feedbackTextCorrect}>Frase correta!</Text>
                </View>
              )}

              {isCorrect === false && (
                <View style={styles.feedbackContainer}>
                  <Ionicons name="close-circle" size={24} color="#f87171" />
                  <Text style={styles.feedbackTextIncorrect}>
                    Frase incorreta. Tente novamente.
                  </Text>
                </View>
              )}

              {isLocked && (
                <View style={styles.lockContainer}>
                  <Ionicons name="lock-closed" size={32} color="#f87171" />
                  <Text style={styles.lockText}>
                    Bloqueado por {remainingLock} segundos
                  </Text>
                </View>
              )}

              <Text style={styles.attemptsText}>
                Tentativas: {attempts} / {MAX_ATTEMPTS}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                (isLocked || !input.trim()) && styles.buttonDisabled,
              ]}
              onPress={handleVerify}
              disabled={isLocked || !input.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Verificar</Text>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
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
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#2a2a3e',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputCorrect: {
    borderColor: '#4ade80',
  },
  inputIncorrect: {
    borderColor: '#f87171',
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  feedbackTextCorrect: {
    color: '#4ade80',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackTextIncorrect: {
    color: '#f87171',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  lockContainer: {
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    backgroundColor: '#2a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  lockText: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  attemptsText: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#2a2a3e',
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

