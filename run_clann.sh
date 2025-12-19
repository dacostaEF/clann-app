#!/usr/bin/env bash

echo "==========================================="
echo "     🚀 Iniciando ambiente do CLANN"
echo "==========================================="
echo ""

# 1. Verificar se Node está instalado
echo "🔍 Verificando Node.js..."
if ! command -v node &> /dev/null
then
    echo "❌ Node.js não encontrado. Instale em: https://nodejs.org/"
    exit 1
fi

echo "✔ Node.js encontrado: $(node -v)"

# 2. Verificar se npm está instalado
echo "🔍 Verificando npm..."
if ! command -v npm &> /dev/null
then
    echo "❌ npm não encontrado."
    exit 1
fi

echo "✔ npm encontrado: $(npm -v)"

# 3. Verificar se Expo CLI está instalado
echo "🔍 Verificando Expo CLI..."
if ! command -v expo &> /dev/null
then
    echo "⚠ Expo CLI não encontrado. Instalando..."
    npm install -g expo-cli
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao instalar Expo CLI"
        exit 1
    fi
    echo "✔ Expo CLI instalado com sucesso"
else
    echo "✔ Expo CLI encontrado: $(expo --version)"
fi

# 4. Instalar dependências do projeto
echo ""
echo "📦 Instalando dependências do projeto..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências"
    exit 1
fi
echo "✔ Dependências instaladas"

# 5. Instalar dependências específicas do CLANN
echo ""
echo "📦 Instalando bibliotecas essenciais..."
npx expo install expo-sqlite expo-camera @react-native-async-storage/async-storage react-native-qrcode-svg
if [ $? -ne 0 ]; then
    echo "⚠ Algumas dependências podem não ter sido instaladas corretamente"
fi

# 6. Limpar cache do Expo
echo ""
echo "🧹 Limpando cache do Expo..."
expo start -c --offline >/dev/null 2>&1
echo "✔ Cache limpo"

# 7. Iniciar app no Expo
echo ""
echo "🚀 Iniciando o CLANN..."
echo ""
echo "==========================================="
echo "    👍 Ambiente pronto! Teste no celular"
echo "==========================================="
echo ""

npx expo start








