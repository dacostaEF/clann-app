// test-quick.js - VERSÃO ES MODULE (COM import)
import WebSocket from 'ws';

console.log('🧪 TESTE RÁPIDO DE SANIDADE');
console.log('='.repeat(40));

console.log('🔌 Tentando conectar ao Gateway...');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', function open() {
    console.log('✅ Conexão WebSocket estabelecida');
    
    const totemId = 'test_' + Date.now();
    console.log('🔑 Totem ID gerado:', totemId);
    
    const authMsg = {
        type: 'auth',
        payload: {
            totemId: totemId,
            publicKey: 'pub_test_123'
        }
    };
    
    ws.send(JSON.stringify(authMsg));
    console.log('✅ Mensagem de autenticação enviada');
    
    // Aguardar 2 segundos para o Gateway processar
    setTimeout(() => {
        ws.close();
        console.log('\n✅ Teste básico concluído!');
        console.log('🔥 Gateway está funcionando!');
        console.log('\n💡 Verifique a JANELA 1 (Gateway) - Deve mostrar:');
        console.log('   "🔗 Nova conexão estabelecida"');
        console.log('   "✅ Totem autenticado: ' + totemId.substring(0, 15) + '..."');
        process.exit(0);
    }, 2000);
});

ws.on('error', function error(err) {
    console.error('❌ ERRO DE CONEXÃO:', err.message);
    console.log('\n🔧 Solução:');
    console.log('1. Gateway está rodando? (Janela 1 deve mostrar "rodando na porta 8080")');
    console.log('2. Porta 8080 está livre?');
    process.exit(1);
});

// Timeout de segurança
setTimeout(() => {
    console.error('⏰ TIMEOUT: Nenhuma resposta do Gateway em 5 segundos');
    process.exit(1);
}, 5000);