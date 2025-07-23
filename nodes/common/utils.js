// Common utilities for all node types
const fs = require('fs');
const path = require('path');

class Logger {
    constructor(nodeType) {
        this.nodeType = nodeType;
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${this.nodeType}] [${level}] ${message}`);
    }

    info(message) {
        this.log('INFO', message);
    }

    warn(message) {
        this.log('WARN', message);
    }

    error(message) {
        this.log('ERROR', message);
    }

    debug(message) {
        this.log('DEBUG', message);
    }
}

class Config {
    static load(configPath) {
        try {
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            return {};
        } catch (error) {
            console.error('Error loading config:', error);
            return {};
        }
    }

    static save(configPath, config) {
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }
}

class NetworkUtils {
    static async checkConnection(url, timeout = 5000) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                timeout: timeout
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    static async waitForService(url, maxRetries = 30, delay = 2000) {
        for (let i = 0; i < maxRetries; i++) {
            if (await this.checkConnection(url)) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        return false;
    }
}

module.exports = {
    Logger,
    Config,
    NetworkUtils
};