import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { chatTheme } from '../../styles/chatTheme';

/**
 * Cabeçalho premium do chat
 * Design inspirado em WhatsApp/Telegram
 */
export default function ChatHeader({ clan, onBack, memberCount = 0, onInviteMembers }) {
  const [menuVisible, setMenuVisible] = useState(false);

  const handleMenuAction = (action) => {
    setMenuVisible(false);
    
    switch (action) {
      case 'invite':
        if (onInviteMembers) {
          onInviteMembers();
        }
        break;
      case 'members':
        Alert.alert('Membros', 'Funcionalidade em desenvolvimento');
        break;
      case 'rules':
        Alert.alert('Regras', 'Funcionalidade em desenvolvimento');
        break;
      case 'media':
        Alert.alert('Mídias', 'Funcionalidade em desenvolvimento');
        break;
      case 'settings':
        Alert.alert('Configurações', 'Funcionalidade em desenvolvimento');
        break;
      case 'leave':
        Alert.alert(
          'Sair do CLANN',
          'Tem certeza que deseja sair deste CLANN?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Sair', style: 'destructive', onPress: () => {
              Alert.alert('Sair', 'Funcionalidade em desenvolvimento');
            }}
          ]
        );
        break;
      default:
        break;
    }
  };

  return (
    <>
      <LinearGradient
        colors={chatTheme.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Botão voltar */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={chatTheme.textPrimary} />
          </TouchableOpacity>

          {/* Ícone e informações do CLANN */}
          <View style={styles.clanInfo}>
            {clan?.icon && (
              <View style={styles.iconContainer}>
                <Text style={styles.clanIcon}>{clan.icon}</Text>
              </View>
            )}
            <View style={styles.textContainer}>
              <Text style={styles.clanName} numberOfLines={1}>
                {clan?.name || 'CLANN'}
              </Text>
            </View>
          </View>

          {/* Botão menu */}
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={24} color={chatTheme.textPrimary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Menu modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuAction('invite')}
            >
              <Ionicons name="person-add" size={20} color={chatTheme.textPrimary} />
              <Text style={styles.menuItemText}>Convidar Membros</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuAction('members')}
            >
              <Ionicons name="people" size={20} color={chatTheme.textPrimary} />
              <Text style={styles.menuItemText}>Ver membros</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuAction('rules')}
            >
              <Ionicons name="document-text" size={20} color={chatTheme.textPrimary} />
              <Text style={styles.menuItemText}>Regras</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuAction('media')}
            >
              <Ionicons name="images" size={20} color={chatTheme.textPrimary} />
              <Text style={styles.menuItemText}>Mídias</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuAction('settings')}
            >
              <Ionicons name="settings" size={20} color={chatTheme.textPrimary} />
              <Text style={styles.menuItemText}>Configurações</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={() => handleMenuAction('leave')}
            >
              <Ionicons name="log-out" size={20} color="#FF4444" />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Sair</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: chatTheme.separatorColor,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  clanInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  clanIcon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  clanName: {
    fontSize: 20,
    fontWeight: '700',
    color: chatTheme.textPrimary,
    letterSpacing: 0.2,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: chatTheme.inputBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  menuItemDanger: {
    marginTop: 8,
  },
  menuItemText: {
    fontSize: 16,
    color: chatTheme.textPrimary,
    marginLeft: 16,
  },
  menuItemTextDanger: {
    color: '#FF4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: chatTheme.separatorColor,
    marginVertical: 8,
  },
});

