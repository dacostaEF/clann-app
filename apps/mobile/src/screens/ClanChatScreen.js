import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import ClanStorage from '../clans/ClanStorage';
import MessagesManager from '../messages/MessagesManager';
import { loadClanMessages, saveClanMessage } from '../messages/MessagesStorage';
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
  const { clanId, clanName, clan: clanFromParams, role } = route.params || {};
  
  // PASSO 3 — PROTEÇÃO FINAL: Garantir que clanId existe
  if (!clanId) {
    console.error('[ClanChat] clanId ausente — retornando');
    // Usa setTimeout para evitar erro de navegação durante render
    setTimeout(() => {
      navigation.goBack();
    }, 0);
    return null;
  }
  
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

  // Função para scroll automático para nova mensagem (final da lista)
  const scrollToNewMessage = useCallback(() => {
    // Scroll para o final da lista (mensagens mais novas)
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  // PASSO 3 — Inicialização com módulos avançados opcionais
  useEffect(() => {
    // Inicializar MessagesManager (só uma vez) - opcional
    MessagesManager.init().catch(error => {
      console.warn('[ClanChat] MessagesManager não disponível, continuando sem ele:', error.message);
    });

    // Carregar totemId atual e role (Sprint 8 - ETAPA 2) - opcional
    const loadTotemIdAndRole = async () => {
      try {
        const totemId = await getCurrentTotemId();
        if (totemId) {
          setCurrentTotemId(prev => prev !== totemId ? totemId : prev);
          
          // Carregar role do usuário no CLANN - opcional
          const targetClanId = clanId || clanFromParams?.id;
          if (targetClanId) {
            try {
              const role = await ClanStorage.getUserRole(targetClanId, totemId);
              setUserRole(prev => prev !== role ? role : prev);
            } catch (roleError) {
              // Se não conseguir carregar role, usa role dos params ou 'member'
              setUserRole(role || 'member');
              console.warn('[ClanChat] Erro ao carregar role, usando padrão:', roleError.message);
            }
          }
        } else {
          // Se não tiver totemId, usa role dos params
          setUserRole(role || 'member');
        }
      } catch (error) {
        // ✅ SOFT-FAIL: Não bloqueia renderização
        console.warn('[ClanChat] Erro ao carregar totemId/role, usando padrão:', error.message);
        setUserRole(role || 'member');
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

  // PASSO 4 — Carregar histórico de mensagens ao entrar no chat
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!clanId) return;

        console.log('[CHAT] carregando histórico do clan', clanId);

        const history = await loadClanMessages(clanId, 200);
        if (!alive) return;

        // Adaptar para o formato que o UI usa
        const mapped = history.map(r => ({
          id: String(r.id),
          text: r.message || '',
          message: r.message || '',
          createdAt: r.timestamp ? new Date(r.timestamp) : new Date(),
          timestamp: r.timestamp || Date.now(),
          authorTotem: r.author_totem || null,
          senderTotem: r.author_totem || null,
        }));

        // Se já tiver mensagens carregadas, mesclar (evitar duplicatas)
        // Ordenar em ordem crescente (antigas primeiro, novas por último) - padrão WhatsApp
        setMessages(prevMessages => {
          const existingIds = new Set(prevMessages.map(m => m.id));
          const newMessages = mapped.filter(m => !existingIds.has(m.id));
          return [...prevMessages, ...newMessages].sort((a, b) => 
            (a.timestamp || 0) - (b.timestamp || 0)
          );
        });

        console.log(`[CHAT] histórico carregado: ${mapped.length} msgs`);
      } catch (err) {
        console.warn('[SOFT-FAIL][ClanChat] load history:', err?.message || err);
      }
    })();

    return () => { alive = false; };
  }, [clanId]);

  // Carregar mensagens quando o CLANN estiver disponível
  useEffect(() => {
    if (clan?.id && currentTotemId) {
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clan?.id, currentTotemId]);

  // PASSO 3 — loadClan opcional (não bloqueia renderização)
  const loadClan = async () => {
    try {
      const data = await ClanStorage.getClanById(clanId);
      setClan(data);
      if (data?.members) {
        setMemberCount(data.members);
      }
    } catch (err) {
      // ✅ SOFT-FAIL: Se não conseguir carregar do banco, usa dados dos params
      console.warn('[ClanChat] Erro ao carregar CLANN do banco, usando dados dos params:', err.message);
      // Se tiver clanName nos params, cria objeto mínimo
      if (clanName) {
        setClan({
          id: clanId,
          name: clanName,
          role: role || 'member'
        });
      }
    }
  };

  // Atualizar contagem de membros quando o CLANN mudar
  useEffect(() => {
    if (clan?.members !== undefined) {
      setMemberCount(prev => prev !== clan.members ? clan.members : prev);
    }
  }, [clan?.members]);

  // Carregar mensagens com merge inteligente de mensagens otimistas
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
        
        // Merge inteligente: preservar otimistas e substituir apenas quando real estiver disponível
        setMessages(prevMessages => {
          // 1. Separar mensagens otimistas (id começando com 'temp_')
          const optimisticMsgs = prevMessages.filter(m => m.id && m.id.toString().startsWith('temp_'));
          
          // 2. Mesclar mensagens reais do storage com otimistas correspondentes
          const mergedReals = updatedMsgs.map(real => {
            // Procurar otimista correspondente
            const matchingOptimistic = optimisticMsgs.find(opt => 
              opt.message === real.message &&
              opt.authorTotem === real.authorTotem &&
              Math.abs(opt.timestamp - real.timestamp) < 10000 // Dentro de 10 segundos
            );
            
            // Se encontrou otimista correspondente, usa a real (com status atualizado)
            if (matchingOptimistic) {
              return {
                ...real,
                status: 'sent' // Atualizar status de 'sending' para 'sent'
              };
            }
            
            // Caso contrário, retorna a mensagem real
            return real;
          });
          
          // 3. Manter otimistas ainda não confirmadas (não têm correspondente real ainda)
          const stillPending = optimisticMsgs.filter(opt =>
            !updatedMsgs.some(real =>
              real.message === opt.message &&
              real.authorTotem === opt.authorTotem &&
              Math.abs(opt.timestamp - real.timestamp) < 10000
            )
          );
          
          // 4. Combinar mensagens reais mescladas com otimistas pendentes
          const allMessages = [...mergedReals, ...stillPending];
          
          // 5. Ordenar por timestamp crescente (antigas primeiro, novas por último) - padrão WhatsApp
          const sortedMessages = allMessages.sort((a, b) => a.timestamp - b.timestamp);
          
          return sortedMessages;
        });
        
        // Scroll para nova mensagem após carregar
        setTimeout(() => {
          scrollToNewMessage();
        }, 100);
        
        // Retornar mensagens mescladas (precisamos acessar o estado atualizado)
        return updatedMsgs;
      } else {
        // Merge inteligente mesmo quando não há mensagens recebidas
        setMessages(prevMessages => {
          // 1. Separar mensagens otimistas
          const optimisticMsgs = prevMessages.filter(m => m.id && m.id.toString().startsWith('temp_'));
          
          // 2. Mesclar mensagens reais do storage com otimistas correspondentes
          const mergedReals = msgs.map(real => {
            const matchingOptimistic = optimisticMsgs.find(opt => 
              opt.message === real.message &&
              opt.authorTotem === real.authorTotem &&
              Math.abs(opt.timestamp - real.timestamp) < 10000
            );
            
            if (matchingOptimistic) {
              return {
                ...real,
                status: 'sent'
              };
            }
            
            return real;
          });
          
          // 3. Manter otimistas ainda não confirmadas
          const stillPending = optimisticMsgs.filter(opt =>
            !msgs.some(real =>
              real.message === opt.message &&
              real.authorTotem === opt.authorTotem &&
              Math.abs(opt.timestamp - real.timestamp) < 10000
            )
          );
          
          // 4. Combinar e ordenar
          const allMessages = [...mergedReals, ...stillPending];
          // Ordenar por timestamp crescente (antigas primeiro, novas por último) - padrão WhatsApp
          const sortedMessages = allMessages.sort((a, b) => a.timestamp - b.timestamp);
          
          return sortedMessages;
        });
        
        // Scroll para nova mensagem após carregar
        setTimeout(() => {
          scrollToNewMessage();
        }, 100);
        
        return msgs;
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [clan?.id, currentTotemId, scrollToNewMessage]);

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

  // PASSO 3 — Gateway e módulos avançados opcionais (não bloqueiam renderização)
  useEffect(() => {
    if (!clan?.id) return;

    console.log(`📡 Configurando listeners para CLANN ${clan.id}`);

    // 1. Registrar handler no Gateway (se disponível) - opcional
    try {
      if (MessagesManager.isGatewayAvailable && typeof MessagesManager.isGatewayAvailable === 'function') {
        if (MessagesManager.isGatewayAvailable()) {
          MessagesManager.registerClannGatewayHandler(clan.id);
        }
      }
    } catch (gatewayError) {
      // ✅ SOFT-FAIL: Gateway não disponível, continua sem ele
      console.warn('[ClanChat] Gateway não disponível, continuando sem ele:', gatewayError.message);
    }

    // 2. Registrar callback para atualizar UI quando mensagem chegar - opcional
    let unregister = null;
    try {
      if (MessagesManager.onNewMessage && typeof MessagesManager.onNewMessage === 'function') {
        const handleNewMessage = (messageData) => {
          console.log('📬 Nova mensagem recebida, atualizando UI...', messageData);
          
          // Apenas recarregar mensagens do storage
          // (toda lógica de descriptografia já foi feita no MessagesManager)
          loadMessages();
        };

        // Registrar callback
        unregister = MessagesManager.onNewMessage(clan.id, handleNewMessage);
      }
    } catch (callbackError) {
      // ✅ SOFT-FAIL: Callback não disponível, continua sem ele
      console.warn('[ClanChat] Callback de mensagens não disponível, continuando sem ele:', callbackError.message);
    }

    // Cleanup: remover callback e handler ao sair
    return () => {
      console.log(`📡 Removendo listeners para CLANN ${clan.id}`);
      try {
        if (unregister && typeof unregister === 'function') {
          unregister(); // Remove callback
        }
      } catch (cleanupError) {
        console.warn('[ClanChat] Erro ao limpar listeners:', cleanupError.message);
      }
      // GatewayClient gerencia cleanup do handler internamente
    };
  }, [clan?.id, loadMessages]);

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
    
    // Salvar texto e opções antes de limpar
    const textToSend = messageText.trim();
    const tempId = `temp_${Date.now()}`;
    const now = Date.now();
    
    // 1. Criar mensagem otimista (optimistic update)
    const optimisticMessage = {
      id: tempId,
      message: textToSend,
      authorTotem: currentTotemId,
      timestamp: now,
      clanId: clan.id,
      status: 'sending',
      selfDestructAt: selfDestructAt || null,
      burnAfterRead: burnAfterRead || false,
      reactions: [],
      deliveredTo: [],
      readBy: [],
      edited: false,
      deleted: false,
    };
    
    // 2. Adicionar mensagem otimista ao estado IMEDIATAMENTE (no final, pois lista não está mais invertida)
    setMessages(prevMessages => [...prevMessages, optimisticMessage]);
    
    // 3. Limpar input imediatamente
    setMessageText('');
    const savedSelfDestructAt = selfDestructAt;
    const savedBurnAfterRead = burnAfterRead;
    setSelfDestructAt(null);
    setBurnAfterRead(false);
    
    // 4. Scroll para nova mensagem
    setTimeout(() => {
      scrollToNewMessage();
    }, 50);
    
    // 5. Enviar mensagem em background (não bloqueia UI)
    try {
      const addedMessage = await MessagesManager.addMessage(
        clan.id,
        currentTotemId,
        textToSend,
        {
          selfDestructAt: savedSelfDestructAt,
          burnAfterRead: savedBurnAfterRead
        }
      );
      
      // PASSO 4 — Salvar mensagem no histórico (soft-fail)
      try {
        await saveClanMessage({
          clanId: clan.id,
          messageId: addedMessage?.id || tempId,
          senderTotem: currentTotemId,
          content: textToSend,
          createdAt: new Date().toISOString(),
        });
      } catch (saveErr) {
        // Soft-fail: não bloqueia o envio
        console.warn('[SOFT-FAIL][ClanChat] Erro ao salvar no histórico:', saveErr?.message || saveErr);
      }
      
      // 6. Recarregar mensagens do storage para substituir a otimista pela real
      await loadMessages();
      
      // 7. Atualizar timestamp do sync após enviar mensagem
      if (clan?.id) {
        SyncManager.updateLastTimestamp(clan.id, Date.now());
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      
      // Remover mensagem otimista em caso de erro
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== tempId)
      );
      
      // Restaurar texto no input em caso de erro
      setMessageText(textToSend);
      setSelfDestructAt(savedSelfDestructAt);
      setBurnAfterRead(savedBurnAfterRead);
      
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
      // Com lista não invertida, mensagem anterior está em index - 1
      const prevItem = index > 0 ? groupedMessages[index - 1] : null;
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

  // Listener para teclado no Android (melhora UX)
  useEffect(() => {
    if (Platform.OS === 'android') {
      const keyboardDidShowListener = Keyboard.addListener(
        'keyboardDidShow',
        () => {
          // Pequeno delay para Android - scroll para final da lista
          setTimeout(() => {
            scrollToNewMessage();
          }, 100);
        }
      );

      return () => {
        keyboardDidShowListener.remove();
      };
    }
  }, [scrollToNewMessage]);

  return (
    <LinearGradient
      colors={chatTheme.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({
          ios: 90,
          android: 0,
        })}
        style={{ flex: 1 }}
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
              renderItem={renderItem}
              contentContainerStyle={styles.messagesListContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                // Scroll automático para nova mensagem (final da lista)
                scrollToNewMessage();
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
      </KeyboardAvoidingView>
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


