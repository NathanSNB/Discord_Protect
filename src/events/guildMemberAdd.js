const { Events } = require('discord.js');
const { logger } = require('../utils/database');
const { createProtectionEmbed } = require('../utils/embeds');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, bot) {
        const guildData = await bot.getGuildData(member.guild.id);
        
        // Only handle authorized user rejoining
        if (member.id !== bot.config.authorizedUserId) return;
        
        try {
            // Restore protected roles
            const protectedRoles = guildData.protectedRoles || [];
            const rolesToAdd = [];
            
            for (const roleId of protectedRoles) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    rolesToAdd.push(role);
                }
            }
            
            if (rolesToAdd.length > 0) {
                await member.roles.add(rolesToAdd, 'Restauration des rôles protégés après retour');
            }
            
            // Restore original nickname if set
            if (guildData.originalNickname) {
                try {
                    await member.setNickname(guildData.originalNickname, 'Restauration du pseudonyme original');
                } catch (error) {
                    logger.warn('Impossible de restaurer le pseudonyme:', error.message);
                }
            }
            
            await bot.logAction(member.guild.id, 'memberRejoin', {
                type: 'rejoin',
                user: member.user.tag,
                rolesRestored: rolesToAdd.length,
                nicknameRestored: !!guildData.originalNickname
            });
            
            const embed = createProtectionEmbed(
                'Retour Détecté',
                'Restauration automatique de votre configuration',
                [
                    { name: 'Rôles restaurés', value: rolesToAdd.length > 0 ? rolesToAdd.map(r => r.name).join(', ') : 'Aucun', inline: false },
                    { name: 'Pseudonyme', value: guildData.originalNickname || 'Aucun pseudonyme sauvegardé', inline: true }
                ]
            );
            
            await bot.notifyUser(null, embed);
            
        } catch (error) {
            logger.error('Erreur lors de la restauration après retour:', error);
        }
    }
};