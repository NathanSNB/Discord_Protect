const { Events } = require('discord.js');
const { logger } = require('../utils/database');
const { createProtectionEmbed } = require('../utils/embeds');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, bot) {
        const member = newState.member || oldState.member;
        const guild = member.guild;
        const guildData = await bot.getGuildData(guild.id);
        
        // Handle different voice state changes
        await handleAntiMuteProtection(oldState, newState, bot, guildData);
        await handlePrivateVoiceChannels(oldState, newState, bot, guildData);
        await handleAntiMoveProtection(oldState, newState, bot, guildData);
        await handleChainSystem(oldState, newState, bot, guildData);
    }
};

// Anti-mute/deafen protection
async function handleAntiMuteProtection(oldState, newState, bot, guildData) {
    if (!guildData.modules.antiMute) return;
    
    const member = newState.member;
    
    // Only protect the authorized user
    if (member.id !== bot.config.authorizedUserId) return;
    
    // Check if bot performed the action (avoid infinite loops)
    const flagKey = `antiMute_${member.guild.id}_${member.id}`;
    if (bot.protectionFlags.has(flagKey)) {
        bot.protectionFlags.delete(flagKey);
        return;
    }
    
    let actionTaken = false;
    
    try {
        // Check server mute
        if (newState.serverMute && !oldState.serverMute) {
            bot.protectionFlags.set(flagKey, true);
            await member.voice.setMute(false, 'Protection anti-mute activée');
            actionTaken = true;
            
            await bot.logAction(member.guild.id, 'antiMute', {
                type: 'unmute',
                user: member.user.tag,
                channel: newState.channel?.name
            });
        }
        
        // Check server deafen
        if (newState.serverDeaf && !oldState.serverDeaf) {
            bot.protectionFlags.set(flagKey, true);
            await member.voice.setDeaf(false, 'Protection anti-sourd activée');
            actionTaken = true;
            
            await bot.logAction(member.guild.id, 'antiMute', {
                type: 'undeafen',
                user: member.user.tag,
                channel: newState.channel?.name
            });
        }
        
        if (actionTaken) {
            const embed = createProtectionEmbed(
                'Protection Anti-Mute Activée',
                'Rétablissement automatique de votre état vocal',
                [
                    { name: 'Action', value: newState.serverMute ? 'Démutage' : 'Retrait sourdine', inline: true },
                    { name: 'Salon', value: newState.channel?.name || 'Aucun', inline: true }
                ]
            );
            
            await bot.notifyUser(null, embed);
        }
        
    } catch (error) {
        logger.error('Erreur lors de la protection anti-mute:', error);
    }
}

// Private voice channels management
async function handlePrivateVoiceChannels(oldState, newState, bot, guildData) {
    if (!guildData.modules.privateVoice) return;
    
    const member = newState.member;
    const newChannelId = newState.channelId;
    const oldChannelId = oldState.channelId;
    
    // Check if member joined a private channel
    if (newChannelId && guildData.privateVoiceChannels[newChannelId]) {
        const channelData = guildData.privateVoiceChannels[newChannelId];
        
        // Skip if it's the authorized user or an allowed member
        if (member.id === bot.config.authorizedUserId || 
            channelData.allowedMembers.includes(member.id) ||
            channelData.presentMembers.includes(member.id)) {
            return;
        }
        
        try {
            // Kick the intruder
            await member.voice.disconnect('Salon vocal privé - Accès refusé');
            
            await bot.logAction(member.guild.id, 'privateVoice', {
                type: 'kick',
                user: member.user.tag,
                channel: newState.channel.name,
                reason: 'Accès non autorisé à un salon privé'
            });
            
            const embed = createProtectionEmbed(
                'Salon Vocal Privé',
                `${member.user.tag} expulsé du salon privé`,
                [
                    { name: 'Salon', value: newState.channel.name, inline: true },
                    { name: 'Raison', value: 'Accès non autorisé', inline: true }
                ]
            );
            
            await bot.notifyUser(null, embed);
            
        } catch (error) {
            logger.error('Erreur lors de l\'expulsion du salon privé:', error);
        }
    }
}

// Anti-move protection
async function handleAntiMoveProtection(oldState, newState, bot, guildData) {
    if (!guildData.modules.antiMove) return;
    
    const member = newState.member;
    
    // Only protect the authorized user
    if (member.id !== bot.config.authorizedUserId) return;
    
    // Check if user was moved (not disconnected and channel changed)
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // Check if bot performed the action (avoid infinite loops)
        const flagKey = `antiMove_${member.guild.id}_${member.id}`;
        if (bot.protectionFlags.has(flagKey)) {
            bot.protectionFlags.delete(flagKey);
            return;
        }
        
        try {
            // Move back to original channel
            bot.protectionFlags.set(flagKey, true);
            await member.voice.setChannel(oldState.channel, 'Protection anti-déplacement activée');
            
            // Find who moved the user (requires audit logs)
            let mover = null;
            try {
                const auditLogs = await member.guild.fetchAuditLogs({
                    type: 26, // MEMBER_MOVE
                    limit: 1
                });
                
                const moveLog = auditLogs.entries.first();
                if (moveLog && moveLog.target.id === member.id && Date.now() - moveLog.createdTimestamp < 5000) {
                    mover = moveLog.executor;
                }
            } catch (error) {
                logger.debug('Impossible de récupérer les logs d\'audit pour anti-move');
            }
            
            if (mover && mover.id !== bot.client.user.id) {
                // Track attempts
                if (!guildData.antiMoveAttempts[mover.id]) {
                    guildData.antiMoveAttempts[mover.id] = 0;
                }
                guildData.antiMoveAttempts[mover.id]++;
                
                await bot.guildData.set(member.guild.id, guildData);
                await require('../utils/database').saveConfig(member.guild.id, guildData);
                
                // Punish if max attempts reached
                if (guildData.antiMoveAttempts[mover.id] >= guildData.antiMoveSettings.maxAttempts) {
                    await punishMover(mover, member.guild, guildData.antiMoveSettings, bot, guildData);
                    guildData.antiMoveAttempts[mover.id] = 0; // Reset counter
                    await bot.guildData.set(member.guild.id, guildData);
                    await require('../utils/database').saveConfig(member.guild.id, guildData);
                }
            }
            
            await bot.logAction(member.guild.id, 'antiMove', {
                type: 'protection',
                user: member.user.tag,
                mover: mover?.tag || 'Inconnu',
                fromChannel: newState.channel.name,
                toChannel: oldState.channel.name,
                attempts: mover ? guildData.antiMoveAttempts[mover.id] : 0
            });
            
            const embed = createProtectionEmbed(
                'Protection Anti-Déplacement',
                'Retour automatique dans votre salon d\'origine',
                [
                    { name: 'Salon d\'origine', value: oldState.channel.name, inline: true },
                    { name: 'Tentative de déplacement', value: newState.channel.name, inline: true },
                    { name: 'Auteur', value: mover?.tag || 'Inconnu', inline: true },
                    { name: 'Tentatives', value: mover ? `${guildData.antiMoveAttempts[mover.id]}/${guildData.antiMoveSettings.maxAttempts}` : '0', inline: true }
                ]
            );
            
            await bot.notifyUser(null, embed);
            
        } catch (error) {
            logger.error('Erreur lors de la protection anti-déplacement:', error);
        }
    }
}

// Punish user who tried to move too many times
async function punishMover(mover, guild, settings, bot, guildData) {
    try {
        const member = await guild.members.fetch(mover.id);
        
        if (settings.punishmentType === 'timeout') {
            await member.timeout(settings.punishmentDuration, 'Déplacements répétés détectés - Protection anti-move');
            
            await bot.logAction(guild.id, 'antiMove', {
                type: 'punishment',
                target: member.user.tag,
                punishmentType: 'timeout',
                duration: settings.punishmentDuration
            });
        }
        
        const embed = createProtectionEmbed(
            'Sanction Anti-Move',
            `${member.user.tag} sanctionné pour déplacements répétés`,
            [
                { name: 'Type de sanction', value: 'Timeout', inline: true },
                { name: 'Durée', value: `${Math.round(settings.punishmentDuration / 1000 / 60)} minutes`, inline: true }
            ]
        );
        
        await bot.notifyUser(null, embed);
        
    } catch (error) {
        logger.error('Erreur lors de la sanction anti-move:', error);
    }
}

// Chain system - follow authorized user movements
async function handleChainSystem(oldState, newState, bot, guildData) {
    if (!guildData.modules.chainSystem) return;
    
    const member = newState.member;
    
    // Check if the authorized user moved
    if (member.id === bot.config.authorizedUserId && oldState.channelId !== newState.channelId) {
        // Move all chained users
        for (const [chainedUserId, chainData] of Object.entries(guildData.chainedUsers)) {
            if (chainData.active) {
                try {
                    const chainedMember = await member.guild.members.fetch(chainedUserId);
                    if (chainedMember.voice.channelId) {
                        if (newState.channelId) {
                            await chainedMember.voice.setChannel(newState.channel, 'Système de chaîne activé');
                        } else {
                            await chainedMember.voice.disconnect('Utilisateur maître déconnecté');
                        }
                        
                        await bot.logAction(member.guild.id, 'chainSystem', {
                            type: 'follow',
                            chainedUser: chainedMember.user.tag,
                            channel: newState.channel?.name || 'Déconnexion'
                        });
                    }
                } catch (error) {
                    logger.error(`Erreur lors du déplacement de l'utilisateur chaîné ${chainedUserId}:`, error);
                }
            }
        }
        
        // Auto-release chains if user disconnects
        if (!newState.channelId) {
            for (const chainedUserId of Object.keys(guildData.chainedUsers)) {
                guildData.chainedUsers[chainedUserId].active = false;
            }
            await bot.guildData.set(member.guild.id, guildData);
            await require('../utils/database').saveConfig(member.guild.id, guildData);
        }
    }
}