// Polyfill para Buffer (necessário para React Native)
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Telas de Onboarding / Segurança
import WelcomeScreen from './src/screens/onboarding/WelcomeScreen';
import TotemGenerationScreen from './src/screens/onboarding/TotemGenerationScreen';
import RecoveryPhraseScreen from './src/screens/onboarding/RecoveryPhraseScreen';
import CreatePinScreen from './src/screens/CreatePinScreen';
import EnterPinScreen from './src/screens/EnterPinScreen';

// Autocheck
import AuthCheckScreen from './src/screens/AuthCheckScreen';

// Telas CLANN
import ClanListScreen from './src/screens/ClanListScreen';
import CreateClanScreen from './src/screens/CreateClanScreen';
import JoinClanScreen from './src/screens/JoinClanScreen';
import ClanInviteScreen from './src/screens/ClanInviteScreen';
import ClanDetailScreen from './src/screens/ClanDetailScreen';
import BottomTabNavigator from './src/components/BottomTabNavigator';

// Segurança
import ExportIdentityScreen from './src/screens/ExportIdentityScreen';
import SecurityAuditScreen from './src/screens/SecurityAuditScreen';

// Banco SQLite
import ClanStorage from './src/clans/ClanStorage';

// Context Providers
import { TotemProvider } from './src/context/TotemContext';
import { SecurityProvider } from './src/context/SecurityContext';
import { ClanProvider } from './src/context/ClanContext';
import { UserProvider } from './src/context/UserContext';

const Stack = createNativeStackNavigator();

export default function App() {
  
  useEffect(() => {
    // Inicializar banco SQLite apenas em plataformas nativas (não web)
    if (Platform.OS !== 'web') {
      ClanStorage.init().catch(error => {
        console.error('Erro ao inicializar banco:', error);
      });
    }
  }, []);

  return (
    <TotemProvider>
      <SecurityProvider>
        <ClanProvider>
          <UserProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <Stack.Navigator
                initialRouteName="AuthCheck"
                screenOptions={{
                  headerShown: false,
                  animation: 'fade',
                  contentStyle: { backgroundColor: '#000000' },
                }}
              >
                
                {/* Decisão automática de fluxo */}
                <Stack.Screen name="AuthCheck" component={AuthCheckScreen} />

                {/* Onboarding */}
                <Stack.Screen name="Welcome" component={WelcomeScreen} />
                <Stack.Screen name="TotemGeneration" component={TotemGenerationScreen} />
                <Stack.Screen name="RecoveryPhrase" component={RecoveryPhraseScreen} />

                {/* PIN */}
                <Stack.Screen name="CreatePin" component={CreatePinScreen} />
                <Stack.Screen name="EnterPin" component={EnterPinScreen} />

                {/* CLANN */}
                <Stack.Screen name="Home" component={BottomTabNavigator} />
                <Stack.Screen name="CreateClan" component={CreateClanScreen} />
                <Stack.Screen name="JoinClan" component={JoinClanScreen} />
                <Stack.Screen name="ClanInvite" component={ClanInviteScreen} />
                <Stack.Screen name="ClanDetail" component={ClanDetailScreen} />

                {/* Segurança */}
                <Stack.Screen name="ExportIdentity" component={ExportIdentityScreen} />
                <Stack.Screen name="SecurityAudit" component={SecurityAuditScreen} />

              </Stack.Navigator>
            </NavigationContainer>
          </UserProvider>
        </ClanProvider>
      </SecurityProvider>
    </TotemProvider>
  );
}
