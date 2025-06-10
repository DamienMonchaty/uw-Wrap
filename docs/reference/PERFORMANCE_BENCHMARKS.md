# 📊 Performance Benchmarks

## Overview

This document contains comprehensive performance benchmarks comparing uW-Wrap against popular Node.js frameworks including Express, Fastify, and Koa.

## Test Environment

- **Hardware**: Standard development machine
- **Node.js**: v20.11.0
- **Test Tool**: Autocannon (HTTP load testing)
- **Test Duration**: 10 seconds per test
- **Concurrent Connections**: 100
- **Pipelining**: 1

## Benchmark Results

### 🏆 Overall Performance Summary

| Rank | Framework | Score | Avg RPS | Avg Latency | Avg Throughput |
|------|-----------|--------|---------|-------------|----------------|
| 🥇 | **uW-Wrap** | 16 | **35,437 req/s** | **2.53ms** | **22.22 MB/s** |
| 🥈 | Fastify | 12 | 20,787 req/s | 4.48ms | 14.91 MB/s |
| 🥉 | Koa | 8 | 15,434 req/s | 6.13ms | 11.69 MB/s |
| 4th | Express | 4 | 6,084 req/s | 16.06ms | 5.41 MB/s |

### Performance vs Express Comparison

- **uW-Wrap**: **5.8x faster** than Express
- **Fastify**: 3.4x faster than Express  
- **Koa**: 2.5x faster than Express

## Detailed Test Results

### 🎯 Hello World Test
Simple JSON response with minimal processing:

| Framework | RPS | Latency | Throughput | vs uW-Wrap |
|-----------|-----|---------|------------|------------|
| **uW-Wrap** | **41,386** | **2.11ms** | **5.92 MB/s** | baseline |
| Fastify | 25,355 | 3.42ms | 4.74 MB/s | -39% |
| Koa | 18,256 | 4.94ms | 3.39 MB/s | -56% |
| Express | 6,654 | 14.52ms | 1.50 MB/s | -84% |

### 🎯 JSON Data Test
Complex JSON response (100 items array):

| Framework | RPS | Latency | Throughput | vs uW-Wrap |
|-----------|-----|---------|------------|------------|
| **uW-Wrap** | **24,245** | **3.65ms** | **68.60 MB/s** | baseline |
| Fastify | 15,711 | 5.89ms | 45.15 MB/s | -35% |
| Koa | 12,627 | 7.42ms | 36.27 MB/s | -48% |
| Express | 5,812 | 16.70ms | 16.93 MB/s | -76% |

### 🎯 Query Parameters Test
URL query parsing and response:

| Framework | RPS | Latency | Throughput | vs uW-Wrap |
|-----------|-----|---------|------------|------------|
| **uW-Wrap** | **37,152** | **2.23ms** | **6.73 MB/s** | baseline |
| Fastify | 23,335 | 3.76ms | 5.25 MB/s | -37% |
| Koa | 17,252 | 5.29ms | 3.87 MB/s | -54% |
| Express | 6,506 | 14.87ms | 1.72 MB/s | -82% |

### 🎯 POST Echo Test
Request body parsing and echo response:

| Framework | RPS | Latency | Throughput | vs uW-Wrap |
|-----------|-----|---------|------------|------------|
| **uW-Wrap** | **38,966** | **2.13ms** | **7.62 MB/s** | baseline |
| Fastify | 18,750 | 4.86ms | 4.49 MB/s | -52% |
| Koa | 13,599 | 6.86ms | 3.24 MB/s | -65% |
| Express | 5,363 | 18.14ms | 1.49 MB/s | -86% |

## Key Performance Insights

### 🚀 uW-Wrap Advantages

1. **Consistent Leader**: uW-Wrap wins every single test category
2. **Low Latency**: Maintains sub-3ms average latency across all tests
3. **High Throughput**: Superior performance in data-intensive operations
4. **Scalability**: Handles 35K+ requests per second on average

### 📈 Performance Characteristics

- **Simple Operations**: 63% faster than Fastify (Hello World test)
- **Data Processing**: 54% faster than Fastify (JSON test)
- **Request Parsing**: 59% faster than Fastify (Query test)
- **Body Processing**: 108% faster than Fastify (POST test)

### 💡 Framework Comparison Notes

**uW-Wrap**:
- Built on uWebSockets.js for maximum performance
- Optimized TypeScript implementation
- Minimal overhead with direct HTTP handling

**Fastify**:
- Good performance with plugin architecture
- JSON schema validation overhead
- Solid second choice for performance

**Koa**:
- Lightweight middleware approach
- Modern async/await support
- Decent performance for medium-scale apps

**Express**:
- Most popular but slowest
- Heavy middleware stack
- Better suited for rapid prototyping

## Running Benchmarks

### Quick Benchmark
```bash
npm run bench:simple
```

### Test Individual Servers
```bash
npm run bench:servers
```

### Custom Benchmarks
```bash
# Test specific endpoint
autocannon -c 100 -d 10 http://localhost:3001/api/hello

# Test with POST data
autocannon -c 100 -d 10 -m POST \
  -H "Content-Type: application/json" \
  -b '{"test":"data"}' \
  http://localhost:3001/api/echo
```

## Production Considerations

### When to Choose uW-Wrap

✅ **High-traffic applications** requiring maximum performance  
✅ **Real-time applications** needing low latency  
✅ **API servers** with heavy request loads  
✅ **Microservices** where performance is critical  
✅ **TypeScript projects** benefiting from full type safety  

### Performance Optimization Tips

1. **Production Mode**: Disable verbose logging
2. **Connection Pooling**: Configure appropriate database connections
3. **Caching**: Implement Redis or in-memory caching
4. **Load Balancing**: Use multiple instances behind a proxy
5. **Monitoring**: Track performance metrics in production

## Benchmark Methodology

### Test Setup
Each framework was tested with identical endpoints:
- `/api/hello` - Simple JSON response
- `/api/json` - Complex data structure (100 items)
- `/api/query` - Query parameter parsing
- `/api/echo` - POST request body processing

### Measurement Criteria
- **RPS (Requests Per Second)**: Higher is better
- **Latency**: Lower is better (mean response time)
- **Throughput**: Higher is better (MB/s)
- **Consistency**: Multiple test runs averaged

### Fair Testing
- Identical hardware and network conditions
- Same Node.js version across all frameworks
- Production-like configurations
- No external dependencies during testing
- Clean server restarts between tests

---

*Last updated: June 10, 2025*  
*Benchmark version: 1.0*
