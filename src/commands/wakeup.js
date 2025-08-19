const { createVoiceEmbed, createSuccessEmbed, createErrorEmbed, createWarningEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'wakeup',
        description: 'Réveiller un utilisateur par déplacements vocaux rapides'
    },
    async execute(message, args, bot) {
        const guildData = await bot.getGuildData(message.guild.id);
        
        if (!guildData.modules.wakeupSystem) {
            const embed = createWarningEmbed(
                'Module Désactivé',
                'Le système de réveil est actuellement désactivé.',
                [{ name: 'Action', value: 'Utilisez `=setup` pour l\'activer', inline: false }]
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            const embed = createErrorEmbed(
                'Utilisateur Manquant',
                'Vous devez mentionner un utilisateur à réveiller.',
                [{ name: 'Usage', value: '`=wakeup @utilisateur`', inline: false }]
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        if (targetUser.id === bot.config.authorizedUserId) {
            const embed = createWarningEmbed(
                'Réveil Impossible',
                'Vous ne pouvez pas vous réveiller vous-même.'
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        try {
            // Check if target member exists and is in voice
            const targetMember = await message.guild.members.fetch(targetUser.id);
            
            if (!targetMember.voice.channelId) {
                const embed = createWarningEmbed(
                    'Utilisateur Non Connecté',
                    `${targetUser.tag} doit être dans un salon vocal pour être réveillé.`
                );
                
                await message.channel.send({ embeds: [embed] });
                return;
            }
            
            // Get available voice channels
            const voiceChannels = message.guild.channels.cache
                .filter(channel => channel.type === 2 && // GUILD_VOICE
                         channel.permissionsFor(message.guild.members.me).has('MoveMembers'))
                .array()
                .slice(0, guildData.wakeupSettings.movesCount);
            
            if (voiceChannels.length < 2) {
                const embed = createWarningEmbed(
                    'Salons Insuffisants',
                    'Il faut au moins 2 salons vocaux accessibles pour réveiller un utilisateur.'
                );
                
                await message.channel.send({ embeds: [embed] });
                return;
            }
            
            const originalChannel = targetMember.voice.channel;
            const totalMoves = Math.min(guildData.wakeupSettings.movesCount, voiceChannels.length * 2);
            const moveDelay = guildData.wakeupSettings.moveDelay;
            
            // Start wakeup process
            const embed = createSuccessEmbed(
                '⏰ Réveil en Cours',
                `Réveil de ${targetUser.tag} en cours...`,
                [
                    { name: 'Déplacements prévus', value: `${totalMoves}`, inline: true },
                    { name: 'Délai entre moves', value: `${moveDelay}ms`, inline: true },
                    { name: 'Salon d\'origine', value: originalChannel.name, inline: true }
                ]
            );
            
            const statusMessage = await message.channel.send({ embeds: [embed] });
            
            // Perform wakeup moves
            for (let i = 0; i < totalMoves; i++) {
                try {
                    // Check if user is still connected
                    await targetMember.fetch();
                    if (!targetMember.voice.channelId) {
                        break; // User disconnected
                    }
                    
                    // Select next channel (cycle through available channels)
                    const nextChannel = voiceChannels[i % voiceChannels.length];
                    
                    // Move to next channel
                    await targetMember.voice.setChannel(nextChannel, `Réveil ${i + 1}/${totalMoves}`);
                    
                    await bot.logAction(message.guild.id, 'wakeupSystem', {
                        type: 'move',
                        target: targetUser.tag,
                        user: message.author.tag,
                        moveNumber: i + 1,
                        totalMoves: totalMoves,
                        channel: nextChannel.name
                    });
                    
                    // Update status message periodically
                    if ((i + 1) % 3 === 0 || i === totalMoves - 1) {
                        const progressEmbed = createVoiceEmbed(
                            '⏰ Réveil en Cours',
                            `Progression: ${i + 1}/${totalMoves} déplacements`,
                            [
                                { name: 'Cible', value: targetUser.tag, inline: true },
                                { name: 'Salon actuel', value: nextChannel.name, inline: true },
                                { name: 'Progression', value: `${Math.round(((i + 1) / totalMoves) * 100)}%`, inline: true }
                            ]
                        );
                        
                        await statusMessage.edit({ embeds: [progressEmbed] });
                    }
                    
                    // Wait before next move (except for last move)
                    if (i < totalMoves - 1) {
                        await new Promise(resolve => setTimeout(resolve, moveDelay));
                    }
                    
                } catch (moveError) {
                    console.error(`Erreur lors du déplacement ${i + 1}:`, moveError);
                    // Continue with next move
                }
            }
            
            // Return to original channel
            try {
                await targetMember.fetch();
                if (targetMember.voice.channelId) {
                    await targetMember.voice.setChannel(originalChannel, 'Retour au salon d\'origine après réveil');
                }
            } catch (returnError) {
                console.error('Erreur lors du retour au salon d\'origine:', returnError);
            }
            
            // Final status update
            const finalEmbed = createSuccessEmbed(
                '✅ Réveil Terminé',
                `${targetUser.tag} a été réveillé avec succès !`,
                [
                    { name: 'Déplacements effectués', value: `${totalMoves}`, inline: true },
                    { name: 'Salon final', value: originalChannel.name, inline: true },
                    { name: 'Durée totale', value: `${Math.round((totalMoves * moveDelay) / 1000)}s`, inline: true }
                ]
            );
            
            await statusMessage.edit({ embeds: [finalEmbed] });
            
            await bot.logAction(message.guild.id, 'wakeupSystem', {
                type: 'completed',
                target: targetUser.tag,
                user: message.author.tag,
                totalMoves: totalMoves,
                originalChannel: originalChannel.name,
                success: true
            });
            
        } catch (error) {
            console.error('Erreur lors du réveil:', error);
            
            const embed = createErrorEmbed(
                'Erreur de Réveil',
                'Une erreur est survenue lors du réveil de l\'utilisateur.',
                [
                    { name: 'Erreur', value: error.message || 'Membre introuvable ou permissions insuffisantes', inline: false },
                    { name: 'Vérifications', value: [
                        '• L\'utilisateur est-il toujours connecté ?',
                        '• Le bot a-t-il la permission "Déplacer des membres" ?',
                        '• Y a-t-il suffisamment de salons vocaux ?'
                    ].join('\n'), inline: false }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
            
            await bot.logAction(message.guild.id, 'wakeupSystem', {
                type: 'error',
                target: targetUser?.tag || 'Inconnu',
                user: message.author.tag,
                error: error.message
            });
        }
    }
};