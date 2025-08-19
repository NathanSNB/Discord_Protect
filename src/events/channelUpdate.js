const { Events } = require('discord.js');
const { logger } = require('../utils/database');
const { createProtectionEmbed } = require('../utils/embeds');

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel, bot) {
        const guildData = await bot.getGuildData(newChannel.guild.id);
        
        if (!guildData.modules.lockName) return;
        
        // Check if this channel is locked
        const lockedChannels = guildData.lockedChannels || [];
        const lockedChannel = lockedChannels.find(locked => locked.channelId === newChannel.id);
        
        if (!lockedChannel) return;
        
        // Check if name was changed
        if (oldChannel.name !== newChannel.name) {
            // Check if bot performed the action (avoid infinite loops)
            const flagKey = `lockName_${newChannel.guild.id}_${newChannel.id}`;
            if (bot.protectionFlags.has(flagKey)) {
                bot.protectionFlags.delete(flagKey);
                return;
            }
            
            try {
                bot.protectionFlags.set(flagKey, true);
                await newChannel.setName(lockedChannel.originalName, 'Protection du nom de salon activée');
                
                // Find who changed the channel name
                let moderator = null;
                try {
                    const auditLogs = await newChannel.guild.fetchAuditLogs({
                        type: 11, // CHANNEL_UPDATE
                        limit: 5
                    });
                    
                    const channelLog = auditLogs.entries.find(entry => 
                        entry.target.id === newChannel.id &&
                        entry.changes.some(change => change.key === 'name') &&
                        Date.now() - entry.createdTimestamp < 10000
                    );
                    
                    if (channelLog) {
                        moderator = channelLog.executor;
                    }
                } catch (error) {
                    logger.debug('Impossible de récupérer les logs d\'audit pour lockname');
                }
                
                await bot.logAction(newChannel.guild.id, 'lockName', {
                    type: 'nameRestored',
                    channel: newChannel.name,
                    channelId: newChannel.id,
                    originalName: lockedChannel.originalName,
                    attemptedName: newChannel.name,
                    moderator: moderator?.tag || 'Inconnu'
                });
                
                const embed = createProtectionEmbed(
                    'Protection Nom de Salon',
                    'Nom du salon restauré automatiquement',
                    [
                        { name: 'Salon', value: `#${lockedChannel.originalName}`, inline: true },
                        { name: 'Tentative de changement', value: newChannel.name, inline: true },
                        { name: 'Modifié par', value: moderator?.tag || 'Inconnu', inline: true }
                    ]
                );
                
                await bot.notifyUser(null, embed);
                
            } catch (error) {
                logger.error(`Erreur lors de la restauration du nom du salon ${newChannel.name}:`, error);
                
                const embed = createProtectionEmbed(
                    'Protection Nom de Salon Échouée',
                    `Impossible de restaurer le nom du salon ${newChannel.name}`,
                    [
                        { name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false },
                        { name: 'Action requise', value: 'Vérifiez les permissions du bot', inline: false }
                    ]
                );
                
                await bot.notifyUser(null, embed);
            }
        }
    }
};