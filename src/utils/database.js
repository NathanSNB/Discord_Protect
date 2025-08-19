const fs = require('fs-extra');
const path = require('path');

const configPath = path.join(__dirname, '../../config.json');
const dataDir = path.join(__dirname, '../../data');
const logsDir = path.join(__dirname, '../../logs');

// Ensure directories exist
fs.ensureDirSync(dataDir);
fs.ensureDirSync(logsDir);

// Logger class
class Logger {
    constructor() {
        this.logFile = path.join(logsDir, `bot-${new Date().toISOString().split('T')[0]}.log`);
    }

    log(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message} ${args.length ? JSON.stringify(args) : ''}`;
        
        console.log(logMessage);
        
        try {
            fs.appendFileSync(this.logFile, logMessage + '\n');
        } catch (error) {
            console.error('Erreur lors de l\'écriture du fichier de log:', error);
        }
    }

    info(message, ...args) {
        this.log('info', message, ...args);
    }

    warn(message, ...args) {
        this.log('warn', message, ...args);
    }

    error(message, ...args) {
        this.log('error', message, ...args);
    }

    debug(message, ...args) {
        this.log('debug', message, ...args);
    }
}

const logger = new Logger();

// Load main bot configuration
function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } else {
            // Copy example config if config doesn't exist
            const examplePath = path.join(__dirname, '../../config.example.json');
            if (fs.existsSync(examplePath)) {
                fs.copyFileSync(examplePath, configPath);
                logger.warn('Configuration copiée depuis config.example.json - Veuillez configurer votre token et ID utilisateur');
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            throw new Error('Aucun fichier de configuration trouvé');
        }
    } catch (error) {
        logger.error('Erreur lors du chargement de la configuration:', error);
        throw error;
    }
}

// Save guild-specific configuration
async function saveConfig(guildId, data) {
    try {
        const filePath = path.join(dataDir, `${guildId}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error(`Erreur lors de la sauvegarde de la configuration pour ${guildId}:`, error);
        throw error;
    }
}

// Load guild-specific configuration
async function loadGuildConfig(guildId) {
    try {
        const filePath = path.join(dataDir, `${guildId}.json`);
        if (await fs.exists(filePath)) {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        logger.error(`Erreur lors du chargement de la configuration pour ${guildId}:`, error);
        return null;
    }
}

// Initialize guild data with default settings
async function initializeGuildData(guildId) {
    const config = loadConfig();
    
    let guildData = await loadGuildConfig(guildId);
    
    if (!guildData) {
        guildData = {
            guildId,
            modules: { ...config.defaultSettings.modules },
            protectedRoles: [...config.defaultSettings.protectedRoles],
            lockedChannels: [...config.defaultSettings.lockedChannels],
            antiMoveSettings: { ...config.defaultSettings.antiMoveSettings },
            wakeupSettings: { ...config.defaultSettings.wakeupSettings },
            notifications: { ...config.defaultSettings.notifications },
            logs: [],
            privateVoiceChannels: {},
            chainedUsers: {},
            antiMoveAttempts: {},
            lastUpdated: Date.now()
        };
        
        await saveConfig(guildId, guildData);
        logger.info(`Configuration initialisée pour le serveur ${guildId}`);
    } else {
        // Ensure all required properties exist (migration support)
        guildData.modules = { ...config.defaultSettings.modules, ...guildData.modules };
        guildData.antiMoveSettings = { ...config.defaultSettings.antiMoveSettings, ...guildData.antiMoveSettings };
        guildData.wakeupSettings = { ...config.defaultSettings.wakeupSettings, ...guildData.wakeupSettings };
        guildData.notifications = { ...config.defaultSettings.notifications, ...guildData.notifications };
        
        if (!guildData.logs) guildData.logs = [];
        if (!guildData.privateVoiceChannels) guildData.privateVoiceChannels = {};
        if (!guildData.chainedUsers) guildData.chainedUsers = {};
        if (!guildData.antiMoveAttempts) guildData.antiMoveAttempts = {};
        
        guildData.lastUpdated = Date.now();
        await saveConfig(guildId, guildData);
    }
    
    return guildData;
}

// Clean old log files (keep last 7 days)
function cleanOldLogs() {
    try {
        const files = fs.readdirSync(logsDir);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        
        files.forEach(file => {
            if (file.startsWith('bot-') && file.endsWith('.log')) {
                const filePath = path.join(logsDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    logger.info(`Ancien fichier de log supprimé: ${file}`);
                }
            }
        });
    } catch (error) {
        logger.error('Erreur lors du nettoyage des logs:', error);
    }
}

// Auto-cleanup logs every 24 hours
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

// Export guild configurations for backup
async function exportAllGuildConfigs() {
    try {
        const files = await fs.readdir(dataDir);
        const configs = {};
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const guildId = file.replace('.json', '');
                configs[guildId] = await loadGuildConfig(guildId);
            }
        }
        
        const exportPath = path.join(logsDir, `export-${Date.now()}.json`);
        await fs.writeFile(exportPath, JSON.stringify(configs, null, 2));
        return exportPath;
    } catch (error) {
        logger.error('Erreur lors de l\'export des configurations:', error);
        throw error;
    }
}

module.exports = {
    logger,
    loadConfig,
    saveConfig,
    loadGuildConfig,
    initializeGuildData,
    exportAllGuildConfigs
};