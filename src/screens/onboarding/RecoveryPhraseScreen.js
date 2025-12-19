/**
 * Tela de Frase de Recuperação
 * Mostra as 12 palavras e solicita confirmação do usuário
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function RecoveryPhraseScreen({ route, navigation }) {
  console.log('RecoveryPhraseScreen renderizando...', { route: route?.params });
  
  // Verifica se recoveryPhrase foi passado
  const recoveryPhrase = route?.params?.recoveryPhrase;
  
  if (!recoveryPhrase) {
    console.error('RecoveryPhrase não encontrado nos parâmetros!', route?.params);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Erro</Text>
          <Text style={styles.errorText}>Frase de recuperação não encontrada.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const words = recoveryPhrase.split(' ');
  console.log('Palavras da frase:', words.length, 'palavras');
  
  const [confirmedWords, setConfirmedWords] = useState({});
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [inputValues, setInputValues] = useState({});

  useEffect(() => {
    console.log('useEffect: selecionando índices para verificação...');
    // Seleciona 2 índices aleatórios para verificação
    const indices = [];
    while (indices.length < 2) {
      const index = Math.floor(Math.random() * words.length);
      if (!indices.includes(index)) {
        indices.push(index);
      }
    }
    const sortedIndices = indices.sort((a, b) => a - b);
    console.log('Índices selecionados:', sortedIndices);
    setSelectedIndices(sortedIndices);
  }, [words.length]);

  const copyPhrase = async () => {
    await Clipboard.setStringAsync(recoveryPhrase);
    Alert.alert('Copiado', 'Frase de recuperação copiada para a área de transferência.');
  };

  const handleWordConfirm = (index, word) => {
    const trimmedWord = word.trim().toLowerCase();
    const correctWord = words[index].toLowerCase();
    
    console.log('Confirmando palavra:', { index, input: trimmedWord, correct: correctWord });
    
    if (trimmedWord === correctWord) {
      const newConfirmed = {
        ...confirmedWords,
        [index]: correctWord,
      };
      setConfirmedWords(newConfirmed);
      // Limpa o input
      setInputValues({
        ...inputValues,
        [index]: '',
      });
      console.log('✅ Palavra confirmada!', { index, word: correctWord, confirmedWords: newConfirmed });
      Alert.alert('✅ Palavra confirmada!', `A palavra na posição ${index + 1} foi confirmada corretamente.`);
    } else {
      console.log('❌ Palavra incorreta!', { input: trimmedWord, expected: correctWord });
      Alert.alert('❌ Palavra incorreta', `A palavra digitada não corresponde. Esperado: "${correctWord}", Digitado: "${trimmedWord}"`);
    }
  };

  const handleContinue = () => {
    console.log('Tentando continuar...', { confirmedWords, selectedIndices, words });
    
    // Verifica se as palavras foram confirmadas corretamente
    const allConfirmed = selectedIndices.every(
      (index) => {
        const confirmed = confirmedWords[index]?.toLowerCase();
        const expected = words[index]?.toLowerCase();
        const match = confirmed === expected;
        console.log(`Verificando palavra ${index}:`, { confirmed, expected, match });
        return match;
      }
    );
    
    // Debug: mostra estado atual
    console.log('Estado completo:', {
      selectedIndices,
      confirmedWords,
      words: words.map((w, i) => ({ index: i, word: w })),
      allConfirmed
    });

    console.log('Todas confirmadas?', allConfirmed);

    if (!allConfirmed) {
      console.log('Faltam palavras para confirmar');
      Alert.alert(
        'Verificação necessária',
        'Por favor, confirme as palavras corretamente antes de continuar.'
      );
      return;
    }

    console.log('Navegando para VerifySeed...');
    // Navega para verificação completa da seed (Sprint 2)
    navigation.navigate('VerifySeed', { recoveryPhrase });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Frase de Recuperação</Text>
          <Text style={styles.subtitle}>
            Anote estas 12 palavras em um local seguro. Elas são necessárias para recuperar seu Totem.
          </Text>

          <View style={styles.phraseContainer}>
            {words.map((word, index) => {
              const needsVerification = selectedIndices.includes(index);
              return (
                <View 
                  key={index} 
                  style={[
                    styles.wordBox,
                    needsVerification && styles.wordBoxHighlighted
                  ]}
                >
                  <Text style={styles.wordNumber}>{index + 1}</Text>
                  <Text style={styles.word}>{word}</Text>
                  {needsVerification && (
                    <Ionicons name="checkmark-circle" size={16} color="#4a90e2" style={styles.verifyIcon} />
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.copyButton}
            onPress={copyPhrase}
            activeOpacity={0.8}
          >
            <Ionicons name="copy-outline" size={20} color="#4a90e2" />
            <Text style={styles.copyButtonText}>Copiar frase</Text>
          </TouchableOpacity>

          <View style={styles.verificationContainer}>
            <Text style={styles.verificationTitle}>
              ⚠️ Confirme as palavras destacadas acima:
            </Text>
            <Text style={styles.verificationSubtitle}>
              Digite as palavras nas posições {selectedIndices.map(i => i + 1).join(' e ')} para continuar
            </Text>
            {selectedIndices.map((index) => (
              <View key={index} style={styles.verificationRow}>
                <Text style={styles.verificationLabel}>
                  Palavra {index + 1}:
                </Text>
                <View style={styles.verificationInput}>
                  {confirmedWords[index] ? (
                    <View style={styles.confirmedWord}>
                      <Text style={styles.confirmedWordText}>
                        {confirmedWords[index]}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          const newConfirmed = { ...confirmedWords };
                          delete newConfirmed[index];
                          setConfirmedWords(newConfirmed);
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color="#4a90e2" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.textInput}
                        value={inputValues[index] || ''}
                        onChangeText={(text) => {
                          setInputValues({
                            ...inputValues,
                            [index]: text,
                          });
                        }}
                        placeholder="Digite a palavra"
                        placeholderTextColor="#666"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onSubmitEditing={() => {
                          if (inputValues[index]) {
                            handleWordConfirm(index, inputValues[index]);
                          }
                        }}
                      />
                      <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={() => {
                          if (inputValues[index]) {
                            handleWordConfirm(index, inputValues[index]);
                          }
                        }}
                      >
                        <Ionicons name="checkmark-circle" size={24} color="#4a90e2" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              selectedIndices.length > 0 && selectedIndices.every(i => confirmedWords[i]) 
                ? styles.buttonEnabled 
                : styles.buttonDisabled
            ]}
            onPress={handleContinue}
            activeOpacity={0.8}
            disabled={!selectedIndices.every(i => confirmedWords[i])}
          >
            <Text style={styles.buttonText}>
              {selectedIndices.every(i => confirmedWords[i]) 
                ? '✅ Confirmar que anotei' 
                : `⚠️ Confirme ${selectedIndices.filter(i => !confirmedWords[i]).length} palavra(s) primeiro`}
            </Text>
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
    padding: 24,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  phraseContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  wordBox: {
    width: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#0f0f1e',
    borderRadius: 8,
  },
  wordNumber: {
    fontSize: 12,
    color: '#4a90e2',
    marginRight: 8,
    fontWeight: '600',
    minWidth: 20,
  },
  word: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
  },
  wordBoxHighlighted: {
    backgroundColor: '#1a2a4a',
    borderWidth: 2,
    borderColor: '#4a90e2',
  },
  verifyIcon: {
    marginLeft: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 32,
  },
  copyButtonText: {
    color: '#4a90e2',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  verificationContainer: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  verificationTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 8,
  },
  verificationSubtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 16,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  verificationLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    width: 100,
  },
  verificationInput: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2a2a3e',
    color: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  confirmButton: {
    padding: 4,
  },
  confirmedWord: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f1e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  confirmedWordText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
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
  buttonEnabled: {
    backgroundColor: '#4a90e2',
    opacity: 1,
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

