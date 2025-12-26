import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ClanCard({ clan, onPress }) {
  const getRoleBadge = (role) => {
    switch (role) {
      case 'founder': return '👑';
      case 'admin': return '⭐';
      default: return '';
    }
  };

  const getTimeSince = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses`;
    return `${Math.floor(diffDays / 365)} anos`;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(clan)}>
      <View style={styles.cardHeader}>
        <Text style={styles.clanIcon}>{clan.icon}</Text>
        
        <View style={styles.clanInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.clanName} numberOfLines={1}>
              {clan.name}
            </Text>
            {getRoleBadge(clan.userRole) && (
              <Text style={styles.roleBadge}>{getRoleBadge(clan.userRole)}</Text>
            )}
          </View>
          
          {clan.description ? (
            <Text style={styles.clanDescription} numberOfLines={2}>
              {clan.description}
            </Text>
          ) : (
            <Text style={styles.noDescription}>Sem descrição</Text>
          )}
        </View>
        
        <View style={styles.memberCount}>
          <Text style={styles.memberCountText}>{clan.members}</Text>
          <Text style={styles.memberCountLabel}>membros</Text>
        </View>
      </View>
      
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <Text style={styles.privacyBadge}>
            {clan.privacy === 'private' ? '🔒' : '🌍'}
          </Text>
          <Text style={styles.createdText}>
            Criado há {getTimeSince(clan.created_at)}
          </Text>
        </View>
        
        <Text style={styles.levelBadge}>Nv. {clan.level || 1}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  clanIcon: {
    fontSize: 32,
    marginRight: 12
  },
  clanInfo: {
    flex: 1,
    marginRight: 12
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  clanName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1
  },
  roleBadge: {
    marginLeft: 6
  },
  clanDescription: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 18
  },
  noDescription: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic'
  },
  memberCount: {
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 60
  },
  memberCountText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold'
  },
  memberCountLabel: {
    color: '#888',
    fontSize: 10
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingTop: 12
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  privacyBadge: {
    marginRight: 8
  },
  createdText: {
    color: '#888',
    fontSize: 12
  },
  levelBadge: {
    backgroundColor: '#4a90e2',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  }
});
