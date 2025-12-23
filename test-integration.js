/**
 * test-integration.js - Teste Frontend + Gateway
 * 
 * Testa a integração do módulo Gateway do frontend com o Gateway backend
 */

import { createGatewayClient } from './src/services/gateway/index.js';

async function testIntegration() {
  console.log('🧪 TESTE DE INTEGRAÇÃO FRONTEND + GATEWAY');
  console.log('='.repeat(50));

  // 1. Criar cliente (como o frontend fará)
  const client = createGatewayClient();

  // Totem de teste (simulando um Totem real)
  const testTotem = {
    id: 'test_integration_' + Date.now(),
    publicKey: 'pubkey_integration_test_123',
  };

  // 2. Conectar ao Gateway
  console.log('\n🔗 Conectando ao Gateway...');
  try {
    await client.connect(testTotem.id, testTotem.publicKey);
    console.log('✅ Conectado e autenticado');
  } catch (error) {
    console.error('❌ Falha na conexão:', error.message);
    return;
  }

  // 3. Testar envio de mensagem (precisa de outro Totem online)
  console.log('\n📤 Testando envio de mensagem...');
  console.log('   ⚠️ Necessário: Outro Totem conectado no Gateway');
  console.log('   Para teste real, abra outro terminal e rode:');
  console.log('   node backend/gateway/test-quick.js');

  // Aguardar para teste manual
  console.log('\n⏳ Aguardando 30 segundos para teste manual...');
  console.log('   Envie uma mensagem de outro cliente para:');
  console.log(`   Totem ID: ${testTotem.id}`);

  // Configurar handler para mensagens
  client.registerClannHandler('test_clann', (payload) => {
    console.log('\n🎉 MENSAGEM RECEBIDA NO FRONTEND!');
    console.log('   De:', payload.senderTotemId);
    console.log('   Clann:', payload.clannId);
    console.log('   ID:', payload.messageId);
    console.log('\n✅ INTEGRAÇÃO FUNCIONANDO! 🚀');

    client.disconnect();
    process.exit(0);
  });

  // Timeout
  setTimeout(() => {
    console.log('\n⏰ Timeout - Nenhuma mensagem recebida');
    console.log('   O Gateway está funcionando, mas precisa de outro cliente');

    client.disconnect();
    process.exit(1);
  }, 30000);
}

testIntegration().catch((error) => {
  console.error('❌ Erro no teste:', error);
  process.exit(1);
});

