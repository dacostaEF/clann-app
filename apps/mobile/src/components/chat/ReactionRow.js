import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AVAILABLE_REACTIONS } from '../../messages/ReactionsManager';
import { chatTheme } from '../../styles/chatTheme';

/**
 * Linha de reações abaixo da bolha de mensagem
 * Exibe emojis com contagem e permite toggle ao tocar
 * Sprint 6 - ETAPA 3
 */
export default function ReactionRow({ 
  reactions, 
  onReactionPress,
  currentTotemId 
}) {
  if (!reactions) return null;

  // Filtrar apenas reações com contagem > 0
  const activeReactions = AVAILABLE_REACTIONS.filter(emoji => {
    const count = (reactions[emoji] || []).length;
    return count > 0;
  });

  if (activeReactions.length === 0) return null;

  return (
    <View style={styles.container}>
      {activeReactions.map((emoji, index) => {
        const totemIds = reactions[emoji] || [];
        const count = totemIds.length;
        const isReacted = currentTotemId && totemIds.includes(currentTotemId);

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.reactionButton,
              isReacted && styles.reactionButtonActive
            ]}
            onPress={() => onReactionPress && onReactionPress(emoji)}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            <Text style={[
              styles.count,
              isReacted && styles.countActive
            ]}>
              {count}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 16,
    marginRight: 16,
    flexWrap: 'wrap',
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  reactionButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: chatTheme.bubbleSent,
  },
  emoji: {
    fontSize: 14,
    marginRight: 4,
  },
  count: {
    fontSize: 12,
    color: chatTheme.textSecondary,
    fontWeight: '500',
  },
  countActive: {
    color: chatTheme.bubbleSent,
    fontWeight: '600',
  },
});

