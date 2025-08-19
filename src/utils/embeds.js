const { EmbedBuilder } = require('discord.js');

// Color constants for different types of embeds
const COLORS = {
    SUCCESS: 0x00FF00,
    ERROR: 0xFF0000,
    WARNING: 0xFFA500,
    INFO: 0x0099FF,
    PROTECTION: 0xFF6B6B,
    VOICE: 0x9B59B6,
    CONFIG: 0x3498DB,
    LOGS: 0x95A5A6,
    DASHBOARD: 0x2ECC71
};

// Create standardized embeds with consistent styling
function createEmbed(type, title, description, fields = [], footer = null) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(COLORS[type.toUpperCase()] || COLORS.INFO)
        .setTimestamp();

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    if (footer) {
        embed.setFooter({ text: footer });
    }

    return embed;
}

// Create success embed
function createSuccessEmbed(title, description, fields = []) {
    return createEmbed('SUCCESS', `✅ ${title}`, description, fields, 'Opération réussie');
}

// Create error embed
function createErrorEmbed(title, description, fields = []) {
    return createEmbed('ERROR', `❌ ${title}`, description, fields, 'Une erreur s\'est produite');
}

// Create warning embed
function createWarningEmbed(title, description, fields = []) {
    return createEmbed('WARNING', `⚠️ ${title}`, description, fields, 'Attention requise');
}

// Create info embed
function createInfoEmbed(title, description, fields = []) {
    return createEmbed('INFO', `ℹ️ ${title}`, description, fields);
}

// Create protection alert embed
function createProtectionEmbed(title, description, fields = []) {
    return createEmbed('PROTECTION', `🛡️ ${title}`, description, fields, 'Protection activée');
}

// Create voice management embed
function createVoiceEmbed(title, description, fields = []) {
    return createEmbed('VOICE', `🎤 ${title}`, description, fields, 'Gestion vocale');
}

// Create configuration embed
function createConfigEmbed(title, description, fields = []) {
    return createEmbed('CONFIG', `⚙️ ${title}`, description, fields, 'Configuration');
}

// Create logs embed
function createLogsEmbed(title, description, fields = []) {
    return createEmbed('LOGS', `📝 ${title}`, description, fields, 'Journaux d\'activité');
}

// Create dashboard embed
function createDashboardEmbed(title, description, fields = []) {
    return createEmbed('DASHBOARD', `📊 ${title}`, description, fields, 'Tableau de bord');
}

// Format time duration to human readable string
function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}j ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// Format time ago (relative time)
function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
    if (hours > 0) return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `il y a ${seconds} seconde${seconds > 1 ? 's' : ''}`;
}

// Create a progress bar for dashboard
function createProgressBar(current, max, length = 10) {
    const percentage = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(percentage * length);
    const empty = length - filled;
    
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// Format bytes to human readable
function formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Truncate text to fit embed field limits
function truncateText(text, maxLength = 1024) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// Create module status indicator
function getModuleStatus(isActive) {
    return isActive ? '🟢 Activé' : '🔴 Désactivé';
}

// Create protection status for dashboard
function createProtectionStatus(modules) {
    const statusText = Object.entries(modules).map(([key, value]) => {
        const names = {
            antiMute: 'Anti-Mute',
            antiTimeout: 'Anti-Timeout',
            antiRole: 'Anti-Rôle',
            antiKickBan: 'Anti-Kick/Ban',
            antiRename: 'Anti-Rename',
            antiPermissions: 'Anti-Permissions',
            lockName: 'Verrouillage Nom',
            privateVoice: 'Vocal Privé',
            antiMove: 'Anti-Move',
            chainSystem: 'Système Chaîne',
            wakeupSystem: 'Réveil',
            antiPing: 'Anti-Ping'
        };
        return `${names[key] || key}: ${getModuleStatus(value)}`;
    }).join('\n');

    return truncateText(statusText);
}

module.exports = {
    COLORS,
    createEmbed,
    createSuccessEmbed,
    createErrorEmbed,
    createWarningEmbed,
    createInfoEmbed,
    createProtectionEmbed,
    createVoiceEmbed,
    createConfigEmbed,
    createLogsEmbed,
    createDashboardEmbed,
    formatDuration,
    formatTimeAgo,
    createProgressBar,
    formatBytes,
    truncateText,
    getModuleStatus,
    createProtectionStatus
};