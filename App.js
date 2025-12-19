// Polyfill para Buffer (necessário para React Native)
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import React, { useEffect } from 'react';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Telas de Onboarding / Segurança
import WelcomeScreen from './src/screens/onboarding/WelcomeScreen';
import TotemGenerationScreen from './src/screens/onboarding/TotemGenerationScreen';
import RecoveryPhraseScreen from './src/screens/onboarding/RecoveryPhraseScreen';
import VerifySeedScreen from './src/screens/VerifySeedScreen';
import CreatePinScreen from './src/screens/CreatePinScreen';
import EnterPinScreen from './src/screens/EnterPinScreen';

// Autocheck
import AuthCheckScreen from './src/screens/AuthCheckScreen';

// Gate Page
import GatePageScreen from './src/screens/GatePageScreen';

// Telas CLANN
import ClanListScreen from './src/screens/ClanListScreen';
import CreateClanScreen from './src/screens/CreateClanScreen';
import JoinClanScreen from './src/screens/JoinClanScreen';
import ClanInviteScreen from './src/screens/ClanInviteScreen';
import ClanDetailScreen from './src/screens/ClanDetailScreen';
import ClanChatScreen from './src/screens/ClanChatScreen';
import BottomTabNavigator from './src/components/BottomTabNavigator';

// Segurança
import ExportIdentityScreen from './src/screens/ExportIdentityScreen';
import SecurityAuditScreen from './src/screens/SecurityAuditScreen';

// Multidispositivo (Sprint 7 - ETAPA 1)
import LinkDeviceScreen from './src/screens/LinkDeviceScreen';
import ScanLinkScreen from './src/screens/ScanLinkScreen';

// Governança (Sprint 7 - Governança - ETAPA 1)
import GovernanceScreen from './src/screens/GovernanceScreen';

// Admin Tools (Sprint 8 - ETAPA 4)
import AdminToolsScreen from './src/screens/AdminToolsScreen';

// Totem Screens (Etapa 2 - Placeholders)
import TotemStatsScreen from './src/screens/totem/TotemStatsScreen';
import TotemDevicesScreen from './src/screens/totem/TotemDevicesScreen';
import TotemAuditScreen from './src/screens/totem/TotemAuditScreen';
import TotemBackupScreen from './src/screens/totem/TotemBackupScreen';
import TotemExportScreen from './src/screens/totem/TotemExportScreen';
import TotemSecretPhraseScreen from './src/screens/totem/TotemSecretPhraseScreen';
import LinkedDevicesScreen from './src/screens/totem/LinkedDevicesScreen';
import TotemAboutScreen from './src/screens/totem/TotemAboutScreen';

// Banco SQLite
import ClanStorage from './src/clans/ClanStorage';
import { initE2E } from './src/security/e2e';

// Migrações (Sprint 8 - ETAPA 1)
import MigrationManager from './src/storage/MigrationManager';

// Segurança Hard (Sprint 8 - ETAPA 3)
import { init as initDeviceTrust } from './src/security/DeviceTrust';
import { init as initSessionFortress } from './src/security/SessionFortress';

// Plugins (Sprint 7 - ETAPA 5)
import { initAllPlugins } from './src/plugins';

// Context Providers
import { TotemProvider } from './src/context/TotemContext';
import { SecurityProvider } from './src/context/SecurityContext';
import { ClanProvider } from './src/context/ClanContext';
import { UserProvider } from './src/context/UserContext';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  useEffect(() => {
    // Inicializar migrações PRIMEIRO (Sprint 8 - ETAPA 1)
    // Migrações devem rodar antes de qualquer acesso ao banco
    MigrationManager.init()
      .then(() => {
        console.log('[App] Migrações concluídas');
        
        // Inicializar banco SQLite apenas em plataformas nativas (não web)
        if (Platform.OS !== 'web') {
          ClanStorage.init().catch(error => {
            console.error('Erro ao inicializar banco:', error);
          });
        }
        
        // Inicializar Device Trust (Sprint 8 - ETAPA 3)
        initDeviceTrust().catch(error => {
          console.error('Erro ao inicializar Device Trust:', error);
        });
        
        // Inicializar Session Fortress (Sprint 8 - ETAPA 3)
        initSessionFortress().catch(error => {
          console.error('Erro ao inicializar Session Fortress:', error);
        });
      })
      .catch(error => {
        console.error('Erro ao inicializar migrações:', error);
        // Continua mesmo com erro (fail-open)
        if (Platform.OS !== 'web') {
          ClanStorage.init().catch(err => {
            console.error('Erro ao inicializar banco:', err);
          });
        }
        
        // Tenta inicializar Device Trust e Session Fortress mesmo com erro de migração
        initDeviceTrust().catch(err => console.error('Erro ao inicializar Device Trust:', err));
        initSessionFortress().catch(err => console.error('Erro ao inicializar Session Fortress:', err));
      });
  
    // Inicializar sistema E2E (Sprint 6)
    initE2E().catch(error => {
      console.error('Erro ao inicializar E2E:', error);
    });
  
    // Inicializar sistema de plugins (Sprint 7 - ETAPA 5)
    initAllPlugins();
  
    // Cleanup: remover listeners ao desmontar
    return () => {
      const { removeListeners } = require('./src/security/SessionFortress');
      removeListeners().catch(err => console.error('Erro ao remover listeners:', err));
    };
  }, []);

  return (
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

        {/* Gate Page - Orientação para visitantes sem convite */}
        <Stack.Screen name="GatePage" component={GatePageScreen} />

        {/* Onboarding */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="TotemGeneration" component={TotemGenerationScreen} />
        <Stack.Screen name="RecoveryPhrase" component={RecoveryPhraseScreen} />
        <Stack.Screen name="VerifySeed" component={VerifySeedScreen} />

        {/* PIN */}
        <Stack.Screen name="CreatePin" component={CreatePinScreen} />
        <Stack.Screen name="EnterPin" component={EnterPinScreen} />

        {/* CLANN */}
        <Stack.Screen name="Home" component={BottomTabNavigator} />
        <Stack.Screen name="CreateClan" component={CreateClanScreen} />
        <Stack.Screen name="JoinClan" component={JoinClanScreen} />
        <Stack.Screen name="ClanInvite" component={ClanInviteScreen} />
        <Stack.Screen name="ClanDetail" component={ClanDetailScreen} />
        <Stack.Screen name="ClanChat" component={ClanChatScreen} />

        {/* Segurança */}
        <Stack.Screen name="ExportIdentity" component={ExportIdentityScreen} />
        <Stack.Screen name="SecurityAudit" component={SecurityAuditScreen} />

        {/* Multidispositivo (Sprint 7 - ETAPA 1) */}
        <Stack.Screen name="LinkDevice" component={LinkDeviceScreen} />
        <Stack.Screen name="ScanLink" component={ScanLinkScreen} />

        {/* Governança (Sprint 7 - Governança - ETAPA 1) */}
        <Stack.Screen name="Governance" component={GovernanceScreen} />

        {/* Admin Tools (Sprint 8 - ETAPA 4) */}
        <Stack.Screen name="AdminTools" component={AdminToolsScreen} />

        {/* Totem Screens (Etapa 2 - Placeholders) */}
        <Stack.Screen name="TotemStats" component={TotemStatsScreen} />
        <Stack.Screen name="TotemDevices" component={TotemDevicesScreen} />
        <Stack.Screen name="TotemAudit" component={TotemAuditScreen} />
        <Stack.Screen name="TotemBackup" component={TotemBackupScreen} />
        <Stack.Screen name="TotemExport" component={TotemExportScreen} />
        <Stack.Screen name="TotemSecretPhrase" component={TotemSecretPhraseScreen} />
        <Stack.Screen name="LinkedDevices" component={LinkedDevicesScreen} />
        <Stack.Screen name="TotemAbout" component={TotemAboutScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  

  return (
    <TotemProvider>
      <SecurityProvider>
        <ClanProvider>
          <UserProvider>
            <AppNavigator />
          </UserProvider>
        </ClanProvider>
      </SecurityProvider>
    </TotemProvider>
  );
}
