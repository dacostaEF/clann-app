# Script para iniciar o ambiente CLANN
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "     Iniciando ambiente do CLANN" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar se Node está instalado
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
    Write-Host "ERRO: Node.js nao encontrado. Instale em: https://nodejs.org/" -ForegroundColor Red
    exit 1
}
$nodeVersion = node -v
Write-Host "OK: Node.js encontrado: $nodeVersion" -ForegroundColor Green

# 2. Verificar se npm está instalado
Write-Host "Verificando npm..." -ForegroundColor Yellow
$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCheck) {
    Write-Host "ERRO: npm nao encontrado." -ForegroundColor Red
    exit 1
}
$npmVersion = npm -v
Write-Host "OK: npm encontrado: $npmVersion" -ForegroundColor Green

# 3. Verificar se Expo CLI está instalado
Write-Host "Verificando Expo CLI..." -ForegroundColor Yellow
$expoCheck = Get-Command expo -ErrorAction SilentlyContinue
if (-not $expoCheck) {
    Write-Host "AVISO: Expo CLI nao encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g expo-cli
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: Falha ao instalar Expo CLI" -ForegroundColor Red
        exit 1
    }
    Write-Host "OK: Expo CLI instalado com sucesso" -ForegroundColor Green
} else {
    $expoVersion = expo --version
    Write-Host "OK: Expo CLI encontrado: $expoVersion" -ForegroundColor Green
}

# 4. Instalar dependências do projeto
Write-Host ""
Write-Host "Instalando dependencias do projeto..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Falha ao instalar dependencias" -ForegroundColor Red
    exit 1
}
Write-Host "OK: Dependencias instaladas" -ForegroundColor Green

# 5. Instalar dependências específicas do CLANN
Write-Host ""
Write-Host "Instalando bibliotecas essenciais..." -ForegroundColor Yellow
npx expo install expo-sqlite expo-camera @react-native-async-storage/async-storage react-native-qrcode-svg
if ($LASTEXITCODE -ne 0) {
    Write-Host "AVISO: Algumas dependencias podem nao ter sido instaladas corretamente" -ForegroundColor Yellow
}

# 6. Limpar cache do Expo
Write-Host ""
Write-Host "Limpando cache do Expo..." -ForegroundColor Yellow
$null = npx expo start -c --offline 2>&1 | Out-Null
Write-Host "OK: Cache limpo" -ForegroundColor Green

# 7. Iniciar app no Expo (navegador)
Write-Host ""
Write-Host "Iniciando o CLANN no navegador..." -ForegroundColor Cyan
Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "    Abrindo no navegador..." -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "DICA: Pressione 'a' para Android, 'i' para iOS, 'w' para web" -ForegroundColor Yellow
Write-Host ""

npx expo start --web
