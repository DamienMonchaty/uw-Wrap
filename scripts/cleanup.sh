#!/bin/bash

# 🧹 Script de nettoyage automatique pour uW-Wrap
# Ce script nettoie les fichiers temporaires et optimise la structure

echo "🧹 Nettoyage automatique du projet uW-Wrap..."

# Suppression des fichiers temporaires
echo "📁 Suppression des fichiers temporaires..."
rm -f test-*.js
rm -f bun-*.js
rm -f *.tmp
rm -f *.temp
rm -f *.log

# Nettoyage du dossier dist
echo "🗂️ Nettoyage du dossier de build..."
rm -rf dist/
rm -rf build/

# Nettoyage des caches
echo "🗄️ Nettoyage des caches..."
rm -rf .cache/
rm -rf .parcel-cache/
rm -rf node_modules/.cache/

# Nettoyage des logs anciens (garde les 3 derniers jours)
echo "📝 Nettoyage des anciens logs..."
find logs/ -name "*.log" -mtime +3 -delete 2>/dev/null || true

# Vérification de la structure de documentation
echo "📚 Vérification de la documentation..."
if [ ! -f "docs/README.md" ]; then
    echo "❌ Index de documentation manquant"
else
    echo "✅ Documentation organisée"
fi

# Vérification des dépendances
echo "📦 Vérification des dépendances..."
if [ -f "package.json" ] && [ -f "bun.lockb" ]; then
    echo "✅ Lockfiles présents"
elif [ -f "package.json" ] && [ -f "package-lock.json" ]; then
    echo "✅ NPM lockfile présent"
else
    echo "⚠️ Aucun lockfile trouvé"
fi

echo "✨ Nettoyage terminé !"
