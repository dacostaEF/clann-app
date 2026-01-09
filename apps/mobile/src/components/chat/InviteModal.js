import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCodeSVG from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { chatTheme } from '../../styles/chatTheme';

/**
 * Modal de convite para CLANN
 * Reutiliza lógica da ClanInviteScreen
 */
export default function InviteModal({ visible, clan, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!clan) return null;

  const inviteCode = clan.invite_code || clan.inviteCode || '';
  const qrData = `CLANN:${inviteCode}`;

  const handleCopyCode = async () => {
    if (!inviteCode) return;

    try {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      Alert.alert('Copiado!', 'Código de convite copiado para a área de transferência');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível copiar o código');
      console.error(error);
    }
  };

  const handleShareCode = async () => {
    if (!inviteCode) return;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Erro', 'Compartilhamento não disponível neste dispositivo');
        return;
      }

      const message = `Entre no CLANN "${clan.name}" usando o código: ${inviteCode}`;
      await Sharing.shareAsync(message, {
        dialogTitle: 'Compartilhar código do CLANN',
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar o código');
      console.error(error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <LinearGradient
          colors={['#0a0a0a', '#111111', '#0a0a0a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Convidar para o CLANN</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color={chatTheme.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* CLANN Info */}
            <View style={styles.clanInfo}>
              {clan.icon && (
                <View style={styles.iconContainer}>
                  <Text style={styles.clanIcon}>{clan.icon}</Text>
                </View>
              )}
              <Text style={styles.clanName}>{clan.name.toUpperCase()}</Text>
              {clan.description && (
                <Text style={styles.clanDescription}>{clan.description}</Text>
              )}
            </View>

            {/* QR Code */}
            {inviteCode && (
              <View style={styles.qrContainer}>
                <View style={styles.qrCard}>
                  <QRCodeSVG
                    value={qrData}
                    size={200}
                    color="#000000"
                    backgroundColor="#ffffff"
                  />
                </View>
              </View>
            )}

            {/* Código de Convite */}
            {inviteCode && (
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Código de Convite</Text>
                <TouchableOpacity
                  style={styles.codeBox}
                  onPress={handleCopyCode}
                  activeOpacity={0.7}
                >
                  <Text style={styles.codeText}>{inviteCode}</Text>
                  <Ionicons
                    name={copied ? 'checkmark' : 'copy-outline'}
                    size={20}
                    color={copied ? '#4CAF50' : chatTheme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Botões */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShareCode}
                activeOpacity={0.8}
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.shareButtonText}>Compartilhar Código</Text>
              </TouchableOpacity>

              {inviteCode && (
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopyCode}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={copied ? 'checkmark-circle' : 'copy-outline'}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.copyButtonText}>
                    {copied ? 'Copiado!' : 'Copiar Código'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Outros usuários podem entrar neste CLANN usando o código acima ou escaneando o QR Code.
              </Text>
            </View>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: chatTheme.separatorColor,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: chatTheme.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  clanInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  clanIcon: {
    fontSize: 40,
  },
  clanName: {
    fontSize: 24,
    fontWeight: '700',
    color: chatTheme.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  clanDescription: {
    fontSize: 14,
    color: chatTheme.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  qrCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  codeContainer: {
    marginBottom: 30,
  },
  codeLabel: {
    fontSize: 14,
    color: chatTheme.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chatTheme.inputBackground,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: chatTheme.separatorColor,
  },
  codeText: {
    fontSize: 24,
    fontWeight: '700',
    color: chatTheme.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginRight: 12,
    letterSpacing: 2,
  },
  buttonsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a90e2',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chatTheme.inputBackground,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: chatTheme.separatorColor,
    gap: 8,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: chatTheme.textPrimary,
  },
  footer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: chatTheme.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});


