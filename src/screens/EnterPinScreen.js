/**
 * Tela de Entrada de PIN
 * Aparece sempre que o app é aberto (se PIN estiver configurado)
 */

import React, { useState, useEffect } from 'react';
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
import { verifyPin, getRemainingAttempts, getLockRemainingTime } from '../security/PinManager';
import { authenticateWithBiometry, isBiometryEnabled } from '../security/BiometryManager';
import { recordFailedAttempt, executeSelfDestruct } from '../security/SelfDestruct';
import { recordAccess } from '../security/SecurityAudit';

export default function EnterPinScreen({ navigation, onSuccess }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [lockRemaining, setLockRemaining] = useState(0);
  const [biometryAvailable, setBiometryAvailable] = useState(false);

  useEffect(() => {
    checkBiometry();
    updateAttempts();
    checkLock();
  }, []);

  useEffect(() => {
    if (lockRemaining > 0) {
      const interval = setInterval(() => {
        checkLock();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockRemaining]);

  const checkBiometry = async () => {
    const enabled = await isBiometryEnabled();
    setBiometryAvailable(enabled);
    
    if (enabled) {
      // Tenta autenticação biométrica automaticamente
      try {
        const success = await authenticateWithBiometry('Autentique-se para acessar o CLÃ');
        if (success) {
          handleSuccess();
        }
      } catch (error) {
        // Biometria falhou, continua para PIN
      }
    }
  };

  const updateAttempts = async () => {
    const attempts = await getRemainingAttempts();
    setRemainingAttempts(attempts);
  };

  const checkLock = async () => {
    const remaining = await getLockRemainingTime();
    setLockRemaining(remaining);
    if (remaining === 0 && lockRemaining > 0) {
      // Desbloqueou, atualiza tentativas
      updateAttempts();
    }
  };

  const handleNumberPress = (number) => {
    if (lockRemaining > 0) return;
    
    if (pin.length < 6) {
      const newPin = pin + number;
      setPin(newPin);
      setError(false);
      
      // Se PIN completo (6 dígitos), verifica automaticamente
      if (newPin.length === 6) {
        handleVerify(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (lockRemaining > 0) return;
    setPin(pin.slice(0, -1));
    setError(false);
  };

  const handleVerify = async (pinToVerify) => {
    if (lockRemaining > 0) {
      Alert.alert('Bloqueado', `PIN bloqueado. Tente novamente em ${lockRemaining} segundos.`);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const isValid = await verifyPin(pinToVerify);
      
      if (isValid) {
        // PIN correto
        await recordAccess();
        await updateAttempts();
        handleSuccess();
      } else {
        // PIN incorreto
        setError(true);
        setPin('');
        await updateAttempts();
        
        // Registra tentativa falhada para autodestruição
        const shouldDestruct = await recordFailedAttempt();
        
        if (shouldDestruct) {
          Alert.alert(
            'Segurança',
            'Muitas tentativas incorretas detectadas. Todos os dados foram apagados por segurança.',
            [
              {
                text: 'OK',
                onPress: async () => {
                  await executeSelfDestruct();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Welcome' }],
                  });
                },
              },
            ]
          );
          return;
        }
        
        const attempts = await getRemainingAttempts();
        if (attempts === 0) {
          await checkLock();
        }
      }
    } catch (error) {
      if (error.message.includes('bloqueado')) {
        await checkLock();
        Alert.alert('Bloqueado', error.message);
      } else {
        setError(true);
        setPin('');
        Alert.alert('Erro', error.message || 'PIN incorreto');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometry = async () => {
    if (!biometryAvailable) return;
    
    setLoading(true);
    try {
      const success = await authenticateWithBiometry('Autentique-se para acessar o CLÃ');
      if (success) {
        await recordAccess();
        handleSuccess();
      } else {
        Alert.alert('Biometria', 'Autenticação biométrica falhou. Use o PIN.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível usar biometria');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      navigation.replace('Home');
    }
  };

  const renderPinDots = () => {
    return (
      <View style={styles.pinContainer}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < pin.length && styles.pinDotFilled,
              error && index < pin.length && styles.pinDotError,
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
                disabled={loading || lockRemaining > 0}
              >
                <Text style={styles.numberText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.numberRow}>
          {biometryAvailable ? (
            <TouchableOpacity
              style={styles.biometryButton}
              onPress={handleBiometry}
              disabled={loading || lockRemaining > 0}
            >
              <Ionicons name="finger-print" size={32} color="#4a90e2" />
            </TouchableOpacity>
          ) : (
            <View style={styles.numberButton} />
          )}
          <TouchableOpacity
            style={styles.numberButton}
            onPress={() => handleNumberPress('0')}
            disabled={loading || lockRemaining > 0}
          >
            <Text style={styles.numberText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.numberButton}
            onPress={handleBackspace}
            disabled={loading || lockRemaining > 0 || pin.length === 0}
          >
            <Ionicons name="backspace-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name="lock-closed" size={64} color="#4a90e2" />
            <Text style={styles.title}>Digite seu PIN</Text>
            {lockRemaining > 0 ? (
              <Text style={styles.lockText}>
                Bloqueado por {lockRemaining} segundos
              </Text>
            ) : (
              <Text style={styles.subtitle}>
                {remainingAttempts > 0
                  ? `${remainingAttempts} tentativa${remainingAttempts > 1 ? 's' : ''} restante${remainingAttempts > 1 ? 's' : ''}`
                  : 'PIN bloqueado'}
              </Text>
            )}
          </View>

          <View style={styles.pinSection}>
            {loading ? (
              <ActivityIndicator size="large" color="#4a90e2" />
            ) : (
              renderPinDots()
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
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
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
  },
  lockText: {
    fontSize: 16,
    color: '#f87171',
    textAlign: 'center',
    fontWeight: '600',
  },
  pinSection: {
    alignItems: 'center',
    marginVertical: 40,
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
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
  pinDotError: {
    backgroundColor: '#f87171',
    borderColor: '#f87171',
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
  biometryButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#4a90e2',
  },
  numberText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
  },
});

