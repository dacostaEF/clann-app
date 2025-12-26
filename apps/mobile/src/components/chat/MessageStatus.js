import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chatTheme } from '../../styles/chatTheme';

/**
 * Componente de status de mensagem estilo WhatsApp
 * Sprint 6 - ETAPA 4
 * Estados: ✔ enviado, ✔✔ entregue, ✔✔ azul lido
 */
export default function MessageStatus({ 
  deliveredTo = [], 
  readBy = [] 
}) {
  // Determinar estado da mensagem
  const getStatus = () => {
    if (readBy.length > 0) {
      return 'read'; // ✔✔ azul (lido)
    } else if (deliveredTo.length > 0) {
      return 'delivered'; // ✔✔ cinza (entregue)
    } else {
      return 'sent'; // ✔ cinza (enviado)
    }
  };

  const status = getStatus();

  return (
    <View style={styles.container}>
      {status === 'read' ? (
        // ✔✔ azul (lido)
        <>
          <Ionicons 
            name="checkmark-done" 
            size={16} 
            color={chatTheme.bubbleSent} 
            style={styles.icon}
          />
          <Ionicons 
            name="checkmark-done" 
            size={16} 
            color={chatTheme.bubbleSent} 
            style={[styles.icon, styles.iconOverlap]}
          />
        </>
      ) : status === 'delivered' ? (
        // ✔✔ cinza (entregue)
        <>
          <Ionicons 
            name="checkmark-done" 
            size={16} 
            color={chatTheme.textSecondary} 
            style={styles.icon}
          />
          <Ionicons 
            name="checkmark-done" 
            size={16} 
            color={chatTheme.textSecondary} 
            style={[styles.icon, styles.iconOverlap]}
          />
        </>
      ) : (
        // ✔ cinza (enviado)
        <Ionicons 
          name="checkmark" 
          size={16} 
          color={chatTheme.textSecondary} 
          style={styles.icon}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  icon: {
    marginLeft: 0,
  },
  iconOverlap: {
    marginLeft: -8, // Sobreposição dos ícones duplos
  },
});

