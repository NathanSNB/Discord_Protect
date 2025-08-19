const { Events } = require('discord.js');
const { logger } = require('../utils/database');
const { createProtectionEmbed } = require('../utils/embeds');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, bot) {
        const guildData = await bot.getGuildData(member.guild.id);
        
        if (!guildData.modules.antiKickBan) return;
        
        // Only protect the authorized user
        if (member.id !== bot.config.authorizedUserId) return;
        
        try {
            // Check if it was a ban or kick
            let wasBanned = false;
            let moderator = null;
            
            try {
                // Check for ban first
                const banInfo = await member.guild.bans.fetch(member.id).catch(() => null);
                if (banInfo) {
                    wasBanned = true;
                    
                    // Try to unban immediately (kamikaze mode)
                    try {
                        await member.guild.bans.remove(member.id, 'Protection anti-ban activée - Débannissement automatique');
                    } catch (unbanError) {
                        logger.warn('Impossible de débannir automatiquement:', unbanError.message);
                    }
                }
                
                // Find who performed the action
                const auditLogs = await member.guild.fetchAuditLogs({
                    type: wasBanned ? 22 : 20, // MEMBER_BAN_ADD or MEMBER_KICK
                    limit: 5
                });
                
                const actionLog = auditLogs.entries.find(entry => 
                    entry.target.id === member.id &&
                    Date.now() - entry.createdTimestamp < 10000
                );
                
                if (actionLog) {
                    moderator = actionLog.executor;
                }
            } catch (error) {
                logger.debug('Erreur lors de la vérification du ban/kick:', error);
            }
            
            // Create invite for re-entry
            let inviteUrl = null;
            try {
                // Try to find a good channel for invite
                let inviteChannel = member.guild.systemChannel || 
                                  member.guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(member.guild.members.me).has('CreateInstantInvite'));
                
                if (inviteChannel) {
                    const invite = await inviteChannel.createInvite({
                        maxAge: 3600, // 1 hour
                        maxUses: 1,
                        unique: true,
                        reason: 'Invitation de retour pour protection anti-kick/ban'
                    });
                    inviteUrl = invite.url;
                }
            } catch (error) {
                logger.error('Erreur lors de la création de l\'invitation:', error);
            }
            
            await bot.logAction(member.guild.id, 'antiKickBan', {
                type: wasBanned ? 'ban' : 'kick',
                user: member.user.tag,
                moderator: moderator?.tag || 'Inconnu',
                inviteCreated: !!inviteUrl,
                unbanned: wasBanned
            });
            
            // Send notification with invite
            const embed = createProtectionEmbed(
                `Protection Anti-${wasBanned ? 'Ban' : 'Kick'}`,
                `${wasBanned ? 'Bannissement' : 'Expulsion'} détecté - Invitation de retour créée`,
                [
                    { name: 'Serveur', value: member.guild.name, inline: true },
                    { name: 'Action détectée', value: wasBanned ? 'Bannissement' : 'Expulsion', inline: true },
                    { name: 'Auteur', value: moderator?.tag || 'Inconnu', inline: true },
                    { name: 'Débannissement', value: wasBanned ? 'Tenté automatiquement' : 'Non applicable', inline: true }
                ]
            );
            
            if (inviteUrl) {
                embed.addFields([
                    { name: '🔗 Invitation de retour', value: inviteUrl, inline: false },
                    { name: '⏱️ Validité', value: '1 heure (1 utilisation)', inline: true }
                ]);
            }
            
            await bot.notifyUser(null, embed);
            
        } catch (error) {
            logger.error('Erreur lors de la protection anti-kick/ban:', error);
        }
    }
};