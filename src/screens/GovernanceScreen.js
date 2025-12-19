/**
 * GovernanceScreen - CLANN Governance Center
 * Sprint 7 - Governança - ETAPA 1
 * 
 * Tela central de governança com 4 blocos:
 * 1. Regras do CLANN (RulesEngine)
 * 2. Conselho de Anciões (Elders Council)
 * 3. Aprovações Pendentes (Pending Approvals)
 * 4. Hash das Regras (Rules Hash)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import ClanStorage from '../clans/ClanStorage';
import { getCurrentTotemId } from '../crypto/totemStorage';
import {
  getRules,
  getActiveRules,
  getRulesHash,
  createRule,
  editRule,
  approveRule,
  toggleRule,
  deleteRule,
  getRulesByCategory,
  getRuleHistory
} from '../clans/RulesEngine';
import {
  getTemplates,
  initDefaultTemplates,
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS
} from '../clans/RuleTemplates';
import {
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  cancelRequest,
  APPROVAL_ACTIONS,
  APPROVAL_ACTION_LABELS,
  APPROVAL_STATUS
} from '../clans/ApprovalEngine';
import { checkAndExecuteApprovedActions } from '../clans/ApprovalExecutor';
import {
  getCouncil,
  initCouncil,
  addElder,
  removeElder,
  isElder,
  setApprovalsRequired,
  getClanMembers
} from '../clans/CouncilManager';
import { CLAN_ROLES } from '../config/ClanTypes';
import { can, canManageRules, canApproveRules, canManageCouncil, canViewGovernance, canAccessAdminTools } from '../clans/permissions';

export default function GovernanceScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { clanId, clan: clanFromParams } = route.params || {};

  const [clan, setClan] = useState(clanFromParams || null);
  const [currentTotemId, setCurrentTotemId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [rules, setRules] = useState([]);
  const [activeRules, setActiveRules] = useState([]);
  const [rulesHash, setRulesHash] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [editRuleText, setEditRuleText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRuleId, setHistoryRuleId] = useState(null);
  const [ruleHistory, setRuleHistory] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [executedApprovals, setExecutedApprovals] = useState([]); // Sprint 8 - ETAPA 5
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [council, setCouncil] = useState(null);
  const [clanMembers, setClanMembers] = useState([]);
  const [loadingCouncil, setLoadingCouncil] = useState(false);
  const [showAddElderModal, setShowAddElderModal] = useState(false);
  const [showSetApprovalsModal, setShowSetApprovalsModal] = useState(false);
  const [newApprovalsRequired, setNewApprovalsRequired] = useState('2');
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, [clanId, clanFromParams]);

  // Recarregar regras quando necessário
  useEffect(() => {
    if (clan?.id && currentTotemId) {
      loadRules();
      loadTemplates();
      loadPendingApprovals();
      loadCouncil();
      loadClanMembers();
      loadStats();
      initDefaultTemplates().catch(console.error);
      
      // Verifica e executa aprovações pendentes automaticamente
      checkAndExecuteApprovedActions(clan.id).then(executed => {
        if (executed.length > 0) {
          // Recarrega dados se alguma ação foi executada
          loadRules();
          loadPendingApprovals();
          loadCouncil();
          loadStats();
        }
      }).catch(console.error);
    }
  }, [clan?.id, currentTotemId, selectedCategory]);

  // Carregar templates
  const loadTemplates = async () => {
    try {
      const allTemplates = await getTemplates();
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }
  };

  // Carregar histórico de uma regra
  const loadRuleHistory = async (ruleId) => {
    try {
      const history = await getRuleHistory(ruleId);
      setRuleHistory(history);
      setHistoryRuleId(ruleId);
      setShowHistory(true);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      Alert.alert('Erro', 'Não foi possível carregar o histórico da regra.');
    }
  };

  // Carregar aprovações pendentes
  const loadPendingApprovals = async () => {
    try {
      setLoadingApprovals(true);
      const approvals = await getPendingApprovals(clan.id);
      
      // Sprint 8 - ETAPA 5: Separar pendentes de executadas
      // Pendentes: status = pending OU (status = approved E executed = 0/false/null)
      // Executadas: executed = 1/true E executed_at não nulo
      const pending = approvals.filter(a => {
        const isPending = a.status === APPROVAL_STATUS.PENDING;
        const isApprovedNotExecuted = a.status === APPROVAL_STATUS.APPROVED && 
          (!a.executed || a.executed === 0 || a.executed === false);
        return isPending || isApprovedNotExecuted;
      });
      
      const executed = approvals.filter(a => {
        return (a.executed === 1 || a.executed === true) && a.executed_at;
      });
      
      setPendingApprovals(pending);
      setExecutedApprovals(executed);
    } catch (error) {
      console.error('Erro ao carregar aprovações pendentes:', error);
    } finally {
      setLoadingApprovals(false);
    }
  };

  // Aprovar solicitação
  const handleApproveRequest = async (approval) => {
    try {
      const updatedApproval = await approveRequest(approval.id, currentTotemId);
      
      // Verifica e executa aprovações automaticamente
      await checkAndExecuteApprovedActions(clan.id);
      
      // Recarrega dados
      await loadPendingApprovals();
      await loadRules();
      await loadCouncil();
      
      // Se foi aprovada e executada, mostra mensagem diferente
      if (updatedApproval.status === APPROVAL_STATUS.APPROVED) {
        Alert.alert('Sucesso', 'Solicitação aprovada e executada automaticamente!');
      } else {
        Alert.alert('Sucesso', 'Solicitação aprovada!');
      }
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error);
      Alert.alert('Erro', error.message || 'Não foi possível aprovar a solicitação.');
    }
  };

  // Rejeitar solicitação
  const handleRejectRequest = async (approval) => {
    Alert.alert(
      'Confirmar Rejeição',
      'Tem certeza que deseja rejeitar esta solicitação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rejeitar',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectRequest(approval.id, currentTotemId);
              await loadPendingApprovals();
              Alert.alert('Sucesso', 'Solicitação rejeitada.');
            } catch (error) {
              console.error('Erro ao rejeitar solicitação:', error);
              Alert.alert('Erro', error.message || 'Não foi possível rejeitar a solicitação.');
            }
          }
        }
      ]
    );
  };

  // Cancelar solicitação
  const handleCancelRequest = async (approval) => {
    Alert.alert(
      'Confirmar Cancelamento',
      'Tem certeza que deseja cancelar esta solicitação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelRequest(approval.id, currentTotemId);
              await loadPendingApprovals();
              Alert.alert('Sucesso', 'Solicitação cancelada.');
            } catch (error) {
              console.error('Erro ao cancelar solicitação:', error);
              Alert.alert('Erro', error.message || 'Não foi possível cancelar a solicitação.');
            }
          }
        }
      ]
    );
  };

  // Carregar conselho de anciões
  const loadCouncil = async () => {
    try {
      setLoadingCouncil(true);
      let councilData = await getCouncil(clan.id);
      
      // Se não existe, inicializa
      if (!councilData && clan.founder_totem) {
        councilData = await initCouncil(clan.id, clan.founder_totem);
      }
      
      setCouncil(councilData);
    } catch (error) {
      console.error('Erro ao carregar conselho:', error);
    } finally {
      setLoadingCouncil(false);
    }
  };

  // Carregar membros do CLANN
  const loadClanMembers = async () => {
    try {
      const members = await getClanMembers(clan.id);
      setClanMembers(members);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
    }
  };

  // Adicionar ancião
  const handleAddElder = async (memberTotem) => {
    try {
      await addElder(clan.id, memberTotem, currentTotemId, true);
      await loadCouncil();
      await loadPendingApprovals(); // Pode ter criado uma aprovação
      setShowAddElderModal(false);
      Alert.alert('Sucesso', 'Solicitação para adicionar ancião criada!');
    } catch (error) {
      console.error('Erro ao adicionar ancião:', error);
      Alert.alert('Erro', error.message || 'Não foi possível adicionar ancião.');
    }
  };

  // Remover ancião
  const handleRemoveElder = async (elderTotem) => {
    Alert.alert(
      'Confirmar Remoção',
      'Tem certeza que deseja remover este ancião do conselho?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeElder(clan.id, elderTotem, currentTotemId, true);
              await loadCouncil();
              await loadPendingApprovals();
              Alert.alert('Sucesso', 'Solicitação para remover ancião criada!');
            } catch (error) {
              console.error('Erro ao remover ancião:', error);
              Alert.alert('Erro', error.message || 'Não foi possível remover ancião.');
            }
          }
        }
      ]
    );
  };

  // Configurar aprovações necessárias
  const handleSetApprovalsRequired = async () => {
    const num = parseInt(newApprovalsRequired);
    if (isNaN(num) || num < 1 || num > 10) {
      Alert.alert('Erro', 'Número de aprovações deve estar entre 1 e 10.');
      return;
    }

    try {
      await setApprovalsRequired(clan.id, num, currentTotemId);
      await loadCouncil();
      await loadStats();
      setShowSetApprovalsModal(false);
      setNewApprovalsRequired('2');
      Alert.alert('Sucesso', 'Número de aprovações atualizado!');
    } catch (error) {
      console.error('Erro ao configurar aprovações:', error);
      Alert.alert('Erro', error.message || 'Não foi possível atualizar.');
    }
  };

  // Carregar estatísticas
  const loadStats = async () => {
    if (!clan?.id) return;
    
    try {
      setLoadingStats(true);
      const statistics = await getGovernanceStats(clan.id);
      setStats(statistics);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Carregar Totem ID
      const totemId = await getCurrentTotemId();
      setCurrentTotemId(totemId);

      // Carregar CLANN
      let clanData = clanFromParams;
      if (!clanData && clanId) {
        clanData = await ClanStorage.getClanById(clanId);
      }
      setClan(clanData);

      // Carregar role do usuário
      if (clanData?.id && totemId) {
        const role = await ClanStorage.getUserRole(clanData.id, totemId);
        setUserRole(role);
      }
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados de governança.');
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    try {
      let allRules = await getRules(clan.id);
      
      // Filtra por categoria se selecionada
      if (selectedCategory) {
        allRules = allRules.filter(r => r.category === selectedCategory);
      }
      
      const active = allRules.filter(r => r.enabled === 1 || r.enabled === true);
      const hash = await getRulesHash(clan.id);

      setRules(allRules);
      setActiveRules(active);
      setRulesHash(hash);
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
    }
  };

  const handleAddRule = async () => {
    if (!newRuleText.trim()) {
      Alert.alert('Erro', 'Digite o texto da regra.');
      return;
    }

    try {
      // Se for founder, aprova automaticamente
      const approvedBy = userRole === CLAN_ROLES.FOUNDER ? currentTotemId : null;
      const templateId = selectedTemplate ? selectedTemplate.template_id : null;
      await createRule(clan.id, newRuleText.trim(), approvedBy, newRuleCategory, templateId);
      
      setNewRuleText('');
      setNewRuleCategory(null);
      setSelectedTemplate(null);
      setShowAddRuleModal(false);
      await loadRules();
      
      Alert.alert('Sucesso', 'Regra criada com sucesso!');
    } catch (error) {
      console.error('Erro ao criar regra:', error);
      Alert.alert('Erro', 'Não foi possível criar a regra.');
    }
  };

  const handleUseTemplate = (template) => {
    setSelectedTemplate(template);
    setNewRuleText(template.text);
    setNewRuleCategory(template.category);
    setShowTemplates(false);
  };

  const handleEditRule = async () => {
    if (!editRuleText.trim()) {
      Alert.alert('Erro', 'Digite o texto da regra.');
      return;
    }

    try {
      await editRule(editingRule.rule_id, editRuleText.trim(), currentTotemId);
      
      setEditingRule(null);
      setEditRuleText('');
      await loadRules();
      
      Alert.alert('Sucesso', 'Regra editada com sucesso!');
    } catch (error) {
      console.error('Erro ao editar regra:', error);
      Alert.alert('Erro', 'Não foi possível editar a regra.');
    }
  };

  const handleApproveRule = async (rule) => {
    try {
      await approveRule(rule.rule_id, currentTotemId);
      await loadRules();
      Alert.alert('Sucesso', 'Regra aprovada!');
    } catch (error) {
      console.error('Erro ao aprovar regra:', error);
      Alert.alert('Erro', 'Não foi possível aprovar a regra.');
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      await toggleRule(rule.rule_id, !rule.enabled);
      await loadRules();
    } catch (error) {
      console.error('Erro ao alterar status da regra:', error);
      Alert.alert('Erro', 'Não foi possível alterar o status da regra.');
    }
  };

  const handleDeleteRule = async (rule) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir esta regra?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRule(rule.rule_id, currentTotemId);
              await loadRules();
              Alert.alert('Sucesso', 'Regra excluída!');
            } catch (error) {
              console.error('Erro ao excluir regra:', error);
              Alert.alert('Erro', 'Não foi possível excluir a regra.');
            }
          }
        }
      ]
    );
  };

  // Permissões usando sistema centralizado (Sprint 8 - ETAPA 2)
  const canManageRulesPermission = canManageRules(userRole);
  const canApproveRulesPermission = canApproveRules(userRole);
  const canManageCouncilPermission = canManageCouncil(userRole);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Carregando governança...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!clan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>CLANN não encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerIcon}>{clan.icon || '🛡️'}</Text>
            <Text style={styles.headerTitle}>Governança</Text>
          </View>
          <Text style={styles.headerSubtitle}>{clan.name}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* BLOCO 0: Dashboard de Estatísticas */}
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>📊 Dashboard</Text>
            <TouchableOpacity onPress={loadStats} style={styles.refreshButton}>
              <Text style={styles.refreshButtonText}>🔄</Text>
            </TouchableOpacity>
          </View>
          {loadingStats ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color="#6C63FF" />
            </View>
          ) : stats ? (
            <View>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Regras</Text>
                  <Text style={styles.statValue}>{stats.rules.total || 0}</Text>
                  <Text style={styles.statSubtext}>{stats.rules.active || 0} ativas</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Aprovações</Text>
                  <Text style={styles.statValue}>{stats.approvals.total || 0}</Text>
                  <Text style={styles.statSubtext}>{stats.approvals.approvalRate || 0}% taxa</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Conselho</Text>
                  <Text style={styles.statValue}>{stats.council.totalElders || 0}</Text>
                  <Text style={styles.statSubtext}>{stats.council.approvalsRequired || 2} necessárias</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Atividade</Text>
                  <Text style={styles.statValue}>{stats.activity.recentEvents || 0}</Text>
                  <Text style={styles.statSubtext}>últimos 7 dias</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* BLOCO 1: Regras do CLANN */}
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>📜 Regras do CLANN</Text>
            {canManageRulesPermission && (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => setShowTemplates(true)}
                  style={[styles.addButton, styles.templateButton]}
                >
                  <Text style={styles.addButtonText}>📋 Templates</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowAddRuleModal(true)}
                  style={styles.addButton}
                >
                  <Text style={styles.addButtonText}>+ Nova Regra</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Filtro de Categorias */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
            <TouchableOpacity
              onPress={() => {
                setSelectedCategory(null);
                loadRules();
              }}
              style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
                Todas
              </Text>
            </TouchableOpacity>
            {Object.entries(RULE_CATEGORY_LABELS).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => {
                  setSelectedCategory(key);
                  loadRules();
                }}
                style={[styles.categoryChip, selectedCategory === key && styles.categoryChipActive]}
              >
                <Text style={[styles.categoryChipText, selectedCategory === key && styles.categoryChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {rules.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Nenhuma regra definida ainda.</Text>
            </View>
          ) : (
            <View style={styles.rulesList}>
              {rules.map((rule) => {
                const approvals = JSON.parse(rule.approved_by || '[]');
                const isApproved = rule.enabled === 1 || rule.enabled === true;
                const needsApproval = !isApproved && approvals.length < 2;

                return (
                  <View key={rule.id || rule.rule_id} style={styles.ruleCard}>
                    <View style={styles.ruleHeader}>
                      <View style={styles.ruleStatusContainer}>
                        <View style={[styles.ruleStatusDot, isApproved && styles.ruleStatusDotActive]} />
                        <Text style={styles.ruleStatusText}>
                          {isApproved ? 'Ativa' : 'Pendente'}
                        </Text>
                        {rule.category && (
                          <Text style={styles.ruleCategory}>
                            • {RULE_CATEGORY_LABELS[rule.category] || rule.category}
                          </Text>
                        )}
                      </View>
                      {needsApproval && (
                        <Text style={styles.approvalBadge}>
                          {approvals.length}/2 aprovações
                        </Text>
                      )}
                    </View>
                    <Text style={styles.ruleText}>{rule.text}</Text>
                    <View style={styles.ruleFooter}>
                      <Text style={styles.ruleVersion}>v{rule.version || 1}</Text>
                      <TouchableOpacity
                        onPress={() => loadRuleHistory(rule.rule_id)}
                        style={styles.historyButton}
                      >
                        <Text style={styles.historyButtonText}>📜 Histórico</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.ruleActions}>
                      {canManageRulesPermission && (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                              setEditingRule(rule);
                              setEditRuleText(rule.text);
                            }}
                            style={styles.ruleActionButton}
                          >
                            <Text style={styles.ruleActionText}>✏️ Editar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleToggleRule(rule)}
                            style={styles.ruleActionButton}
                          >
                            <Text style={styles.ruleActionText}>
                              {isApproved ? '⏸️ Desativar' : '▶️ Ativar'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteRule(rule)}
                            style={[styles.ruleActionButton, styles.deleteButton]}
                          >
                            <Text style={[styles.ruleActionText, styles.deleteButtonText]}>🗑️ Excluir</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {canApproveRulesPermission && needsApproval && (
                        <TouchableOpacity
                          onPress={() => handleApproveRule(rule)}
                          style={[styles.ruleActionButton, styles.approveButton]}
                        >
                          <Text style={[styles.ruleActionText, styles.approveButtonText]}>✅ Aprovar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* BLOCO 2: Conselho de Anciões */}
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>👥 Conselho de Anciões</Text>
            {canManageCouncilPermission && council && (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => setShowSetApprovalsModal(true)}
                  style={[styles.addButton, styles.configButton]}
                >
                  <Text style={styles.addButtonText}>⚙️ Config</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowAddElderModal(true)}
                  style={styles.addButton}
                >
                  <Text style={styles.addButtonText}>+ Ancião</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {loadingCouncil ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color="#6C63FF" />
              <Text style={styles.emptyStateText}>Carregando...</Text>
            </View>
          ) : !council ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Conselho não inicializado</Text>
            </View>
          ) : (
            <View>
              <View style={styles.councilInfo}>
                <Text style={styles.councilLabel}>Aprovações necessárias:</Text>
                <Text style={styles.councilValue}>{council.approvals_required || 2}</Text>
              </View>

              <Text style={styles.eldersTitle}>Anciões ({council.elders?.length || 0}):</Text>
              <View style={styles.eldersList}>
                {council.elders && council.elders.length > 0 ? (
                  council.elders.map((elderTotem, index) => {
                    const isFounder = elderTotem === council.founder_totem;
                    const isCurrentUser = elderTotem === currentTotemId;
                    const canRemove = canManageCouncilPermission && !isFounder && elderTotem !== currentTotemId;

                    return (
                      <View key={index} style={styles.elderCard}>
                        <View style={styles.elderInfo}>
                          <Text style={styles.elderTotem}>
                            {isCurrentUser ? 'Você' : elderTotem.substring(0, 12) + '...'}
                          </Text>
                          {isFounder && (
                            <Text style={styles.founderBadge}>👑 Fundador</Text>
                          )}
                          {isCurrentUser && !isFounder && (
                            <Text style={styles.currentUserBadge}>Você</Text>
                          )}
                        </View>
                        {canRemove && (
                          <TouchableOpacity
                            onPress={() => handleRemoveElder(elderTotem)}
                            style={styles.removeElderButton}
                          >
                            <Text style={styles.removeElderButtonText}>🗑️ Remover</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyStateText}>Nenhum ancião definido</Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* BLOCO 3: Aprovações Pendentes */}
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>⏳ Aprovações Pendentes</Text>
            <TouchableOpacity
              onPress={loadPendingApprovals}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshButtonText}>🔄 Atualizar</Text>
            </TouchableOpacity>
          </View>

          {loadingApprovals ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color="#6C63FF" />
              <Text style={styles.emptyStateText}>Carregando...</Text>
            </View>
          ) : pendingApprovals.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Nenhuma aprovação pendente.</Text>
            </View>
          ) : (
            <View style={styles.approvalsList}>
              {pendingApprovals.map((approval) => {
                const isPending = approval.status === APPROVAL_STATUS.PENDING;
                const isApproved = approval.status === APPROVAL_STATUS.APPROVED;
                const isRejected = approval.status === APPROVAL_STATUS.REJECTED;
                const isRequester = approval.requested_by === currentTotemId;
                const hasApproved = approval.approvals?.includes(currentTotemId);
                const hasRejected = approval.rejections?.includes(currentTotemId);
                const canApprove = canApproveRulesPermission && !hasApproved && !hasRejected && isPending;
                const canReject = canApproveRulesPermission && !hasApproved && !hasRejected && isPending;

                return (
                  <View key={approval.id} style={styles.approvalCard}>
                    <View style={styles.approvalHeader}>
                      <View style={styles.approvalStatusContainer}>
                        <View style={[
                          styles.approvalStatusDot,
                          isApproved && styles.approvalStatusDotApproved,
                          isRejected && styles.approvalStatusDotRejected,
                          isPending && styles.approvalStatusDotPending
                        ]} />
                        <Text style={styles.approvalStatusText}>
                          {isPending && 'Pendente'}
                          {isApproved && 'Aprovada'}
                          {isRejected && 'Rejeitada'}
                        </Text>
                      </View>
                      <Text style={styles.approvalType}>
                        {APPROVAL_ACTION_LABELS[approval.action_type] || approval.action_type}
                      </Text>
                    </View>

                    <View style={styles.approvalContent}>
                      <Text style={styles.approvalLabel}>Solicitado por:</Text>
                      <Text style={styles.approvalValue}>
                        {isRequester ? 'Você' : approval.requested_by?.substring(0, 8) + '...'}
                      </Text>
                      
                      {approval.action_data && (
                        <>
                          <Text style={styles.approvalLabel}>Detalhes:</Text>
                          <Text style={styles.approvalDetails}>
                            {typeof approval.action_data === 'object' 
                              ? JSON.stringify(approval.action_data, null, 2)
                              : approval.action_data}
                          </Text>
                        </>
                      )}

                      <View style={styles.approvalCounts}>
                        <Text style={styles.approvalCount}>
                          ✅ {approval.approvals?.length || 0} aprovações
                        </Text>
                        <Text style={styles.approvalCount}>
                          ❌ {approval.rejections?.length || 0} rejeições
                        </Text>
                      </View>

                      {approval.created_at && (
                        <Text style={styles.approvalDate}>
                          {new Date(approval.created_at).toLocaleString('pt-BR')}
                        </Text>
                      )}
                    </View>

                    <View style={styles.approvalActions}>
                      {isRequester && isPending && (
                        <TouchableOpacity
                          onPress={() => handleCancelRequest(approval)}
                          style={[styles.approvalActionButton, styles.cancelButton]}
                        >
                          <Text style={styles.approvalActionText}>🗑️ Cancelar</Text>
                        </TouchableOpacity>
                      )}
                      {canApprove && (
                        <TouchableOpacity
                          onPress={() => handleApproveRequest(approval)}
                          style={[styles.approvalActionButton, styles.approveButton]}
                        >
                          <Text style={[styles.approvalActionText, styles.approveButtonText]}>✅ Aprovar</Text>
                        </TouchableOpacity>
                      )}
                      {canReject && (
                        <TouchableOpacity
                          onPress={() => handleRejectRequest(approval)}
                          style={[styles.approvalActionButton, styles.rejectButton]}
                        >
                          <Text style={[styles.approvalActionText, styles.rejectButtonText]}>❌ Rejeitar</Text>
                        </TouchableOpacity>
                      )}
                      {hasApproved && (
                        <Text style={styles.approvalActionText}>✅ Você aprovou</Text>
                      )}
                      {hasRejected && (
                        <Text style={styles.approvalActionText}>❌ Você rejeitou</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* BLOCO 4: Hash das Regras */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>🔐 Hash das Regras</Text>
          <View style={styles.hashCard}>
            <Text style={styles.hashLabel}>Hash SHA256 das regras ativas:</Text>
            {rulesHash ? (
              <Text style={styles.hashValue} selectable>
                {rulesHash}
              </Text>
            ) : (
              <Text style={styles.hashEmpty}>Nenhuma regra ativa</Text>
            )}
            <Text style={styles.hashDescription}>
              Este hash garante a integridade das regras. Qualquer alteração nas regras ativas resultará em um novo hash.
            </Text>
          </View>
        </View>

        {/* BLOCO 5: Admin Tools (Sprint 8 - ETAPA 4) */}
        {canAccessAdminTools(userRole) && (
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>⚙️ Ferramentas Administrativas</Text>
            </View>
            <Text style={styles.blockDescription}>
              Acesse ferramentas avançadas de administração: exportação, reset e verificação de integridade.
            </Text>
            <TouchableOpacity
              style={styles.adminToolsButton}
              onPress={() => navigation.navigate('AdminTools', { clanId: clan.id, clan })}
            >
              <Text style={styles.adminToolsButtonText}>Abrir Admin Tools</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal: Adicionar Regra */}
      <Modal
        visible={showAddRuleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddRuleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Regra</Text>
            
            {selectedTemplate && (
              <View style={styles.templateBadge}>
                <Text style={styles.templateBadgeText}>
                  📋 Template: {selectedTemplate.name}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTemplate(null);
                    setNewRuleText('');
                    setNewRuleCategory(null);
                  }}
                >
                  <Text style={styles.templateBadgeClose}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.modalLabel}>Categoria (opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalCategoryFilter}>
              {Object.entries(RULE_CATEGORY_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setNewRuleCategory(key)}
                  style={[styles.modalCategoryChip, newRuleCategory === key && styles.modalCategoryChipActive]}
                >
                  <Text style={[styles.modalCategoryChipText, newRuleCategory === key && styles.modalCategoryChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Texto da Regra</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Digite o texto da regra..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={newRuleText}
              onChangeText={setNewRuleText}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddRuleModal(false);
                  setNewRuleText('');
                }}
                style={[styles.modalButton, styles.modalButtonCancel]}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddRule}
                style={[styles.modalButton, styles.modalButtonConfirm]}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonConfirmText]}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Editar Regra */}
      <Modal
        visible={!!editingRule}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setEditingRule(null);
          setEditRuleText('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Regra</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Digite o texto da regra..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={editRuleText}
              onChangeText={setEditRuleText}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setEditingRule(null);
                  setEditRuleText('');
                }}
                style={[styles.modalButton, styles.modalButtonCancel]}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEditRule}
                style={[styles.modalButton, styles.modalButtonConfirm]}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonConfirmText]}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Templates */}
      <Modal
        visible={showTemplates}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTemplates(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Templates de Regras</Text>
            <ScrollView style={styles.templatesList}>
              {templates.length === 0 ? (
                <Text style={styles.emptyStateText}>Nenhum template disponível</Text>
              ) : (
                templates.map((template) => (
                  <TouchableOpacity
                    key={template.id || template.template_id}
                    onPress={() => handleUseTemplate(template)}
                    style={styles.templateCard}
                  >
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateDescription}>{template.description}</Text>
                    <Text style={styles.templateText} numberOfLines={2}>{template.text}</Text>
                    {template.category && (
                      <Text style={styles.templateCategory}>
                        {RULE_CATEGORY_LABELS[template.category] || template.category}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowTemplates(false)}
              style={[styles.modalButton, styles.modalButtonCancel]}
            >
              <Text style={styles.modalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Histórico */}
      <Modal
        visible={showHistory}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowHistory(false);
          setHistoryRuleId(null);
          setRuleHistory([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Histórico de Versões</Text>
            <ScrollView style={styles.historyList}>
              {ruleHistory.length === 0 ? (
                <Text style={styles.emptyStateText}>Nenhum histórico disponível</Text>
              ) : (
                ruleHistory.map((entry, index) => (
                  <View key={entry.id || index} style={styles.historyEntry}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyVersion}>Versão {entry.version}</Text>
                      <Text style={styles.historyType}>
                        {entry.change_type === 'created' && '📝 Criada'}
                        {entry.change_type === 'edited' && '✏️ Editada'}
                        {entry.change_type === 'deleted' && '🗑️ Excluída'}
                        {entry.change_type === 'approved' && '✅ Aprovada'}
                      </Text>
                    </View>
                    <Text style={styles.historyText}>{entry.text}</Text>
                    {entry.changed_at && (
                      <Text style={styles.historyDate}>
                        {new Date(entry.changed_at).toLocaleString('pt-BR')}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              onPress={() => {
                setShowHistory(false);
                setHistoryRuleId(null);
                setRuleHistory([]);
              }}
              style={[styles.modalButton, styles.modalButtonCancel]}
            >
              <Text style={styles.modalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Adicionar Ancião */}
      <Modal
        visible={showAddElderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddElderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adicionar Ancião</Text>
            <Text style={styles.modalLabel}>Selecione um membro para adicionar ao conselho:</Text>
            <ScrollView style={styles.membersList}>
              {clanMembers
                .filter(m => {
                  // Filtra membros que não são anciões
                  return !council?.elders?.includes(m.totem_id);
                })
                .map((member) => (
                  <TouchableOpacity
                    key={member.totem_id}
                    onPress={() => handleAddElder(member.totem_id)}
                    style={styles.memberCard}
                  >
                    <Text style={styles.memberTotem}>
                      {member.totem_id === currentTotemId 
                        ? 'Você' 
                        : member.totem_id.substring(0, 12) + '...'}
                    </Text>
                    <Text style={styles.memberRole}>
                      {member.role === 'founder' ? '👑 Fundador' : 
                       member.role === 'admin' ? '🛡️ Admin' : 
                       '👤 Membro'}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowAddElderModal(false)}
              style={[styles.modalButton, styles.modalButtonCancel]}
            >
              <Text style={styles.modalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Configurar Aprovações */}
      <Modal
        visible={showSetApprovalsModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowSetApprovalsModal(false);
          setNewApprovalsRequired('2');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar Aprovações</Text>
            <Text style={styles.modalLabel}>
              Número de aprovações necessárias para aprovar ações (1-10):
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="2"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={newApprovalsRequired}
              onChangeText={setNewApprovalsRequired}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setShowSetApprovalsModal(false);
                  setNewApprovalsRequired('2');
                }}
                style={[styles.modalButton, styles.modalButtonCancel]}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSetApprovalsRequired}
                style={[styles.modalButton, styles.modalButtonConfirm]}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonConfirmText]}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#aaa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  block: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  templateButton: {
    backgroundColor: '#4CAF50',
  },
  configButton: {
    backgroundColor: '#FF9800',
  },
  blockTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#888',
    fontSize: 14,
  },
  rulesList: {
    gap: 12,
  },
  ruleCard: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ruleStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginRight: 8,
  },
  ruleStatusDotActive: {
    backgroundColor: '#4CAF50',
  },
  ruleStatusText: {
    color: '#aaa',
    fontSize: 12,
  },
  ruleCategory: {
    color: '#6C63FF',
    fontSize: 11,
    marginLeft: 8,
  },
  ruleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  ruleVersion: {
    color: '#888',
    fontSize: 11,
  },
  historyButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#2a2a3e',
    borderRadius: 4,
  },
  historyButtonText: {
    color: '#6C63FF',
    fontSize: 11,
  },
  categoryFilter: {
    marginBottom: 16,
    maxHeight: 40,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  categoryChipText: {
    color: '#aaa',
    fontSize: 13,
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  approvalBadge: {
    backgroundColor: '#FF9800',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  ruleText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  ruleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleActionButton: {
    backgroundColor: '#2a2a3e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ruleActionText: {
    color: '#fff',
    fontSize: 12,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  deleteButtonText: {
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  infoText: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 8,
  },
  infoSubtext: {
    color: '#888',
    fontSize: 13,
  },
  hashCard: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  hashLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 8,
  },
  hashValue: {
    color: '#6C63FF',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  hashEmpty: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  hashDescription: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  modalLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 8,
  },
  templateBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  templateBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  templateBadgeClose: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCategoryFilter: {
    marginBottom: 16,
    maxHeight: 40,
  },
  modalCategoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    marginRight: 8,
  },
  modalCategoryChipActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  modalCategoryChipText: {
    color: '#aaa',
    fontSize: 12,
  },
  modalCategoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  templatesList: {
    maxHeight: 400,
    marginBottom: 20,
  },
  templateCard: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  templateName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateDescription: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  templateText: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 8,
  },
  templateCategory: {
    color: '#6C63FF',
    fontSize: 11,
  },
  historyList: {
    maxHeight: 400,
    marginBottom: 20,
  },
  historyEntry: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyVersion: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
  },
  historyType: {
    color: '#aaa',
    fontSize: 12,
  },
  historyText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  historyDate: {
    color: '#888',
    fontSize: 11,
  },
  modalInput: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#2a2a3e',
  },
  modalButtonConfirm: {
    backgroundColor: '#6C63FF',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonConfirmText: {
    color: '#fff',
  },
  refreshButton: {
    backgroundColor: '#2a2a3e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  approvalsList: {
    gap: 12,
  },
  approvalCard: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  approvalStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  approvalStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  approvalStatusDotPending: {
    backgroundColor: '#FF9800',
  },
  approvalStatusDotApproved: {
    backgroundColor: '#4CAF50',
  },
  approvalStatusDotRejected: {
    backgroundColor: '#f44336',
  },
  approvalStatusText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  approvalType: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
  },
  approvalContent: {
    marginBottom: 12,
  },
  approvalLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  approvalValue: {
    color: '#fff',
    fontSize: 14,
  },
  approvalDetails: {
    color: '#aaa',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#000',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  approvalCounts: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  approvalCount: {
    color: '#aaa',
    fontSize: 12,
  },
  approvalDate: {
    color: '#666',
    fontSize: 11,
    marginTop: 8,
  },
  approvalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  approvalActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  approvalActionText: {
    color: '#fff',
    fontSize: 12,
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  rejectButtonText: {
    color: '#fff',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  councilInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  councilLabel: {
    color: '#aaa',
    fontSize: 14,
  },
  councilValue: {
    color: '#6C63FF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  eldersTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  eldersList: {
    gap: 8,
  },
  elderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  elderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  elderTotem: {
    color: '#fff',
    fontSize: 14,
  },
  founderBadge: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  currentUserBadge: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: '600',
  },
  removeElderButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeElderButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  membersList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  memberTotem: {
    color: '#fff',
    fontSize: 14,
  },
  memberRole: {
    color: '#aaa',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    alignItems: 'center',
  },
  statLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#6C63FF',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statSubtext: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  executedCard: {
    opacity: 0.8,
    borderColor: '#4CAF50',
  },
  approvalStatusDotExecuted: {
    backgroundColor: '#4CAF50',
  },
  executedStatusText: {
    color: '#4CAF50',
  },
  executedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 8,
  },
  executedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  blockDescription: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  adminToolsButton: {
    backgroundColor: '#4a90e2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  adminToolsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

