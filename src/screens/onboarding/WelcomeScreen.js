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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTotem } from '../../context/TotemContext';
import ClanManager from '../../clans/ClanManager';
import { getCurrentTotemId } from '../../crypto/totemStorage';
import { generateTotem } from '../../crypto/totem';
import { saveTotemSecure } from '../../storage/secureStore';

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { totem, setTotem } = useTotem();
  const [clannParams, setClannParams] = useState(null);
  const [status, setStatus] = useState('');
  const [processing, setProcessing] = useState(false);

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
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <Text style={styles.title}>CLÃ</Text>
            <Text style={styles.subtitle}>Onde o grupo governa</Text>
            <Text style={styles.subtitle}>Onde a privacidade é lei</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 64,
  },
  title: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 20,
    color: '#a0a0a0',
    marginTop: 12,
    textAlign: 'center',
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





