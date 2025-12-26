/**
 * Context API para gerenciamento do estado de CLANNs
 * Gerencia lista de CLANNs do usuário e CLANN atual
 * 
 * NÃO implementa chat, membros, tribunal ou votações.
 * Apenas prepara terreno para Sprint 3.
 */

import React, { createContext, useContext, useState } from 'react';
import { getMyClans } from '../services/clanStorage';

const ClanContext = createContext(null);

export function ClanProvider({ children }) {
  const [myClans, setMyClans] = useState([]);
  const [currentClan, setCurrentClan] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Carrega CLANNs do usuário
   * @param {string} totemId - ID do Totem do usuário
   */
  const loadMyClans = async (totemId) => {
    if (!totemId) {
      setMyClans([]);
      return;
    }

    try {
      setLoading(true);
      const clans = await getMyClans(totemId);
      setMyClans(clans || []);
      return clans || [];
    } catch (error) {
      console.error('Erro ao carregar CLANNs:', error);
      setMyClans([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Adiciona um CLANN à lista
   * @param {Object} clan - Objeto CLANN
   */
  const addClan = (clan) => {
    setMyClans((prev) => {
      // Evita duplicatas
      const exists = prev.some((c) => c.clanId === clan.clanId);
      if (exists) {
        return prev;
      }
      return [...prev, clan];
    });
  };

  /**
   * Atualiza um CLANN na lista
   * @param {Object} updatedClan - CLANN atualizado
   */
  const updateClan = (updatedClan) => {
    setMyClans((prev) =>
      prev.map((clan) =>
        clan.clanId === updatedClan.clanId ? updatedClan : clan
      )
    );

    // Se é o CLANN atual, atualiza também
    if (currentClan && currentClan.clanId === updatedClan.clanId) {
      setCurrentClan(updatedClan);
    }
  };

  /**
   * Remove um CLANN da lista
   * @param {string} clanId - ID do CLANN a remover
   */
  const removeClan = (clanId) => {
    setMyClans((prev) => prev.filter((clan) => clan.clanId !== clanId));
    
    // Se é o CLANN atual, limpa
    if (currentClan && currentClan.clanId === clanId) {
      setCurrentClan(null);
    }
  };

  /**
   * Define o CLANN atual
   * @param {Object|null} clan - CLANN a definir como atual
   */
  const setCurrentClanState = (clan) => {
    setCurrentClan(clan);
  };

  const value = {
    // Estado
    myClans,
    currentClan,
    loading,

    // Funções
    loadMyClans,
    addClan,
    updateClan,
    removeClan,
    setCurrentClan: setCurrentClanState,
  };

  return (
    <ClanContext.Provider value={value}>
      {children}
    </ClanContext.Provider>
  );
}

/**
 * Hook para usar o ClanContext
 */
export function useClan() {
  const context = useContext(ClanContext);
  if (!context) {
    throw new Error('useClan deve ser usado dentro de ClanProvider');
  }
  return context;
}

