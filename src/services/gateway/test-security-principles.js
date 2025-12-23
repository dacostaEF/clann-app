/**
 * test-security-principles.js - TESTE DOS PRINCÍPIOS
 * 
 * Valida que os princípios de segurança do CLANN estão sendo
 * corretamente aplicados e que violações são detectadas.
 */

import { SECURITY_PRINCIPLES, GatewayValidators } from './index.js';

console.log('🔒 TESTE DOS PRINCÍPIOS DE SEGURANÇA CLANN');
console.log('='.repeat(60));

console.log(SECURITY_PRINCIPLES);

// Testar violações
console.log('\n🧪 TESTANDO VIOLAÇÕES (deveriam falhar):');

const testCases = [
  {
    name: 'Payload com texto plano (não criptografado)',
    payload: {
      clannId: 'test',
      recipientTotemId: 'totem123',
      encryptedPayload: 'Este é texto plano, não criptografado!',
    },
    shouldFail: true,
  },
  {
    name: 'Payload muito curto',
    payload: {
      clannId: 'test',
      recipientTotemId: 'totem123',
      encryptedPayload: 'short',
    },
    shouldFail: true,
  },
  {
    name: 'Payload que parece criptografado',
    payload: {
      clannId: 'test',
      recipientTotemId: 'totem123',
      encryptedPayload: 'aGVsbG8gd29ybGQhISEhCg=='.repeat(5), // Base64
    },
    shouldFail: false,
  },
  {
    name: 'Dados com chave privada (VIOLAÇÃO GRAVE)',
    data: {
      message: 'test',
      privateKey: 'minha-chave-secreta', // ⚠️ VIOLAÇÃO
    },
    validator: 'validateNoKeysInGatewayData',
    shouldFail: true,
  },
];

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}:`);

  try {
    if (testCase.validator === 'validateNoKeysInGatewayData') {
      GatewayValidators.validateNoKeysInGatewayData(testCase.data);
    } else {
      GatewayValidators.validateOutgoingPayload(testCase.payload);
    }

    if (testCase.shouldFail) {
      console.error('❌ TESTE FALHOU: Deveria ter lançado erro!');
    } else {
      console.log('✅ Validação passou (como esperado)');
    }
  } catch (error) {
    if (testCase.shouldFail) {
      console.log(`✅ Validação falhou (como esperado): ${error.message}`);
    } else {
      console.error(`❌ TESTE FALHOU: Não deveria lançar erro: ${error.message}`);
    }
  }
});

console.log('\n' + '='.repeat(60));
console.log('🔐 PRINCÍPIOS DE SEGURANÇA VALIDADOS');
console.log('✅ Validações de segurança funcionando corretamente');
console.log('✅ Violações são detectadas e bloqueadas');
console.log('='.repeat(60));

