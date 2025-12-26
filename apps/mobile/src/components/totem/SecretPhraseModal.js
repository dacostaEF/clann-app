import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function SecretPhraseModal({ visible, words, onClose }) {
  const [copied, setCopied] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Converter frase (string ou array) para array de palavras
  const phraseWords = React.useMemo(() => {
    if (!words) return [];
    if (Array.isArray(words)) return words;
    if (typeof words === 'string') {
      // Se for string, dividir por espaços
      return words.trim().split(/\s+/).filter(w => w.length > 0);
    }
    return [];
  }, [words]);

  const handleCopyPhrase = async () => {
    if (phraseWords.length === 0) return;

    try {
      const phraseText = phraseWords.join(' ');
      await Clipboard.setStringAsync(phraseText);
      
      setCopied(true);
      
      // Animação de scale no botão
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 0.95,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();

      // Resetar feedback após 2 segundos
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Erro ao copiar frase:', error);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Blur/Overlay escuro */}
        <View style={styles.blurOverlay} />
        
        {/* Container do modal */}
        <View style={styles.modalContainer}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Sua Frase Secreta</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Subtítulo/Aviso */}
            <Text style={styles.subtitle}>
              Guarde em um local seguro. Nunca compartilhe.
            </Text>

            {/* Grid das palavras */}
            {phraseWords.length > 0 ? (
              <View style={styles.wordsGrid}>
                {phraseWords.map((word, index) => (
                  <View key={index} style={styles.wordItem}>
                    <View style={styles.wordNumber}>
                      <Text style={styles.wordNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.wordText}>{word}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={48} color="#ff4444" />
                <Text style={styles.emptyText}>
                  Frase secreta não encontrada
                </Text>
                <Text style={styles.emptySubtext}>
                  A frase de recuperação não está disponível neste Totem.
                </Text>
              </View>
            )}

            {/* Botões */}
            <View style={styles.buttonsContainer}>
              {phraseWords.length > 0 && (
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <TouchableOpacity
                    style={[styles.copyButton, copied && styles.copyButtonActive]}
                    onPress={handleCopyPhrase}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={copied ? "checkmark-circle" : "copy-outline"}
                      size={20}
                      color="#ffffff"
                    />
                    <Text style={styles.copyButtonText}>
                      {copied ? 'Copiado!' : 'Copiar Frase'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}

              <TouchableOpacity
                style={styles.closeButtonBottom}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }),
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  wordItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  wordNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  wordNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  wordText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 12,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  copyButtonActive: {
    backgroundColor: '#10b981',
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButtonBottom: {
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
});

