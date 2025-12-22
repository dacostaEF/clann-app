/**
 * Tela de Geração do Totem - Design Premium
 * Mantém 100% da lógica do Totem (não altera totem.js, seed.js, totemStorage.js ou contexts)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

// Mantendo os imports originais da lógica do Totem
import { generateTotem } from '../../crypto/totem';
import { saveTotemSecure } from '../../storage/secureStore';
import { useTotem } from '../../context/TotemContext';

// CSS Global para animações na Web
const globalCSS = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}

@keyframes glow {
  0% { filter: drop-shadow(0 0 4px rgba(120,180,255,0.5)); }
  50% { filter: drop-shadow(0 0 12px rgba(120,180,255,0.9)); }
  100% { filter: drop-shadow(0 0 4px rgba(120,180,255,0.5)); }
}
`;

export default function TotemGenerationScreen({ navigation }) {
  const { setTotem } = useTotem();
  const [loading, setLoading] = useState(true);
  const [totemData, setTotemData] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Refs para aplicar animações CSS diretamente no DOM (Web)
  const logoWrapperRef = useRef(null);
  const logoGlowRef = useRef(null);

  // Injetar CSS global e aplicar animações na Web
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Injetar CSS global
      const styleId = 'totem-generation-animations';
      let styleElement = document.getElementById(styleId);
      
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = globalCSS;
        document.head.appendChild(styleElement);
      }

      // Função helper para aplicar animação CSS via setNativeProps ou DOM direto
      const applyAnimation = (ref, animation) => {
        if (!ref?.current) return;
        
        try {
          const element = ref.current;
          
          // Método 1: Usar setNativeProps (React Native Web suporta)
          if (typeof element.setNativeProps === 'function') {
            element.setNativeProps({
              style: { 
                animation,
                WebkitAnimation: animation, // Prefixo para Safari
              },
            });
            return;
          }
          
          // Método 2: Acessar DOM diretamente (fallback)
          // React Native Web armazena referência ao DOM em diferentes lugares
          const domElement = 
            element._node || 
            element._nativeNode || 
            (element._owner && element._owner._instance) ||
            element;
          
          if (domElement && domElement.style) {
            domElement.style.animation = animation;
            domElement.style.WebkitAnimation = animation;
          }
        } catch (error) {
          // Silenciosamente falhar se não conseguir aplicar (pode ser mobile)
          if (__DEV__) {
            console.warn('Erro ao aplicar animação CSS (normal em mobile):', error.message);
          }
        }
      };

      // Aplicar animações após um pequeno delay para garantir que os elementos estão renderizados
      const timeoutId = setTimeout(() => {
        // Aplicar animações pulse e glow na logo CLANN
        applyAnimation(logoWrapperRef, 'pulse 1.8s ease-in-out infinite');
        applyAnimation(logoGlowRef, 'glow 2.4s ease-in-out infinite');
      }, 200);

      // Cleanup ao desmontar
      return () => {
        clearTimeout(timeoutId);
        const element = document.getElementById(styleId);
        if (element) {
          element.remove();
        }
      };
    }
  }, [loading]); // Re-executar quando loading mudar para garantir que os elementos existam

  // Geração do Totem (lógica original mantida)
  useEffect(() => {
    const generateTotemData = async () => {
      try {
        setLoading(true);
        console.log('Gerando Totem...');
        const newTotem = generateTotem();
        console.log('Totem gerado:', newTotem);
        console.log('TOTEM GERADO >>>', JSON.stringify(newTotem, null, 2));
        console.log('Propriedades do Totem:', Object.keys(newTotem));
        
        // Salva o Totem de forma segura
        console.log('Salvando Totem...');
        console.log('TOTEM ANTES DE SALVAR >>>', JSON.stringify(newTotem, null, 2));
        await saveTotemSecure(newTotem);
        console.log('Totem salvo com sucesso');
        
        // Atualiza o context
        setTotem(newTotem);
        setTotemData(newTotem);

        // Delay para mostrar a animação
        setTimeout(() => setLoading(false), 800);
      } catch (error) {
        console.error('Erro ao gerar Totem:', error);
        Alert.alert('Erro', `Não foi possível gerar o Totem: ${error.message}`);
        setLoading(false);
      }
    };

    generateTotemData();
  }, []);

  const copyToClipboard = async (text, label) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', `${label} copiado para a área de transferência.`);
  };

  const handleContinue = () => {
    console.log('Navegando para RecoveryPhrase...', {
      recoveryPhrase: totemData?.recoveryPhrase,
      totemExists: !!totemData,
    });
    // Navega para tela de frase de recuperação (mantendo a lógica original)
    if (!totemData?.recoveryPhrase) {
      Alert.alert('Erro', 'Frase de recuperação não encontrada no Totem.');
      return;
    }
    navigation.navigate('RecoveryPhrase', { recoveryPhrase: totemData.recoveryPhrase });
  };

  return (
    <LinearGradient
      colors={['#000000', '#0A1533', '#000000']}
      locations={[0, 0.6, 1]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Botão Voltar */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#666666" />
          </TouchableOpacity>

          {/* Logo CLANN discreta com animação pulsante e glow */}
          <View ref={logoWrapperRef} style={styles.logoWrapper}>
            <View ref={logoGlowRef} style={styles.logoGlowContainer}>
              <Image
                source={require('../../../LogoClann.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Títulos */}
          <Text style={styles.title}>
            {loading ? 'Forjando seu Totem…' : 'Seu Totem nasceu'}
          </Text>

          <Text style={styles.subtitle}>
            {loading
              ? 'Preparando sua identidade criptográfica.'
              : 'Identidade criptográfica gerada localmente no seu dispositivo.'}
          </Text>

          {/* Card do Totem (apenas quando não está carregando) */}
          {!loading && totemData && (
            <View style={styles.card}>
              <View style={styles.cardNameRow}>
                <Text style={styles.cardName}>{totemData.symbolicName}</Text>
                <TouchableOpacity
                  onPress={() => setActiveTooltip(activeTooltip === 'codinome' ? null : 'codinome')}
                  style={styles.infoIcon}
                >
                  <Ionicons name="information-circle" size={18} color="#4a90e2" />
                </TouchableOpacity>
              </View>
              {activeTooltip === 'codinome' && (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipText}>
                    Identificador interno usado no CLANN. Não revela informações pessoais e pode ser alterado posteriormente.
                  </Text>
                </View>
              )}
              <Text style={styles.cardDescription}>
                Este é o seu identificador seguro no CLANN.{'\n'}
                Você pode renomeá-lo depois.
              </Text>

              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <Text style={styles.label}>ID:</Text>
                  <TouchableOpacity
                    onPress={() => setActiveTooltip(activeTooltip === 'id' ? null : 'id')}
                    style={styles.infoIcon}
                  >
                    <Ionicons name="information-circle" size={16} color="#4a90e2" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => copyToClipboard(totemData.totemId, 'ID do Totem')}
                  style={styles.copyButton}
                >
                  <Text style={styles.value}>{totemData.totemId.substring(0, 8).toUpperCase()}</Text>
                  <Ionicons name="copy-outline" size={18} color="#4a90e2" style={styles.copyIcon} />
                </TouchableOpacity>
              </View>
              {activeTooltip === 'id' && (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipText}>
                    Identificador único criptográfico do seu Totem. Gerado deterministicamente a partir da sua chave privada. Usado para autenticação e assinatura digital.
                  </Text>
                </View>
              )}

              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <Text style={styles.label}>Chave Pública:</Text>
                  <TouchableOpacity
                    onPress={() => setActiveTooltip(activeTooltip === 'publicKey' ? null : 'publicKey')}
                    style={styles.infoIcon}
                  >
                    <Ionicons name="information-circle" size={16} color="#4a90e2" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => copyToClipboard(totemData.publicKey, 'Chave pública')}
                  style={styles.copyButton}
                >
                  <Text style={styles.value} numberOfLines={1}>
                    {totemData.publicKey.substring(0, 12)}...
                  </Text>
                  <Ionicons name="copy-outline" size={18} color="#4a90e2" style={styles.copyIcon} />
                </TouchableOpacity>
              </View>
              {activeTooltip === 'publicKey' && (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipText}>
                    Chave criptográfica pública derivada da sua chave privada. Pode ser compartilhada com segurança para verificação de assinaturas e autenticação. A chave privada permanece apenas no seu dispositivo.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Botão de continuar (apenas quando não está carregando) */}
          {!loading && totemData && (
            <>
              <TouchableOpacity style={styles.button} onPress={handleContinue} activeOpacity={0.8}>
                <Text style={styles.buttonText}>Ver frase de recuperação</Text>
              </TouchableOpacity>
              <Text style={styles.recoveryWarning}>
                Sem a frase de recuperação, sua identidade não pode ser restaurada.
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 140,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    padding: 8,
    zIndex: 10,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoGlowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    opacity: 0.65,
    alignSelf: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: 'rgba(80,140,255,0.5)',
  },
  iconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(80,140,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldIcon: {
    // Animação aplicada via ref no useEffect
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#aaaaaa',
    fontSize: 15,
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    width: '100%',
    backgroundColor: '#111827',
    padding: 22,
    borderRadius: 14,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardName: {
    color: '#4a90e2',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  infoIcon: {
    marginLeft: 6,
    padding: 2,
  },
  tooltip: {
    backgroundColor: '#1a2a3a',
    borderWidth: 1,
    borderColor: '#4a90e2',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  tooltipText: {
    fontSize: 12,
    color: '#cccccc',
    lineHeight: 18,
    textAlign: 'left',
  },
  cardDescription: {
    color: '#aaaaaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    gap: 16,
  },
  label: {
    color: '#666666',
    fontSize: 14,
    flexShrink: 0,
  },
  value: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'monospace',
    marginRight: 8,
    flex: 1,
    textAlign: 'right',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  copyIcon: {
    marginLeft: 4,
  },
  button: {
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 280,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  recoveryWarning: {
    color: '#aaaaaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 20,
    paddingHorizontal: 20,
  },
});
