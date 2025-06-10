#!/usr/bin/env node

/**
 * Script de nettoyage des logs pour réduire le bruit
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Fonction pour nettoyer un fichier
function cleanFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let changed = false;

        // Remplacer les console.log par des logs conditionnels en développement
        const consoleLogs = content.match(/console\.log\([^)]+\);/g);
        if (consoleLogs) {
            for (const log of consoleLogs) {
                const conditional = `if (process.env.NODE_ENV === 'development') { ${log} }`;
                content = content.replace(log, conditional);
                changed = true;
            }
        }

        // Réduire les logs debug excessifs
        content = content.replace(
            /this\.logger\.debug\(/g,
            'if (process.env.NODE_ENV === \'development\') { this.logger.debug('
        );

        if (content.includes('if (process.env.NODE_ENV === \'development\') { this.logger.debug(')) {
            // Ajouter les accolades fermantes manquantes
            content = content.replace(
                /if \(process\.env\.NODE_ENV === 'development'\) { this\.logger\.debug\([^;]+\);/g,
                (match) => match + ' }'
            );
            changed = true;
        }

        if (changed) {
            fs.writeFileSync(filePath, content);
            console.log(`✅ Cleaned: ${filePath}`);
        }
    } catch (error) {
        console.error(`❌ Error cleaning ${filePath}:`, error.message);
    }
}

// Nettoyer les fichiers
const filesToClean = [
    'example/services/UserService.ts',
    'example/database/AppRepositoryManager.ts'
];

console.log('🧹 Cleaning excessive logs...');

filesToClean.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
        cleanFile(fullPath);
    } else {
        console.log(`⚠️ File not found: ${fullPath}`);
    }
});

console.log('✨ Log cleaning completed!');
