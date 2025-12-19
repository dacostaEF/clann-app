# Frontend - Página de Convite CLANN

## Como usar

### Opção 1: Servidor Python
```bash
cd frontend
python3 -m http.server 8081
```

### Opção 2: Servidor Node.js (http-server)
```bash
npm install -g http-server
cd frontend
http-server -p 8081
```

### Opção 3: Servidor PHP
```bash
cd frontend
php -S localhost:8081
```

## Testar

Acesse: `http://localhost:8081/invite.html?code=ABC123`

## Nota

Esta página é independente do app CLANN principal. Ela apenas:
1. Busca dados do convite no Gateway
2. Exibe informações do CLANN
3. Redireciona para o app principal com o `clannId`















