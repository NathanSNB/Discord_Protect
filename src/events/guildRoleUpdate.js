const { Events } = require('discord.js');
const { logger } = require('../utils/database');
const { createProtectionEmbed } = require('../utils/embeds');

module.exports = {
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole, bot) {
        const guildData = await bot.getGuildData(newRole.guild.id);
        
        if (!guildData.modules.antiPermissions) return;
        
        // Check if this is a protected role
        const protectedRoles = guildData.protectedRoles || [];
        if (!protectedRoles.includes(newRole.id)) return;
        
        // Check if bot performed the action (avoid infinite loops)
        const flagKey = `antiPermissions_${newRole.guild.id}_${newRole.id}`;
        if (bot.protectionFlags.has(flagKey)) {
            bot.protectionFlags.delete(flagKey);
            return;
        }
        
        // Compare permissions
        if (!oldRole.permissions.equals(newRole.permissions)) {
            try {
                bot.protectionFlags.set(flagKey, true);
                await newRole.setPermissions(oldRole.permissions, 'Protection des permissions activée');
                
                // Find who modified the role
                let moderator = null;
                try {
                    const auditLogs = await newRole.guild.fetchAuditLogs({
                        type: 31, // ROLE_UPDATE
                        limit: 5
                    });
                    
                    const roleLog = auditLogs.entries.find(entry => 
                        entry.target.id === newRole.id &&
                        Date.now() - entry.createdTimestamp < 10000
                    );
                    
                    if (roleLog) {
                        moderator = roleLog.executor;
                    }
                } catch (error) {
                    logger.debug('Impossible de récupérer les logs d\'audit pour anti-permissions');
                }
                
                await bot.logAction(newRole.guild.id, 'antiPermissions', {
                    type: 'restored',
                    role: newRole.name,
                    roleId: newRole.id,
                    moderator: moderator?.tag || 'Inconnu',
                    changesReverted: true
                });
                
                const embed = createProtectionEmbed(
                    'Protection Anti-Permissions',
                    'Permissions du rôle restaurées automatiquement',
                    [
                        { name: 'Rôle', value: newRole.name, inline: true },
                        { name: 'Modifié par', value: moderator?.tag || 'Inconnu', inline: true },
                        { name: 'Action', value: 'Permissions restaurées', inline: true }
                    ]
                );
                
                await bot.notifyUser(null, embed);
                
            } catch (error) {
                logger.error(`Erreur lors de la restauration des permissions du rôle ${newRole.name}:`, error);
                
                const embed = createProtectionEmbed(
                    'Protection Anti-Permissions Échouée',
                    `Impossible de restaurer les permissions du rôle ${newRole.name}`,
                    [
                        { name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false },
                        { name: 'Action requise', value: 'Vérifiez les permissions du bot', inline: false }
                    ]
                );
                
                await bot.notifyUser(null, embed);
            }
        }
        
        // Check for admin permission being added (anti-raid protection)
        if (!oldRole.permissions.has('Administrator') && newRole.permissions.has('Administrator')) {
            const embed = createProtectionEmbed(
                '🚨 Alerte Anti-Raid',
                `Permission Administrateur détectée sur le rôle ${newRole.name}`,
                [
                    { name: 'Rôle concerné', value: newRole.name, inline: true },
                    { name: '⚠️ Risque', value: 'Permission administrative ajoutée', inline: true },
                    { name: 'Action recommandée', value: 'Vérifiez immédiatement cette modification', inline: false }
                ]
            );
            
            await bot.notifyUser(null, embed);
        }
    }
};