import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import ClanStorage from '../clans/ClanStorage';
import MessagesManager from '../messages/MessagesManager';
import { getCurrentTotemId } from '../crypto/totemStorage';
import ChatHeader from '../components/chat/ChatHeader';
import MessageBubble from '../components/chat/MessageBubble';
import MessageInput from '../components/chat/MessageInput';
import DateSeparator from '../components/chat/DateSeparator';
import TypingIndicator from '../components/chat/TypingIndicator';
import ReactionPicker from '../components/chat/ReactionPicker';
import MessageActions from '../components/chat/MessageActions';
import SyncManager from '../sync/SyncManager';
import { chatTheme } from '../styles/chatTheme';
import { canDeleteMessage } from '../clans/permissions';

export default function ClanChatScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { clanId, clan: clanFromParams } = route.params || {};
  
  const [clan, setClan] = useState(clanFromParams || null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [currentTotemId, setCurrentTotemId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [selfDestructAt, setSelfDestructAt] = useState(null);
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState({ x: 0, y: 0 });
  const [actionsModalVisible, setActionsModalVisible] = useState(false);
  const [selectedMessageForAction, setSelectedMessageForAction] = useState(null);
  
  const flatListRef = useRef(null);

  // Inicialização
  useEffect(() => {
    // Inicializar MessagesManager (só uma vez)
    MessagesManager.init().catch(error => {
      console.error('Erro ao inicializar MessagesManager:', error);
    });

    // Carregar totemId atual e role (Sprint 8 - ETAPA 2)
    const loadTotemIdAndRole = async () => {
      try {
        const totemId = await getCurrentTotemId();
        if (totemId) {
          setCurrentTotemId(prev => prev !== totemId ? totemId : prev);
          
          // Carregar role do usuário no CLANN
          const targetClanId = clanId || clanFromParams?.id;
          if (targetClanId) {
            const role = await ClanStorage.getUserRole(targetClanId, totemId);
            setUserRole(prev => prev !== role ? role : prev);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar totemId/role:', error);
      }
    };
    loadTotemIdAndRole();

    // Se já recebeu o CLANN via params, usa diretamente (só atualiza se for diferente)
    if (clanFromParams) {
      setClan(prevClan => {
        if (!prevClan || prevClan.id !== clanFromParams.id) {
          return clanFromParams;
        }
        return prevClan;
      });
      return;
    }
    
    // Caso contrário, busca no banco (só se não tiver clan ainda)
    if (clanId) {
      loadClan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clanId, clanFromParams?.id]);

  // Carregar mensagens quando o CLANN estiver disponível
  useEffect(() => {
    if (clan?.id && currentTotemId) {
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clan?.id, currentTotemId]);

  const loadClan = async () => {
    try {
      const data = await ClanStorage.getClanById(clanId);
      setClan(data);
      if (data?.members) {
        setMemberCount(data.members);
      }
    } catch (err) {
      console.error('Erro ao carregar CLANN:', err);
    }
  };

  // Atualizar contagem de membros quando o CLANN mudar
  useEffect(() => {
    if (clan?.members !== undefined) {
      setMemberCount(prev => prev !== clan.members ? clan.members : prev);
    }
  }, [clan?.members]);

  // Carregar mensagens
  const loadMessages = useCallback(async () => {
    if (!clan?.id || !currentTotemId) return [];
    
    try {
      setLoading(true);
      const msgs = await MessagesManager.getMessages(clan.id);
      
      // Marcar todas as mensagens recebidas como entregue ao carregar (Sprint 6 - ETAPA 4)
      const receivedMessages = msgs.filter(msg => msg.authorTotem !== currentTotemId);
      if (receivedMessages.length > 0) {
        const markDeliveredPromises = receivedMessages.map(msg => 
          MessagesManager.markMessageDelivered(msg.id, currentTotemId).catch(err => {
            console.warn(`Erro ao marcar mensagem ${msg.id} como entregue:`, err);
          })
        );
        await Promise.all(markDeliveredPromises);
        
        // Recarregar mensagens para obter status atualizado
        const updatedMsgs = await MessagesManager.getMessages(clan.id);
        setMessages(updatedMsgs);
        return updatedMsgs;
      } else {
        setMessages(msgs);
        return msgs;
      }
      
      // Scroll para o final após um pequeno delay
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [clan?.id, currentTotemId]);

  // Handler para deltas recebidos via sync (Sprint 6 - ETAPA 6)
  const handleIncomingDeltas = useCallback(async (deltaMessages) => {
    if (!deltaMessages || deltaMessages.length === 0 || !clan?.id) return;

    try {
      // Obter mensagens atuais e mesclar com deltas
      setMessages(prevMessages => {
        // Processar merge de forma assíncrona
        MessagesManager.mergeDelta(deltaMessages, prevMessages).then(mergedMessages => {
          setMessages(mergedMessages);
          
          // Atualizar último timestamp no SyncManager
          if (deltaMessages.length > 0) {
            const maxTimestamp = Math.max(...deltaMessages.map(m => m.timestamp || 0));
            SyncManager.updateLastTimestamp(clan.id, maxTimestamp);
          }
        }).catch(err => {
          console.error('Erro ao mesclar deltas:', err);
        });
        
        // Retornar estado anterior enquanto processa (evita flicker)
        return prevMessages;
      });
    } catch (error) {
      console.error('Erro ao processar deltas:', error);
    }
  }, [clan?.id]);

  // Iniciar/parar sincronização (Sprint 6 - ETAPA 6)
  useEffect(() => {
    if (clan?.id && currentTotemId) {
      // Iniciar sync
      SyncManager.startSync(clan.id, handleIncomingDeltas);

      // Parar sync ao desmontar ou mudar de CLANN
      return () => {
        SyncManager.stopSync(clan.id);
      };
    } else {
      // Parar sync se não houver CLANN ou totemId
      SyncManager.stopSync();
    }
  }, [clan?.id, currentTotemId]);

  // Recarregar mensagens ao focar na tela
  useFocusEffect(
    useCallback(() => {
      if (clan?.id && currentTotemId) {
        // Carregar mensagens primeiro
        loadMessages().then((loadedMsgs) => {
          // Usar apenas mensagens carregadas, não do estado (evita loop)
          if (loadedMsgs && Array.isArray(loadedMsgs)) {
            const receivedMessageIds = loadedMsgs
              .filter(msg => msg.authorTotem !== currentTotemId)
              .map(msg => msg.id);
            
            if (receivedMessageIds.length > 0) {
              MessagesManager.markMessagesRead(receivedMessageIds, currentTotemId)
                .then(() => {
                  // Recarregar mensagens para atualizar status (sem loop)
                  loadMessages();
                })
                .catch(err => {
                  console.warn('Erro ao marcar mensagens como lidas:', err);
                });
            }
          }
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clan?.id, currentTotemId])
  );

  // Enviar mensagem
  const handleSendMessage = async () => {
    if (!messageText.trim() || !clan?.id || !currentTotemId) return;
    
    try {
      await MessagesManager.addMessage(
        clan.id,
        currentTotemId,
        messageText.trim(),
        {
          selfDestructAt,
          burnAfterRead
        }
      );
      
      setMessageText('');
      setSelfDestructAt(null);
      setBurnAfterRead(false);
      await loadMessages(); // Recarregar lista
      
      // Atualizar timestamp do sync após enviar mensagem
      if (clan?.id) {
        SyncManager.updateLastTimestamp(clan.id, Date.now());
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      
      // Mostra mensagem específica se foi bloqueado por enforcement
      if (error.enforcementBlocked || error.message.includes('bloqueada') || error.message.includes('proibido')) {
        Alert.alert(
          'Ação Bloqueada',
          error.message || 'Esta ação está bloqueada por uma regra ativa do CLANN.',
          [
            {
              text: 'Ver Regras',
              onPress: () => {
                // Navegar para tela de governança se disponível
                navigation.navigate('Governance', { clanId: clan.id, clan });
              }
            },
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert('Erro', 'Não foi possível enviar a mensagem');
      }
    }
  };

  // Callback para seleção de timer (Sprint 6)
  const handleTimerSelect = (selfDestruct, burnAfter) => {
    setSelfDestructAt(selfDestruct);
    setBurnAfterRead(burnAfter);
  };

  // Handler para long press em mensagem (Sprint 6 - ETAPA 3 e ETAPA 5)
  const handleMessageLongPress = (messageId, event, message) => {
    // Verificar se é mensagem do próprio usuário para mostrar ações
    if (message && message.authorTotem === currentTotemId && !message.deleted) {
      // Verificar se pode editar (não pode se tiver autodestruição ou burn-after-read)
      const canEdit = !message.selfDestructAt && !message.burnAfterRead;
      const canDelete = true;
      
      if (canEdit || canDelete) {
        setSelectedMessageForAction({ ...message, canEdit, canDelete });
        setActionsModalVisible(true);
        return;
      }
    }
    
    // Se não pode editar/apagar, abrir ReactionPicker (ETAPA 3)
    const { pageX, pageY } = event.nativeEvent || {};
    setReactionPickerPosition({ x: pageX || 0, y: pageY || 0 });
    setSelectedMessageId(messageId);
    setReactionPickerVisible(true);
  };

  // Handler para editar mensagem (Sprint 6 - ETAPA 5)
  const handleEditMessage = async (newText) => {
    if (!selectedMessageForAction || !clan?.id || !currentTotemId) return;

    try {
      await MessagesManager.editMessage(
        selectedMessageForAction.id,
        clan.id,
        newText,
        currentTotemId
      );
      await loadMessages();
      setActionsModalVisible(false);
      setSelectedMessageForAction(null);
    } catch (error) {
      console.error('Erro ao editar mensagem:', error);
      Alert.alert('Erro', error.message || 'Não foi possível editar a mensagem');
    }
  };

  // Handler para deletar mensagem (Sprint 6 - ETAPA 5)
  const handleDeleteMessage = async () => {
    if (!selectedMessageForAction || !clan?.id || !currentTotemId) return;

    try {
      await MessagesManager.deleteMessage(
        selectedMessageForAction.id,
        clan.id,
        currentTotemId
      );
      await loadMessages();
      setActionsModalVisible(false);
      setSelectedMessageForAction(null);
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error);
      Alert.alert('Erro', error.message || 'Não foi possível deletar a mensagem');
    }
  };

  // Handler para seleção de reação (Sprint 6 - ETAPA 3)
  const handleReactionSelect = async (emoji) => {
    if (!selectedMessageId || !currentTotemId) return;

    try {
      // Alternar reação via MessagesManager
      const updatedReactions = await MessagesManager.toggleReaction(
        selectedMessageId,
        emoji,
        currentTotemId
      );

      // Atualizar reações na mensagem local
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === selectedMessageId
            ? { ...msg, reactions: updatedReactions }
            : msg
        )
      );

      setReactionPickerVisible(false);
      setSelectedMessageId(null);
    } catch (error) {
      console.error('Erro ao alternar reação:', error);
      Alert.alert('Erro', 'Não foi possível adicionar a reação');
    }
  };

  // Handler para toque em reação existente (Sprint 6 - ETAPA 3)
  const handleReactionPress = async (messageId, emoji) => {
    if (!currentTotemId) return;

    try {
      const updatedReactions = await MessagesManager.toggleReaction(
        messageId,
        emoji,
        currentTotemId
      );

      // Atualizar reações na mensagem local
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId
            ? { ...msg, reactions: updatedReactions }
            : msg
        )
      );
    } catch (error) {
      console.error('Erro ao alternar reação:', error);
    }
  };

  // Verificar se deve mostrar nome do autor
  const shouldShowAuthor = useCallback((currentMsg, prevMsg) => {
    if (!prevMsg || prevMsg.type !== 'message') return true;
    if (currentMsg.authorTotem !== prevMsg.authorTotem) return true;
    
    // Mostrar se passou mais de 5 minutos
    const timeDiff = currentMsg.timestamp - prevMsg.timestamp;
    return timeDiff > 5 * 60 * 1000;
  }, []);

  // Agrupar mensagens por data e preparar para renderização
  const groupedMessages = useMemo(() => {
    if (!messages.length) return [];

    const grouped = [];
    let currentDate = null;

    messages.forEach((msg) => {
      const msgDate = new Date(msg.timestamp);
      const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`;

      // Adicionar separador de data se necessário
      if (currentDate !== dateKey) {
        currentDate = dateKey;
        grouped.push({
          type: 'date',
          timestamp: msg.timestamp,
          id: `date-${dateKey}`,
        });
      }

      // Adicionar mensagem
      grouped.push({
        type: 'message',
        ...msg,
      });
    });

    return grouped;
  }, [messages]);

  const renderItem = ({ item, index }) => {
    if (item.type === 'date') {
      return <DateSeparator timestamp={item.timestamp} />;
    }

    if (item.type === 'message') {
      const isMyMessage = item.authorTotem === currentTotemId;
      const prevItem = groupedMessages[index + 1];
      const showAuthor = shouldShowAuthor(item, prevItem);

      // Normalizar authorName para evitar problemas com null/undefined
      const authorName = !isMyMessage && item.authorTotem
        ? `Totem ${item.authorTotem.slice(0, 8)}...`
        : null;

      return (
        <MessageBubble
          message={item.message}
          isSent={isMyMessage}
          authorName={authorName}
          timestamp={item.timestamp}
          showAuthor={showAuthor && !isMyMessage}
          showAvatar={false}
          selfDestructAt={item.selfDestructAt}
          burnAfterRead={item.burnAfterRead}
          reactions={item.reactions}
          onLongPress={(event) => handleMessageLongPress(item.id, event, item)}
          onReactionPress={(emoji) => handleReactionPress(item.id, emoji)}
          currentTotemId={currentTotemId}
          deliveredTo={item.deliveredTo || []}
          readBy={item.readBy || []}
          edited={item.edited || false}
          deleted={item.deleted || false}
          editedAt={item.editedAt || null}
        />
      );
    }

    return null;
  };

  return (
    <LinearGradient
      colors={chatTheme.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header Premium */}
        <ChatHeader
          clan={clan}
          onBack={() => navigation.goBack()}
          memberCount={memberCount}
        />

        {/* Área de mensagens */}
        <View style={styles.messagesContainer}>
          {messages.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>💬</Text>
              <Text style={styles.emptyStateTitle}>Chat do CLANN</Text>
              <Text style={styles.emptyStateText}>
                Este é o início do chat do CLANN "{clan?.name || ''}"
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Envie a primeira mensagem para começar a conversa
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={groupedMessages}
              keyExtractor={(item) => item.id?.toString() || `item-${item.timestamp}`}
              inverted={true}
              renderItem={renderItem}
              contentContainerStyle={styles.messagesListContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                // Scroll automático para última mensagem
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
            />
          )}
        </View>

        {/* Campo de entrada premium */}
        <MessageInput
          value={messageText}
          onChangeText={setMessageText}
          onSend={handleSendMessage}
          placeholder="Digite uma mensagem…"
          onTimerSelect={handleTimerSelect}
        />

        {/* Reaction Picker (Sprint 6 - ETAPA 3) */}
        <ReactionPicker
          visible={reactionPickerVisible}
          onSelect={handleReactionSelect}
          onClose={() => {
            setReactionPickerVisible(false);
            setSelectedMessageId(null);
          }}
          position={reactionPickerPosition}
        />

        {/* Message Actions Modal (Sprint 6 - ETAPA 5) */}
        <MessageActions
          visible={actionsModalVisible}
          onClose={() => {
            setActionsModalVisible(false);
            setSelectedMessageForAction(null);
          }}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          messageText={selectedMessageForAction?.message || ''}
          canEdit={selectedMessageForAction?.canEdit || false}
          canDelete={selectedMessageForAction?.canDelete || false}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesListContent: {
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: chatTheme.textPrimary,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: chatTheme.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: chatTheme.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});


