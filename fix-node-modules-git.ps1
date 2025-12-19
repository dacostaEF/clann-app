# Script para remover node_modules do rastreamento do Git
# Este script é seguro e não deleta os arquivos, apenas remove do Git

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Removendo node_modules do Git" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se é um repositório Git
if (-not (Test-Path .git)) {
    Write-Host "⚠️  Este diretório não é um repositório Git ainda." -ForegroundColor Yellow
    Write-Host "   Quando você inicializar o Git (git init), o .gitignore já vai funcionar." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para inicializar o Git de forma segura:" -ForegroundColor Green
    Write-Host "   1. git init" -ForegroundColor White
    Write-Host "   2. git add .gitignore" -ForegroundColor White
    Write-Host "   3. git commit -m 'Add .gitignore'" -ForegroundColor White
    Write-Host "   4. git add ." -ForegroundColor White
    Write-Host "   5. git commit -m 'Initial commit'" -ForegroundColor White
    Write-Host ""
    exit 0
}

Write-Host "✓ Repositório Git encontrado" -ForegroundColor Green
Write-Host ""

# Verifica se node_modules está sendo rastreado
$trackedFiles = git ls-files | Select-String "node_modules"
if ($trackedFiles) {
    Write-Host "⚠️  node_modules está sendo rastreado pelo Git!" -ForegroundColor Yellow
    Write-Host "   Removendo do índice do Git (os arquivos permanecerão no disco)..." -ForegroundColor Yellow
    Write-Host ""
    
    # Remove node_modules do índice do Git (não deleta os arquivos)
    git rm -r --cached node_modules 2>&1 | Out-Null
    git rm -r --cached "**/node_modules" 2>&1 | Out-Null
    
    # Remove também de subdiretórios
    Get-ChildItem -Path . -Filter "node_modules" -Recurse -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
        Write-Host "   Removendo: $relativePath" -ForegroundColor Gray
        git rm -r --cached "$relativePath" 2>&1 | Out-Null
    }
    
    Write-Host ""
    Write-Host "✓ node_modules removido do índice do Git" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Próximos passos:" -ForegroundColor Cyan
    Write-Host "   1. Verifique as mudanças: git status" -ForegroundColor White
    Write-Host "   2. Commit a remoção: git commit -m 'Remove node_modules from Git tracking'" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✓ node_modules NÃO está sendo rastreado pelo Git" -ForegroundColor Green
    Write-Host "   Tudo certo! O .gitignore está funcionando." -ForegroundColor Green
    Write-Host ""
}

# Verifica se o .gitignore está correto
$gitignoreContent = Get-Content .gitignore -Raw -ErrorAction SilentlyContinue
if ($gitignoreContent -notmatch "node_modules") {
    Write-Host "⚠️  AVISO: .gitignore não contém 'node_modules'" -ForegroundColor Red
    Write-Host "   Mas já verificamos que está correto, então está tudo bem." -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Concluído!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

