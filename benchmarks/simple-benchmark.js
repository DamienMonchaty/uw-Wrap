/**
 * Simple Benchmark Suite using only Autocannon
 * Compares uW-Wrap with popular Node.js frameworks
 */

const autocannon = require('autocannon');
const { spawn } = require('child_process');
const { promisify } = require('util');

const sleep = promisify(setTimeout);

// Framework configurations
const frameworks = {
    'uW-Wrap': { port: 3001, script: 'benchmarks/servers/uw-wrap-server.ts', cmd: 'npx', args: ['ts-node'] },
    'Express': { port: 3002, script: 'benchmarks/servers/express-server.js', cmd: 'node', args: [] },
    'Fastify': { port: 3003, script: 'benchmarks/servers/fastify-server.js', cmd: 'node', args: [] },
    'Koa': { port: 3004, script: 'benchmarks/servers/koa-server.js', cmd: 'node', args: [] }
};

// Test configurations
const testConfigs = {
    hello: { path: '/api/hello', method: 'GET' },
    json: { path: '/api/json', method: 'GET' },
    query: { path: '/api/query?name=test&value=123', method: 'GET' },
    echo: { 
        path: '/api/echo', 
        method: 'POST',
        body: JSON.stringify({ test: 'data', timestamp: Date.now() }),
        headers: { 'Content-Type': 'application/json' }
    }
};

class SimpleBenchmarkRunner {
    constructor() {
        this.processes = new Map();
    }
    
    async startServer(name) {
        const config = frameworks[name];
        console.log(`🚀 Starting ${name} server on port ${config.port}...`);
        
        const args = [...config.args, config.script];
        const process = spawn(config.cmd, args, {
            stdio: 'pipe',
            shell: true
        });
        
        this.processes.set(name, process);
        
        // Wait for server to start
        await sleep(3000);
        
        // Verify server is running
        try {
            const response = await fetch(`http://localhost:${config.port}/api/hello`);
            if (response.ok) {
                console.log(`✅ ${name} server ready`);
                return true;
            } else {
                throw new Error(`Server responded with ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ Failed to start ${name} server:`, error.message);
            return false;
        }
    }
    
    async stopServer(name) {
        const process = this.processes.get(name);
        if (process) {
            process.kill('SIGTERM');
            this.processes.delete(name);
            console.log(`🛑 Stopped ${name} server`);
        }
    }
    
    async stopAllServers() {
        for (const name of this.processes.keys()) {
            await this.stopServer(name);
        }
    }
    
    async runLoadTest(framework, testName) {
        const config = frameworks[framework];
        const testConfig = testConfigs[testName];
        
        const url = `http://localhost:${config.port}${testConfig.path}`;
        
        console.log(`📊 Testing ${framework} - ${testName}`);
        
        const result = await autocannon({
            url,
            method: testConfig.method,
            body: testConfig.body,
            headers: testConfig.headers,
            connections: 100,
            duration: 10, // 10 seconds
            pipelining: 1
        });
        
        return {
            framework,
            test: testName,
            rps: result.requests.average,
            latency: {
                mean: result.latency.mean,
                max: result.latency.max,
                min: result.latency.min
            },
            throughput: result.throughput.average,
            errors: result.errors
        };
    }
    
    async runComprehensiveBenchmark() {
        console.log('🎯 Starting Framework Performance Benchmark');
        console.log('==========================================\n');
        
        const results = [];
        
        // Start all servers
        for (const framework of Object.keys(frameworks)) {
            const started = await this.startServer(framework);
            if (!started) {
                console.error(`Skipping ${framework} due to startup failure`);
            }
        }
        
        await sleep(2000); // Give servers time to stabilize
        
        // Run tests for each framework and endpoint
        for (const framework of Object.keys(frameworks)) {
            if (!this.processes.has(framework)) continue;
            
            console.log(`\n🔥 Testing ${framework}...`);
            
            for (const testName of Object.keys(testConfigs)) {
                try {
                    const result = await this.runLoadTest(framework, testName);
                    results.push(result);
                    
                    console.log(`  ${testName}: ${result.rps.toFixed(0)} req/s, ${result.latency.mean.toFixed(2)}ms avg`);
                } catch (error) {
                    console.error(`  ❌ ${testName} failed:`, error.message);
                }
                
                await sleep(1000); // Cool down between tests
            }
        }
        
        // Stop all servers
        await this.stopAllServers();
        
        // Generate report
        this.generateReport(results);
    }
    
    generateReport(results) {
        console.log('\n📈 BENCHMARK RESULTS');
        console.log('====================\n');
        
        // Group results by test
        const testGroups = {};
        results.forEach(result => {
            if (!testGroups[result.test]) {
                testGroups[result.test] = [];
            }
            testGroups[result.test].push(result);
        });
        
        // Display results
        Object.entries(testGroups).forEach(([testName, testResults]) => {
            console.log(`\n🎯 ${testName.toUpperCase()} TEST`);
            console.log('-'.repeat(60));
            
            // Sort by RPS descending
            testResults.sort((a, b) => b.rps - a.rps);
            
            testResults.forEach((result, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
                console.log(`${medal} ${result.framework.padEnd(10)} | ${result.rps.toFixed(0).padStart(8)} req/s | ${result.latency.mean.toFixed(2).padStart(7)}ms avg | ${(result.throughput / 1024 / 1024).toFixed(2).padStart(6)} MB/s`);
            });
        });
        
        // Overall winner
        console.log('\n🏆 OVERALL PERFORMANCE RANKING');
        console.log('===============================');
        
        const frameworkScores = {};
        Object.keys(frameworks).forEach(fw => frameworkScores[fw] = 0);
        
        Object.values(testGroups).forEach((testResults) => {
            testResults.sort((a, b) => b.rps - a.rps);
            testResults.forEach((result, index) => {
                frameworkScores[result.framework] += (testResults.length - index);
            });
        });
        
        const sortedFrameworks = Object.entries(frameworkScores)
            .sort(([,a], [,b]) => b - a);
        
        sortedFrameworks.forEach(([framework, score], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
            console.log(`${medal} ${framework.padEnd(10)} | Score: ${score}`);
        });
        
        // Calculate averages
        console.log('\n📊 AVERAGE PERFORMANCE METRICS');
        console.log('===============================');
        
        const frameworkAvgs = {};
        Object.keys(frameworks).forEach(fw => {
            const fwResults = results.filter(r => r.framework === fw);
            if (fwResults.length > 0) {
                const avgRps = fwResults.reduce((sum, r) => sum + r.rps, 0) / fwResults.length;
                const avgLatency = fwResults.reduce((sum, r) => sum + r.latency.mean, 0) / fwResults.length;
                const avgThroughput = fwResults.reduce((sum, r) => sum + r.throughput, 0) / fwResults.length;
                
                frameworkAvgs[fw] = { avgRps, avgLatency, avgThroughput };
            }
        });
        
        const sortedByRps = Object.entries(frameworkAvgs)
            .sort(([,a], [,b]) => b.avgRps - a.avgRps);
        
        sortedByRps.forEach(([framework, metrics], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
            console.log(`${medal} ${framework.padEnd(10)} | ${metrics.avgRps.toFixed(0).padStart(8)} req/s avg | ${metrics.avgLatency.toFixed(2).padStart(7)}ms avg | ${(metrics.avgThroughput / 1024 / 1024).toFixed(2).padStart(6)} MB/s avg`);
        });
        
        console.log('\n💡 Higher RPS and lower latency are better');
        console.log('📊 Benchmark completed successfully!');
    }
}

// Main execution
async function main() {
    console.log('🚀 uW-Wrap Framework Benchmark Suite');
    console.log('=====================================\n');
    
    const runner = new SimpleBenchmarkRunner();
    
    try {
        await runner.runComprehensiveBenchmark();
    } catch (error) {
        console.error('❌ Benchmark failed:', error);
        await runner.stopAllServers();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { SimpleBenchmarkRunner };
