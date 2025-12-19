/**
 * Gateway CLANN - DOSE 1
 * Servidor de Convites (Transporte Cego)
 * 
 * Conforme MANIFESTO_TECNICO_CLANN.md:
 * - Gateway não autentica usuários
 * - Gateway não valida Totem
 * - Gateway apenas mapeia código de convite para clannId
 * - Zero sessão, zero identidade
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

// Middleware para permitir chamadas do frontend
app.use(express.json());
app.use(cors({
  origin: '*', // Em produção, restrinja!
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Dados MOCKADOS de convites (substitua por um banco simples depois)
// IMPORTANTE: Apenas dados públicos do CLANN, sem identidade
const inviteDatabase = {
  'ABC123': {
    clannId: 'clann_lab_secreto',
    clanName: 'Laboratório CLANN',
    objective: 'Testar soberania digital',
    securityTier: 'free',
    expiresAt: '2099-12-31T23:59:59Z'
  },
  'TEST01': {
    clannId: 'clann_teste_01',
    clanName: 'CLANN de Teste',
    objective: 'Validar fluxo de convites',
    securityTier: 'free',
    expiresAt: '2025-12-31T23:59:59Z'
  }
};

/**
 * ENDPOINT ÚNICO E ESSENCIAL: Resolver Convite
 * GET /invite/:code
 * 
 * Retorna dados públicos do CLANN associado ao código de convite.
 * Gateway NÃO cria sessão, NÃO autentica, NÃO rastreia.
 */
app.get('/invite/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const invite = inviteDatabase[code];
  
  if (!invite) {
    return res.status(404).json({ 
      error: 'Convite não encontrado ou expirado',
      code: code
    });
  }
  
  // Verificar expiração (se houver)
  if (invite.expiresAt) {
    const expiresAt = new Date(invite.expiresAt);
    const now = new Date();
    
    if (expiresAt < now) {
      return res.status(400).json({ 
        error: 'Convite expirado',
        code: code,
        expiresAt: invite.expiresAt
      });
    }
  }
  
  // O Gateway NÃO cria sessão, NÃO autentica, NÃO rastreia.
  // Apenas devolve os dados públicos do CLANN.
  res.json({
    code: code,
    clannId: invite.clannId,
    clanName: invite.clanName,
    objective: invite.objective,
    securityTier: invite.securityTier,
    expiresAt: invite.expiresAt
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'CLANN Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`[GATEWAY] Servidor de convites ouvindo em http://localhost:${PORT}`);
  console.log(`[TESTE] Acesse: http://localhost:${PORT}/invite/ABC123`);
  console.log(`[HEALTH] Acesse: http://localhost:${PORT}/health`);
  console.log(`[INFO] Convites disponíveis: ${Object.keys(inviteDatabase).join(', ')}`);
});


