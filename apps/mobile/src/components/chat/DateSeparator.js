import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { chatTheme } from '../../styles/chatTheme';

/**
 * Separador de data estilo WhatsApp
 * Exibe "HOJE", "ONTEM" ou a data formatada
 */
export default function DateSeparator({ timestamp }) {
  const formatDate = (ts) => {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Resetar horas para comparação
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return 'HOJE';
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'ONTEM';
    } else {
      // Formatar data: "DD/MM/YYYY"
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>{formatDate(timestamp)}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: chatTheme.separatorColor,
  },
  text: {
    fontSize: 12,
    color: chatTheme.textTertiary,
    marginHorizontal: 12,
    fontWeight: '500',
  },
});

