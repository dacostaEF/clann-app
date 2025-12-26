/**
 * Context API para gerenciamento do estado do Totem
 * Centraliza o estado do Totem carregado do secureStore
 * 
 * NÃO implementa lógica de backup, seed ou segurança.
 * Apenas centraliza o estado do Totem.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadTotemSecure } from '../storage/secureStore';
import { hasPin } from '../security/PinManager';
import { validateTotem } from '../crypto/totem';

const TotemContext = createContext(null);

/**
 * Estados oficiais do Totem
 * DOSE 4.2 - Estados Oficiais do Totem
 */
export const TotemState = {
  NONE: 'NONE',                // Nenhum Totem
  LOADING: 'LOADING',          // Carregando do storage
  NEEDS_PIN: 'NEEDS_PIN',      // Totem existe, mas PIN não
  READY: 'READY',              // Totem + PIN válidos
  CORRUPTED: 'CORRUPTED'       // Totem inválido/inconsistente
};

export function TotemProvider({ children }) {
  const [totem, setTotemState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totemState, setTotemStateValue] = useState(TotemState.LOADING);

  /**
   * Deriva o estado do Totem baseado em totem e PIN
   * DOSE 4.2 - Estados Oficiais do Totem
   */
  const deriveTotemState = async (totemData) => {
    // 1. Sem Totem
    if (!totemData) {
      return TotemState.NONE;
    }

    // 2. Verificar se Totem é válido (lazy - não bloquear)
    try {
      const isValid = validateTotem(totemData);
      if (!isValid) {
        return TotemState.CORRUPTED;
      }
    } catch (error) {
      // Se validação falhar, assumir corrompido
      console.error('[TotemContext] Erro ao validar Totem:', error);
      return TotemState.CORRUPTED;
    }

    // 3. Verificar se tem PIN
    try {
      const hasPinConfigured = await hasPin();
      
      if (!hasPinConfigured) {
        return TotemState.NEEDS_PIN;
      }

      return TotemState.READY;
    } catch (error) {
      // Se verificação de PIN falhar, assumir que não tem PIN
      console.error('[TotemContext] Erro ao verificar PIN:', error);
      return TotemState.NEEDS_PIN;
    }
  };

  /**
   * Carrega o Totem do secureStore
   */
  const loadTotem = async () => {
    try {
      setLoading(true);
      setTotemStateValue(TotemState.LOADING);
      
      const loadedTotem = await loadTotemSecure();
      setTotemState(loadedTotem);
      
      // Derivar estado após carregar
      const newState = await deriveTotemState(loadedTotem);
      setTotemStateValue(newState);
      
      return loadedTotem;
    } catch (error) {
      console.error('Erro ao carregar Totem:', error);
      setTotemState(null);
      setTotemStateValue(TotemState.NONE);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Define o Totem no estado
   */
  const setTotem = async (newTotem) => {
    setTotemState(newTotem);
    
    // Derivar estado após atualizar
    const newState = await deriveTotemState(newTotem);
    setTotemStateValue(newState);
  };

  /**
   * Limpa o Totem do estado
   */
  const clearTotem = () => {
    setTotemState(null);
    setTotemStateValue(TotemState.NONE);
  };

  // Carrega Totem ao montar o provider
  useEffect(() => {
    console.log("[TotemContext] Iniciando carregamento do Totem...");
    
    loadTotem().then((loadedTotem) => {
      console.log("[TotemContext] Totem carregado do storage:", loadedTotem);
      
      if (!loadedTotem) {
        console.warn("[TotemContext] Nenhum Totem encontrado — fluxo seguirá para onboarding.");
      }
    });
  }, []);

  const value = {
    totem,
    loading,
    totemState, // DOSE 4.2 - Estado oficial do Totem
    setTotem,
    loadTotem,
    clearTotem,
  };

  return (
    <TotemContext.Provider value={value}>
      {children}
    </TotemContext.Provider>
  );
}

/**
 * Hook para usar o TotemContext
 */
export function useTotem() {
  const context = useContext(TotemContext);
  if (!context) {
    throw new Error('useTotem deve ser usado dentro de TotemProvider');
  }
  return context;
}

