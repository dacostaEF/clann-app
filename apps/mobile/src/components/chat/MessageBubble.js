import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chatTheme } from '../../styles/chatTheme';
import ReactionRow from './ReactionRow';
import MessageStatus from './MessageStatus';
import { injectWatermark } from '../../utils/watermark';

/**
 * Bolha de mensagem estilo WhatsApp/Telegram
 * Suporta mensagens enviadas e recebidas
 * Sprint 6 - ETAPA 3: Suporte a reações
 */
export default function MessageBubble({ 
  message, 
  isSent, 
  authorName, 
  timestamp,
  showAuthor = false,
  showAvatar = false,
  selfDestructAt = null,
  burnAfterRead = false,
  reactions = null,
  onLongPress = null,
  onReactionPress = null,
  currentTotemId = null,
  deliveredTo = [],
  readBy = [],
  edited = false,
  deleted = false,
  editedAt = null
}) {
  const formatTime = (ts) => {
    const date = new Date(ts);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Aplica watermark invisível ao texto da mensagem (Sprint 7 - ETAPA 2)
  // Watermark é aplicado apenas na renderização, não altera o conteúdo armazenado
  const watermarkedMessage = useMemo(() => {
    if (!message || !currentTotemId || deleted) {
      return message || '';
    }
    
    // Aplica watermark apenas para mensagens recebidas (para identificar quem vazou)
    // Mensagens enviadas também podem ter watermark para rastreamento
    return injectWatermark(message, currentTotemId);
  }, [message, currentTotemId, deleted]);

  // Normaliza watermarkedMessage para garantir que seja sempre string (proteção contra text node warning)
  const safeMessage = typeof watermarkedMessage === 'string' ? watermarkedMessage : '';

  return (
    <View style={[
      styles.container,
      isSent ? styles.containerSent : styles.containerReceived
    ]}>
      {/* Nome do autor (apenas para mensagens recebidas) */}
      {!isSent && showAuthor && authorName && (
        <Text style={styles.authorName}>{authorName}</Text>
      )}

      {/* Container da bolha com long press (Sprint 6 - ETAPA 3) */}
      <TouchableOpacity
        style={[
          styles.bubble,
          isSent ? styles.bubbleSent : styles.bubbleReceived
        ]}
        onLongPress={onLongPress}
        activeOpacity={0.9}
        delayLongPress={500}
      >
        <Text style={[
          styles.messageText,
          isSent ? styles.messageTextSent : styles.messageTextReceived,
          deleted && styles.deletedText
        ]}>
          {safeMessage}
        </Text>

        {/* Timestamp e indicadores */}
        <View style={styles.footer}>
          {/* Indicador de self-destruct ou burn-after-read (Sprint 6) */}
          {(selfDestructAt || burnAfterRead) && (
            <Text style={styles.destructIcon}>
              {burnAfterRead ? '🔥' : '⏳'}
            </Text>
          )}
          
          <Text style={[
            styles.timestamp,
            isSent ? styles.timestampSent : styles.timestampReceived
          ]}>
            {formatTime(timestamp)}
          </Text>
          
          {/* Indicador de edição (Sprint 6 - ETAPA 5) */}
          {edited && !deleted && (
            <Text style={styles.editedLabel}>(editado)</Text>
          )}
          
          {/* Status de mensagem (Sprint 6 - ETAPA 4) - apenas para mensagens enviadas */}
          {isSent && (
            <MessageStatus 
              deliveredTo={deliveredTo}
              readBy={readBy}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Linha de reações (Sprint 6 - ETAPA 3) */}
      {reactions && (
        <ReactionRow
          reactions={reactions}
          onReactionPress={onReactionPress}
          currentTotemId={currentTotemId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '75%',
    marginBottom: 4,
    marginHorizontal: 16,
  },
  containerSent: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  containerReceived: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  authorName: {
    fontSize: 12,
    color: chatTheme.textSecondary,
    marginBottom: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: chatTheme.borderRadius,
    shadowColor: chatTheme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: chatTheme.shadowOpacity,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleSent: {
    backgroundColor: chatTheme.bubbleSent,
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: chatTheme.bubbleReceived,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  messageTextSent: {
    color: '#FFFFFF',
  },
  messageTextReceived: {
    color: chatTheme.textPrimary,
  },
  deletedText: {
    fontStyle: 'italic',
    opacity: 0.7,
  },
  editedLabel: {
    fontSize: 10,
    color: chatTheme.textTertiary,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    marginRight: 4,
  },
  timestampSent: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  timestampReceived: {
    color: chatTheme.textTertiary,
  },
  checkmarks: {
    marginLeft: 2,
  },
  destructIcon: {
    fontSize: 12,
    marginRight: 4,
  },
});

