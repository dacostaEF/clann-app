import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCodeSVG from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import ClanStorage from '../clans/ClanStorage';

// CSS Global para animações e efeitos premium na Web
const globalCSS = `
@keyframes subtleGlow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
}

.clann-icon-premium-glow {
  animation: subtleGlow 3s ease-in-out infinite;
}

.clann-icon-premium-float {
  animation: float 4s ease-in-out infinite;
}

.share-button-premium:hover {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4), 0 0 30px rgba(110, 182, 255, 0.3) !important;
  transform: translateY(-2px);
}

.chat-button-premium:hover {
  box-shadow: 0 8px 20px rgba(0, 255, 157, 0.4), 0 0 30px rgba(0, 255, 157, 0.2) !important;
  transform: translateY(-2px);
}
`;

export default function ClanInviteScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { clanId, clan: clanFromParams } = route.params || {};
  
  const [clan, setClan] = useState(clanFromParams || null);
  const [loading, setLoading] = useState(!clanFromParams);
  
  // Refs para aplicar animações CSS diretamente no DOM (Web)
  const iconContainerRef = useRef(null);
  const qrCardRef = useRef(null);
  const codeTextRef = useRef(null);

  // Injetar CSS global e aplicar animações (Web)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const styleId = 'clann-invite-premium-animations';
      let styleElement = document.getElementById(styleId);
      
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = globalCSS;
        document.head.appendChild(styleElement);
      }

      // Aplicar animações após renderização
      const timeoutId = setTimeout(() => {
        const applyAnimation = (ref, className) => {
          if (!ref?.current) return;
          try {
            const element = ref.current;
            const domElement = 
              element._node || 
              element._nativeNode || 
              (element._owner && element._owner._instance) ||
              element;
            
            if (domElement && domElement.classList) {
              domElement.classList.add(className);
            }
          } catch (error) {
            if (__DEV__) {
              console.warn('Erro ao aplicar animação CSS:', error.message);
            }
          }
        };

        applyAnimation(iconContainerRef, 'clann-icon-premium-glow');
        applyAnimation(iconContainerRef, 'clann-icon-premium-float');
      }, 200);

      return () => {
        clearTimeout(timeoutId);
        const element = document.getElementById(styleId);
        if (element) {
          element.remove();
        }
      };
    }
  }, [clan]);

  useEffect(() => {
    // Se já recebeu o CLANN via params, não precisa buscar
    if (clanFromParams) {
      setClan(clanFromParams);
      setLoading(false);
      return;
    }
    
    // Caso contrário, tenta buscar no banco (só funciona em mobile)
    loadClanData();
  }, [clanId, clanFromParams]);

  const loadClanData = async () => {
    if (!clanId) {
      Alert.alert('Erro', 'ID do CLANN não fornecido');
      setLoading(false);
      return;
    }

    try {
      const clanData = await ClanStorage.getClanById(clanId);
      if (!clanData) {
        Alert.alert('Erro', 'CLANN não encontrado');
        setLoading(false);
        return;
      }
      setClan(clanData);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os dados do CLANN');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleShareCode = async () => {
    if (!clan?.invite_code) return;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Erro', 'Compartilhamento não disponível neste dispositivo');
        return;
      }

      const message = `Entre no CLANN "${clan.name}" usando o código: ${clan.invite_code}`;
      await Sharing.shareAsync(message, {
        dialogTitle: 'Compartilhar código do CLANN',
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar o código');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <LinearGradient
        colors={['#0a0a0a', '#111111', '#0a0a0a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6eb6ff" />
            <Text style={styles.loadingText}>Carregando...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!clan) {
    return (
      <LinearGradient
        colors={['#0a0a0a', '#111111', '#0a0a0a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>CLANN não encontrado</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const inviteCode = clan.invite_code || clan.inviteCode || '';
  const qrData = `CLANN:${inviteCode}`;

  return (
    <LinearGradient
      colors={['#0a0a0a', '#111111', '#0a0a0a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Convidar para o CLANN</Text>
            <Text style={styles.subtitle}>
              Compartilhe o código ou escaneie o QR Code
            </Text>
          </View>

          {/* CLANN Info Premium */}
          <View style={styles.clanInfoPremium}>
            <Text style={styles.clanNamePremium}>{clan.name.toUpperCase()}</Text>
            {clan.icon && (
              <View style={styles.iconContainerPremium} ref={iconContainerRef}>
                <Text style={styles.clanIconPremium}>{clan.icon}</Text>
              </View>
            )}
            {clan.description && (
              <Text style={styles.clanSubtitle}>{clan.description}</Text>
            )}
          </View>

          {/* QR Code Card Premium */}
          <View style={styles.qrContainerPremium} ref={qrCardRef}>
            <View style={styles.qrCardInner}>
          <QRCodeSVG
            value={qrData}
            size={220}
            color="#000000"
            backgroundColor="#ffffff"
          />
            </View>
          </View>

          {/* Código de Convite Premium */}
          <View style={styles.codeContainerPremium}>
            <Text style={styles.codeLabelPremium}>Código de Convite</Text>
            <View style={styles.codeBoxPremium}>
              <Text style={styles.codeTextPremium} ref={codeTextRef}>
                {clan.invite_code || clan.inviteCode || 'N/A'}
              </Text>
            </View>
          </View>

          {/* Botões Premium - Container para alinhamento */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.shareButtonPremium}
              onPress={handleShareCode}
              activeOpacity={0.8}
              {...(Platform.OS === 'web' && { className: 'share-button-premium' })}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.shareButtonTextPremium}>📤 Compartilhar Código</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chatButtonPremium}
              onPress={() => navigation.navigate('ClanChat', { clanId: clan.id, clan })}
              activeOpacity={0.8}
              {...(Platform.OS === 'web' && { className: 'chat-button-premium' })}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.chatButtonTextPremium}>💬 Entrar no Chat</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer Premium */}
          <View style={styles.footerPremium}>
            <Text style={styles.footerText}>
              Outros usuários podem entrar neste CLANN usando o código acima ou escaneando o QR Code.
            </Text>
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
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
  },
  // Header Premium
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#88c0ff',
    textAlign: 'center',
    opacity: 0.7,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  // CLANN Info Premium
  clanInfoPremium: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  clanNamePremium: {
    fontSize: 28,
    fontWeight: '800',
    color: Platform.OS === 'web' ? 'transparent' : '#a8d8ff',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
    ...(Platform.OS === 'web' && {
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    }),
  },
  iconContainerPremium: {
    width: 100,
    height: 100,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(110, 182, 255, 0.6)',
    backgroundColor: 'rgba(17, 34, 51, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 0 30px rgba(110, 182, 255, 0.15), inset 0 0 20px rgba(110, 182, 255, 0.1)',
    }),
    shadowColor: '#6eb6ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  clanIconPremium: {
    fontSize: 50,
  },
  clanSubtitle: {
    fontSize: 14,
    color: '#88c0ff',
    opacity: 0.6,
    fontWeight: '300',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 4,
  },
  // QR Code Card Premium
  qrContainerPremium: {
    backgroundColor: 'rgba(20, 25, 35, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(110, 182, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    maxWidth: 320,
    alignSelf: 'center',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(10px)',
    }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  qrCardInner: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  // Código Premium
  codeContainerPremium: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    alignItems: 'stretch',
    marginBottom: 16,
  },
  codeLabelPremium: {
    fontSize: 12,
    color: '#88c0ff',
    marginBottom: 8,
    opacity: 0.7,
    fontWeight: '400',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  codeBoxPremium: {
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(110, 182, 255, 0.2)',
    width: '100%',
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(5px)',
    }),
  },
  codeTextPremium: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    color: '#ffffff',
    textAlign: 'center',
    // Removido gradiente para garantir que o texto apareça sempre
  },
  // Botões Premium - Container
  buttonsContainer: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    alignItems: 'stretch',
    marginBottom: 16,
  },
  shareButtonPremium: {
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
    backgroundColor: 'rgba(42, 67, 101, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(110, 182, 255, 0.3)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  chatButtonPremium: {
    borderRadius: 12,
    marginBottom: 0,
    width: '100%',
    backgroundColor: 'rgba(0, 255, 157, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 157, 0.4)',
    overflow: 'hidden',
    shadowColor: '#00ff9d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonContent: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  shareButtonTextPremium: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  chatButtonTextPremium: {
    color: '#001a0d',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Footer Premium
  footerPremium: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    padding: 16,
    borderRadius: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(110, 182, 255, 0.1)',
    backgroundColor: 'rgba(10, 15, 25, 0.3)',
    marginTop: 8,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(5px)',
    }),
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(200, 220, 255, 0.6)',
    lineHeight: 18,
    textAlign: 'center',
    letterSpacing: 0.3,
    fontWeight: '300',
  },
});
