import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chatTheme } from '../../styles/chatTheme';

/**
 * Modal de ações para mensagem (Editar/Apagar)
 * Sprint 6 - ETAPA 5
 */
export default function MessageActions({
  visible,
  onClose,
  onEdit,
  onDelete,
  messageText = '',
  canEdit = true,
  canDelete = true
}) {
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState(messageText);

  const handleEdit = () => {
    if (!editedText.trim()) {
      Alert.alert('Erro', 'A mensagem não pode estar vazia');
      return;
    }
    if (editedText.trim() === messageText.trim()) {
      Alert.alert('Aviso', 'Nenhuma alteração foi feita');
      return;
    }
    onEdit(editedText.trim());
    setEditMode(false);
    setEditedText(messageText);
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      'Apagar mensagem',
      'Tem certeza que deseja apagar esta mensagem?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => {
            onDelete();
            onClose();
          }
        }
      ]
    );
  };

  const handleCancel = () => {
    setEditMode(false);
    setEditedText(messageText);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleCancel}
      >
        <View style={styles.container}>
          {editMode ? (
            // Modo de edição
            <View style={styles.editContainer}>
              <Text style={styles.editTitle}>Editar mensagem</Text>
              <TextInput
                style={styles.editInput}
                value={editedText}
                onChangeText={setEditedText}
                multiline
                autoFocus
                placeholderTextColor={chatTheme.textTertiary}
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setEditMode(false);
                    setEditedText(messageText);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleEdit}
                >
                  <Text style={styles.saveButtonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Menu de ações
            <View style={styles.menuContainer}>
              {canEdit && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setEditMode(true)}
                >
                  <Ionicons name="create-outline" size={20} color={chatTheme.textPrimary} />
                  <Text style={styles.menuItemText}>Editar</Text>
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity
                  style={[styles.menuItem, styles.deleteItem]}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF4444" />
                  <Text style={[styles.menuItemText, styles.deleteText]}>Apagar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.menuItem, styles.cancelItem]}
                onPress={handleCancel}
              >
                <Text style={styles.menuItemText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: chatTheme.inputBackground,
    borderRadius: 16,
    padding: 20,
    minWidth: 280,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: chatTheme.inputBorder,
  },
  menuContainer: {
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  deleteItem: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  cancelItem: {
    marginTop: 8,
    marginBottom: 0,
    justifyContent: 'center',
  },
  menuItemText: {
    color: chatTheme.textPrimary,
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  deleteText: {
    color: '#FF4444',
  },
  editContainer: {
    width: '100%',
  },
  editTitle: {
    color: chatTheme.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  editInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: chatTheme.textPrimary,
    fontSize: 16,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: chatTheme.inputBorder,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: chatTheme.bubbleSent,
  },
  cancelButtonText: {
    color: chatTheme.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

