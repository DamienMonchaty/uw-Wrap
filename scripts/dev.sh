#!/bin/bash

# 🚀 Script de développement pour uW-Wrap
# Ce script facilite le développement avec hot reload et monitoring

echo "🚀 uW-Wrap Development Environment"
echo "================================="

# Vérification des prérequis
check_dependencies() {
    echo "🔍 Vérification des dépendances..."
    
    if [ ! -d "node_modules" ]; then
        echo "📦 Installation des dépendances..."
        if command -v bun &> /dev/null; then
            bun install
        else
            npm install
        fi
    fi
    
    if [ ! -f ".env" ]; then
        echo "⚙️ Fichier .env manquant. Utilisation des valeurs par défaut..."
        cat > .env << EOF
PORT=3001
USE_MYSQL=false
DB_FILE=./database_new.sqlite
JWT_SECRET=your-development-secret-key
NODE_ENV=development
EOF
    fi
}

# Menu interactif
show_menu() {
    echo ""
    echo "Choisissez une option :"
    echo "1) 🚀 Démarrer avec Node.js (npm start)"
    echo "2) ⚡ Démarrer avec Bun (plus rapide)"
    echo "3) 👀 Mode watch (auto-restart)"
    echo "4) 🔨 Build du projet"
    echo "5) 🧹 Nettoyer le projet"
    echo "6) 📊 Voir les logs"
    echo "7) 🏥 Health check"
    echo "8) ❌ Quitter"
    echo ""
    read -p "Votre choix (1-8): " choice
}

# Fonctions principales
start_node() {
    echo "🚀 Démarrage avec Node.js..."
    npm start
}

start_bun() {
    if command -v bun &> /dev/null; then
        echo "⚡ Démarrage avec Bun..."
        bun run example/server.ts
    else
        echo "❌ Bun non installé. Utilisation de Node.js..."
        start_node
    fi
}

watch_mode() {
    if command -v bun &> /dev/null; then
        echo "👀 Mode watch avec Bun..."
        bun --watch example/server.ts
    else
        echo "👀 Mode watch avec Node.js..."
        npx nodemon example/server.ts
    fi
}

build_project() {
    echo "🔨 Build du projet..."
    npm run build
    echo "✅ Build terminé !"
}

cleanup_project() {
    echo "🧹 Nettoyage du projet..."
    ./scripts/cleanup.sh
}

show_logs() {
    echo "📊 Derniers logs (appuyez sur Ctrl+C pour quitter)..."
    tail -f logs/*.log 2>/dev/null || echo "Aucun log trouvé"
}

health_check() {
    echo "🏥 Vérification de santé..."
    curl -s http://localhost:3001/health || echo "❌ Serveur non accessible"
}

# Initialisation
check_dependencies

# Boucle principale
while true; do
    show_menu
    case $choice in
        1) start_node ;;
        2) start_bun ;;
        3) watch_mode ;;
        4) build_project ;;
        5) cleanup_project ;;
        6) show_logs ;;
        7) health_check ;;
        8) echo "👋 Au revoir !"; exit 0 ;;
        *) echo "❌ Option invalide" ;;
    esac
    echo ""
    read -p "Appuyez sur Entrée pour continuer..."
done
