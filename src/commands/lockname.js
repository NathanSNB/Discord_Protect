const { createSuccessEmbed, createErrorEmbed, createWarningEmbed, createInfoEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'lockname',
        description: 'Verrouillage/déverrouillage du nom d\'un salon'
    },
    async execute(message, args, bot) {
        const guildData = await bot.getGuildData(message.guild.id);
        
        let targetChannel = null;
        let action = 'toggle'; // Default action
        
        // Parse arguments
        if (args.length === 0) {
            // Lock current channel if in text channel
            targetChannel = message.channel;
        } else if (args.length === 1) {
            // Check if it's a channel mention or action
            const channelMention = message.mentions.channels.first();
            if (channelMention) {
                targetChannel = channelMention;
            } else if (['lock', 'unlock'].includes(args[0].toLowerCase())) {
                targetChannel = message.channel;
                action = args[0].toLowerCase();
            } else {
                const embed = createErrorEmbed(
                    'Argument Invalide',
                    'Usage: `=lockname` ou `=lockname #salon` ou `=lockname lock/unlock`'
                );
                await message.channel.send({ embeds: [embed] });
                return;
            }
        } else if (args.length === 2) {
            // Channel and action specified
            const channelMention = message.mentions.channels.first();
            if (channelMention && ['lock', 'unlock'].includes(args[1].toLowerCase())) {
                targetChannel = channelMention;
                action = args[1].toLowerCase();
            } else {
                const embed = createErrorEmbed(
                    'Arguments Invalides',
                    'Usage: `=lockname #salon lock/unlock`'
                );
                await message.channel.send({ embeds: [embed] });
                return;
            }
        } else {
            const embed = createInfoEmbed(
                'Usage de la Commande',
                'Commande de verrouillage des noms de salons',
                [
                    {
                        name: '📝 **Syntaxes Disponibles**',
                        value: [
                            '`=lockname` - Verrouiller/déverrouiller le salon actuel',
                            '`=lockname #salon` - Verrouiller/déverrouiller un salon spécifique',
                            '`=lockname lock` - Verrouiller le salon actuel',
                            '`=lockname unlock` - Déverrouiller le salon actuel',
                            '`=lockname #salon lock` - Verrouiller un salon spécifique',
                            '`=lockname #salon unlock` - Déverrouiller un salon spécifique'
                        ].join('\n'),
                        inline: false
                    }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        if (!targetChannel) {
            const embed = createErrorEmbed(
                'Salon Introuvable',
                'Impossible de trouver le salon à verrouiller.'
            );
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        try {
            // Check if channel is currently locked
            const lockedChannels = guildData.lockedChannels || [];
            const existingLock = lockedChannels.find(lock => lock.channelId === targetChannel.id);
            
            if (action === 'toggle') {
                action = existingLock ? 'unlock' : 'lock';
            }
            
            if (action === 'lock') {
                if (existingLock) {
                    const embed = createWarningEmbed(
                        'Salon Déjà Verrouillé',
                        `Le salon ${targetChannel} est déjà verrouillé.`,
                        [
                            { name: 'Nom protégé', value: existingLock.originalName, inline: true },
                            { name: 'Verrouillé le', value: new Date(existingLock.lockedAt).toLocaleString('fr-FR'), inline: true }
                        ]
                    );
                    
                    await message.channel.send({ embeds: [embed] });
                    return;
                }
                
                // Add to locked channels
                const lockData = {
                    channelId: targetChannel.id,
                    channelName: targetChannel.name,
                    originalName: targetChannel.name,
                    lockedAt: Date.now(),
                    lockedBy: message.author.id
                };
                
                lockedChannels.push(lockData);
                guildData.lockedChannels = lockedChannels;
                
                await bot.guildData.set(message.guild.id, guildData);
                await require('../utils/database').saveConfig(message.guild.id, guildData);
                
                await bot.logAction(message.guild.id, 'lockName', {
                    type: 'locked',
                    channel: targetChannel.name,
                    channelId: targetChannel.id,
                    user: message.author.tag
                });
                
                const embed = createSuccessEmbed(
                    '🔒 Salon Verrouillé',
                    `Le nom du salon ${targetChannel} est maintenant protégé.`,
                    [
                        { name: 'Salon', value: targetChannel.toString(), inline: true },
                        { name: 'Nom protégé', value: targetChannel.name, inline: true },
                        { name: 'Statut', value: '🔒 Verrouillé', inline: true }
                    ]
                );
                
                embed.addFields([{
                    name: '🛡️ **Protection Active**',
                    value: [
                        '• Toute tentative de renommage sera annulée',
                        '• Le nom original sera restauré automatiquement',
                        '• Les actions seront loggées et vous serez notifié',
                        '• Utilisez `=lockname #salon unlock` pour déverrouiller'
                    ].join('\n'),
                    inline: false
                }]);
                
                await message.channel.send({ embeds: [embed] });
                
            } else if (action === 'unlock') {
                if (!existingLock) {
                    const embed = createWarningEmbed(
                        'Salon Non Verrouillé',
                        `Le salon ${targetChannel} n'est pas verrouillé.`
                    );
                    
                    await message.channel.send({ embeds: [embed] });
                    return;
                }
                
                // Remove from locked channels
                const lockIndex = lockedChannels.findIndex(lock => lock.channelId === targetChannel.id);
                lockedChannels.splice(lockIndex, 1);
                guildData.lockedChannels = lockedChannels;
                
                await bot.guildData.set(message.guild.id, guildData);
                await require('../utils/database').saveConfig(message.guild.id, guildData);
                
                await bot.logAction(message.guild.id, 'lockName', {
                    type: 'unlocked',
                    channel: targetChannel.name,
                    channelId: targetChannel.id,
                    user: message.author.tag,
                    wasLockedSince: existingLock.lockedAt
                });
                
                const embed = createSuccessEmbed(
                    '🔓 Salon Déverrouillé',
                    `Le nom du salon ${targetChannel} peut maintenant être modifié.`,
                    [
                        { name: 'Salon', value: targetChannel.toString(), inline: true },
                        { name: 'Était protégé', value: existingLock.originalName, inline: true },
                        { name: 'Statut', value: '🔓 Déverrouillé', inline: true },
                        { 
                            name: 'Durée du verrouillage', 
                            value: formatDuration(Date.now() - existingLock.lockedAt), 
                            inline: true 
                        }
                    ]
                );
                
                await message.channel.send({ embeds: [embed] });
            }
            
        } catch (error) {
            console.error('Erreur lors du verrouillage/déverrouillage:', error);
            
            const embed = createErrorEmbed(
                'Erreur de Verrouillage',
                'Une erreur est survenue lors de la gestion du verrouillage du salon.',
                [
                    { name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false },
                    { name: 'Vérifications', value: [
                        '• Le bot a-t-il les permissions nécessaires ?',
                        '• Le salon existe-t-il toujours ?',
                        '• Y a-t-il un problème de configuration ?'
                    ].join('\n'), inline: false }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
        }
    }
};

function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}j ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}