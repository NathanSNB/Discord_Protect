const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

// Import utilities
const { loadConfig, saveConfig, initializeGuildData, logger } = require('./utils/database');
const { checkPermissions } = require('./utils/permissions');
const { createEmbed } = require('./utils/embeds');

class DiscordProtectBot {
    constructor() {
        // Initialize client with required intents
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.DirectMessages
            ]
        });

        // Initialize collections
        this.commands = new Collection();
        this.cooldowns = new Collection();
        this.guildData = new Collection();
        this.protectionFlags = new Collection();
        
        // Load configuration
        this.config = loadConfig();
        
        // Initialize bot
        this.init();
    }

    async init() {
        try {
            // Load commands
            await this.loadCommands();
            
            // Load events
            await this.loadEvents();
            
            // Setup error handling
            this.setupErrorHandling();
            
            // Login to Discord
            await this.client.login(this.config.token);
            
        } catch (error) {
            logger.error('Erreur lors de l\'initialisation du bot:', error);
            process.exit(1);
        }
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                this.commands.set(command.data.name, command);
                logger.info(`Commande chargée: ${command.data.name}`);
            } else {
                logger.warn(`Commande malformée dans ${filePath}`);
            }
        }
    }

    async loadEvents() {
        const eventsPath = path.join(__dirname, 'events');
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);
            
            if (event.once) {
                this.client.once(event.name, (...args) => event.execute(...args, this));
            } else {
                this.client.on(event.name, (...args) => event.execute(...args, this));
            }
            logger.info(`Événement chargé: ${event.name}`);
        }
    }

    setupErrorHandling() {
        // Handle client errors
        this.client.on('error', error => {
            logger.error('Erreur Discord.js:', error);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', error => {
            logger.error('Promesse rejetée non gérée:', error);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', error => {
            logger.error('Exception non capturée:', error);
            process.exit(1);
        });
    }

    // Utility methods for protection modules
    isProtectionActive(guildId, moduleName) {
        const data = this.guildData.get(guildId);
        return data?.modules?.[moduleName] || false;
    }

    async logAction(guildId, type, details) {
        try {
            const data = this.guildData.get(guildId) || {};
            if (!data.logs) data.logs = [];
            
            const logEntry = {
                timestamp: Date.now(),
                type,
                details,
                id: Date.now().toString()
            };
            
            data.logs.unshift(logEntry);
            
            // Limit log entries
            if (data.logs.length > this.config.maxLogEntries) {
                data.logs = data.logs.slice(0, this.config.maxLogEntries);
            }
            
            this.guildData.set(guildId, data);
            await saveConfig(guildId, data);
            
        } catch (error) {
            logger.error('Erreur lors de l\'enregistrement du log:', error);
        }
    }

    async notifyUser(message, embed = null) {
        if (!this.config.dmNotifications) return;
        
        try {
            const user = await this.client.users.fetch(this.config.authorizedUserId);
            if (embed) {
                await user.send({ embeds: [embed] });
            } else {
                await user.send(message);
            }
        } catch (error) {
            logger.error('Erreur lors de l\'envoi de notification:', error);
        }
    }

    // Get guild data with initialization
    async getGuildData(guildId) {
        if (!this.guildData.has(guildId)) {
            const data = await initializeGuildData(guildId);
            this.guildData.set(guildId, data);
        }
        return this.guildData.get(guildId);
    }
}

// Initialize and start bot
const bot = new DiscordProtectBot();

module.exports = { DiscordProtectBot };