// test-final-debug.js - Teste controlado com logs detalhados
import WebSocket from 'ws';

console.log('🔍 TESTE DEFINITIVO DO GATEWAY');
console.log('='.repeat(60));

// Configuração
const GATEWAY_URL = 'ws://localhost:8080';
const TEST_DURATION = 10000; // 10 segundos

// Totems de teste
const TOTEM_ALPHA = {
  totemId: 'alpha_' + Date.now(),
  publicKey: 'pub_alpha_' + Math.random().toString(36).substr(2, 8)
};

const TOTEM_BETA = {
  totemId: 'beta_' + Date.now(),
  publicKey: 'pub_beta_' + Math.random().toString(36).substr(2, 8)
};

console.log('📋 Configuração do teste:');
console.log(`   Gateway: ${GATEWAY_URL}`);
console.log(`   Totem Alpha: ${TOTEM_ALPHA.totemId}`);
console.log(`   Totem Beta: ${TOTEM_BETA.totemId}`);
console.log('');

// ========== FASE 1: CONEXÃO E AUTENTICAÇÃO ==========
console.log('🔄 FASE 1: Autenticação dos Totems');

const alphaWS = new WebSocket(GATEWAY_URL);
const betaWS = new WebSocket(GATEWAY_URL);

let alphaAuthenticated = false;
let betaAuthenticated = false;
let testPhase = 1;

// ----- Totem Alpha -----
alphaWS.on('open', () => {
  console.log('✅ Alpha: WebSocket aberto');
  
  const authMessage = {
    type: 'auth',
    payload: TOTEM_ALPHA
  };
  
  console.log('📤 Alpha enviando auth:', JSON.stringify(authMessage));
  alphaWS.send(JSON.stringify(authMessage));
});

alphaWS.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(`📬 Alpha recebeu: ${msg.type}`);
  
  if (!alphaAuthenticated && msg.type !== 'error') {
    alphaAuthenticated = true;
    console.log('🎉 Alpha autenticado com sucesso!');
    checkPhaseCompletion();
  }
});

// ----- Totem Beta -----
betaWS.on('open', () => {
  console.log('✅ Beta: WebSocket aberto');
  
  const authMessage = {
    type: 'auth',
    payload: TOTEM_BETA
  };
  
  console.log('📤 Beta enviando auth:', JSON.stringify(authMessage));
  betaWS.send(JSON.stringify(authMessage));
});

betaWS.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(`📬 Beta recebeu: ${msg.type}`);
  
  if (msg.type === 'message') {
    console.log('🎉🎉🎉 BETA RECEBEU MENSAGEM DO ALPHA!');
    console.log('   Conteúdo:', JSON.stringify(msg.payload, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('🎊 TESTE COMPLETO COM SUCESSO!');
    console.log('✅ Gateway está funcionando PERFEITAMENTE!');
    console.log('='.repeat(60));
    
    alphaWS.close();
    betaWS.close();
    process.exit(0);
  }
});

// ========== FASE 2: ENVIO DE MENSAGEM ==========
function checkPhaseCompletion() {
  if (alphaAuthenticated && betaAuthenticated && testPhase === 1) {
    testPhase = 2;
    console.log('\n🔄 FASE 2: Envio de mensagem Alpha → Beta');
    
    // Aguardar 1 segundo e enviar mensagem
    setTimeout(() => {
      const message = {
        type: 'relay',
        payload: {
          clannId: 'test_clann_debug',
          recipientTotemId: TOTEM_BETA.totemId,
          encryptedPayload: 'CONTEÚDO_CRIPTOGRAFADO_DE_TESTE',
          messageId: 'debug_msg_' + Date.now()
        }
      };
      
      console.log('📤 Alpha enviando mensagem para Beta:');
      console.log(JSON.stringify(message, null, 2));
      
      alphaWS.send(JSON.stringify(message));
      
      // Timeout para esta fase
      setTimeout(() => {
        console.log('\n❌ TIMEOUT: Beta não recebeu a mensagem');
        console.log('⚠️  O Gateway recebeu mas não roteou a mensagem');
        process.exit(1);
      }, 3000);
      
    }, 1000);
  }
}

betaWS.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (!betaAuthenticated && msg.type !== 'error') {
    betaAuthenticated = true;
    console.log('🎉 Beta autenticado com sucesso!');
    checkPhaseCompletion();
  }
});

// ========== HANDLERS DE ERRO ==========
alphaWS.on('error', (err) => {
  console.error('❌ Alpha WebSocket error:', err.message);
});

betaWS.on('error', (err) => {
  console.error('❌ Beta WebSocket error:', err.message);
});

alphaWS.on('close', (code, reason) => {
  console.log(`🔌 Alpha fechado: ${code} - ${reason}`);
});

betaWS.on('close', (code, reason) => {
  console.log(`🔌 Beta fechado: ${code} - ${reason}`);
});

// ========== TIMEOUT GLOBAL ==========
setTimeout(() => {
  console.log('\n⏰ TIMEOUT GLOBAL: Teste não completou em 10 segundos');
  console.log('📊 Status:');
  console.log(`   Alpha autenticado: ${alphaAuthenticated}`);
  console.log(`   Beta autenticado: ${betaAuthenticated}`);
  console.log(`   Fase atual: ${testPhase}`);
  
  alphaWS.close();
  betaWS.close();
  process.exit(1);
}, TEST_DURATION);

console.log('\n⏱️  Teste iniciado. Aguardando eventos...');

