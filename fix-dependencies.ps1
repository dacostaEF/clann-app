# Script para corrigir dependências do CLANN
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "     Corrigindo dependências do CLANN" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Parar qualquer processo do Metro/Expo
Write-Host "Parando processos do Metro/Expo..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*expo*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Limpar cache do npm
Write-Host "Limpando cache do npm..." -ForegroundColor Yellow
npm cache clean --force

# 3. Limpar node_modules e package-lock.json
Write-Host "Removendo node_modules e package-lock.json..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json"
}

# 4. Limpar cache do Expo
Write-Host "Limpando cache do Expo..." -ForegroundColor Yellow
if (Test-Path ".expo") {
    Remove-Item -Recurse -Force ".expo"
}
if (Test-Path ".metro") {
    Remove-Item -Recurse -Force ".metro"
}

# 5. Reinstalar dependências base
Write-Host ""
Write-Host "Instalando dependências base..." -ForegroundColor Yellow
npm install

# 6. Instalar dependências web usando Expo (garante compatibilidade)
Write-Host ""
Write-Host "Instalando dependências web com Expo..." -ForegroundColor Yellow
npx expo install react-native-web react-dom

# 7. Instalar outras dependências essenciais
Write-Host ""
Write-Host "Instalando outras dependências essenciais..." -ForegroundColor Yellow
npx expo install @react-navigation/bottom-tabs

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "     Dependências corrigidas!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Agora execute: npm start" -ForegroundColor Yellow
Write-Host ""

