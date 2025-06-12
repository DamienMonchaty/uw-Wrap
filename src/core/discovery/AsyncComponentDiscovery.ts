/**
 * AsyncComponentDiscovery - Asynchronous component discovery system
 * Single responsibility: Component discovery with performance optimization
 * Separated from registration logic for better testability
 */

import path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { FileScanner, ScanResult, ScanOptions } from './FileScanner';
import { DiscoveryConfig, DiscoveryConfiguration, ComponentPatterns } from './DiscoveryConfig';
import { Logger } from '../../utils/logger';

export interface DiscoveredComponent {
    /** Full path to the component file */
    filePath: string;
    /** Relative path from base directory */
    relativePath: string;
    /** Component type inferred from patterns */
    inferredType: keyof ComponentPatterns | 'unknown';
    /** File name without extension */
    componentName: string;
    /** File size in bytes */
    fileSize: number;
    /** Last modified timestamp */
    lastModified: Date;
}

export interface DiscoveryResult {
    /** List of discovered components */
    components: DiscoveredComponent[];
    /** Discovery statistics */
    stats: {
        totalFiles: number;
        componentFiles: number;
        scanTimeMs: number;
        importTimeMs: number;
        errors: number;
    };
    /** Errors encountered during discovery */
    errors: Array<{ path: string; error: string; phase: 'scan' | 'import' | 'analyze' }>;
    /** Performance metrics */
    performance: {
        avgFileProcessingTime: number;
        peakMemoryUsage: number;
        parallelWorkers: number;
    };
}

export interface DiscoveryProgress {
    phase: 'scanning' | 'importing' | 'analyzing' | 'complete';
    current: number;
    total: number;
    currentFile?: string;
    timeElapsed: number;
    estimatedTimeRemaining?: number;
}

/**
 * High-performance asynchronous component discovery
 */
export class AsyncComponentDiscovery {
    private logger?: Logger;
    private fileScanner: FileScanner;

    constructor(logger?: Logger) {
        this.logger = logger;
        this.fileScanner = new FileScanner(logger);
    }

    /**
     * Discover components with full async support and progress reporting
     */
    async discoverComponents(
        config: DiscoveryConfiguration,
        onProgress?: (progress: DiscoveryProgress) => void
    ): Promise<DiscoveryResult> {
        const startTime = Date.now();
        const result: DiscoveryResult = {
            components: [],
            stats: {
                totalFiles: 0,
                componentFiles: 0,
                scanTimeMs: 0,
                importTimeMs: 0,
                errors: 0
            },
            errors: [],
            performance: {
                avgFileProcessingTime: 0,
                peakMemoryUsage: 0,
                parallelWorkers: 0
            }
        };

        try {
            // Phase 1: File scanning
            await this.reportProgress(onProgress, {
                phase: 'scanning',
                current: 0,
                total: 1,
                timeElapsed: Date.now() - startTime
            });

            const scanResult = await this.performFileScan(config, onProgress);
            result.stats.totalFiles = scanResult.stats.totalFiles;
            result.stats.scanTimeMs = scanResult.stats.scanTimeMs;
            result.errors.push(...scanResult.errors.map(e => ({ ...e, phase: 'scan' as const })));

            // Phase 2: Component analysis
            await this.reportProgress(onProgress, {
                phase: 'analyzing',
                current: 0,
                total: scanResult.files.length,
                timeElapsed: Date.now() - startTime
            });

            const components = await this.analyzeComponents(
                scanResult.files,
                config,
                onProgress,
                startTime
            );

            result.components = components;
            result.stats.componentFiles = components.length;

            // Phase 3: Complete
            await this.reportProgress(onProgress, {
                phase: 'complete',
                current: components.length,
                total: components.length,
                timeElapsed: Date.now() - startTime
            });

            // Calculate performance metrics
            const totalTime = Date.now() - startTime;
            result.performance.avgFileProcessingTime = components.length > 0 ? 
                totalTime / components.length : 0;
            result.performance.peakMemoryUsage = process.memoryUsage().heapUsed;

        } catch (error) {
            result.errors.push({
                path: config.baseDirectory,
                error: error instanceof Error ? error.message : String(error),
                phase: 'scan'
            });
            result.stats.errors++;
        }

        return result;
    }

    /**
     * Discover specific component types only
     */
    async discoverComponentTypes(
        componentTypes: (keyof ComponentPatterns)[],
        config: DiscoveryConfiguration,
        onProgress?: (progress: DiscoveryProgress) => void
    ): Promise<DiscoveryResult> {
        // Create focused configuration for specific types
        const focusedPatterns: Partial<ComponentPatterns> = {};
        for (const type of componentTypes) {
            focusedPatterns[type] = config.patterns[type];
        }

        const focusedConfig: DiscoveryConfiguration = {
            ...config,
            patterns: {
                handlers: focusedPatterns.handlers || [],
                services: focusedPatterns.services || [],
                repositories: focusedPatterns.repositories || [],
                middleware: focusedPatterns.middleware || [],
                controllers: focusedPatterns.controllers || [],
                components: focusedPatterns.components || []
            }
        };

        return this.discoverComponents(focusedConfig, onProgress);
    }

    /**
     * Perform file scanning with progress reporting
     */
    private async performFileScan(
        config: DiscoveryConfiguration,
        onProgress?: (progress: DiscoveryProgress) => void
    ): Promise<ScanResult> {
        const scanPattern = DiscoveryConfig.getAllPatterns(config);
        
        const scanOptions: ScanOptions = {
            baseDirectory: config.baseDirectory,
            patterns: scanPattern,
            async: config.async.enabled,
            batchSize: config.async.batchSize,
            onProgress: config.async.progressReporting ? 
                (scanned, total) => this.reportScanProgress(onProgress, scanned, total) : 
                undefined
        };

        if (config.async.enabled) {
            return this.fileScanner.scanAsync(scanOptions);
        } else {
            return this.fileScanner.scanSync(scanOptions);
        }
    }

    /**
     * Analyze discovered files to extract component information
     */
    private async analyzeComponents(
        filePaths: string[],
        config: DiscoveryConfiguration,
        onProgress?: (progress: DiscoveryProgress) => void,
        startTime: number = Date.now()
    ): Promise<DiscoveredComponent[]> {
        const components: DiscoveredComponent[] = [];
        const batchSize = config.async.batchSize;

        // Process files in batches for better performance
        for (let i = 0; i < filePaths.length; i += batchSize) {
            const batch = filePaths.slice(i, i + batchSize);
            
            if (config.performance.parallelScanning) {
                // Parallel processing
                const batchResults = await Promise.all(
                    batch.map(filePath => this.analyzeComponent(filePath, config))
                );
                components.push(...batchResults.filter(c => c !== null) as DiscoveredComponent[]);
            } else {
                // Sequential processing
                for (const filePath of batch) {
                    const component = await this.analyzeComponent(filePath, config);
                    if (component) {
                        components.push(component);
                    }
                }
            }

            // Report progress
            if (onProgress) {
                await this.reportProgress(onProgress, {
                    phase: 'analyzing',
                    current: i + batch.length,
                    total: filePaths.length,
                    currentFile: batch[batch.length - 1],
                    timeElapsed: Date.now() - startTime,
                    estimatedTimeRemaining: this.estimateTimeRemaining(
                        i + batch.length,
                        filePaths.length,
                        Date.now() - startTime
                    )
                });
            }
        }

        return components;
    }

    /**
     * Analyze individual component file
     */
    private async analyzeComponent(
        filePath: string,
        config: DiscoveryConfiguration
    ): Promise<DiscoveredComponent | null> {
        try {
            const fs = require('fs/promises');
            const stats = await fs.stat(filePath);
            
            const relativePath = path.relative(config.baseDirectory, filePath);
            const componentName = path.basename(filePath, path.extname(filePath));
            const inferredType = this.inferComponentType(relativePath, config.patterns);

            return {
                filePath,
                relativePath,
                inferredType,
                componentName,
                fileSize: stats.size,
                lastModified: stats.mtime
            };

        } catch (error) {
            this.logger?.warn(`Failed to analyze component: ${filePath}`, { error });
            return null;
        }
    }

    /**
     * Infer component type from file path patterns
     */
    private inferComponentType(
        relativePath: string,
        patterns: ComponentPatterns
    ): keyof ComponentPatterns | 'unknown' {
        for (const [type, typePatterns] of Object.entries(patterns)) {
            if (typePatterns.some((pattern: string) => this.matchPattern(relativePath, pattern))) {
                return type as keyof ComponentPatterns;
            }
        }
        return 'unknown';
    }

    /**
     * Pattern matching utility
     */
    private matchPattern(text: string, pattern: string): boolean {
        // Simple glob matching (can be enhanced)
        const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(text.replace(/\\/g, '/'));
    }

    /**
     * Report scan progress
     */
    private async reportScanProgress(
        onProgress?: (progress: DiscoveryProgress) => void,
        scanned: number = 0,
        total: number = 0
    ): Promise<void> {
        if (onProgress) {
            await this.reportProgress(onProgress, {
                phase: 'scanning',
                current: scanned,
                total: total || scanned,
                timeElapsed: Date.now()
            });
        }
    }

    /**
     * Report progress with async support
     */
    private async reportProgress(
        onProgress: ((progress: DiscoveryProgress) => void) | undefined,
        progress: DiscoveryProgress
    ): Promise<void> {
        if (onProgress) {
            // Use setImmediate to yield control and allow for async progress reporting
            await new Promise(resolve => setImmediate(resolve));
            onProgress(progress);
        }
    }

    /**
     * Estimate remaining time for completion
     */
    private estimateTimeRemaining(
        current: number,
        total: number,
        timeElapsed: number
    ): number | undefined {
        if (current === 0) return undefined;
        
        const avgTimePerItem = timeElapsed / current;
        const remaining = total - current;
        return Math.round(avgTimePerItem * remaining);
    }

    /**
     * Get discovery statistics for monitoring
     */
    async getDiscoveryStats(config: DiscoveryConfiguration): Promise<{
        estimatedFiles: number;
        estimatedComponents: number;
        configurationValid: boolean;
        recommendedSettings: Partial<DiscoveryConfiguration>;
    }> {
        const validation = DiscoveryConfig.validate(config);
        
        // Quick scan to estimate file counts
        const quickScan = await this.fileScanner.scanAsync({
            baseDirectory: config.baseDirectory,
            patterns: {
                include: ['**/*.ts'],
                exclude: config.globalExcludes,
                extensions: config.extensions,
                maxDepth: Math.min(3, config.maxDepth), // Shallow scan for estimation
                followSymlinks: false
            },
            async: true,
            batchSize: 100
        });

        const estimatedComponents = Math.floor(quickScan.files.length * 0.3); // Rough estimate

        // Recommend settings based on project size
        const recommendedSettings: Partial<DiscoveryConfiguration> = {};
        if (quickScan.files.length > 1000) {
            recommendedSettings.async = { ...config.async, batchSize: 200 };
            recommendedSettings.performance = { ...config.performance, maxConcurrency: 8 };
        }

        return {
            estimatedFiles: quickScan.files.length,
            estimatedComponents,
            configurationValid: validation.valid,
            recommendedSettings
        };
    }
}
