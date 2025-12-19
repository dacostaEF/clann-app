# Script para configurar repositório Git APENAS no diretório do projeto CLÃ
# Execute este script no diretório do projeto

Write-Host "=== Configurando Repositório Git para CLÃ ===" -ForegroundColor Cyan

# Define o caminho do projeto
$projectPath = $PWD
Write-Host "Diretório do projeto: $projectPath" -ForegroundColor Yellow

# Remove qualquer .git existente no diretório do projeto
if (Test-Path ".git") {
    Write-Host "Removendo .git existente..." -ForegroundColor Yellow
    Remove-Item -Path ".git" -Recurse -Force
}

# Limpa variáveis de ambiente do Git
$env:GIT_DIR = $null
$env:GIT_WORK_TREE = $null

# Inicializa novo repositório
Write-Host "Inicializando novo repositório Git..." -ForegroundColor Yellow
git init --initial-branch=main

# Verifica se o repositório foi criado corretamente
$gitTopLevel = git rev-parse --show-toplevel 2>$null
if ($gitTopLevel -eq $projectPath) {
    Write-Host "✓ Repositório criado corretamente!" -ForegroundColor Green
} else {
    Write-Host "⚠ ATENÇÃO: O Git ainda está detectando outro repositório!" -ForegroundColor Red
    Write-Host "   Git detectou: $gitTopLevel" -ForegroundColor Red
    Write-Host "   Esperado: $projectPath" -ForegroundColor Red
}

# Adiciona arquivos do projeto
Write-Host "`nAdicionando arquivos do projeto..." -ForegroundColor Yellow
git add App.js app.json babel.config.js jest.config.js package.json README.md .gitignore
git add src/
git add assets/

# Mostra status
Write-Host "`n=== Status do Repositório ===" -ForegroundColor Cyan
git status --short

Write-Host "`n=== Arquivos prontos para commit ===" -ForegroundColor Cyan
git status --short | Where-Object { $_ -notmatch "^\?\?" }

Write-Host "`n✓ Configuração concluída!" -ForegroundColor Green
Write-Host "Execute: git commit -m 'Sprint 1: TOTEM + Onboarding'" -ForegroundColor Yellow





