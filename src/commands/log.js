const { createLogsEmbed, formatTimeAgo, truncateText } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'log',
        description: 'Affiche les journaux d\'activité récents (1-20 entrées)'
    },
    async execute(message, args, bot) {
        const guildData = await bot.getGuildData(message.guild.id);
        const logs = guildData.logs || [];
        
        // Parse arguments
        let count = 10; // Default
        let filter = null;
        
        // Parse number of entries
        if (args[0] && !isNaN(parseInt(args[0]))) {
            count = Math.max(1, Math.min(20, parseInt(args[0])));
        }
        
        // Parse filter type
        if (args[1]) {
            const validFilters = ['protection', 'voice', 'command', 'alert', 'error', 'all'];
            if (validFilters.includes(args[1].toLowerCase())) {
                filter = args[1].toLowerCase();
            }
        }
        
        // Filter logs based on type
        let filteredLogs = logs;
        if (filter && filter !== 'all') {
            filteredLogs = logs.filter(log => getLogCategory(log.type) === filter);
        }
        
        if (filteredLogs.length === 0) {
            const embed = createLogsEmbed(
                'Aucun Journal Trouvé',
                filter ? `Aucune entrée trouvée pour le filtre: **${filter}**` : 'Aucune activité enregistrée.',
                [
                    { 
                        name: 'Filtres disponibles', 
                        value: '`protection`, `voice`, `command`, `alert`, `error`, `all`',
                        inline: false 
                    },
                    {
                        name: 'Utilisation',
                        value: '`=log [nombre] [filtre]`\nExemple: `=log 15 protection`',
                        inline: false
                    }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        // Get requested number of entries
        const logsToShow = filteredLogs.slice(0, count);
        
        // Create log entries
        const logEntries = logsToShow.map((log, index) => {
            const timeAgo = formatTimeAgo(log.timestamp);
            const icon = getLogIcon(log.type);
            const description = getLogDescription(log);
            const details = getLogDetails(log);
            
            return `**${index + 1}.** ${icon} ${description}\n   ${details} • *${timeAgo}*`;
        });
        
        // Split into multiple embeds if too long
        const maxLength = 4000;
        const embeds = [];
        let currentContent = '';
        let currentIndex = 0;
        
        for (const entry of logEntries) {
            if (currentContent.length + entry.length > maxLength) {
                // Create embed with current content
                const embed = createLogsEmbed(
                    `📝 Journaux d'Activité ${embeds.length > 0 ? `(${embeds.length + 1})` : ''}`,
                    currentContent,
                    embeds.length === 0 ? [
                        {
                            name: 'Informations',
                            value: [
                                `📊 Total affiché: **${logsToShow.length}** / ${filteredLogs.length}`,
                                `🔍 Filtre: **${filter || 'Tous'}**`,
                                `⏱️ Période: Dernières activités`
                            ].join('\n'),
                            inline: false
                        }
                    ] : []
                );
                
                embeds.push(embed);
                currentContent = entry;
            } else {
                currentContent += (currentContent ? '\n\n' : '') + entry;
            }
        }
        
        // Add remaining content
        if (currentContent) {
            const embed = createLogsEmbed(
                `📝 Journaux d'Activité ${embeds.length > 0 ? `(${embeds.length + 1})` : ''}`,
                currentContent,
                embeds.length === 0 ? [
                    {
                        name: 'Informations',
                        value: [
                            `📊 Total affiché: **${logsToShow.length}** / ${filteredLogs.length}`,
                            `🔍 Filtre: **${filter || 'Tous'}**`,
                            `⏱️ Période: Dernières activités`
                        ].join('\n'),
                        inline: false
                    }
                ] : []
            );
            embeds.push(embed);
        }
        
        // Send embeds
        for (const embed of embeds) {
            await message.channel.send({ embeds: [embed] });
        }
    }
};

function getLogCategory(type) {
    const categories = {
        // Protection category
        'antiMute': 'protection',
        'antiTimeout': 'protection',
        'antiRole': 'protection',
        'antiKickBan': 'protection',
        'antiRename': 'protection',
        'antiPermissions': 'protection',
        'lockName': 'protection',
        'antiMove': 'protection',
        'antiPing': 'protection',
        
        // Voice category
        'privateVoice': 'voice',
        'chainSystem': 'voice',
        'wakeupSystem': 'voice',
        
        // Command category
        'command': 'command',
        
        // Alert category
        'alert': 'alert',
        'memberRejoin': 'alert',
        
        // Error category
        'error': 'error'
    };
    
    return categories[type] || 'other';
}

function getLogIcon(type) {
    const icons = {
        'antiMute': '🔇',
        'antiTimeout': '⏰',
        'antiRole': '👤',
        'antiKickBan': '🚫',
        'antiRename': '📝',
        'antiPermissions': '🛡️',
        'lockName': '🔒',
        'antiMove': '🚫',
        'antiPing': '📵',
        'privateVoice': '🎤',
        'chainSystem': '⛓️',
        'wakeupSystem': '⏰',
        'command': '⚙️',
        'alert': '⚠️',
        'error': '❌',
        'memberRejoin': '🔄'
    };
    
    return icons[type] || '📋';
}

function getLogDescription(log) {
    const details = log.details || {};
    
    switch (log.type) {
        case 'antiMute':
            return `**Protection Anti-Mute** - ${details.type === 'undeafen' ? 'Retrait sourdine' : 'Démutage'}`;
            
        case 'antiTimeout':
            return `**Protection Anti-Timeout** - Timeout supprimé`;
            
        case 'antiRole':
            return `**Protection Anti-Rôle** - Rôle restauré: ${details.role}`;
            
        case 'antiKickBan':
            return `**Protection Anti-${details.type.charAt(0).toUpperCase() + details.type.slice(1)}** - Action détectée`;
            
        case 'antiRename':
            return `**Protection Anti-Rename** - Pseudonyme restauré`;
            
        case 'antiPermissions':
            return details.type === 'roleRecreated' 
                ? `**Protection Anti-Permissions** - Rôle recréé: ${details.roleName}`
                : `**Protection Anti-Permissions** - Permissions restaurées: ${details.role}`;
            
        case 'lockName':
            return `**Protection Nom Salon** - Nom restauré: #${details.originalName}`;
            
        case 'antiMove':
            return details.type === 'punishment'
                ? `**Anti-Move** - Sanction appliquée à ${details.target}`
                : `**Protection Anti-Move** - Retour forcé`;
            
        case 'antiPing':
            return `**Anti-Ping** - Message supprimé de ${details.user}`;
            
        case 'privateVoice':
            return details.type === 'kick'
                ? `**Salon Privé** - ${details.user} expulsé`
                : `**Salon Privé** - Configuration modifiée`;
            
        case 'chainSystem':
            return `**Système Chaîne** - ${details.chainedUser} déplacé vers ${details.channel}`;
            
        case 'wakeupSystem':
            return `**Système Réveil** - ${details.target} déplacé (${details.moveNumber}/${details.totalMoves})`;
            
        case 'command':
            return `**Commande** - ${details.command} utilisée`;
            
        case 'memberRejoin':
            return `**Retour Détecté** - Configuration restaurée`;
            
        case 'alert':
            return `**Alerte** - ${details.message || 'Alerte système'}`;
            
        case 'error':
            return `**Erreur** - ${details.error || 'Erreur système'}`;
            
        default:
            return `**${log.type}** - Activité enregistrée`;
    }
}

function getLogDetails(log) {
    const details = log.details || {};
    const detailParts = [];
    
    // Add user information
    if (details.user) {
        detailParts.push(`👤 ${details.user}`);
    }
    
    // Add channel information
    if (details.channel) {
        detailParts.push(`📍 #${details.channel}`);
    }
    
    // Add moderator information
    if (details.moderator && details.moderator !== 'Inconnu') {
        detailParts.push(`👮 ${details.moderator}`);
    }
    
    // Add specific details based on type
    switch (log.type) {
        case 'antiMove':
            if (details.attempts) {
                detailParts.push(`🔢 ${details.attempts}/${details.maxAttempts || 3} tentatives`);
            }
            break;
            
        case 'antiTimeout':
            if (details.originalDuration) {
                const duration = new Date(details.originalDuration);
                detailParts.push(`⏱️ Durée prévue: ${duration.toLocaleString('fr-FR')}`);
            }
            break;
            
        case 'antiKickBan':
            if (details.inviteCreated) {
                detailParts.push(`🔗 Invitation créée`);
            }
            if (details.unbanned) {
                detailParts.push(`✅ Débannissement tenté`);
            }
            break;
            
        case 'wakeupSystem':
            if (details.moveNumber && details.totalMoves) {
                detailParts.push(`📊 ${details.moveNumber}/${details.totalMoves} mouvements`);
            }
            break;
            
        case 'privateVoice':
            if (details.reason) {
                detailParts.push(`📋 ${details.reason}`);
            }
            break;
    }
    
    return detailParts.join(' • ') || 'Aucun détail supplémentaire';
}