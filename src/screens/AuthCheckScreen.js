import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTotem, TotemState } from '../context/TotemContext';

export default function AuthCheckScreen() {
  const navigation = useNavigation();
  const { totemState, loading: totemLoading } = useTotem();

  /**
   * Verifica se há código de convite na URL
   * DOSE 2: Gate Page - verificar convite antes de decidir rota
   */
  const checkForInviteInURL = async () => {
    try {
      let url = null;
      
      if (Platform.OS === 'web') {
        url = window.location.href;
      } else {
        url = await Linking.getInitialURL();
      }
      
      if (!url) return false;

      // Extrair parâmetros da hash (#) da URL
      const hashPart = url.split('#')[1] || '';
      const queryString = hashPart.split('?')[1] || '';
      
      if (!queryString) return false;

      const params = Object.fromEntries(new URLSearchParams(queryString));
      
      // Verificar se há clannId (indica convite)
      return !!params.clannId;
    } catch (error) {
      console.error('Erro ao verificar URL:', error);
      return false;
    }
  };

  useEffect(() => {
    // DOSE 4.3 - AuthCheck Simplificado
    // Aguardar carregamento completo antes de navegar
    if (totemLoading) return;

    // Verificar se há convite na URL quando TotemState.NONE
    if (totemState === TotemState.NONE) {
      checkForInviteInURL().then((hasInvite) => {
        if (hasInvite) {
          // Se há convite, vai para Welcome (que processa o convite)
          navigation.replace('Welcome');
        } else {
          // Se não há convite, vai para Gate Page
          navigation.replace('GatePage');
        }
      });
      return;
    }

    // Navegar baseado apenas no totemState (sem lógica implícita)
    switch (totemState) {

      case TotemState.NEEDS_PIN:
        navigation.replace('CreatePin');
        break;

      case TotemState.READY:
        navigation.replace('EnterPin');
        break;

      case TotemState.CORRUPTED:
        navigation.replace('TotemAudit');
        break;

      case TotemState.LOADING:
      default:
        // Não navegar durante carregamento
        break;
    }
  }, [totemLoading, totemState, navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4a90e2" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center'
  }
});
