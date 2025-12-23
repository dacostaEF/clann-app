// test-conversation.js - TESTE DE CONVERSAÇÃO REAL
import WebSocket from 'ws';

console.log('💬 TESTE DE CONVERSAÇÃO REAL CLANN');
console.log('='.repeat(50));
console.log('Este teste simula 2 Totems trocando mensagens');
console.log('Através do Gateway Cego\n');

const TOTEM_A = {
    totemId: 'leon_' + Date.now(),
    name: '🧙‍♂️ LEÃO DE BRONZE',
    publicKey: 'pubkey_leon_abc123'
};

const TOTEM_B = {
    totemId: 'dragao_' + Date.now(),
    name: '🐉 DRAGÃO AZUL',
    publicKey: 'pubkey_dragao_xyz789'
};

const CLANN_ID = 'clann_selva_digital';

let messagesReceived = 0;
const totalMessages = 3;

// ==================== TOTEM B (RECEPTOR) ====================
const wsB = new WebSocket('ws://localhost:8080');

wsB.on('open', () => {
    console.log(`${TOTEM_B.name} conectado e autenticando...`);
    
    wsB.send(JSON.stringify({
        type: 'auth',
        payload: TOTEM_B
    }));
});

wsB.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'message') {
            messagesReceived++;
            
            console.log(`\n📬 [${messagesReceived}/${totalMessages}] ${TOTEM_B.name} RECEBEU:`);
            console.log(`   Mensagem: "${msg.payload.encryptedPayload}"`);
            console.log(`   De: ${msg.payload.senderTotemId}`);
            console.log(`   Clann: ${msg.payload.clannId}`);
            console.log(`   ID: ${msg.payload.messageId}`);
            
            if (messagesReceived >= totalMessages) {
                console.log('\n' + '='.repeat(50));
                console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
                console.log(`✅ ${totalMessages} mensagens entregues via Gateway`);
                console.log('🔥 O Gateway Cego está funcionando PERFEITAMENTE!');
                console.log('='.repeat(50));
                
                wsB.close();
                process.exit(0);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

// ==================== TOTEM A (TRANSMISSOR) ====================
setTimeout(() => {
    console.log(`\n⏳ Conectando ${TOTEM_A.name} em 1 segundo...\n`);
    
    const wsA = new WebSocket('ws://localhost:8080');
    let messagesSent = 0;
    
    wsA.on('open', () => {
        console.log(`${TOTEM_A.name} conectado e autenticando...`);
        
        wsA.send(JSON.stringify({
            type: 'auth',
            payload: TOTEM_A
        }));
        
        // Enviar 3 mensagens com intervalo
        const sendNextMessage = () => {
            if (messagesSent >= totalMessages) {
                console.log(`\n✅ ${TOTEM_A.name} completou envio de ${totalMessages} mensagens`);
                setTimeout(() => wsA.close(), 1000);
                return;
            }
            
            messagesSent++;
            
            const messagePayload = {
                type: 'relay',
                payload: {
                    clannId: CLANN_ID,
                    recipientTotemId: TOTEM_B.totemId,
                    encryptedPayload: `[MENSAGEM ${messagesSent}] Olá Dragão! Do Leão às ${new Date().toLocaleTimeString()}`,
                    messageId: `msg_${Date.now()}_${messagesSent}`
                }
            };
            
            wsA.send(JSON.stringify(messagePayload));
            console.log(`📤 ${TOTEM_A.name} enviou mensagem ${messagesSent}/${totalMessages}`);
            
            // Agendar próxima mensagem
            if (messagesSent < totalMessages) {
                setTimeout(sendNextMessage, 2000);
            }
        };
        
        // Começar a enviar após 1 segundo
        setTimeout(sendNextMessage, 1000);
    });
    
    wsA.on('error', (err) => {
        console.error(`❌ Erro com ${TOTEM_A.name}:`, err.message);
    });
}, 1500);

// Timeout de segurança
setTimeout(() => {
    console.error('\n⏰ TIMEOUT: Teste demorou muito');
    process.exit(1);
}, 30000);

console.log('📊 Monitorando logs do Gateway na Janela 1...');
console.log('   Deve mostrar: "📤 Mensagem ... roteada diretamente para ..."');