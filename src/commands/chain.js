const { createVoiceEmbed, createSuccessEmbed, createErrorEmbed, createWarningEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'chain',
        description: 'Créer/supprimer une chaîne vocale avec un utilisateur'
    },
    async execute(message, args, bot) {
        const guildData = await bot.getGuildData(message.guild.id);
        const member = message.member;
        
        // Check if user is in voice channel
        if (!member.voice.channelId) {
            const embed = createErrorEmbed(
                'Erreur Système Chaîne',
                'Vous devez être dans un salon vocal pour utiliser le système de chaînes.'
            );
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            const embed = createErrorEmbed(
                'Utilisateur Manquant',
                'Vous devez mentionner un utilisateur pour créer/supprimer une chaîne.',
                [{ name: 'Usage', value: '`=chain @utilisateur`', inline: false }]
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        if (targetUser.id === bot.config.authorizedUserId) {
            const embed = createWarningEmbed(
                'Chaîne Impossible',
                'Vous ne pouvez pas créer une chaîne avec vous-même.'
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
                    `${targetUser.tag} doit être dans un salon vocal pour créer une chaîne.`
                );
                
                await message.channel.send({ embeds: [embed] });
                return;
            }
            
            const existingChain = guildData.chainedUsers[targetUser.id];
            
            if (existingChain && existingChain.active) {
                // Remove existing chain
                guildData.chainedUsers[targetUser.id].active = false;
                guildData.chainedUsers[targetUser.id].endedAt = Date.now();
                
                await bot.guildData.set(message.guild.id, guildData);
                await require('../utils/database').saveConfig(message.guild.id, guildData);
                
                await bot.logAction(message.guild.id, 'chainSystem', {
                    type: 'removed',
                    chainedUser: targetUser.tag,
                    user: message.author.tag,
                    channel: member.voice.channel.name
                });
                
                const embed = createSuccessEmbed(
                    '⛓️ Chaîne Supprimée',
                    `La chaîne avec ${targetUser.tag} a été supprimée.`,
                    [
                        { name: 'Utilisateur libéré', value: targetUser.tag, inline: true },
                        { name: 'Statut', value: '🔓 Libre', inline: true }
                    ]
                );
                
                await message.channel.send({ embeds: [embed] });
                
            } else {
                // Create new chain
                guildData.chainedUsers[targetUser.id] = {
                    active: true,
                    masterId: bot.config.authorizedUserId,
                    createdAt: Date.now(),
                    endedAt: null,
                    initialChannel: targetMember.voice.channelId
                };
                
                await bot.guildData.set(message.guild.id, guildData);
                await require('../utils/database').saveConfig(message.guild.id, guildData);
                
                await bot.logAction(message.guild.id, 'chainSystem', {
                    type: 'created',
                    chainedUser: targetUser.tag,
                    user: message.author.tag,
                    initialChannel: targetMember.voice.channel.name,
                    masterChannel: member.voice.channel.name
                });
                
                const embed = createSuccessEmbed(
                    '⛓️ Chaîne Créée',
                    `Une chaîne vocale a été créée avec ${targetUser.tag}.`,
                    [
                        { name: 'Utilisateur chaîné', value: targetUser.tag, inline: true },
                        { name: 'Statut', value: '🔗 Enchaîné', inline: true },
                        { name: 'Salon initial', value: targetMember.voice.channel.name, inline: true }
                    ]
                );
                
                embed.addFields([{
                    name: '🎯 **Comment ça fonctionne**',
                    value: [
                        '• L\'utilisateur vous suivra automatiquement',
                        '• Quand vous changez de salon, il vous suit',
                        '• Si vous vous déconnectez, la chaîne se libère',
                        '• Utilisez `=chain @user` pour supprimer la chaîne'
                    ].join('\n'),
                    inline: false
                }]);
                
                await message.channel.send({ embeds: [embed] });
            }
            
        } catch (error) {
            console.error('Erreur lors de la gestion de la chaîne:', error);
            
            const embed = createErrorEmbed(
                'Erreur Système Chaîne',
                'Une erreur est survenue lors de la gestion de la chaîne vocale.',
                [
                    { name: 'Erreur', value: error.message || 'Membre introuvable', inline: false },
                    { name: 'Action', value: 'Vérifiez que l\'utilisateur est sur le serveur', inline: false }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
        }
    }
};