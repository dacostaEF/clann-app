# Gateway CLANN - DOSE 1

## Instalação

```bash
cd gateway
npm install
```

## Executar

```bash
npm start
```

O servidor iniciará em `http://localhost:3001`

## Endpoints

### GET /invite/:code
Valida código de convite e retorna dados públicos do CLANN.

**Exemplo:**
```bash
curl http://localhost:3001/invite/ABC123
```

**Resposta:**
```json
{
  "code": "ABC123",
  "clannId": "clann_lab_secreto",
  "clanName": "Laboratório CLANN",
  "objective": "Testar soberania digital",
  "securityTier": "free",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

### GET /health
Health check do servidor.

## Convites de Teste

- `ABC123` - Laboratório CLANN
- `TEST01` - CLANN de Teste

## Notas

- Gateway não autentica usuários
- Gateway não valida Totem
- Gateway apenas mapeia código → clannId
- Dados mockados em memória (substituir por banco depois)















