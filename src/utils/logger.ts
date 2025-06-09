import fs from 'fs';
import path from 'path';

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

export class Logger {
    private logDir: string;
    private logFile: string;

    constructor(logDir: string = 'logs') {
        this.logDir = logDir;
        this.logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
        this.ensureLogDirectory();
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    private formatMessage(level: LogLevel, message: string, meta?: any): string {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
    }

    private writeToFile(formattedMessage: string): void {
        fs.appendFileSync(this.logFile, formattedMessage);
    }

    debug(message: string, meta?: any): void {
        const formattedMessage = this.formatMessage(LogLevel.DEBUG, message, meta);
        console.log(formattedMessage.trim());
        this.writeToFile(formattedMessage);
    }

    info(message: string, meta?: any): void {
        const formattedMessage = this.formatMessage(LogLevel.INFO, message, meta);
        console.log(formattedMessage.trim());
        this.writeToFile(formattedMessage);
    }

    warn(message: string, meta?: any): void {
        const formattedMessage = this.formatMessage(LogLevel.WARN, message, meta);
        console.warn(formattedMessage.trim());
        this.writeToFile(formattedMessage);
    }

    error(message: string, meta?: any): void {
        const formattedMessage = this.formatMessage(LogLevel.ERROR, message, meta);
        console.error(formattedMessage.trim());
        this.writeToFile(formattedMessage);
    }
}
