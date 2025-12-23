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
  ScrollView,
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
  const infoIconColor = 'rgba(107, 122, 144, 0.65)';
  const infoIconActiveColor = '#4a90e2';

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
        {/* Botão Voltar - Fixo no topo */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#666666" />
        </TouchableOpacity>
        
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>

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
                  <Ionicons
                    name="information-circle"
                    size={18}
                    color={activeTooltip === 'codinome' ? infoIconActiveColor : infoIconColor}
                  />
                </TouchableOpacity>
              </View>
              {activeTooltip === 'codinome' && (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipTitle}>
                    Este é o seu codinome público no CLANN.
                  </Text>
                  <View style={styles.tooltipItemContainer}>
                    <Text style={styles.tooltipItem}>• É como você aparecerá nas conversas, listas de membros e ações dentro dos CLANNs</Text>
                    <Text style={styles.tooltipItem}>• Não revela sua identidade real nem informações pessoais</Text>
                    <Text style={styles.tooltipItem}>• Funciona como sua identidade social soberana</Text>
                    <Text style={styles.tooltipItem}>• Pode ser alterado posteriormente nas configurações do Totem</Text>
                  </View>
                </View>
              )}
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <Text style={styles.label}>ID:</Text>
                  <TouchableOpacity
                    onPress={() => setActiveTooltip(activeTooltip === 'id' ? null : 'id')}
                    style={styles.infoIcon}
                  >
                    <Ionicons
                      name="information-circle"
                      size={16}
                      color={activeTooltip === 'id' ? infoIconActiveColor : infoIconColor}
                    />
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
                  <Text style={styles.tooltipTitle}>
                    Identificador técnico único do seu Totem.
                  </Text>
                  <View style={styles.tooltipItemContainer}>
                    <Text style={styles.tooltipItem}>• Usado internamente pelo CLANN para garantir unicidade e integridade das interações</Text>
                    <Text style={styles.tooltipItem}>• Não é exibido em conversas nem visível para outros membros</Text>
                    <Text style={styles.tooltipItem}>• Você só precisará dele em situações específicas, como recuperação, validação ou suporte técnico</Text>
                    <Text style={styles.tooltipItem}>Não contém informações pessoais e não permite identificar quem você é.</Text>
                  </View>
                </View>
              )}

              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <Text style={styles.label}>Chave Pública:</Text>
                  <TouchableOpacity
                    onPress={() => setActiveTooltip(activeTooltip === 'publicKey' ? null : 'publicKey')}
                    style={styles.infoIcon}
                  >
                    <Ionicons
                      name="information-circle"
                      size={16}
                      color={activeTooltip === 'publicKey' ? infoIconActiveColor : infoIconColor}
                    />
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
                  <Text style={styles.tooltipTitle}>
                    Componente criptográfico de verificação do seu Totem.
                  </Text>
                  <View style={styles.tooltipItemContainer}>
                    <Text style={styles.tooltipItem}>• Permite que outros sistemas ou membros confirmem que mensagens e ações vieram do seu Totem</Text>
                    <Text style={styles.tooltipItem}>• Pode ser usada em auditorias, validações externas ou integrações futuras</Text>
                    <Text style={styles.tooltipItem}>• Não dá acesso ao seu Totem e não compromete sua segurança</Text>
                    <Text style={styles.tooltipItem}>Sua chave privada nunca sai do seu dispositivo.</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Botão de continuar (apenas quando não está carregando) */}
          {!loading && totemData && (
            <>
              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.button} onPress={handleContinue} activeOpacity={0.8}>
                  <Text style={styles.buttonText}>Ver frase de recuperação</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveTooltip(activeTooltip === 'recoveryPhrase' ? null : 'recoveryPhrase')}
                  style={styles.buttonInfoIcon}
                >
                  <Ionicons
                    name="information-circle"
                    size={18}
                    color={activeTooltip === 'recoveryPhrase' ? infoIconActiveColor : infoIconColor}
                  />
                </TouchableOpacity>
              </View>
              {activeTooltip === 'recoveryPhrase' && (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipTitle}>
                    A frase de recuperação permite restaurar toda a identidade do Totem, o que inclui:
                  </Text>
                  <View style={styles.tooltipItemContainer}>
                    <Text style={styles.tooltipItem}>✅ Codinome (ou a capacidade de recuperá-lo/renomeá-lo)</Text>
                    <Text style={styles.tooltipItem}>✅ ID do Totem</Text>
                    <Text style={styles.tooltipItem}>✅ Chave Pública</Text>
                    <Text style={styles.tooltipItem}>✅ Chave Privada correspondente</Text>
                    <Text style={styles.tooltipItem}>✅ Acesso aos CLANNs vinculados àquele Totem</Text>
                    <Text style={[styles.tooltipItem, styles.tooltipItemSpacing]}>Ou seja:</Text>
                    <Text style={styles.tooltipItem}>A frase de recuperação não recupera "o app" e conversas do grupo.</Text>
                    <Text style={styles.tooltipItem}>Ela recupera a identidade inteira.</Text>
                  </View>
                </View>
              )}
              <Text style={styles.recoveryWarning}>
                Sem a frase de recuperação, sua identidade não pode ser restaurada.
              </Text>
            </>
          )}
          </View>
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    paddingTop: 140,
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: '100%',
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
    alignItems: 'center',
  },
  tooltipTitle: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 10,
  },
  tooltipItemContainer: {
    width: '100%',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  tooltipItem: {
    fontSize: 12,
    color: '#cccccc',
    lineHeight: 18,
    textAlign: 'left',
    marginBottom: 6,
  },
  tooltipItemSpacing: {
    marginTop: 8,
    marginBottom: 4,
  },
  tooltipText: {
    fontSize: 12,
    color: '#cccccc',
    lineHeight: 18,
    textAlign: 'left',
  },
  tooltipTextCentered: {
    textAlign: 'center',
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
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
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
  buttonInfoIcon: {
    padding: 4,
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
