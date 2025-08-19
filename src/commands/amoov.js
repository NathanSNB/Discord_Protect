const { createVoiceEmbed, createSuccessEmbed, createWarningEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'amoov',
        description: 'Activation/désactivation de la protection anti-déplacement vocal'
    },
    async execute(message, args, bot) {
        const guildData = await bot.getGuildData(message.guild.id);
        const member = message.member;
        
        // Check if user is in voice channel for context
        const voiceChannel = member.voice.channel;
        
        try {
            // Toggle anti-move protection
            const wasActive = guildData.modules.antiMove;
            guildData.modules.antiMove = !wasActive;
            
            // Reset attempt counters when toggling
            if (guildData.modules.antiMove) {
                guildData.antiMoveAttempts = {};
            }
            
            await bot.guildData.set(message.guild.id, guildData);
            await require('../utils/database').saveConfig(message.guild.id, guildData);
            
            await bot.logAction(message.guild.id, 'antiMove', {
                type: guildData.modules.antiMove ? 'enabled' : 'disabled',
                user: message.author.tag,
                channel: voiceChannel?.name || 'Aucun salon vocal'
            });
            
            const status = guildData.modules.antiMove ? 'activée' : 'désactivée';
            const statusEmoji = guildData.modules.antiMove ? '🛡️' : '🔓';
            const statusColor = guildData.modules.antiMove ? 'SUCCESS' : 'WARNING';
            
            const embed = createVoiceEmbed(
                `${statusEmoji} Protection Anti-Move ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                `La protection contre les déplacements vocaux est maintenant **${status}**.`
            );
            
            embed.addFields([
                {
                    name: '⚙️ **Configuration Actuelle**',
                    value: [
                        `🚫 Statut: ${guildData.modules.antiMove ? '🟢 Activé' : '🔴 Désactivé'}`,
                        `🔢 Max tentatives: ${guildData.antiMoveSettings.maxAttempts}`,
                        `⏱️ Durée sanction: ${Math.round(guildData.antiMoveSettings.punishmentDuration / 1000 / 60)} minutes`,
                        `📋 Type sanction: ${guildData.antiMoveSettings.punishmentType}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🎯 **Comment ça fonctionne**',
                    value: guildData.modules.antiMove ? [
                        '• Détecte les déplacements forcés',
                        '• Vous ramène automatiquement',
                        '• Compte les tentatives par utilisateur',
                        '• Sanctionne après le maximum atteint'
                    ].join('\n') : [
                        '• Protection désactivée',
                        '• Déplacements vocaux autorisés',
                        '• Aucune sanction appliquée',
                        '• Utilisez `=amoov` pour réactiver'
                    ].join('\n'),
                    inline: true
                }
            ]);
            
            if (voiceChannel) {
                embed.addFields([{
                    name: '📍 **Salon Vocal Actuel**',
                    value: `Vous êtes dans: **${voiceChannel.name}**`,
                    inline: false
                }]);
            }
            
            if (guildData.modules.antiMove) {
                embed.addFields([{
                    name: '📊 **Statistiques**',
                    value: [
                        `🔄 Compteurs réinitialisés`,
                        `⚡ Protection immédiate`,
                        `📝 Logs activés`
                    ].join('\n'),
                    inline: false
                }]);
                
                embed.addFields([{
                    name: '⚠️ **Attention**',
                    value: [
                        '• Seuls les déplacements **forcés** sont bloqués',
                        '• Les déplacements volontaires restent possibles',
                        '• Les modérateurs malveillants seront sanctionnés',
                        '• Vous recevrez des notifications des actions'
                    ].join('\n'),
                    inline: false
                }]);
            }
            
            embed.setFooter({ 
                text: guildData.modules.antiMove 
                    ? 'Protection anti-move active • Vous êtes protégé contre les déplacements forcés'
                    : 'Protection anti-move désactivée • Les déplacements forcés sont autorisés'
            });
            
            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Erreur lors du toggle anti-move:', error);
            
            const embed = createWarningEmbed(
                'Erreur Anti-Move',
                'Une erreur est survenue lors de la modification de la protection anti-déplacement.',
                [
                    { name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false },
                    { name: 'Action', value: 'Réessayez dans quelques instants', inline: false }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
        }
    }
};