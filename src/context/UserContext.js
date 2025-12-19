/**
 * Context API para gerenciamento do estado do usuário
 * Gerencia informações do usuário e preferências
 */

import React, { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState({
    theme: 'dark',
    notifications: true,
  });

  const updateUser = (userData) => {
    setUser(userData);
  };

  const updatePreferences = (newPreferences) => {
    setPreferences((prev) => ({ ...prev, ...newPreferences }));
  };

  const value = {
    user,
    preferences,
    updateUser,
    updatePreferences,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * Hook para usar o UserContext
 */
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser deve ser usado dentro de UserProvider');
  }
  return context;
}

