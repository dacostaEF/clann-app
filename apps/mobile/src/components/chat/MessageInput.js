import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Text,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chatTheme } from '../../styles/chatTheme';

/**
 * Campo de entrada de mensagem estilo WhatsApp
 * Com ícones de anexo, microfone, timer e envio
 * Sprint 6: Self-destruct e Burn-after-read
 */
export default function MessageInput({ 
  value, 
  onChangeText, 
  onSend, 
  placeholder = "Digite uma mensagem…",
  onTimerSelect = null // Callback: (selfDestructAt, burnAfterRead) => void
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [selectedTimer, setSelectedTimer] = useState(null);

  const hasText = value && value.trim().length > 0;

  // Opções de timer
  const timerOptions = [
    { label: '1 minuto', value: 1 * 60 * 1000, icon: '⏱️' },
    { label: '1 hora', value: 60 * 60 * 1000, icon: '⏰' },
    { label: '1 dia', value: 24 * 60 * 60 * 1000, icon: '📅' },
    { label: '1 semana', value: 7 * 24 * 60 * 60 * 1000, icon: '🗓️' },
    { label: 'Após ler (Burn)', value: 'burn', icon: '🔥' },
  ];

  const handleTimerSelect = (option) => {
    setSelectedTimer(option);
    setTimerModalVisible(false);
    
    if (onTimerSelect) {
      if (option.value === 'burn') {
        onTimerSelect(null, true); // burn-after-read
      } else {
        const selfDestructAt = Date.now() + option.value;
        onTimerSelect(selfDestructAt, false);
      }
    }
  };

  const clearTimer = () => {
    setSelectedTimer(null);
    if (onTimerSelect) {
      onTimerSelect(null, false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[
        styles.inputContainer,
        isFocused && styles.inputContainerFocused
      ]}>
        {/* Ícone de anexo */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            // Funcionalidade de anexo em desenvolvimento
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="attach" 
            size={24} 
            color={chatTheme.textSecondary} 
          />
        </TouchableOpacity>

        {/* Botão de timer (Sprint 6) */}
        <TouchableOpacity
          style={[styles.iconButton, selectedTimer && styles.timerButtonActive]}
          onPress={() => setTimerModalVisible(true)}
          onLongPress={selectedTimer ? clearTimer : undefined}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="time-outline" 
            size={24} 
            color={selectedTimer ? chatTheme.bubbleSent : chatTheme.textSecondary} 
          />
        </TouchableOpacity>

        {/* Campo de texto */}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={chatTheme.textTertiary}
          multiline
          maxLength={5000}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType="send"
          onSubmitEditing={hasText ? onSend : undefined}
        />

        {/* Botão de envio ou microfone */}
        {hasText ? (
          <TouchableOpacity
            style={styles.sendButton}
            onPress={onSend}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              // Funcionalidade de gravação de áudio em desenvolvimento
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name="mic" 
              size={24} 
              color={chatTheme.textSecondary} 
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Modal de seleção de timer */}
      <Modal
        visible={timerModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTimerModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTimerModalVisible(false)}
        >
          <View style={styles.timerModal}>
            <Text style={styles.timerModalTitle}>Temporizador de autodestruição</Text>
            
            {timerOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.timerOption}
                onPress={() => handleTimerSelect(option)}
              >
                <Text style={styles.timerOptionIcon}>{option.icon}</Text>
                <Text style={styles.timerOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}

            {selectedTimer && (
              <>
                <View style={styles.timerDivider} />
                <TouchableOpacity
                  style={styles.timerOption}
                  onPress={() => {
                    clearTimer();
                    setTimerModalVisible(false);
                  }}
                >
                  <Text style={styles.timerOptionIcon}>❌</Text>
                  <Text style={styles.timerOptionText}>Remover timer</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.timerCancelButton}
              onPress={() => setTimerModalVisible(false)}
            >
              <Text style={styles.timerCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: chatTheme.inputBackground,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: chatTheme.separatorColor,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: chatTheme.background,
    borderRadius: chatTheme.borderRadius,
    borderWidth: 1,
    borderColor: chatTheme.inputBorder,
    paddingHorizontal: 4,
    paddingVertical: 6,
    minHeight: 44,
    maxHeight: 120,
  },
  inputContainerFocused: {
    borderColor: chatTheme.bubbleSent,
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: chatTheme.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    maxHeight: 100,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: chatTheme.bubbleSent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  timerButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerModal: {
    backgroundColor: chatTheme.inputBackground,
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 320,
  },
  timerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: chatTheme.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  timerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  timerOptionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  timerOptionText: {
    fontSize: 16,
    color: chatTheme.textPrimary,
  },
  timerDivider: {
    height: 1,
    backgroundColor: chatTheme.separatorColor,
    marginVertical: 12,
  },
  timerCancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timerCancelText: {
    fontSize: 16,
    color: chatTheme.textSecondary,
  },
});

