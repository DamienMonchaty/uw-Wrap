@echo off
REM 🚀 Script de développement pour uW-Wrap (Windows)
REM Ce script facilite le développement avec hot reload et monitoring

echo 🚀 uW-Wrap Development Environment
echo =================================

REM Vérification des prérequis
echo 🔍 Vérification des dépendances...

if not exist node_modules\ (
    echo 📦 Installation des dépendances...
    where bun >nul 2>&1
    if %errorlevel% equ 0 (
        bun install
    ) else (
        npm install
    )
)

REM Vérification de la compilation TypeScript
echo 🔨 Vérification de la compilation...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Erreur de compilation TypeScript
    pause
    exit /b 1
)

REM Création du dossier logs si nécessaire
if not exist logs\ mkdir logs

REM Affichage des options
echo.
echo 🛠️  Options de développement disponibles:
echo [1] Démarrer le serveur (Node.js)
echo [2] Démarrer le serveur (Bun)
echo [3] Mode watch (développement)
echo [4] Tests
echo [5] Nettoyage
echo [6] Documentation
echo [q] Quitter
echo.

:menu
set /p choice="Votre choix: "

if "%choice%"=="1" (
    echo 🚀 Démarrage du serveur avec Node.js...
    npm start
) else if "%choice%"=="2" (
    echo 🚀 Démarrage du serveur avec Bun...
    npm run start:bun
) else if "%choice%"=="3" (
    echo 👀 Mode watch activé...
    echo Note: Vous devez installer nodemon ou un outil similaire
    npx nodemon example/server.ts
) else if "%choice%"=="4" (
    echo 🧪 Lancement des tests...
    npm test
) else if "%choice%"=="5" (
    echo 🧹 Nettoyage...
    call scripts\cleanup.bat
) else if "%choice%"=="6" (
    echo 📚 Ouverture de la documentation...
    echo Documentation disponible dans le dossier docs/
    start docs\README.md
) else if "%choice%"=="q" (
    echo 👋 Au revoir!
    exit /b 0
) else (
    echo ❌ Option invalide
    goto menu
)

echo.
echo Appuyez sur une touche pour continuer...
pause >nul
goto menu
