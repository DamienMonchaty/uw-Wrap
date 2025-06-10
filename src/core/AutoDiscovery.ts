/**
 * Auto-Discovery System
 * Automatically discovers and loads handlers, services, and repositories
 */

import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger';

export interface DiscoveryConfig {
    baseDir: string;
    patterns: {
        handlers?: string[];
        services?: string[];
        repositories?: string[];
    };
    excludePatterns?: string[];
}

export class AutoDiscovery {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Auto-discover and import all classes with decorators
     */
    async discoverAndImport(config: DiscoveryConfig): Promise<void> {
        this.logger.info('🔍 Starting auto-discovery...', { baseDir: config.baseDir });

        const files = this.scanDirectory(config.baseDir, config.patterns, config.excludePatterns);
        
        this.logger.info(`📁 Found ${files.length} matching files:`, { files: files.map(f => path.relative(config.baseDir, f)) });
        
        let importedCount = 0;
        for (const file of files) {
            try {
                // Dynamic import to trigger decorator registration
                await import(file);
                importedCount++;
                this.logger.debug(`✅ Imported: ${path.relative(config.baseDir, file)}`);
            } catch (error) {
                this.logger.warn(`⚠️ Failed to import: ${file}`, { error: (error as Error).message });
            }
        }

        this.logger.info(`🎉 Auto-discovery completed: ${importedCount} files imported`);
    }

    /**
     * Scan directory for matching files
     */
    private scanDirectory(
        baseDir: string, 
        patterns: DiscoveryConfig['patterns'], 
        excludePatterns: string[] = []
    ): string[] {
        const files: string[] = [];

        this.logger.debug('🔍 Scanning directory...', { baseDir, patterns, excludePatterns });

        const scanRecursive = (currentDir: string) => {
            if (!fs.existsSync(currentDir)) {
                this.logger.warn(`Directory does not exist: ${currentDir}`);
                return;
            }

            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            this.logger.debug(`📂 Scanning: ${currentDir}, found ${entries.length} entries`);

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);

                if (entry.isDirectory()) {
                    // Skip node_modules and other excluded directories
                    if (this.shouldExcludeDirectory(entry.name, excludePatterns)) {
                        this.logger.debug(`⚠️ Excluding directory: ${entry.name}`);
                        continue;
                    }
                    this.logger.debug(`📁 Entering directory: ${entry.name}`);
                    scanRecursive(fullPath);
                } else if (entry.isFile()) {
                    this.logger.debug(`📄 Found file: ${fullPath}`);
                    if (this.shouldIncludeFile(fullPath, patterns, excludePatterns, baseDir)) {
                        files.push(fullPath);
                        this.logger.debug(`✅ File included: ${path.relative(baseDir, fullPath)}`);
                    } else {
                        this.logger.debug(`❌ File excluded: ${path.relative(baseDir, fullPath)}`);
                    }
                }
            }
        };

        scanRecursive(baseDir);
        return files;
    }

    /**
     * Check if directory should be excluded
     */
    private shouldExcludeDirectory(dirName: string, excludePatterns: string[]): boolean {
        const defaultExcludes = ['node_modules', '.git', 'dist', 'build', 'coverage'];
        const allExcludes = [...defaultExcludes, ...excludePatterns];
        
        return allExcludes.some(pattern => {
            if (pattern.includes('*')) {
                return this.matchGlob(dirName, pattern);
            }
            return dirName === pattern;
        });
    }

    /**
     * Check if file should be included
     */
    private shouldIncludeFile(
        filePath: string, 
        patterns: DiscoveryConfig['patterns'], 
        excludePatterns: string[],
        baseDir: string
    ): boolean {
        const relativePath = path.relative(baseDir, filePath);
        const fileName = path.basename(filePath);

        this.logger.debug(`🔍 Checking file: ${relativePath}`, { 
            fileName, 
            patterns, 
            excludePatterns 
        });

        // Check exclude patterns first
        if (excludePatterns.some(pattern => this.matchPattern(relativePath, pattern))) {
            this.logger.debug(`❌ File matches exclude pattern: ${relativePath}`);
            return false;
        }

        // Must be TypeScript file
        if (!fileName.endsWith('.ts') || fileName.endsWith('.d.ts')) {
            this.logger.debug(`❌ File is not a valid TypeScript file: ${fileName}`);
            return false;
        }

        // Check include patterns
        const allPatterns = [
            ...(patterns.handlers || []),
            ...(patterns.services || []),
            ...(patterns.repositories || [])
        ];

        if (allPatterns.length === 0) {
            // Default patterns if none specified
            const defaultMatch = this.hasDefaultPattern(relativePath);
            this.logger.debug(`🔍 Using default patterns for ${relativePath}: ${defaultMatch}`);
            return defaultMatch;
        }

        const matches = allPatterns.some(pattern => {
            const match = this.matchPattern(relativePath, pattern);
            this.logger.debug(`🔍 Pattern '${pattern}' vs '${relativePath}': ${match}`);
            return match;
        });

        this.logger.debug(`🔍 Final match result for ${relativePath}: ${matches}`);
        return matches;
    }

    /**
     * Check if file matches default patterns
     */
    private hasDefaultPattern(filePath: string): boolean {
        const defaultPatterns = [
            '**/handlers/**/*.ts',
            '**/services/**/*.ts',
            '**/repositories/**/*.ts',
            '**/*Handler.ts',
            '**/*Service.ts',
            '**/*Repository.ts'
        ];

        return defaultPatterns.some(pattern => this.matchPattern(filePath, pattern));
    }

    /**
     * Simple glob matching
     */
    private matchGlob(text: string, pattern: string): boolean {
        // Escape special regex characters except * and ?
        let regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex chars but not * and ?
            .replace(/\*\*/g, '___DOUBLE_STAR___')  // Temporarily replace **
            .replace(/\*/g, '[^/]*')                // * matches anything except /
            .replace(/___DOUBLE_STAR___/g, '.*')    // ** matches anything including /
            .replace(/\?/g, '.');                   // ? matches any single char

        const regex = new RegExp(`^${regexPattern}$`);
        const result = regex.test(text);
        
        this.logger.debug(`🎯 Glob match: pattern="${pattern}" -> regex="${regexPattern}" vs text="${text}" = ${result}`);
        
        return result;
    }

    /**
     * Pattern matching for file paths
     */
    private matchPattern(filePath: string, pattern: string): boolean {
        // Normalize paths - convert all backslashes to forward slashes for consistent matching
        const normalizedPath = filePath.replace(/\\/g, '/');
        const normalizedPattern = pattern.replace(/\\/g, '/');

        this.logger.debug(`🔍 Pattern matching: '${normalizedPattern}' vs '${normalizedPath}'`);
        
        const result = this.matchGlob(normalizedPath, normalizedPattern);
        this.logger.debug(`🔍 Match result: ${result}`);
        
        return result;
    }
}
