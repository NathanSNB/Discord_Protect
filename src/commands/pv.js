const { createVoiceEmbed, createSuccessEmbed, createErrorEmbed, createWarningEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'pv',
        description: 'Gestion des salons vocaux privés'
    },
    async execute(message, args, bot) {
        const guildData = await bot.getGuildData(message.guild.id);
        const member = message.member;
        
        // Check if user is in voice channel
        if (!member.voice.channelId) {
            const embed = createErrorEmbed(
                'Erreur Vocal Privé',
                'Vous devez être dans un salon vocal pour utiliser cette commande.'
            );
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        const voiceChannel = member.voice.channel;
        const subcommand = args[0]?.toLowerCase();
        
        switch (subcommand) {
            case 'add':
                await handleAddMember(message, args, bot, guildData, voiceChannel);
                break;
            case 'remove':
                await handleRemoveMember(message, args, bot, guildData, voiceChannel);
                break;
            case 'list':
                await handleListMembers(message, bot, guildData, voiceChannel);
                break;
            default:
                await handleTogglePrivate(message, bot, guildData, voiceChannel);
                break;
        }
    }
};

async function handleTogglePrivate(message, bot, guildData, voiceChannel) {
    const channelId = voiceChannel.id;
    const isCurrentlyPrivate = guildData.privateVoiceChannels[channelId];
    
    try {
        if (isCurrentlyPrivate) {
            // Make public
            delete guildData.privateVoiceChannels[channelId];
            
            await bot.logAction(message.guild.id, 'privateVoice', {
                type: 'disabled',
                channel: voiceChannel.name,
                user: message.author.tag
            });
            
            const embed = createSuccessEmbed(
                'Salon Vocal Public',
                `Le salon **${voiceChannel.name}** est maintenant public.`,
                [
                    { name: 'Statut', value: '🔓 Public', inline: true },
                    { name: 'Membres', value: 'Accès libre', inline: true }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
            
        } else {
            // Make private - preserve current members
            const currentMembers = voiceChannel.members
                .filter(m => m.id !== bot.config.authorizedUserId)
                .map(m => m.id);
            
            guildData.privateVoiceChannels[channelId] = {
                channelName: voiceChannel.name,
                allowedMembers: [],
                presentMembers: currentMembers,
                createdAt: Date.now(),
                createdBy: message.author.id
            };
            
            await bot.logAction(message.guild.id, 'privateVoice', {
                type: 'enabled',
                channel: voiceChannel.name,
                user: message.author.tag,
                preservedMembers: currentMembers.length
            });
            
            const embed = createSuccessEmbed(
                'Salon Vocal Privé',
                `Le salon **${voiceChannel.name}** est maintenant privé.`,
                [
                    { name: 'Statut', value: '🔒 Privé', inline: true },
                    { name: 'Membres préservés', value: `${currentMembers.length}`, inline: true },
                    { name: 'Gestion', value: 'Utilisez `=pv add/remove @user`', inline: false }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
        }
        
        await bot.guildData.set(message.guild.id, guildData);
        await require('../utils/database').saveConfig(message.guild.id, guildData);
        
    } catch (error) {
        console.error('Erreur lors du toggle du salon privé:', error);
        
        const embed = createErrorEmbed(
            'Erreur Salon Privé',
            'Une erreur est survenue lors de la modification du statut du salon.',
            [{ name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false }]
        );
        
        await message.channel.send({ embeds: [embed] });
    }
}

async function handleAddMember(message, args, bot, guildData, voiceChannel) {
    const channelId = voiceChannel.id;
    const channelData = guildData.privateVoiceChannels[channelId];
    
    if (!channelData) {
        const embed = createWarningEmbed(
            'Salon Non Privé',
            `Le salon **${voiceChannel.name}** n'est pas configuré comme privé.`,
            [{ name: 'Action', value: 'Utilisez `=pv` pour rendre ce salon privé', inline: false }]
        );
        
        await message.channel.send({ embeds: [embed] });
        return;
    }
    
    const targetUser = message.mentions.users.first();
    if (!targetUser) {
        const embed = createErrorEmbed(
            'Utilisateur Manquant',
            'Vous devez mentionner un utilisateur à ajouter.',
            [{ name: 'Usage', value: '`=pv add @utilisateur`', inline: false }]
        );
        
        await message.channel.send({ embeds: [embed] });
        return;
    }
    
    try {
        // Check if member exists in guild
        const targetMember = await message.guild.members.fetch(targetUser.id);
        
        if (channelData.allowedMembers.includes(targetUser.id)) {
            const embed = createWarningEmbed(
                'Membre Déjà Autorisé',
                `${targetUser.tag} est déjà autorisé dans ce salon privé.`
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        // Add to allowed members
        channelData.allowedMembers.push(targetUser.id);
        
        await bot.guildData.set(message.guild.id, guildData);
        await require('../utils/database').saveConfig(message.guild.id, guildData);
        
        await bot.logAction(message.guild.id, 'privateVoice', {
            type: 'memberAdded',
            channel: voiceChannel.name,
            user: message.author.tag,
            addedMember: targetUser.tag
        });
        
        const embed = createSuccessEmbed(
            'Membre Ajouté',
            `${targetUser.tag} a été ajouté aux membres autorisés.`,
            [
                { name: 'Salon', value: voiceChannel.name, inline: true },
                { name: 'Total autorisés', value: `${channelData.allowedMembers.length}`, inline: true }
            ]
        );
        
        await message.channel.send({ embeds: [embed] });
        
    } catch (error) {
        console.error('Erreur lors de l\'ajout du membre:', error);
        
        const embed = createErrorEmbed(
            'Erreur d\'Ajout',
            'Impossible d\'ajouter ce membre au salon privé.',
            [{ name: 'Erreur', value: error.message || 'Membre introuvable', inline: false }]
        );
        
        await message.channel.send({ embeds: [embed] });
    }
}

async function handleRemoveMember(message, args, bot, guildData, voiceChannel) {
    const channelId = voiceChannel.id;
    const channelData = guildData.privateVoiceChannels[channelId];
    
    if (!channelData) {
        const embed = createWarningEmbed(
            'Salon Non Privé',
            `Le salon **${voiceChannel.name}** n'est pas configuré comme privé.`
        );
        
        await message.channel.send({ embeds: [embed] });
        return;
    }
    
    const targetUser = message.mentions.users.first();
    if (!targetUser) {
        const embed = createErrorEmbed(
            'Utilisateur Manquant',
            'Vous devez mentionner un utilisateur à retirer.',
            [{ name: 'Usage', value: '`=pv remove @utilisateur`', inline: false }]
        );
        
        await message.channel.send({ embeds: [embed] });
        return;
    }
    
    const memberIndex = channelData.allowedMembers.indexOf(targetUser.id);
    if (memberIndex === -1) {
        const embed = createWarningEmbed(
            'Membre Non Autorisé',
            `${targetUser.tag} n'était pas dans la liste des membres autorisés.`
        );
        
        await message.channel.send({ embeds: [embed] });
        return;
    }
    
    try {
        // Remove from allowed members
        channelData.allowedMembers.splice(memberIndex, 1);
        
        // If member is currently in the voice channel, kick them
        const targetMember = voiceChannel.members.get(targetUser.id);
        if (targetMember && targetMember.id !== bot.config.authorizedUserId) {
            await targetMember.voice.disconnect('Retiré de la liste des membres autorisés');
        }
        
        await bot.guildData.set(message.guild.id, guildData);
        await require('../utils/database').saveConfig(message.guild.id, guildData);
        
        await bot.logAction(message.guild.id, 'privateVoice', {
            type: 'memberRemoved',
            channel: voiceChannel.name,
            user: message.author.tag,
            removedMember: targetUser.tag,
            wasKicked: !!targetMember
        });
        
        const embed = createSuccessEmbed(
            'Membre Retiré',
            `${targetUser.tag} a été retiré des membres autorisés.`,
            [
                { name: 'Salon', value: voiceChannel.name, inline: true },
                { name: 'Action', value: targetMember ? 'Expulsé du salon' : 'Retiré de la liste', inline: true },
                { name: 'Total autorisés', value: `${channelData.allowedMembers.length}`, inline: true }
            ]
        );
        
        await message.channel.send({ embeds: [embed] });
        
    } catch (error) {
        console.error('Erreur lors de la suppression du membre:', error);
        
        const embed = createErrorEmbed(
            'Erreur de Suppression',
            'Une erreur est survenue lors de la suppression du membre.',
            [{ name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false }]
        );
        
        await message.channel.send({ embeds: [embed] });
    }
}

async function handleListMembers(message, bot, guildData, voiceChannel) {
    const channelId = voiceChannel.id;
    const channelData = guildData.privateVoiceChannels[channelId];
    
    if (!channelData) {
        const embed = createWarningEmbed(
            'Salon Non Privé',
            `Le salon **${voiceChannel.name}** n'est pas configuré comme privé.`,
            [{ name: 'Action', value: 'Utilisez `=pv` pour rendre ce salon privé', inline: false }]
        );
        
        await message.channel.send({ embeds: [embed] });
        return;
    }
    
    try {
        // Get current members in voice channel
        const currentMembers = voiceChannel.members.filter(m => m.id !== bot.config.authorizedUserId);
        
        // Get allowed members info
        const allowedMembers = [];
        for (const userId of channelData.allowedMembers) {
            try {
                const user = await bot.client.users.fetch(userId);
                const isPresent = currentMembers.has(userId);
                allowedMembers.push(`${isPresent ? '🟢' : '🔴'} ${user.tag}`);
            } catch (error) {
                allowedMembers.push(`❓ Utilisateur inconnu (${userId})`);
            }
        }
        
        // Get present members not in allowed list
        const presentNotAllowed = [];
        for (const [memberId, member] of currentMembers) {
            if (!channelData.allowedMembers.includes(memberId) && !channelData.presentMembers.includes(memberId)) {
                presentNotAllowed.push(`⚠️ ${member.user.tag} (non autorisé)`);
            }
        }
        
        const embed = createVoiceEmbed(
            `Liste des Membres - ${voiceChannel.name}`,
            `🔒 Salon vocal privé • Créé ${new Date(channelData.createdAt).toLocaleString('fr-FR')}`
        );
        
        if (allowedMembers.length > 0) {
            embed.addFields([{
                name: '✅ **Membres Autorisés**',
                value: allowedMembers.join('\n'),
                inline: false
            }]);
        } else {
            embed.addFields([{
                name: '✅ **Membres Autorisés**',
                value: 'Aucun membre autorisé',
                inline: false
            }]);
        }
        
        if (channelData.presentMembers.length > 0) {
            const preservedMembers = [];
            for (const userId of channelData.presentMembers) {
                try {
                    const user = await bot.client.users.fetch(userId);
                    const isPresent = currentMembers.has(userId);
                    preservedMembers.push(`${isPresent ? '🟢' : '🔴'} ${user.tag} (préservé)`);
                } catch (error) {
                    preservedMembers.push(`❓ Utilisateur préservé (${userId})`);
                }
            }
            
            embed.addFields([{
                name: '💾 **Membres Préservés**',
                value: preservedMembers.join('\n'),
                inline: false
            }]);
        }
        
        if (presentNotAllowed.length > 0) {
            embed.addFields([{
                name: '⚠️ **Présents Non Autorisés**',
                value: presentNotAllowed.join('\n'),
                inline: false
            }]);
        }
        
        embed.addFields([{
            name: '📊 **Statistiques**',
            value: [
                `👥 Actuellement présents: ${currentMembers.size}`,
                `✅ Membres autorisés: ${channelData.allowedMembers.length}`,
                `💾 Membres préservés: ${channelData.presentMembers.length}`
            ].join('\n'),
            inline: false
        }]);
        
        await message.channel.send({ embeds: [embed] });
        
    } catch (error) {
        console.error('Erreur lors de l\'affichage de la liste:', error);
        
        const embed = createErrorEmbed(
            'Erreur de Liste',
            'Une erreur est survenue lors de l\'affichage de la liste des membres.',
            [{ name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false }]
        );
        
        await message.channel.send({ embeds: [embed] });
    }
}