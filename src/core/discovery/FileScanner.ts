/**
 * FileScanner - Pure file system scanning utility
 * Single responsibility: File discovery and pattern matching
 * Designed to be testable and configurable
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../../utils/logger';

export interface ScanPattern {
    /** Glob patterns to include */
    include: string[];
    /** Glob patterns to exclude */
    exclude: string[];
    /** File extensions to include (e.g., ['.ts', '.js']) */
    extensions: string[];
    /** Maximum scan depth (prevents infinite recursion) */
    maxDepth: number;
    /** Whether to follow symbolic links */
    followSymlinks: boolean;
}

export interface ScanOptions {
    /** Base directory to scan from */
    baseDirectory: string;
    /** Scan patterns configuration */
    patterns: ScanPattern;
    /** Whether to scan asynchronously */
    async: boolean;
    /** Batch size for async operations */
    batchSize: number;
    /** Progress callback for async operations */
    onProgress?: (scannedFiles: number, totalEstimate: number) => void;
}

export interface ScanResult {
    /** List of discovered file paths */
    files: string[];
    /** Scan statistics */
    stats: {
        scannedDirectories: number;
        totalFiles: number;
        matchedFiles: number;
        skippedFiles: number;
        errors: number;
        scanTimeMs: number;
    };
    /** Errors encountered during scan */
    errors: Array<{ path: string; error: string }>;
}

/**
 * High-performance, configurable file scanner
 */
export class FileScanner {
    private logger?: Logger;

    constructor(logger?: Logger) {
        this.logger = logger;
    }

    /**
     * Asynchronous file scanning (recommended for production)
     */
    async scanAsync(options: ScanOptions): Promise<ScanResult> {
        const startTime = Date.now();
        const result: ScanResult = {
            files: [],
            stats: {
                scannedDirectories: 0,
                totalFiles: 0,
                matchedFiles: 0,
                skippedFiles: 0,
                errors: 0,
                scanTimeMs: 0
            },
            errors: []
        };

        try {
            await this.scanDirectoryAsync(
                options.baseDirectory,
                options.patterns,
                result,
                0,
                options.patterns.maxDepth,
                options.batchSize,
                options.onProgress
            );
        } catch (error) {
            result.errors.push({
                path: options.baseDirectory,
                error: error instanceof Error ? error.message : String(error)
            });
            result.stats.errors++;
        }

        result.stats.scanTimeMs = Date.now() - startTime;
        return result;
    }

    /**
     * Synchronous file scanning (for compatibility)
     */
    scanSync(options: Omit<ScanOptions, 'async' | 'batchSize' | 'onProgress'>): ScanResult {
        const startTime = Date.now();
        const result: ScanResult = {
            files: [],
            stats: {
                scannedDirectories: 0,
                totalFiles: 0,
                matchedFiles: 0,
                skippedFiles: 0,
                errors: 0,
                scanTimeMs: 0
            },
            errors: []
        };

        try {
            this.scanDirectorySync(
                options.baseDirectory,
                options.patterns,
                result,
                0,
                options.patterns.maxDepth
            );
        } catch (error) {
            result.errors.push({
                path: options.baseDirectory,
                error: error instanceof Error ? error.message : String(error)
            });
            result.stats.errors++;
        }

        result.stats.scanTimeMs = Date.now() - startTime;
        return result;
    }

    /**
     * Async directory scanning implementation
     */
    private async scanDirectoryAsync(
        directory: string,
        patterns: ScanPattern,
        result: ScanResult,
        currentDepth: number,
        maxDepth: number,
        batchSize: number,
        onProgress?: (scannedFiles: number, totalEstimate: number) => void
    ): Promise<void> {
        if (currentDepth >= maxDepth) {
            return;
        }

        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });
            result.stats.scannedDirectories++;

            // Process files in batches for better performance
            const files = entries.filter(entry => entry.isFile());
            const directories = entries.filter(entry => entry.isDirectory());

            // Process files in batches
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(async (file) => {
                        const filePath = path.join(directory, file.name);
                        result.stats.totalFiles++;

                        if (this.shouldIncludeFile(filePath, patterns)) {
                            result.files.push(filePath);
                            result.stats.matchedFiles++;
                        } else {
                            result.stats.skippedFiles++;
                        }

                        if (onProgress) {
                            onProgress(result.stats.totalFiles, result.stats.totalFiles * 2); // Rough estimate
                        }
                    })
                );
            }

            // Process subdirectories recursively
            for (const dir of directories) {
                if (!this.shouldExcludeDirectory(dir.name, patterns.exclude)) {
                    const subdirPath = path.join(directory, dir.name);
                    await this.scanDirectoryAsync(
                        subdirPath,
                        patterns,
                        result,
                        currentDepth + 1,
                        maxDepth,
                        batchSize,
                        onProgress
                    );
                }
            }

        } catch (error) {
            result.errors.push({
                path: directory,
                error: error instanceof Error ? error.message : String(error)
            });
            result.stats.errors++;
        }
    }

    /**
     * Sync directory scanning implementation
     */
    private scanDirectorySync(
        directory: string,
        patterns: ScanPattern,
        result: ScanResult,
        currentDepth: number,
        maxDepth: number
    ): void {
        if (currentDepth >= maxDepth) {
            return;
        }

        try {
            const entries = require('fs').readdirSync(directory, { withFileTypes: true });
            result.stats.scannedDirectories++;

            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);

                if (entry.isFile()) {
                    result.stats.totalFiles++;
                    if (this.shouldIncludeFile(fullPath, patterns)) {
                        result.files.push(fullPath);
                        result.stats.matchedFiles++;
                    } else {
                        result.stats.skippedFiles++;
                    }
                } else if (entry.isDirectory()) {
                    if (!this.shouldExcludeDirectory(entry.name, patterns.exclude)) {
                        this.scanDirectorySync(fullPath, patterns, result, currentDepth + 1, maxDepth);
                    }
                }
            }

        } catch (error) {
            result.errors.push({
                path: directory,
                error: error instanceof Error ? error.message : String(error)
            });
            result.stats.errors++;
        }
    }

    /**
     * Check if file should be included based on patterns
     */
    private shouldIncludeFile(filePath: string, patterns: ScanPattern): boolean {
        const fileName = path.basename(filePath);
        const fileExt = path.extname(filePath);

        // Check extension first (performance optimization)
        if (patterns.extensions.length > 0 && !patterns.extensions.includes(fileExt)) {
            return false;
        }

        // Check exclude patterns first (performance optimization)
        if (patterns.exclude.some(pattern => this.matchPattern(filePath, pattern))) {
            return false;
        }

        // Check include patterns
        return patterns.include.length === 0 || 
               patterns.include.some(pattern => this.matchPattern(filePath, pattern));
    }

    /**
     * Check if directory should be excluded
     */
    private shouldExcludeDirectory(dirName: string, excludePatterns: string[]): boolean {
        const defaultExcludes = [
            'node_modules',
            '.git',
            '.svn',
            '.hg',
            'dist',
            'build',
            'coverage',
            '.nyc_output',
            'tmp',
            'temp'
        ];

        const allExcludes = [...defaultExcludes, ...excludePatterns];
        return allExcludes.some(pattern => this.matchPattern(dirName, pattern));
    }

    /**
     * Enhanced glob pattern matching with better performance
     */
    private matchPattern(text: string, pattern: string): boolean {
        // Normalize paths for cross-platform compatibility
        const normalizedText = text.replace(/\\/g, '/');
        const normalizedPattern = pattern.replace(/\\/g, '/');

        // Cache compiled regex patterns for better performance
        return this.createRegexFromGlob(normalizedPattern).test(normalizedText);
    }

    /**
     * Convert glob pattern to regex with caching
     */
    private static regexCache = new Map<string, RegExp>();

    private createRegexFromGlob(pattern: string): RegExp {
        if (FileScanner.regexCache.has(pattern)) {
            return FileScanner.regexCache.get(pattern)!;
        }

        let regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
            .replace(/\*\*/g, '___DOUBLE_STAR___')  // Temporarily replace **
            .replace(/\*/g, '[^/]*')                // * matches anything except /
            .replace(/___DOUBLE_STAR___/g, '.*')    // ** matches anything including /
            .replace(/\?/g, '.');                   // ? matches any single char

        const regex = new RegExp(`^${regexPattern}$`);
        FileScanner.regexCache.set(pattern, regex);
        return regex;
    }

    /**
     * Clear regex cache (useful for testing or memory management)
     */
    static clearCache(): void {
        FileScanner.regexCache.clear();
    }
}
