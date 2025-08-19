const { createSuccessEmbed, createWarningEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'aping',
        description: 'Activer/désactiver la suppression automatique des messages qui vous mentionnent'
    },
    async execute(message, args, bot) {
        const guildData = await bot.getGuildData(message.guild.id);
        
        try {
            // Toggle anti-ping protection
            const wasActive = guildData.modules.antiPing;
            guildData.modules.antiPing = !wasActive;
            
            await bot.guildData.set(message.guild.id, guildData);
            await require('../utils/database').saveConfig(message.guild.id, guildData);
            
            await bot.logAction(message.guild.id, 'antiPing', {
                type: guildData.modules.antiPing ? 'enabled' : 'disabled',
                user: message.author.tag
            });
            
            const status = guildData.modules.antiPing ? 'activée' : 'désactivée';
            const statusEmoji = guildData.modules.antiPing ? '📵' : '📢';
            
            const embed = guildData.modules.antiPing ? createSuccessEmbed(
                `${statusEmoji} Protection Anti-Ping Activée`,
                'La suppression automatique des mentions est maintenant active.'
            ) : createWarningEmbed(
                `${statusEmoji} Protection Anti-Ping Désactivée`,
                'Les messages qui vous mentionnent ne seront plus supprimés automatiquement.'
            );
            
            embed.addFields([
                {
                    name: '⚙️ **Configuration Actuelle**',
                    value: [
                        `📵 Statut: ${guildData.modules.antiPing ? '🟢 Activé' : '🔴 Désactivé'}`,
                        `👤 Utilisateur protégé: <@${bot.config.authorizedUserId}>`,
                        `📝 Logging: ${guildData.modules.antiPing ? '✅ Activé' : '❌ Désactivé'}`,
                        `🔔 Notifications DM: ${guildData.notifications?.dmAlerts ? '✅ Activées' : '❌ Désactivées'}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🎯 **Comment ça fonctionne**',
                    value: guildData.modules.antiPing ? [
                        '• Détecte automatiquement vos mentions',
                        '• Supprime les messages instantanément',
                        '• Logs détaillés de chaque suppression',
                        '• Notifications DM des tentatives',
                        '• Ne supprime PAS vos propres messages'
                    ].join('\n') : [
                        '• Protection désactivée',
                        '• Messages avec mentions conservés',
                        '• Aucune suppression automatique',
                        '• Utilisez `=aping` pour réactiver'
                    ].join('\n'),
                    inline: true
                }
            ]);
            
            if (guildData.modules.antiPing) {
                embed.addFields([{
                    name: '⚠️ **Importantes Notes**',
                    value: [
                        '• **Vos messages ne sont jamais supprimés**',
                        '• Seules les mentions d\'autres utilisateurs sont supprimées',
                        '• Les logs incluent l\'auteur et le contenu du message',
                        '• Vous recevez une notification DM pour chaque suppression',
                        '• Les modérateurs peuvent toujours voir les logs'
                    ].join('\n'),
                    inline: false
                }]);
                
                embed.addFields([{
                    name: '📊 **Informations Loggées**',
                    value: [
                        '🏷️ Nom d\'utilisateur de l\'auteur',
                        '🆔 ID de l\'utilisateur',
                        '📍 Salon où le message a été envoyé',
                        '📝 Contenu du message (100 premiers caractères)',
                        '⏰ Horodatage de la suppression'
                    ].join('\n'),
                    inline: false
                }]);
            }
            
            embed.setFooter({ 
                text: guildData.modules.antiPing 
                    ? 'Anti-Ping activé • Toutes vos mentions seront automatiquement supprimées'
                    : 'Anti-Ping désactivé • Les mentions sont autorisées'
            });
            
            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Erreur lors du toggle anti-ping:', error);
            
            const embed = createWarningEmbed(
                'Erreur Anti-Ping',
                'Une erreur est survenue lors de la modification de la protection anti-ping.',
                [
                    { name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false },
                    { name: 'Action', value: 'Réessayez dans quelques instants', inline: false }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
        }
    }
};