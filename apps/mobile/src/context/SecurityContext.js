/**
 * Context API para gerenciamento do estado de segurança
 * Guarda flags e estado relacionado a PIN, biometria e tentativas
 * 
 * NÃO implementa lógica de autodestruição.
 * A lógica de autodestruição continua nos módulos do Sprint 2.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { hasPin } from '../security/PinManager';
import { isBiometryEnabled, isBiometryAvailable } from '../security/BiometryManager';
import { getRemainingAttempts, getLockRemainingTime } from '../security/PinManager';
import { getFailedAttempts } from '../security/SelfDestruct';

const SecurityContext = createContext(null);

export function SecurityProvider({ children }) {
  const [hasPinConfigured, setHasPinConfigured] = useState(false);
  const [biometryEnabled, setBiometryEnabled] = useState(false);
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [pinRemainingAttempts, setPinRemainingAttempts] = useState(5);
  const [pinLockRemaining, setPinLockRemaining] = useState(0);
  const [selfDestructAttempts, setSelfDestructAttempts] = useState(0);
  const [loading, setLoading] = useState(true);

  /**
   * Carrega o estado de segurança
   */
  const loadSecurityState = async () => {
    try {
      setLoading(true);
      
      // Importa a função hasPin dinamicamente para evitar problemas no web
      const { hasPin: hasPinFn } = await import('../security/PinManager');
      
      const [hasPinValue, biometryEnabled, biometryAvail, remainingAttempts, lockRemaining, failedAttempts] = await Promise.all([
        hasPinFn().catch(() => false),
        isBiometryEnabled().catch(() => false),
        isBiometryAvailable().catch(() => false),
        getRemainingAttempts().catch(() => 5),
        getLockRemainingTime().catch(() => 0),
        getFailedAttempts().catch(() => 0),
      ]);

      setHasPinConfigured(hasPinValue);
      setBiometryEnabled(biometryEnabled);
      setBiometryAvailable(biometryAvail);
      setPinRemainingAttempts(remainingAttempts);
      setPinLockRemaining(lockRemaining);
      setSelfDestructAttempts(failedAttempts);
    } catch (error) {
      console.error('Erro ao carregar estado de segurança:', error);
      // Define valores padrão em caso de erro
      setHasPinConfigured(false);
      setBiometryEnabled(false);
      setBiometryAvailable(false);
      setPinRemainingAttempts(5);
      setPinLockRemaining(0);
      setSelfDestructAttempts(0);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Atualiza o estado de PIN
   */
  const updatePinState = async () => {
    try {
      const { hasPin: hasPinFn } = await import('../security/PinManager');
      const hasPinValue = await hasPinFn().catch(() => false);
      setHasPinConfigured(hasPinValue);
      if (hasPinValue) {
        const remaining = await getRemainingAttempts().catch(() => 5);
        const lockRemaining = await getLockRemainingTime().catch(() => 0);
        setPinRemainingAttempts(remaining);
        setPinLockRemaining(lockRemaining);
      }
    } catch (error) {
      console.error('Erro ao atualizar estado de PIN:', error);
    }
  };

  /**
   * Atualiza o estado de biometria
   */
  const updateBiometryState = async () => {
    const enabled = await isBiometryEnabled();
    const available = await isBiometryAvailable();
    setBiometryEnabled(enabled);
    setBiometryAvailable(available);
  };

  /**
   * Atualiza tentativas de autodestruição
   */
  const updateSelfDestructState = async () => {
    const attempts = await getFailedAttempts();
    setSelfDestructAttempts(attempts);
  };

  // Carrega estado inicial
  useEffect(() => {
    loadSecurityState();
  }, []);

  // Atualiza estado periodicamente (a cada 5 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      updatePinState();
      updateBiometryState();
      updateSelfDestructState();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const value = {
    // Estado
    hasPinConfigured,
    biometryEnabled,
    biometryAvailable,
    pinRemainingAttempts,
    pinLockRemaining,
    selfDestructAttempts,
    loading,
    
    // Funções
    loadSecurityState,
    updatePinState,
    updateBiometryState,
    updateSelfDestructState,
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}

/**
 * Hook para usar o SecurityContext
 */
export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity deve ser usado dentro de SecurityProvider');
  }
  return context;
}

