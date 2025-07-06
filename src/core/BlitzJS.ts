import { App, SSLApp, TemplatedApp, HttpRequest, HttpResponse, AppOptions } from 'uWebSockets.js';

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

export interface RouteContext {
  req: HttpRequest;
  res: HttpResponse;
  params: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
}

export type RouteHandlerFunction = (ctx: RouteContext) => void | Promise<void>;
export type MiddlewareFunction = (ctx: RouteContext, next: () => Promise<void>) => void | Promise<void>;

// Types stricts pour les réponses simples
export type SimpleResponse = string | number | boolean | null | Record<string, unknown> | unknown[];
export type SimpleHandlerFunction = (ctx: RouteContext) => SimpleResponse | Promise<SimpleResponse>;
export type SimpleHandler = SimpleResponse | SimpleHandlerFunction;

export interface BlitzConfig {
  port?: number;
  host?: string;
  ssl?: AppOptions;
  prefix?: string; // Nouveau: support des préfixes
}

interface Route {
  method: HttpMethod;
  pattern: string;
  handler: RouteHandlerFunction;
  regex: RegExp;
  paramNames: string[];
}

/**
 * BlitzJS - Ultra-lightweight, Elysia-like web framework
 */
export class BlitzJS {
  private app: TemplatedApp;
  private routes: Route[] = [];
  private middlewares: MiddlewareFunction[] = [];
  private config: BlitzConfig;
  private prefix: string;

  constructor(config: BlitzConfig = {}) {
    this.config = {
      port: 3000,
      host: '0.0.0.0',
      ...config
    };
    
    this.prefix = config.prefix || '';
    
    // Initialize uWebSockets.js app only if this is not a sub-app
    if (!config.prefix) {
      this.app = config.ssl ? SSLApp(config.ssl) : App();
      this.setupRoutes();
    } else {
      this.app = null as any; // Sub-app doesn't have its own uWS app
    }
  }

  /**
   * Add middleware to the application
   */
  use(middleware: MiddlewareFunction | BlitzJS): this {
    if (middleware instanceof BlitzJS) {
      // Mount a sub-application
      this.mountSubApp(middleware);
    } else {
      // Add regular middleware
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * Mount a sub-application with its routes and middlewares
   */
  private mountSubApp(subApp: BlitzJS): void {
    // Add sub-app's middlewares with prefix
    for (const middleware of subApp.middlewares) {
      this.middlewares.push(middleware);
    }
    
    // Add sub-app's routes with prefix
    for (const route of subApp.routes) {
      const prefixedPattern = this.combinePaths(subApp.prefix, route.pattern);
      this.addRoute(route.method, prefixedPattern, route.handler);
    }
  }

  /**
   * Combine paths properly handling slashes
   */
  private combinePaths(prefix: string, path: string): string {
    if (!prefix) return path;
    
    // Ensure prefix starts with / and doesn't end with /
    const cleanPrefix = prefix.startsWith('/') ? prefix : '/' + prefix;
    const normalizedPrefix = cleanPrefix.endsWith('/') ? cleanPrefix.slice(0, -1) : cleanPrefix;
    
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    
    return normalizedPrefix + cleanPath;
  }

  /**
   * Handle GET requests with Elysia-like simplicity
   */
  get(pattern: string, handler: SimpleHandler): this {
    // For sub-apps, store the pattern as-is (without prefix)
    this.addRoute('get', pattern, this.createSimpleHandler(handler));
    return this;
  }

  /**
   * Handle POST requests with Elysia-like simplicity
   */
  post(pattern: string, handler: SimpleHandler): this {
    this.addRoute('post', pattern, this.createSimpleHandler(handler));
    return this;
  }

  /**
   * Handle PUT requests with Elysia-like simplicity
   */
  put(pattern: string, handler: SimpleHandler): this {
    this.addRoute('put', pattern, this.createSimpleHandler(handler));
    return this;
  }

  /**
   * Handle DELETE requests with Elysia-like simplicity
   */
  delete(pattern: string, handler: SimpleHandler): this {
    this.addRoute('delete', pattern, this.createSimpleHandler(handler));
    return this;
  }

  /**
   * Handle PATCH requests with Elysia-like simplicity
   */
  patch(pattern: string, handler: SimpleHandler): this {
    this.addRoute('patch', pattern, this.createSimpleHandler(handler));
    return this;
  }

  /**
   * Handle OPTIONS requests with Elysia-like simplicity
   */
  options(pattern: string, handler: SimpleHandler): this {
    this.addRoute('options', pattern, this.createSimpleHandler(handler));
    return this;
  }

  /**
   * Handle HEAD requests with Elysia-like simplicity
   */
  head(pattern: string, handler: SimpleHandler): this {
    this.addRoute('head', pattern, this.createSimpleHandler(handler));
    return this;
  }

  /**
   * Start server and return this for method chaining
   * Only works on main app (not sub-apps with prefix)
   */
  listen(port?: number, callback?: (token: false | object) => void): this {
    if (this.prefix) {
      throw new Error('Cannot call listen() on a sub-app with prefix. Use listen() on the main app.');
    }
    
    const serverPort = port || this.config.port!;
    
    this.app.listen(this.config.host!, serverPort, (token) => {
      if (token) {
        console.log(`🚀 BlitzJS running on http://${this.config.host}:${serverPort}`);
        if (callback) callback(token);
      } else {
        console.error(`❌ Failed to listen on port ${serverPort}`);
        process.exit(1);
      }
    });
    return this;
  }

  /**
   * Get the underlying uWebSockets.js app instance
   */
  getUwsApp(): TemplatedApp {
    return this.app;
  }

  /**
   * Add a route to the handler
   */
  private addRoute(method: HttpMethod, pattern: string, handler: RouteHandlerFunction): void {
    const { regex, paramNames } = this.compilePattern(pattern);
    
    this.routes.push({
      method,
      pattern,
      handler,
      regex,
      paramNames
    });
  }

  /**
   * Handle an incoming request
   */
  private async handleRequest(method: HttpMethod, res: HttpResponse, req: HttpRequest): Promise<void> {
    const url = req.getUrl();
    const query = req.getQuery();
    
    // Find matching route
    const route = this.findRoute(method, url);
    
    if (!route) {
      this.sendNotFound(res);
      return;
    }

    // Extract parameters
    const params = this.extractParams(route, url);
    const queryParams = this.parseQuery(query);

    // Create context
    const context: RouteContext = {
      req,
      res,
      params,
      query: queryParams,
      body: undefined
    };

    // Execute middleware chain and route handler
    await this.executeMiddlewares(context, async () => {
      try {
        await route.handler(context);
      } catch (error) {
        console.error('Route handler error:', error);
        if (!res.aborted) {
          res.writeStatus('500 Internal Server Error');
          res.end('Internal Server Error');
        }
      }
    });
  }

  /**
   * Execute all middlewares in order
   */
  private async executeMiddlewares(context: RouteContext, finalHandler: () => Promise<void>): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= this.middlewares.length) {
        return finalHandler();
      }

      const middleware = this.middlewares[index++];
      try {
        await middleware(context, next);
      } catch (error) {
        console.error('Middleware error:', error);
        if (!context.res.aborted) {
          context.res.writeStatus('500 Internal Server Error');
          context.res.end('Internal Server Error');
        }
      }
    };

    await next();
  }

  /**
   * Find a matching route for the given method and URL
   */
  private findRoute(method: HttpMethod, url: string): Route | null {
    for (const route of this.routes) {
      if (route.method === method && route.regex.test(url)) {
        return route;
      }
    }
    return null;
  }

  /**
   * Extract parameters from the URL using the route pattern
   */
  private extractParams(route: Route, url: string): Record<string, string> {
    const params: Record<string, string> = {};
    const matches = url.match(route.regex);
    
    if (matches) {
      route.paramNames.forEach((name, index) => {
        params[name] = matches[index + 1] || '';
      });
    }
    
    return params;
  }

  /**
   * Parse query string into object
   */
  private parseQuery(query: string): Record<string, string> {
    const params: Record<string, string> = {};
    
    if (!query) return params;
    
    const pairs = query.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    }
    
    return params;
  }

  /**
   * Compile a route pattern into a regex and extract parameter names
   */
  private compilePattern(pattern: string): { regex: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    
    // First extract parameters, then escape slashes
    let regexPattern = pattern
      .replace(/:([^/]+)/g, (match, paramName) => {
        paramNames.push(paramName);
        return '([^/]+)';
      })
      .replace(/\*/g, '.*')
      .replace(/\//g, '\\/');  // Escape slashes AFTER processing params
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    return { regex, paramNames };
  }

  /**
   * Send a 404 Not Found response
   */
  private sendNotFound(res: HttpResponse): void {
    if (!res.aborted) {
      res.writeStatus('404 Not Found');
      res.end('Not Found');
    }
  }

  /**
   * Setup routes on the uWebSockets.js app
   */
  private setupRoutes(): void {
    // Setup all HTTP methods with proper typing
    this.app.get('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('get', res, req);
    });
    
    this.app.post('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('post', res, req);
    });
    
    this.app.put('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('put', res, req);
    });
    
    this.app.del('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('delete', res, req);
    });
    
    this.app.patch('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('patch', res, req);
    });
    
    this.app.options('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('options', res, req);
    });
    
    this.app.head('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('head', res, req);
    });
  }

  /**
   * Create a route handler that supports simple responses
   */
  private createSimpleHandler(handler: SimpleHandler): RouteHandlerFunction {
    if (typeof handler === 'string' || typeof handler === 'number' || typeof handler === 'boolean' || handler === null) {
      // Simple primitive response
      return async (ctx: RouteContext) => {
        ctx.res.writeHeader('Content-Type', 'text/plain');
        ctx.res.end(String(handler));
      };
    }
    
    if (typeof handler === 'object' && handler !== null) {
      // Simple object response (JSON)
      return async (ctx: RouteContext) => {
        ctx.res.writeHeader('Content-Type', 'application/json');
        ctx.res.end(JSON.stringify(handler));
      };
    }
    
    if (typeof handler === 'function') {
      // Function handler with return value support
      return async (ctx: RouteContext) => {
        try {
          const result = await (handler as SimpleHandlerFunction)(ctx);
          
          if (result !== undefined) {
            // Auto-handle return values
            if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean' || result === null) {
              ctx.res.writeHeader('Content-Type', 'text/plain');
              ctx.res.end(String(result));
            } else if (typeof result === 'object') {
              ctx.res.writeHeader('Content-Type', 'application/json');
              ctx.res.end(JSON.stringify(result));
            }
          }
        } catch (error) {
          console.error('Handler error:', error);
          if (!ctx.res.aborted) {
            ctx.res.writeStatus('500 Internal Server Error');
            ctx.res.writeHeader('Content-Type', 'application/json');
            ctx.res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
        }
      };
    }

    // Fallback
    return async (ctx: RouteContext) => {
      ctx.res.writeStatus('500 Internal Server Error');
      ctx.res.writeHeader('Content-Type', 'application/json');
      ctx.res.end(JSON.stringify({ error: 'Invalid handler' }));
    };
  }

  /**
   * Static file helper (like Elysia's file())
   */
  static file(path: string): RouteHandlerFunction {
    return async (ctx) => {
      try {
        const fs = require('fs');
        const mimeType = BlitzJS.getMimeType(path);
        
        if (!fs.existsSync(path)) {
          ctx.res.writeStatus('404 Not Found');
          ctx.res.end('File not found');
          return;
        }

        const stats = fs.statSync(path);
        const fileContent = fs.readFileSync(path);
        
        ctx.res.writeHeader('Content-Type', mimeType);
        ctx.res.writeHeader('Content-Length', stats.size.toString());
        ctx.res.end(fileContent);
      } catch (error) {
        ctx.res.writeStatus('500 Internal Server Error');
        ctx.res.end('Error reading file');
      }
    };
  }

  /**
   * Get MIME type from file extension
   */
  private static getMimeType(filepath: string): string {
    const ext = filepath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'pdf': 'application/pdf',
      'txt': 'text/plain'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

/**
 * Create a new BlitzJS instance (Elysia-like factory)
 */
export function Blitz(config?: BlitzConfig): BlitzJS {
  return new BlitzJS(config);
}
