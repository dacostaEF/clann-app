# ============================================
# SCRIPT SEGURO - CORRIGIR GIT E NODE_MODULES
# Remove node_modules do Git SEM quebrar o projeto
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CORREÇÃO SEGURA - GIT E NODE_MODULES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# PASSO 1: Verificar se .gitignore está correto
# ============================================
Write-Host "[1/6] Verificando .gitignore..." -ForegroundColor Yellow

if (-not (Test-Path .gitignore)) {
    Write-Host "❌ ERRO: .gitignore não encontrado!" -ForegroundColor Red
    Write-Host "   Criando .gitignore básico..." -ForegroundColor Yellow
    @"
node_modules/
**/node_modules/
**/node_modules/**
node_modules
**/node_modules
.expo/
.expo-shared/
dist/
build/
*.log
.env
"@ | Out-File -FilePath .gitignore -Encoding UTF8
    Write-Host "✓ .gitignore criado" -ForegroundColor Green
} else {
    $gitignoreContent = Get-Content .gitignore -Raw
    if ($gitignoreContent -notmatch "node_modules") {
        Write-Host "⚠️  AVISO: .gitignore não contém 'node_modules'" -ForegroundColor Yellow
        Write-Host "   Adicionando ao .gitignore..." -ForegroundColor Yellow
        Add-Content -Path .gitignore -Value "`nnode_modules/`n**/node_modules/"
        Write-Host "✓ node_modules adicionado ao .gitignore" -ForegroundColor Green
    } else {
        Write-Host "✓ .gitignore está correto" -ForegroundColor Green
    }
}

Write-Host ""

# ============================================
# PASSO 2: Verificar se Git está inicializado
# ============================================
Write-Host "[2/6] Verificando repositório Git..." -ForegroundColor Yellow

$isGitRepo = Test-Path .git

if (-not $isGitRepo) {
    Write-Host "⚠️  Git não está inicializado" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 PROCEDIMENTO RECOMENDADO:" -ForegroundColor Cyan
    Write-Host "   1. git init" -ForegroundColor White
    Write-Host "   2. git add .gitignore" -ForegroundColor White
    Write-Host "   3. git commit -m 'Add .gitignore'" -ForegroundColor White
    Write-Host "   4. git add ." -ForegroundColor White
    Write-Host "   5. git commit -m 'Initial commit'" -ForegroundColor White
    Write-Host ""
    Write-Host "   Isso garante que .gitignore seja commitado PRIMEIRO," -ForegroundColor Gray
    Write-Host "   prevenindo que node_modules seja rastreado." -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "Deseja inicializar o Git agora? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        Write-Host ""
        Write-Host "Inicializando Git..." -ForegroundColor Yellow
        git init --initial-branch=main
        
        Write-Host "Adicionando .gitignore PRIMEIRO..." -ForegroundColor Yellow
        git add .gitignore
        git commit -m "Add .gitignore - Ignora node_modules e arquivos temporários"
        
        Write-Host "✓ Git inicializado com .gitignore commitado" -ForegroundColor Green
        Write-Host ""
        Write-Host "Agora você pode adicionar os outros arquivos:" -ForegroundColor Cyan
        Write-Host "   git add ." -ForegroundColor White
        Write-Host "   git commit -m 'Initial commit'" -ForegroundColor White
        Write-Host ""
        exit 0
    } else {
        Write-Host "Script encerrado. Execute os passos manualmente quando estiver pronto." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "✓ Repositório Git encontrado" -ForegroundColor Green
Write-Host ""

# ============================================
# PASSO 3: Verificar se node_modules está sendo rastreado
# ============================================
Write-Host "[3/6] Verificando se node_modules está sendo rastreado..." -ForegroundColor Yellow

$trackedFiles = git ls-files | Select-String "node_modules"
$trackedCount = ($trackedFiles | Measure-Object).Count

if ($trackedCount -eq 0) {
    Write-Host "✓ node_modules NÃO está sendo rastreado - Tudo certo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[4/6] Verificando se .gitignore está commitado..." -ForegroundColor Yellow
    
    $gitignoreTracked = git ls-files | Select-String "\.gitignore"
    if ($gitignoreTracked) {
        Write-Host "✓ .gitignore está commitado" -ForegroundColor Green
    } else {
        Write-Host "⚠️  .gitignore não está commitado" -ForegroundColor Yellow
        Write-Host "   Adicionando .gitignore..." -ForegroundColor Yellow
        git add .gitignore
        git commit -m "Add .gitignore"
        Write-Host "✓ .gitignore commitado" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ TUDO ESTÁ CORRETO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "node_modules não está sendo rastreado pelo Git." -ForegroundColor Green
    Write-Host "O .gitignore está funcionando corretamente." -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host "⚠️  PROBLEMA ENCONTRADO: node_modules está sendo rastreado!" -ForegroundColor Red
Write-Host "   Arquivos rastreados: $trackedCount" -ForegroundColor Yellow
Write-Host ""

# ============================================
# PASSO 4: Remover node_modules do rastreamento (SEM DELETAR ARQUIVOS)
# ============================================
Write-Host "[4/6] Removendo node_modules do rastreamento do Git..." -ForegroundColor Yellow
Write-Host "   (Os arquivos permanecerão no disco, apenas serão removidos do Git)" -ForegroundColor Gray
Write-Host ""

# Remove node_modules raiz
if (Test-Path "node_modules") {
    Write-Host "   Removendo: node_modules/" -ForegroundColor Gray
    git rm -r --cached node_modules 2>&1 | Out-Null
}

# Remove node_modules de subdiretórios
$nodeModulesDirs = Get-ChildItem -Path . -Filter "node_modules" -Recurse -Directory -ErrorAction SilentlyContinue
foreach ($dir in $nodeModulesDirs) {
    $relativePath = $dir.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
    Write-Host "   Removendo: $relativePath" -ForegroundColor Gray
    git rm -r --cached "$relativePath" 2>&1 | Out-Null
}

Write-Host ""
Write-Host "✓ node_modules removido do índice do Git" -ForegroundColor Green
Write-Host ""

# ============================================
# PASSO 5: Garantir que .gitignore está commitado
# ============================================
Write-Host "[5/6] Garantindo que .gitignore está commitado..." -ForegroundColor Yellow

$gitignoreTracked = git ls-files | Select-String "\.gitignore"
if (-not $gitignoreTracked) {
    Write-Host "   Adicionando .gitignore..." -ForegroundColor Gray
    git add .gitignore
    git commit -m "Add .gitignore" 2>&1 | Out-Null
    Write-Host "✓ .gitignore commitado" -ForegroundColor Green
} else {
    Write-Host "✓ .gitignore já está commitado" -ForegroundColor Green
}

Write-Host ""

# ============================================
# PASSO 6: Verificação final
# ============================================
Write-Host "[6/6] Verificação final..." -ForegroundColor Yellow

$remainingTracked = git ls-files | Select-String "node_modules"
$remainingCount = ($remainingTracked | Measure-Object).Count

if ($remainingCount -eq 0) {
    Write-Host "✓ node_modules NÃO está mais sendo rastreado!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Ainda há $remainingCount arquivos de node_modules rastreados" -ForegroundColor Yellow
    Write-Host "   Execute manualmente: git rm -r --cached <caminho>" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ CORREÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📝 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "   1. Verifique as mudanças: git status" -ForegroundColor White
Write-Host "   2. Commit a remoção: git commit -m 'Remove node_modules from Git tracking'" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   - Os arquivos de node_modules permanecem no disco" -ForegroundColor Gray
Write-Host "   - O projeto continua funcionando normalmente" -ForegroundColor Gray
Write-Host "   - Execute 'npm install' se precisar recriar node_modules" -ForegroundColor Gray
Write-Host ""

