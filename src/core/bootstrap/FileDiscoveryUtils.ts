/**
 * FileDiscoveryUtils - Utility functions for file and schema discovery
 * Extracted from ApplicationBootstrap to follow SRP
 */

import path from 'path';
import fs from 'fs';

/**
 * Schema discovery options
 */
export interface SchemaDiscoveryOptions {
    /** Custom base directory for schema search */
    baseDirectory?: string;
    /** Custom file patterns to search for */
    patterns?: string[];
    /** Whether to search recursively */
    recursive?: boolean;
}

/**
 * File discovery utilities
 * Single responsibility: file system operations and path discovery
 */
export class FileDiscoveryUtils {
    
    /**
     * Auto-detect schema file location with customizable options
     */
    static detectSchemaPath(options: SchemaDiscoveryOptions = {}): string | null {
        const baseDir = options.baseDirectory || process.cwd();
        const patterns = options.patterns || [
            'schema.sql',
            'database/schema.sql',
            'db/schema.sql',
            'sql/schema.sql',
            'migrations/schema.sql',
            'database/migrations/schema.sql'
        ];

        const possiblePaths = patterns.map(pattern => path.join(baseDir, pattern));

        for (const schemaPath of possiblePaths) {
            if (fs.existsSync(schemaPath)) {
                return schemaPath;
            }
        }

        // If recursive search is enabled, look in subdirectories
        if (options.recursive) {
            return this.recursiveSchemaSearch(baseDir);
        }

        return null;
    }

    /**
     * Recursively search for schema files
     */
    private static recursiveSchemaSearch(baseDir: string, maxDepth: number = 2): string | null {
        const searchInDirectory = (dir: string, currentDepth: number): string | null => {
            if (currentDepth >= maxDepth) {
                return null;
            }

            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                
                // First, look for schema files in current directory
                for (const entry of entries) {
                    if (entry.isFile() && entry.name === 'schema.sql') {
                        return path.join(dir, entry.name);
                    }
                }

                // Then search subdirectories
                for (const entry of entries) {
                    if (entry.isDirectory() && !entry.name.startsWith('.')) {
                        const result = searchInDirectory(path.join(dir, entry.name), currentDepth + 1);
                        if (result) {
                            return result;
                        }
                    }
                }
            } catch (error) {
                // Ignore permission errors and continue search
            }

            return null;
        };

        return searchInDirectory(baseDir, 0);
    }

    /**
     * Discover configuration files
     */
    static discoverConfigFiles(baseDir: string = process.cwd()): string[] {
        const configPatterns = [
            'config.json',
            'config.js',
            'config.ts',
            '.uwraprc',
            '.uwraprc.json',
            'uwrap.config.js',
            'uwrap.config.ts'
        ];

        const foundConfigs: string[] = [];

        for (const pattern of configPatterns) {
            const configPath = path.join(baseDir, pattern);
            if (fs.existsSync(configPath)) {
                foundConfigs.push(configPath);
            }
        }

        return foundConfigs;
    }

    /**
     * Discover environment files
     */
    static discoverEnvironmentFiles(baseDir: string = process.cwd()): string[] {
        const envPatterns = [
            '.env',
            '.env.local',
            '.env.development',
            '.env.production',
            '.env.test'
        ];

        const foundEnvFiles: string[] = [];

        for (const pattern of envPatterns) {
            const envPath = path.join(baseDir, pattern);
            if (fs.existsSync(envPath)) {
                foundEnvFiles.push(envPath);
            }
        }

        return foundEnvFiles;
    }

    /**
     * Check if a path exists and is readable
     */
    static isPathAccessible(filePath: string): boolean {
        try {
            fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file stats safely
     */
    static getFileSafely(filePath: string): { content: string; stats: fs.Stats } | null {
        try {
            if (!this.isPathAccessible(filePath)) {
                return null;
            }

            const stats = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf-8');

            return { content, stats };
        } catch {
            return null;
        }
    }

    /**
     * Validate file extension
     */
    static hasValidExtension(filePath: string, validExtensions: string[]): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return validExtensions.includes(ext);
    }

    /**
     * Create directory if it doesn't exist
     */
    static ensureDirectoryExists(dirPath: string): boolean {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            return true;
        } catch {
            return false;
        }
    }
}
