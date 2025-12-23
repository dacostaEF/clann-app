/**
 * Tela de Boas-vindas - Primeira tela do onboarding
 * DOSE 2: Integração com convites via URL
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTotem } from '../../context/TotemContext';
import ClanManager from '../../clans/ClanManager';
import { getCurrentTotemId } from '../../crypto/totemStorage';
import { generateTotem } from '../../crypto/totem';
import { saveTotemSecure } from '../../storage/secureStore';
import MessagesManager from '../../messages/MessagesManager';

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { totem, setTotem } = useTotem();
  const [clannParams, setClannParams] = useState(null);
  const [status, setStatus] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Detectar se é mobile (width < 768px)
  const windowWidth = Dimensions.get('window').width;
  const isMobile = windowWidth < 768;

  useEffect(() => {
    // DOSE 2: Verificar se há parâmetros de convite na URL
    checkInitialURL();
    
    // Escutar mudanças de URL (para Web)
    if (Platform.OS === 'web') {
      const handleURLChange = () => {
        checkInitialURL();
      };
      
      // Escutar mudanças na hash da URL
      window.addEventListener('hashchange', handleURLChange);
      
      return () => {
        window.removeEventListener('hashchange', handleURLChange);
      };
    }
  }, []);

  /**
   * DOSE 2: Verifica URL inicial e extrai parâmetros de convite
   * 🔒 REGRA: NUNCA buscar dados no Gateway aqui
   * 🔒 REGRA: A entrada é com base APENAS nos dados do convite
   */
  const checkInitialURL = async () => {
    try {
      let url = null;
      
      // Obter URL inicial
      if (Platform.OS === 'web') {
        // Na Web, pegar da window.location
        url = window.location.href;
      } else {
        // Mobile: usar Linking
        url = await Linking.getInitialURL();
      }
      
      if (!url) {
        setStatus('');
        return;
      }

      // Extrair parâmetros da hash (#) da URL
      // Exemplo: http://localhost:8081/#/welcome?clannId=...&clanName=...
      const hashPart = url.split('#')[1] || '';
      const queryString = hashPart.split('?')[1] || '';
      
      if (!queryString) {
        setStatus('');
        return;
      }

      // Converter parâmetros para objeto
      const params = Object.fromEntries(new URLSearchParams(queryString));
      
      // 🔒 VALIDAÇÃO CRÍTICA: Deve ter clannId
      if (!params.clannId) {
        setStatus('');
        return;
      }

      // Armazenar parâmetros (incluindo nome se existir)
      const clannData = {
        clannId: params.clannId,
        clanName: params.clanName || `CLANN ${params.clannId.substring(0, 8)}...`,
        objective: params.objective || '',
        securityTier: params.securityTier || 'free',
        source: params.source || 'direct'
      };
      
      setClannParams(clannData);
      setStatus(`Convite detectado: ${clannData.clanName}`);

      // INICIAR ENTRADA AUTOMÁTICA (após pequeno delay para UX)
      setTimeout(() => {
        handleAutoJoin(clannData);
      }, 1500);

    } catch (error) {
      console.error('Erro ao processar URL:', error);
      setStatus('');
    }
  };

  /**
   * DOSE 2: Entrada automática no CLANN via convite
   * 🔒 REGRA CRÍTICA: NUNCA buscar dados no Gateway aqui
   * 🔒 REGRA CRÍTICA: A entrada é com base APENAS nos dados do convite
   * 
   * IMPLEMENTAÇÃO: Criação automática de Totem para securityTier='free'
   * Preserva soberania local e elimina loops de onboarding
   */
  const handleAutoJoin = async (clannData) => {
    setProcessing(true);
    setStatus(`Entrando no CLANN: ${clannData.clanName || clannData.clannId}`);
    
    try {
      // 1. PRIMEIRO: Verificar Totem local
      let totemId = await getCurrentTotemId();
      
      if (!totemId) {
        // 2. DECISÃO: Criar Totem automaticamente apenas para securityTier='free'
        if (clannData.securityTier === 'free') {
          // Criação automática de Totem (padrão do TotemGenerationScreen)
          setStatus('Criando Totem...');
          
          try {
            console.log('[WelcomeScreen] Criando Totem automaticamente para securityTier=free');
            const newTotem = generateTotem();
            console.log('[WelcomeScreen] Totem gerado:', newTotem);
            
            // Persistir Totem no secureStore
            await saveTotemSecure(newTotem);
            console.log('[WelcomeScreen] Totem salvo com sucesso');
            
            // Atualizar estado global via TotemContext
            await setTotem(newTotem);
            
            // Obter totemId do Totem criado
            totemId = newTotem.totemId;
            console.log('[WelcomeScreen] Totem criado e injetado no context. ID:', totemId);
            
            // INICIALIZAR GATEWAY APÓS CRIAÇÃO DO TOTEM (Fase 3)
            try {
              await MessagesManager.initializeGateway();
              console.log('🌍 Totem conectado ao Gateway CLANN!');
              console.log('   Comunicação internacional agora disponível');
            } catch (error) {
              console.error('⚠️ Gateway não disponível, modo local apenas:', error);
              // O app continua funcionando localmente
            }
            
            setStatus('Totem criado. Entrando no CLANN...');
          } catch (error) {
            console.error('[WelcomeScreen] Erro ao criar Totem automaticamente:', error);
            throw new Error(`Falha ao criar Totem: ${error.message}`);
          }
        } else {
          // Para securityTier !== 'free', manter comportamento de onboarding manual
          setStatus('');
          setProcessing(false);
          Alert.alert(
            'Totem Necessário',
            'Você precisa criar um Totem primeiro para entrar neste CLANN.',
            [
              {
                text: 'Criar Totem',
                onPress: () => {
                  navigation.navigate('TotemGeneration', { pendingClann: clannData });
                }
              },
              {
                text: 'Cancelar',
                style: 'cancel',
                onPress: () => {
                  setClannParams(null);
                  setStatus('');
                  setProcessing(false);
                }
              }
            ]
          );
          return;
        }
      }

      // 2. DEPOIS: Chamar lógica de entrada EXISTENTE
      // 🔒 NOTA: ClanManager deve funcionar APENAS com clannId
      const success = await ClanManager.joinClanByClannId(clannData.clannId, totemId);
      
      if (success) {
        setStatus(`✅ Entrou no CLANN: ${clannData.clanName || clannData.clannId}`);
        
        // Navegar para chat após 1s
        setTimeout(() => {
          navigation.navigate('ClanDetail', { 
            clanId: success.id || clannData.clannId,
            clan: success
          });
          setClannParams(null);
          setStatus('');
          setProcessing(false);
        }, 1000);
      } else {
        setStatus('❌ Falha ao entrar no CLANN (verifique Totem local)');
        setProcessing(false);
      }
      
    } catch (error) {
      console.error('Erro ao entrar no CLANN:', error);
      Alert.alert('Erro', error.message || 'Erro na entrada local');
      setStatus('');
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, isMobile && styles.contentMobile]}>
            {/* Navegação de retorno */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>← Voltar</Text>
            </TouchableOpacity>

            {/* Logo CLANN discreta */}
            <Image
              source={require('../../../LogoClann.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* Título principal */}
            <Text style={styles.title}>CLÃ</Text>

            {/* Subtítulo */}
            <Text style={styles.subtitle}>Identidade Anônima por Design</Text>

            {/* Bloco 1 - O que é o Totem? */}
            <View style={styles.textBlock}>
              <Text style={styles.blockTitle}>O que é o Totem?</Text>
              <Text style={styles.blockText}>
                Seu Totem é uma identidade criptográfica anônima, gerada localmente no seu dispositivo.
                {'\n\n'}
                Ele substitui completamente nome, telefone e e-mail por um avatar digital soberano.
                {'\n\n'}
                Nenhuma informação pessoal é usada.{'\n'}
                Nenhuma identidade real é exposta.
              </Text>
            </View>

            {/* Bloco 2 - Por que isso importa? */}
            <View style={styles.textBlock}>
              <Text style={styles.blockTitle}>Por que isso importa?</Text>
              <Text style={styles.blockText}>
                No CLANN, os participantes não operam como pessoas físicas,
                mas como identidades seguras dentro de um coletivo protegido.
                {'\n\n'}
                Isso impede reconhecimento entre membros
                e elimina qualquer forma de rastreamento pessoal.
              </Text>
            </View>

            {/* Bloco 3 - Como funciona? */}
            <View style={styles.textBlock}>
              <Text style={styles.blockTitle}>Como funciona?</Text>
              <Text style={styles.blockText}>
                Ao criar seu Totem, o CLANN gera chaves criptográficas exclusivas
                que permanecem apenas no seu dispositivo.
                {'\n\n'}
                Você escolhe um avatar abstrato e um codinome interno.
                {'\n'}
                Nada é enviado para servidores centrais.
              </Text>
            </View>

            {/* Bloco técnico */}
            <View style={styles.techBlock}>
              <Text style={styles.techTitle}>Proteção técnica ativa</Text>
              <View style={styles.techContent}>
                <Text style={styles.techItem}>✓ Chaves privadas apenas no dispositivo</Text>
                <Text style={styles.techItem}>✓ Zero metadados identificáveis</Text>
                <Text style={styles.techItem}>✓ Nenhum vínculo Totem ↔ Pessoa</Text>
                <Text style={styles.techItem}>✓ Identidade isolada por CLÃ</Text>
              </View>
            </View>

            {/* DOSE 2: Mostrar status de processamento de convite */}
            {status ? (
              <View style={styles.statusContainer}>
                {processing && <ActivityIndicator size="small" color="#4a90e2" style={{ marginRight: 8 }} />}
                <Text style={styles.statusText}>{status}</Text>
              </View>
            ) : null}

            {/* DOSE 2: Mostrar informações do convite */}
            {clannParams && (
              <View style={styles.clannInfoContainer}>
                <Text style={styles.clannInfoTitle}>CLANN ID: {clannParams.clannId}</Text>
                {clannParams.clanName && (
                  <Text style={styles.clannInfoText}>Nome: {clannParams.clanName}</Text>
                )}
                {clannParams.objective && (
                  <Text style={styles.clannInfoText}>Objetivo: {clannParams.objective}</Text>
                )}
                <Text style={styles.clannInfoText}>
                  Origem: {clannParams.source === 'invite' ? 'Convite' : 'Acesso direto'}
                </Text>
              </View>
            )}

            {/* Botão único de ação */}
            {!processing && (
              <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate('TotemGeneration')}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Criar meu Totem</Text>
              </TouchableOpacity>
            )}
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  contentMobile: {
    paddingVertical: 24,
    paddingTop: 16,
  },
  logo: {
    width: 70,
    height: 70,
    marginBottom: 16,
    opacity: 0.65,
    alignSelf: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '500',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 0,
    letterSpacing: 2,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 18,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  textBlock: {
    width: '100%',
    maxWidth: 500,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'left',
  },
  blockText: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
    textAlign: 'left',
  },
  techBlock: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    width: '100%',
    maxWidth: 500,
  },
  techTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4a90e2',
    marginBottom: 16,
    textAlign: 'center',
  },
  techContent: {
    gap: 10,
  },
  techItem: {
    fontSize: 13,
    color: '#aaaaaa',
    lineHeight: 20,
    paddingLeft: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    minWidth: 250,
    justifyContent: 'center',
  },
  statusText: {
    color: '#4a90e2',
    fontSize: 14,
    fontWeight: '600',
  },
  clannInfoContainer: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    minWidth: 280,
  },
  clannInfoTitle: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  clannInfoText: {
    color: '#cccccc',
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});





