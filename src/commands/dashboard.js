const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType
} = require('discord.js');
const { createDashboardEmbed, formatDuration, formatBytes, createProgressBar } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'dashboard',
        description: 'Tableau de bord en temps réel avec métriques avancées'
    },
    async execute(message, args, bot) {
        const guildData = await bot.getGuildData(message.guild.id);
        
        try {
            const dashboardEmbed = await createDashboard(bot, message.guild, guildData);
            const components = createDashboardComponents();
            
            const dashboardMessage = await message.channel.send({
                embeds: [dashboardEmbed],
                components: components
            });
            
            // Create collector for refresh button
            const collector = dashboardMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 600000 // 10 minutes
            });
            
            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== bot.config.authorizedUserId) {
                    await interaction.reply({ content: '❌ Seul l\'utilisateur autorisé peut utiliser ce tableau de bord.', ephemeral: true });
                    return;
                }
                
                if (interaction.customId === 'dashboard_refresh') {
                    const updatedEmbed = await createDashboard(bot, message.guild, guildData);
                    await interaction.update({ embeds: [updatedEmbed] });
                } else if (interaction.customId === 'dashboard_config') {
                    await interaction.reply({ content: '⚙️ Utilisez `=setup` pour accéder à la configuration complète.', ephemeral: true });
                } else if (interaction.customId === 'dashboard_logs') {
                    await interaction.reply({ content: '📝 Utilisez `=log` pour voir les journaux détaillés.', ephemeral: true });
                } else if (interaction.customId === 'dashboard_close') {
                    await dashboardMessage.delete();
                    collector.stop();
                }
            });
            
            collector.on('end', async () => {
                try {
                    const disabledComponents = createDashboardComponents(true);
                    await dashboardMessage.edit({ components: disabledComponents });
                } catch (error) {
                    // Message might be deleted
                }
            });
            
        } catch (error) {
            console.error('Erreur lors de la création du dashboard:', error);
            await message.channel.send('❌ Une erreur est survenue lors de la génération du tableau de bord.');
        }
    }
};

async function createDashboard(bot, guild, guildData) {
    const systemStats = getSystemStats(bot);
    const moduleStats = getModuleStats(guildData);
    const activityStats = getActivityStats(guildData);
    const recentActivity = getRecentActivity(guildData);
    
    const embed = createDashboardEmbed(
        'Tableau de Bord Discord Protect',
        `🏠 **${guild.name}** • Surveillance en temps réel`,
        [
            {
                name: '📊 **Statut Système**',
                value: [
                    `⏱️ Uptime: ${formatDuration(systemStats.uptime)}`,
                    `🖥️ Mémoire: ${systemStats.memory}`,
                    `📡 Ping: ${systemStats.ping}ms`,
                    `🌐 Serveurs: ${systemStats.guilds}`
                ].join('\n'),
                inline: true
            },
            {
                name: '🛡️ **Modules de Protection**',
                value: [
                    `${getModuleIcon('antiMute')} Anti-Mute: ${getStatusText(guildData.modules.antiMute)}`,
                    `${getModuleIcon('antiTimeout')} Anti-Timeout: ${getStatusText(guildData.modules.antiTimeout)}`,
                    `${getModuleIcon('antiRole')} Anti-Rôle: ${getStatusText(guildData.modules.antiRole)}`,
                    `${getModuleIcon('antiKickBan')} Anti-Kick/Ban: ${getStatusText(guildData.modules.antiKickBan)}`
                ].join('\n'),
                inline: true
            },
            {
                name: '🎤 **Modules Vocaux**',
                value: [
                    `${getModuleIcon('privateVoice')} Vocal Privé: ${getStatusText(guildData.modules.privateVoice)}`,
                    `${getModuleIcon('antiMove')} Anti-Move: ${getStatusText(guildData.modules.antiMove)}`,
                    `${getModuleIcon('chainSystem')} Chaînes: ${getStatusText(guildData.modules.chainSystem)}`,
                    `${getModuleIcon('wakeupSystem')} Réveil: ${getStatusText(guildData.modules.wakeupSystem)}`
                ].join('\n'),
                inline: true
            },
            {
                name: '⚡ **Activité en Cours**',
                value: [
                    `🔒 Salons privés actifs: ${Object.keys(guildData.privateVoiceChannels || {}).length}`,
                    `⛓️ Chaînes actives: ${Object.values(guildData.chainedUsers || {}).filter(c => c.active).length}`,
                    `🔐 Salons verrouillés: ${guildData.lockedChannels?.length || 0}`,
                    `🛡️ Rôles protégés: ${guildData.protectedRoles?.length || 0}`
                ].join('\n'),
                inline: false
            },
            {
                name: '📈 **Statistiques 24h**',
                value: [
                    `🛡️ Protections: ${activityStats.protections}`,
                    `⚙️ Commandes: ${activityStats.commands}`,
                    `⚠️ Alertes: ${activityStats.alerts}`,
                    `❌ Erreurs: ${activityStats.errors}`
                ].join('\n'),
                inline: true
            },
            {
                name: '🔧 **Configuration**',
                value: [
                    `📢 Notifications DM: ${getStatusText(guildData.notifications?.dmAlerts)}`,
                    `🚨 Alertes admin: ${getStatusText(guildData.notifications?.adminRoleAlert)}`,
                    `👤 Alertes rôles: ${getStatusText(guildData.notifications?.protectedRoleAlert)}`,
                    `📝 Logs stockés: ${guildData.logs?.length || 0}`
                ].join('\n'),
                inline: true
            }
        ]
    );
    
    // Add recent activity if available
    if (recentActivity.length > 0) {
        embed.addFields([{
            name: '🔄 **Activité Récente**',
            value: recentActivity.slice(0, 5).join('\n'),
            inline: false
        }]);
    }
    
    embed.setFooter({ text: `Dernière mise à jour: ${new Date().toLocaleString('fr-FR')} • Utilisez les boutons pour interagir` });
    
    return embed;
}

function getSystemStats(bot) {
    const uptime = bot.client.uptime || 0;
    const memoryUsage = process.memoryUsage();
    const ping = bot.client.ws.ping;
    const guilds = bot.client.guilds.cache.size;
    
    return {
        uptime,
        memory: formatBytes(memoryUsage.heapUsed) + '/' + formatBytes(memoryUsage.heapTotal),
        ping,
        guilds
    };
}

function getModuleStats(guildData) {
    const modules = guildData.modules || {};
    const activeModules = Object.values(modules).filter(Boolean).length;
    const totalModules = Object.keys(modules).length;
    
    return {
        active: activeModules,
        total: totalModules,
        percentage: totalModules > 0 ? Math.round((activeModules / totalModules) * 100) : 0
    };
}

function getActivityStats(guildData) {
    const logs = guildData.logs || [];
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(log => log.timestamp > last24h);
    
    const stats = {
        protections: 0,
        commands: 0,
        alerts: 0,
        errors: 0
    };
    
    for (const log of recentLogs) {
        switch (log.type) {
            case 'antiMute':
            case 'antiTimeout':
            case 'antiRole':
            case 'antiKickBan':
            case 'antiRename':
            case 'antiPermissions':
            case 'antiMove':
            case 'lockName':
                stats.protections++;
                break;
            case 'command':
                stats.commands++;
                break;
            case 'alert':
                stats.alerts++;
                break;
            case 'error':
                stats.errors++;
                break;
        }
    }
    
    return stats;
}

function getRecentActivity(guildData) {
    const logs = guildData.logs || [];
    const recent = logs.slice(0, 10);
    
    return recent.map(log => {
        const timeAgo = formatTimeAgo(log.timestamp);
        const type = getLogTypeIcon(log.type);
        const description = getLogDescription(log);
        
        return `${type} ${description} • ${timeAgo}`;
    });
}

function getLogTypeIcon(type) {
    const icons = {
        antiMute: '🔇',
        antiTimeout: '⏰',
        antiRole: '👤',
        antiKickBan: '🚫',
        antiRename: '📝',
        antiPermissions: '🛡️',
        antiMove: '🚫',
        privateVoice: '🎤',
        chainSystem: '⛓️',
        lockName: '🔒',
        command: '⚙️',
        alert: '⚠️',
        error: '❌'
    };
    
    return icons[type] || '📋';
}

function getLogDescription(log) {
    const details = log.details || {};
    
    switch (log.type) {
        case 'antiMute':
            return `Protection anti-${details.type || 'mute'}`;
        case 'antiTimeout':
            return 'Timeout supprimé';
        case 'antiRole':
            return `Rôle ${details.role} restauré`;
        case 'antiKickBan':
            return `Protection anti-${details.type}`;
        case 'antiRename':
            return 'Pseudonyme restauré';
        case 'antiPermissions':
            return `Permissions ${details.role} restaurées`;
        case 'antiMove':
            return 'Déplacement annulé';
        case 'privateVoice':
            return 'Salon privé - Expulsion';
        case 'chainSystem':
            return 'Chaîne - Suivi';
        case 'lockName':
            return `Nom salon restauré`;
        case 'command':
            return `Commande ${details.command}`;
        default:
            return 'Activité';
    }
}

function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}j`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'maintenant';
}

function getModuleIcon(moduleId) {
    const icons = {
        antiMute: '🔇',
        antiTimeout: '⏰',
        antiRole: '👤',
        antiKickBan: '🚫',
        antiRename: '📝',
        antiPermissions: '🛡️',
        lockName: '🔒',
        privateVoice: '🎤',
        antiMove: '🚫',
        chainSystem: '⛓️',
        wakeupSystem: '⏰',
        antiPing: '📵'
    };
    
    return icons[moduleId] || '⚙️';
}

function getStatusText(status) {
    return status ? '🟢 ON' : '🔴 OFF';
}

function createDashboardComponents(disabled = false) {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('dashboard_refresh')
                .setLabel('Actualiser')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId('dashboard_config')
                .setLabel('Configuration')
                .setEmoji('⚙️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId('dashboard_logs')
                .setLabel('Journaux')
                .setEmoji('📝')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId('dashboard_close')
                .setLabel('Fermer')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(disabled)
        );
    
    return [row1];
}