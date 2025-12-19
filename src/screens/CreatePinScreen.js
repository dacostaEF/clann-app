/**
 * Tela de Criação de PIN
 * Permite criar um PIN de 4-6 dígitos
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createPin } from '../security/PinManager';
import { isBiometryAvailable } from '../security/BiometryManager';
import { useTotem } from '../context/TotemContext';

export default function CreatePinScreen({ navigation }) {
  const { loadTotem } = useTotem();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [showBiometryOption, setShowBiometryOption] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    checkBiometry();
  }, []);

  const checkBiometry = async () => {
    const available = await isBiometryAvailable();
    setShowBiometryOption(available);
  };

  const handleNumberPress = (number) => {
    if (!isConfirming) {
      // Primeira entrada do PIN
      if (pin.length < 6) {
        setPin(pin + number);
      }
    } else {
      // Confirmação do PIN
      if (confirmPin.length < 6) {
        const newConfirmPin = confirmPin + number;
        setConfirmPin(newConfirmPin);
        
        // Se completou a confirmação e coincide, cria automaticamente
        if (newConfirmPin.length === pin.length && newConfirmPin === pin && pin.length >= 4) {
          handleCreatePin(pin);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isConfirming && confirmPin.length > 0) {
      setConfirmPin(confirmPin.slice(0, -1));
    } else if (!isConfirming && pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const handleCreatePin = async (finalPin) => {
    if (finalPin.length < 4) {
      Alert.alert('Atenção', 'O PIN deve ter pelo menos 4 dígitos');
      return;
    }

    setLoading(true);
    try {
      await createPin(finalPin);
      
      // Atualizar TotemContext para recalcular o estado (NEEDS_PIN → READY)
      await loadTotem();
      
      if (showBiometryOption) {
        // Pergunta se deseja ativar biometria
        Alert.alert(
          'Biometria',
          'Deseja ativar autenticação biométrica?',
          [
            {
              text: 'Não',
              style: 'cancel',
              onPress: () => navigation.navigate('Home'),
            },
            {
              text: 'Sim',
              onPress: async () => {
                const { enableBiometry } = await import('../security/BiometryManager');
                try {
                  await enableBiometry();
                  navigation.navigate('Home');
                } catch (error) {
                  Alert.alert('Erro', 'Não foi possível ativar biometria');
                  navigation.navigate('Home');
                }
              },
            },
          ]
        );
      } else {
        navigation.navigate('Home');
      }
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível criar o PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (pin.length < 4) {
      Alert.alert('Atenção', 'O PIN deve ter pelo menos 4 dígitos');
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert('Erro', 'Os PINs não coincidem. Tente novamente.');
      setPin('');
      setConfirmPin('');
      setIsConfirming(false);
      return;
    }

    handleCreatePin(pin);
  };

  const renderPinDots = (currentPin) => {
    return (
      <View style={styles.pinContainer}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < currentPin.length && styles.pinDotFilled,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderNumberPad = () => {
    const numbers = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];

    return (
      <View style={styles.numberPad}>
        {numbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numberRow}>
            {row.map((num) => (
              <TouchableOpacity
                key={num}
                style={styles.numberButton}
                onPress={() => handleNumberPress(num.toString())}
                disabled={loading}
              >
                <Text style={styles.numberText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.numberRow}>
          <View style={styles.numberButton} />
          <TouchableOpacity
            style={styles.numberButton}
            onPress={() => handleNumberPress('0')}
            disabled={loading}
          >
            <Text style={styles.numberText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.numberButton}
            onPress={handleBackspace}
            disabled={loading || (pin.length === 0 && confirmPin.length === 0)}
          >
            <Ionicons name="backspace-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>Criando PIN...</Text>
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
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name="lock-closed" size={64} color="#4a90e2" />
            <Text style={styles.title}>
              {!isConfirming ? 'Crie seu PIN' : 'Confirme seu PIN'}
            </Text>
            <Text style={styles.subtitle}>
              {!isConfirming
                ? 'Digite um PIN de 4 a 6 dígitos para proteger seu Totem'
                : 'Digite o mesmo PIN novamente para confirmar'}
            </Text>
          </View>

          <View style={styles.pinSection}>
            {!isConfirming ? (
              <>
                {renderPinDots(pin)}
                {pin.length >= 4 && (
                  <TouchableOpacity
                    style={styles.continueButton}
                    onPress={() => {
                      console.log('Botão Continuar clicado, PIN atual:', pin);
                      // Inicia a fase de confirmação
                      setIsConfirming(true);
                      setConfirmPin('');
                    }}
                    disabled={loading}
                  >
                    <Text style={styles.continueButtonText}>Continuar</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <Text style={styles.label}>Primeiro PIN:</Text>
                {renderPinDots(pin)}
                <Text style={[styles.label, { marginTop: 24 }]}>Confirme o PIN:</Text>
                {renderPinDots(confirmPin)}
                {confirmPin.length === pin.length && confirmPin.length >= 4 && (
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleConfirm}
                    disabled={loading}
                  >
                    <Text style={styles.confirmButtonText}>Confirmar</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {renderNumberPad()}
        </View>
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
  loadingText: {
    color: '#a0a0a0',
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
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
  pinSection: {
    alignItems: 'center',
    marginVertical: 40,
  },
  label: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 16,
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2a2a3e',
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#3a3a4e',
  },
  pinDotFilled: {
    backgroundColor: '#4a90e2',
    borderColor: '#4a90e2',
  },
  continueButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 16,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 24,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  numberPad: {
    marginBottom: 40,
  },
  numberRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  numberButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  numberText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
  },
});

