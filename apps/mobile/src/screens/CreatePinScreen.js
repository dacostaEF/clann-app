/**
 * Tela de Criação de PIN
 * Permite criar um PIN de 4-6 dígitos
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createPin } from '../security/PinManager';
import { isBiometryAvailable } from '../security/BiometryManager';
import { useTotem } from '../context/TotemContext';
import ClanStorage from '../clans/ClanStorage';
import { getCurrentTotemId } from '../crypto/totemStorage';

export default function CreatePinScreen({ navigation }) {
  const { loadTotem } = useTotem();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [showBiometryOption, setShowBiometryOption] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Animação de pulso para mobile (mesma lógica das outras telas)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.8)).current;
  
  // Animação de rotação para o spinner de processamento
  const spinAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    checkBiometry();
  }, []);

  // Animação de pulso para mobile (mesma lógica das outras telas)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.08,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.8,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, []);

  // Animação de rotação para o spinner de processamento
  useEffect(() => {
    if (loading || isProcessing) {
      // Resetar o valor da animação para garantir rotação contínua
      spinAnim.setValue(0);
      
      const spinAnimation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );
      spinAnimation.start();
      return () => {
        spinAnimation.stop();
        spinAnim.setValue(0);
      };
    } else {
      // Parar animação quando não está processando
      spinAnim.setValue(0);
    }
  }, [loading, isProcessing]);

  const checkBiometry = async () => {
    const available = await isBiometryAvailable();
    setShowBiometryOption(available);
  };

  const handleNumberPress = (number) => {
    if (!isConfirming) {
      // Primeira entrada do PIN
      if (pin.length < 6 && !isProcessing) {
        setPin(pin + number);
      }
    } else {
      // Confirmação do PIN
      if (confirmPin.length < pin.length && !loading && !isProcessing) {
        const newConfirmPin = confirmPin + number;
        setConfirmPin(newConfirmPin);
        
        // Ao completar o último dígito, mostra spinner IMEDIATAMENTE
        if (newConfirmPin.length === pin.length && pin.length >= 4) {
          // Ativa processamento visual instantaneamente
          setIsProcessing(true);
          
          // Validação assíncrona após mostrar o spinner
          setTimeout(() => {
            if (newConfirmPin === pin) {
              // PINs coincidem - cria o PIN
              handleCreatePin(pin);
            } else {
              // PINs não coincidem - volta para entrada e mostra erro
              setIsProcessing(false);
              Alert.alert('Erro', 'Os PINs não coincidem. Tente novamente.');
              setPin('');
              setConfirmPin('');
              setIsConfirming(false);
            }
          }, 100); // Pequeno delay apenas para garantir renderização do spinner
        }
      }
    }
  };

  const handleBackspace = () => {
    // Não permite backspace durante processamento
    if (loading || isProcessing) return;
    
    if (isConfirming && confirmPin.length > 0) {
      setConfirmPin(confirmPin.slice(0, -1));
    } else if (!isConfirming && pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  /**
   * Navega após criar PIN: verifica se há CLANNs e navega para ClanDetail se existir
   */
  const navigateAfterPinCreation = async () => {
    try {
      const totemId = await getCurrentTotemId();
      if (!totemId) {
        // Se não conseguir obter totemId, vai para Home
        navigation.navigate('Home');
        return;
      }

      // Buscar CLANNs associados ao Totem
      const clans = await ClanStorage.getUserClans(totemId);
      
      if (clans && clans.length > 0) {
        // Se houver CLANNs, navegar para o primeiro
        const firstClan = clans[0];
        navigation.navigate('ClanDetail', {
          clanId: firstClan.id,
          clan: firstClan
        });
      } else {
        // Se não houver CLANNs, navegar para Home
        navigation.navigate('Home');
      }
    } catch (error) {
      console.warn('[CreatePin] Erro ao verificar CLANNs, navegando para Home:', error);
      // Em caso de erro, navegar para Home (comportamento seguro)
      navigation.navigate('Home');
    }
  };

  const handleCreatePin = async (finalPin) => {
    if (finalPin.length < 4) {
      setIsProcessing(false);
      Alert.alert('Atenção', 'O PIN deve ter pelo menos 4 dígitos');
      return;
    }

    // Já está em processamento visual, agora inicia a criação real
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
              onPress: () => navigateAfterPinCreation(),
            },
            {
              text: 'Sim',
              onPress: async () => {
                const { enableBiometry } = await import('../security/BiometryManager');
                try {
                  await enableBiometry();
                  await navigateAfterPinCreation();
                } catch (error) {
                  Alert.alert('Erro', 'Não foi possível ativar biometria');
                  await navigateAfterPinCreation();
                }
              },
            },
          ]
        );
      } else {
        await navigateAfterPinCreation();
      }
    } catch (error) {
      setIsProcessing(false);
      Alert.alert('Erro', error.message || 'Não foi possível criar o PIN');
    } finally {
      setLoading(false);
      setIsProcessing(false);
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
                disabled={loading || isProcessing || (isConfirming && confirmPin.length >= pin.length)}
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
            disabled={loading || (isConfirming && confirmPin.length >= pin.length)}
          >
            <Text style={styles.numberText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.numberButton}
            onPress={handleBackspace}
            disabled={loading || isProcessing || (pin.length === 0 && confirmPin.length === 0) || (isConfirming && confirmPin.length >= pin.length)}
          >
            <Ionicons name="backspace-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Tela de processamento ritualístico (mostra imediatamente ao completar PIN)
  if (loading || isProcessing) {
    const spin = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#000000', '#1a1a2e', '#16213e']}
          style={styles.gradient}
        >
          <ScrollView 
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          >
            {/* Header Ritualístico - Respiro visual soberano */}
            <View style={styles.topSpacer} />
            
            <View style={styles.backContainer}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
                disabled={true}
              >
                <Text style={[styles.backText, { opacity: 0.3 }]}>← Voltar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.logoContainer}>
              {Platform.OS === 'web' ? (
                <Image
                  source={require('../../assets/LogoClann.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <Animated.View
                  style={[
                    {
                      transform: [{ scale: pulseAnim }],
                      opacity: opacityAnim,
                    },
                  ]}
                >
                  <Image
                    source={require('../../assets/LogoClann.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </Animated.View>
              )}
            </View>

            <View style={styles.processingContainer}>
              <Animated.View
                style={[
                  styles.spinnerContainer,
                  { transform: [{ rotate: spin }] },
                ]}
              >
                <View style={styles.spinnerCircle} />
              </Animated.View>
              
              <Text style={styles.processingTitle}>Estamos criando seu Totem</Text>
              <Text style={styles.processingSubtitle}>
                Processando sua identidade e segurança…
              </Text>
            </View>
          </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Ritualístico - Respiro visual soberano */}
          <View style={styles.topSpacer} />
          
          <View style={styles.backContainer}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.backText}>← Voltar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.logoContainer}>
            {Platform.OS === 'web' ? (
              <Image
                source={require('../../assets/LogoClann.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <Animated.View
                style={[
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: opacityAnim,
                  },
                ]}
              >
                <Image
                  source={require('../../assets/LogoClann.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </Animated.View>
            )}
          </View>

          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="lock-closed" size={56} color="#4a90e2" />
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
                {/* Botão removido - processo é automático ao completar o último dígito */}
              </>
            )}
          </View>

            {renderNumberPad()}
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
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
    padding: 24,
  },
  topSpacer: {
    height: 40,
  },
  backContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  backText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 60,
    height: 60,
    opacity: 0.65,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  pinSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  label: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 12,
    marginTop: 8,
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
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
    marginTop: 8,
    marginBottom: 24,
  },
  numberRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  numberButton: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  // Estilos para tela de processamento
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  spinnerContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  spinnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#4a90e2',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 15,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 32,
  },
  numberText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
  },
});

