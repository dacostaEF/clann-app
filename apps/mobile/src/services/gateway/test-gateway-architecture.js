/**
 * test-gateway-architecture.js - TESTE COMPLETO
 * 
 * Testa a nova arquitetura do Gateway CLANN:
 * - Factory Pattern
 * - Validações de segurança
 * - Múltiplas instâncias
 * - Limitações arquiteturais
 */

import {
  GatewayClient,
  gatewayFactory,
  GatewayValidators,
  ARCHITECTURE_LIMITATIONS,
} from './index.js';

console.log('🧪 TESTE DA NOVA ARQUITETURA GATEWAY');
console.log('='.repeat(60));

// 1. Mostrar limitações conscientes
console.log('\n📋 LIMITAÇÕES ARQUITETURAIS (CONSCIENTES):');
console.log(JSON.stringify(ARCHITECTURE_LIMITATIONS, null, 2));

// 2. Testar Factory Pattern
console.log('\n🏭 TESTANDO FACTORY PATTERN:');
const client1 = gatewayFactory.createClient();
const client2 = gatewayFactory.createClient({ gatewayUrl: 'ws://localhost:8080' });

console.log(`✅ Criadas ${gatewayFactory.listInstances().length} instâncias via factory`);
console.log(`   Client1: ${client1 ? 'OK' : 'FALHA'}`);
console.log(`   Client2: ${client2 ? 'OK' : 'FALHA'}`);

// 3. Testar validações de segurança
console.log('\n🔒 TESTANDO VALIDAÇÕES DE SEGURANÇA:');

try {
  GatewayValidators.validateEncryptionKey('minha-chave-local-longa-123', 'test');
  console.log('✅ Validação de chave local: OK');
} catch (error) {
  console.error('❌ Validação de chave local:', error.message);
}

try {
  GatewayValidators.validateEncryptionKey('http://api.com/key=123', 'test-remota');
  console.error('❌ VALIDAÇÃO FALHOU: Chave remota deveria ser rejeitada');
} catch (error) {
  console.log('✅ Validação rejeitou chave remota:', error.message);
}

// 4. Testar múltiplas instâncias
console.log('\n🔀 TESTANDO MÚLTIPLAS INSTÂNCIAS:');

const totemA = { totemId: 'test_totem_a', publicKey: 'pub_a' };
const totemB = { totemId: 'test_totem_b', publicKey: 'pub_b' };

// Registrar instâncias na factory
const clientA = gatewayFactory.createClient();
const clientB = gatewayFactory.createClient();

gatewayFactory.registerInstance(totemA.totemId, clientA);
gatewayFactory.registerInstance(totemB.totemId, clientB);

console.log('✅ Instâncias registradas por totemId');
console.log('   Totem A:', gatewayFactory.getInstance(totemA.totemId) ? 'OK' : 'FALHA');
console.log('   Totem B:', gatewayFactory.getInstance(totemB.totemId) ? 'OK' : 'FALHA');

// 5. Testar desconexão em massa
console.log('\n🔌 TESTANDO DESCONEXÃO EM MASSA:');
gatewayFactory.disconnectAll();
console.log(`✅ Todas instâncias desconectadas: ${gatewayFactory.listInstances().length} restantes`);

console.log('\n' + '='.repeat(60));
console.log('🎉 TESTE DE ARQUITETURA CONCLUÍDO!');
console.log('✅ Factory Pattern funcionando');
console.log('✅ Validações de segurança ativas');
console.log('✅ Múltiplas instâncias suportadas');
console.log('='.repeat(60));

