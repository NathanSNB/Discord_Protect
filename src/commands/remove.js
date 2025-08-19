const { createSuccessEmbed, createErrorEmbed, createWarningEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'remove',
        description: 'Retirer toutes les permissions d\'un utilisateur (anti-raid)'
    },
    async execute(message, args, bot) {
        const targetUser = message.mentions.users.first();
        
        if (!targetUser) {
            const embed = createErrorEmbed(
                'Utilisateur Manquant',
                'Vous devez mentionner un utilisateur pour lui retirer les permissions.',
                [{ name: 'Usage', value: '`=remove @utilisateur`', inline: false }]
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        if (targetUser.id === bot.config.authorizedUserId) {
            const embed = createWarningEmbed(
                'Action Interdite',
                'Vous ne pouvez pas retirer vos propres permissions.'
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        try {
            const targetMember = await message.guild.members.fetch(targetUser.id);
            
            // Check if bot can manage this member
            const botMember = await message.guild.members.fetch(bot.client.user.id);
            if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
                const embed = createWarningEmbed(
                    'Permissions Insuffisantes',
                    'Impossible de gérer cet utilisateur : son rôle le plus élevé est supérieur ou égal au mien.',
                    [
                        { name: 'Son rôle le plus élevé', value: targetMember.roles.highest.name, inline: true },
                        { name: 'Mon rôle le plus élevé', value: botMember.roles.highest.name, inline: true }
                    ]
                );
                
                await message.channel.send({ embeds: [embed] });
                return;
            }
            
            // Save current roles configuration before removing
            const currentRoles = targetMember.roles.cache
                .filter(role => role.id !== message.guild.id) // Exclude @everyone
                .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.color,
                    permissions: role.permissions.bitfield.toString(),
                    position: role.position,
                    hoist: role.hoist,
                    mentionable: role.mentionable
                }));
            
            // Remove all roles except @everyone
            const rolesToRemove = targetMember.roles.cache.filter(role => role.id !== message.guild.id);
            
            let removedRoles = [];
            let failedRoles = [];
            
            for (const [roleId, role] of rolesToRemove) {
                try {
                    await targetMember.roles.remove(role, 'Suppression anti-raid des permissions');
                    removedRoles.push(role.name);
                } catch (error) {
                    failedRoles.push(`${role.name} (${error.message})`);
                }
            }
            
            // Remove timeout if any
            if (targetMember.communicationDisabledUntil) {
                try {
                    await targetMember.timeout(null, 'Suppression timeout anti-raid');
                } catch (error) {
                    console.warn('Impossible de supprimer le timeout:', error.message);
                }
            }
            
            // Store the configuration for potential restoration
            const guildData = await bot.getGuildData(message.guild.id);
            if (!guildData.removedUserConfigs) {
                guildData.removedUserConfigs = {};
            }
            
            guildData.removedUserConfigs[targetUser.id] = {
                userId: targetUser.id,
                username: targetUser.tag,
                roles: currentRoles,
                removedAt: Date.now(),
                removedBy: message.author.id,
                removedRoles: removedRoles,
                failedRoles: failedRoles
            };
            
            await bot.guildData.set(message.guild.id, guildData);
            await require('../utils/database').saveConfig(message.guild.id, guildData);
            
            await bot.logAction(message.guild.id, 'antiRaid', {
                type: 'permissionsRemoved',
                target: targetUser.tag,
                user: message.author.tag,
                removedRoles: removedRoles.length,
                failedRoles: failedRoles.length,
                totalRoles: currentRoles.length
            });
            
            const embed = createSuccessEmbed(
                '🚨 Permissions Supprimées',
                `Toutes les permissions de ${targetUser.tag} ont été supprimées.`,
                [
                    { name: '✅ Rôles supprimés', value: `${removedRoles.length}`, inline: true },
                    { name: '❌ Échecs', value: `${failedRoles.length}`, inline: true },
                    { name: '💾 Configuration sauvée', value: 'Oui', inline: true }
                ]
            );
            
            if (removedRoles.length > 0) {
                embed.addFields([{
                    name: '🗑️ **Rôles Supprimés**',
                    value: removedRoles.slice(0, 10).join(', ') + (removedRoles.length > 10 ? `... +${removedRoles.length - 10}` : ''),
                    inline: false
                }]);
            }
            
            if (failedRoles.length > 0) {
                embed.addFields([{
                    name: '⚠️ **Échecs de Suppression**',
                    value: failedRoles.slice(0, 5).join('\n'),
                    inline: false
                }]);
            }
            
            embed.addFields([{
                name: '🔄 **Restauration Possible**',
                value: [
                    `\`=add @${targetUser.tag} restore\` - Restaurer tous les rôles`,
                    `\`=export @${targetUser.tag}\` - Voir la configuration JSON`,
                    'La configuration est sauvegardée pour une restauration ultérieure'
                ].join('\n'),
                inline: false
            }]);
            
            await message.channel.send({ embeds: [embed] });
            
            // Send alert notification
            const alertEmbed = createWarningEmbed(
                '🚨 Action Anti-Raid Exécutée',
                `Permissions supprimées pour ${targetUser.tag}`,
                [
                    { name: 'Serveur', value: message.guild.name, inline: true },
                    { name: 'Rôles supprimés', value: `${removedRoles.length}/${currentRoles.length}`, inline: true }
                ]
            );
            
            await bot.notifyUser(null, alertEmbed);
            
        } catch (error) {
            console.error('Erreur lors de la suppression des permissions:', error);
            
            const embed = createErrorEmbed(
                'Erreur Anti-Raid',
                'Une erreur est survenue lors de la suppression des permissions.',
                [
                    { name: 'Erreur', value: error.message || 'Membre introuvable', inline: false },
                    { name: 'Vérifications', value: [
                        '• L\'utilisateur est-il toujours sur le serveur ?',
                        '• Le bot a-t-il les permissions "Gérer les rôles" ?',
                        '• Le rôle du bot est-il assez haut dans la hiérarchie ?'
                    ].join('\n'), inline: false }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
        }
    }
};