import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { DEFAULT_CLAN_ICONS } from '../config/ClanTypes';

export default function ClanIconPicker({ selected, onSelect }) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {DEFAULT_CLAN_ICONS.map((icon, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.iconButton,
              selected === icon && styles.iconButtonSelected
            ]}
            onPress={() => onSelect(icon)}
          >
            <Text style={styles.iconText}>{icon}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8
  },
  scrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 4
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  iconButtonSelected: {
    borderColor: '#4a90e2',
    backgroundColor: '#2a2a2a'
  },
  iconText: {
    fontSize: 24
  }
});
