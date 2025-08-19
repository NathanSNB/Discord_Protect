const { Events } = require('discord.js');
const { logger } = require('../utils/database');
const { createProtectionEmbed } = require('../utils/embeds');

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role, bot) {
        const guildData = await bot.getGuildData(role.guild.id);
        
        if (!guildData.modules.antiPermissions) return;
        
        // Check if this was a protected role
        const protectedRoles = guildData.protectedRoles || [];
        if (!protectedRoles.includes(role.id)) return;
        
        try {
            // Recreate the deleted protected role
            const newRole = await role.guild.roles.create({
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                permissions: role.permissions,
                mentionable: role.mentionable,
                position: role.position,
                reason: 'Rôle protégé supprimé - Recréation automatique'
            });
            
            // Update protected roles list with new ID
            const roleIndex = protectedRoles.indexOf(role.id);
            if (roleIndex !== -1) {
                protectedRoles[roleIndex] = newRole.id;
                await bot.guildData.set(role.guild.id, guildData);
                await require('../utils/database').saveConfig(role.guild.id, guildData);
            }
            
            // Re-add role to authorized user
            try {
                const member = await role.guild.members.fetch(bot.config.authorizedUserId);
                await member.roles.add(newRole, 'Restauration du rôle protégé');
            } catch (error) {
                logger.error('Erreur lors de la réattribution du rôle restauré:', error);
            }
            
            // Find who deleted the role
            let moderator = null;
            try {
                const auditLogs = await role.guild.fetchAuditLogs({
                    type: 32, // ROLE_DELETE
                    limit: 5
                });
                
                const deleteLog = auditLogs.entries.find(entry => 
                    entry.target.id === role.id &&
                    Date.now() - entry.createdTimestamp < 10000
                );
                
                if (deleteLog) {
                    moderator = deleteLog.executor;
                }
            } catch (error) {
                logger.debug('Impossible de récupérer les logs d\'audit pour suppression de rôle');
            }
            
            await bot.logAction(role.guild.id, 'antiPermissions', {
                type: 'roleRecreated',
                oldRoleId: role.id,
                newRoleId: newRole.id,
                roleName: role.name,
                moderator: moderator?.tag || 'Inconnu'
            });
            
            const embed = createProtectionEmbed(
                'Protection Anti-Permissions',
                'Rôle protégé supprimé - Recréation automatique effectuée',
                [
                    { name: 'Rôle supprimé', value: role.name, inline: true },
                    { name: 'Nouveau rôle', value: newRole.toString(), inline: true },
                    { name: 'Supprimé par', value: moderator?.tag || 'Inconnu', inline: true }
                ]
            );
            
            await bot.notifyUser(null, embed);
            
        } catch (error) {
            logger.error(`Erreur lors de la recréation du rôle protégé ${role.name}:`, error);
            
            const embed = createProtectionEmbed(
                'Protection Anti-Permissions Échouée',
                `Impossible de recréer le rôle protégé ${role.name}`,
                [
                    { name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false },
                    { name: 'Action requise', value: 'Recréation manuelle nécessaire', inline: false }
                ]
            );
            
            await bot.notifyUser(null, embed);
        }
    }
};