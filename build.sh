#!/bin/bash

# ============================================
# AODA Store — Script de Build para Produção
# Requer: npm install -g clean-css-cli terser
# Uso: chmod +x build.sh && ./build.sh
# ============================================

set -e

# Configuração (ALTERE ESTES VALORES antes de executar)
SITE_URL="https://aodastore.co.ao"

# Directorios
BUILD_DIR="build-min"
SRC_CSS=("shared-ux.css")
SRC_JS=("main.js" "app-backend.js" "email-service.js" "payment-service.js" "auth-service.js")

# Gerar nomes de ficheiro de saída (corrigido: usar bash parameter expansion)
DIST_CSS=()
for f in "${SRC_CSS[@]}"; do
    DIST_CSS+=("$(basename "$f" .css).min.css")
done

DIST_JS=()
for f in "${SRC_JS[@]}"; do
    DIST_JS+=("$(basename "$f" .js).min.js")
done

echo ""
echo "════════════════════════════════════"
echo "  AODA Store — Build de Produção"
echo "══════════════════════════════════"
echo ""
echo "Site URL: $SITE_URL"
echo "Output:    $BUILD_DIR/"
echo ""

# Criar diretório de saída
mkdir -p "$BUILD_DIR"

echo "📦 CSS..."
for i in "${!SRC_CSS[@]}"; do
    css="${SRC_CSS[$i]}"
    dist="${DIST_CSS[$i]}"
    echo "  $css → $dist"
    npx clean-css-cli "$css" -o "$BUILD_DIR/$dist" --format beautify
    echo "  ✓ $(wc -c < "$BUILD_DIR/$dist") bytes"
done

echo ""
echo "📦 JavaScript..."
JS_BUNDLE=""
for js in "${SRC_JS[@]}"; do
    echo "  $js → bundle.min.js"
    JS_BUNDLE="$JS_BUNDLE $(cat "$js")"
done

# Minificar e mangle o bundle inteiro de uma vez
echo "  Minificando e mangleando..."
echo "$JS_BUNDLE" | npx terser --compress --mangle > "$BUILD_DIR/bundle.min.js"
echo "  ✓ $(wc -c < "$BUILD_DIR/bundle.min.js") bytes (de $(wc -c <<< "$JS_BUNDLE") bytes)"
echo ""

echo ""
echo "✅ Build concluído com sucesso!"
echo ""
echo "Para usar os ficheiros minificados:"
echo "  1. Substituir <script src=\"main.js\"> por <script src=\"build-min/bundle.min.js\">"
echo "  2. Substituir <link href=\"shared-ux.css\"> por <link href=\"build-min/shared-ux.min.css\">"
echo "  * Repetir em todos os ficheiros HTML"
echo ""
echo "Para reverter para desenvolvimento:"
echo "  1. Substituir <script src=\"build-min/bundle.min.js\"> por <script src=\"main.js\">"
echo "  2. Substituir <link href=\"build-min/shared-ux.min.css\"> por <link href=\"shared-ux.css\">"
echo "  * Repetir em todos os ficheiros HTML"
echo ""
echo "Ficheiros gerados:"
ls -lh "$BUILD_DIR/"