import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { chatTheme } from '../../styles/chatTheme';

/**
 * Separador de data estilo WhatsApp/Telegram
 * Exibe "Hoje", "Ontem" ou data formatada amigável (ex: "09 de janeiro")
 * Fase 3 - Item 3.2: Orientação temporal macro
 */
export default function DateSeparator({ timestamp }) {
  const formatDate = (ts) => {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Resetar horas para comparação (apenas data, sem hora)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    // Comparar datas
    if (dateOnly.getTime() === todayOnly.getTime()) {
      return 'Hoje';
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Ontem';
    } else {
      // Formatar data amigável: "09 de janeiro"
      const day = date.getDate();
      const monthNames = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
      ];
      const monthName = monthNames[date.getMonth()];
      return `${day} de ${monthName}`;
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
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: chatTheme.separatorColor,
    opacity: 0.5,
  },
  text: {
    fontSize: 11,
    color: chatTheme.textTertiary || chatTheme.textSecondary,
    marginHorizontal: 10,
    fontWeight: '400',
    opacity: 0.8,
    textTransform: 'capitalize',
  },
});

