@echo off
REM 🧹 Script de nettoyage automatique pour uW-Wrap (Windows)
REM Ce script nettoie les fichiers temporaires et optimise la structure

echo 🧹 Nettoyage automatique du projet uW-Wrap...

REM Suppression des fichiers temporaires
echo 📁 Suppression des fichiers temporaires...
if exist test-*.js del /q test-*.js
if exist bun-*.js del /q bun-*.js
if exist *.tmp del /q *.tmp
if exist *.temp del /q *.temp
if exist *.log del /q *.log

REM Nettoyage du dossier dist
echo 🗂️ Nettoyage du dossier de build...
if exist dist\ rd /s /q dist\
if exist build\ rd /s /q build\

REM Nettoyage des caches
echo 🗄️ Nettoyage des caches...
if exist .cache\ rd /s /q .cache\
if exist .parcel-cache\ rd /s /q .parcel-cache\
if exist node_modules\.cache\ rd /s /q node_modules\.cache\

REM Nettoyage des logs anciens (garde les fichiers récents)
echo 📝 Nettoyage des anciens logs...
if exist logs\ (
    cd logs
    forfiles /m *.log /d -3 /c "cmd /c del @path" 2>nul
    cd ..
)

echo ✅ Nettoyage terminé avec succès !
