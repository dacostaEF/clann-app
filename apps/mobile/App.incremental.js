// App.js incremental - adicionando componentes gradualmente
import React, { useEffect } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

// Polyfill para Buffer
import { Buffer } from 'buffer';
global.Buffer = Buffer;

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>CLANN - Teste Incremental</Text>
      <Text style={styles.subtext}>Adicionando componentes...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtext: {
    color: '#888',
    fontSize: 16,
  },
});

