const { Events } = require('discord.js');
const { logger } = require('../utils/database');
const { createProtectionEmbed } = require('../utils/embeds');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, bot) {
        const guildData = await bot.getGuildData(newMember.guild.id);
        
        // Handle different member update protections
        await handleAntiTimeoutProtection(oldMember, newMember, bot, guildData);
        await handleAntiRoleProtection(oldMember, newMember, bot, guildData);
        await handleAntiRenameProtection(oldMember, newMember, bot, guildData);
        await handleRoleAlerts(oldMember, newMember, bot, guildData);
    }
};

// Anti-timeout protection
async function handleAntiTimeoutProtection(oldMember, newMember, bot, guildData) {
    if (!guildData.modules.antiTimeout) return;
    
    // Only protect the authorized user
    if (newMember.id !== bot.config.authorizedUserId) return;
    
    // Check if timeout was applied
    if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
        // Check if bot performed the action (avoid infinite loops)
        const flagKey = `antiTimeout_${newMember.guild.id}_${newMember.id}`;
        if (bot.protectionFlags.has(flagKey)) {
            bot.protectionFlags.delete(flagKey);
            return;
        }
        
        try {
            bot.protectionFlags.set(flagKey, true);
            await newMember.timeout(null, 'Protection anti-timeout activée');
            
            // Find who applied the timeout
            let moderator = null;
            try {
                const auditLogs = await newMember.guild.fetchAuditLogs({
                    type: 24, // MEMBER_UPDATE
                    limit: 5
                });
                
                const timeoutLog = auditLogs.entries.find(entry => 
                    entry.target.id === newMember.id && 
                    entry.changes.some(change => change.key === 'communication_disabled_until') &&
                    Date.now() - entry.createdTimestamp < 10000
                );
                
                if (timeoutLog) {
                    moderator = timeoutLog.executor;
                }
            } catch (error) {
                logger.debug('Impossible de récupérer les logs d\'audit pour anti-timeout');
            }
            
            await bot.logAction(newMember.guild.id, 'antiTimeout', {
                type: 'removed',
                user: newMember.user.tag,
                moderator: moderator?.tag || 'Inconnu',
                originalDuration: newMember.communicationDisabledUntil?.toISOString()
            });
            
            const embed = createProtectionEmbed(
                'Protection Anti-Timeout',
                'Suppression automatique du timeout',
                [
                    { name: 'Modérateur', value: moderator?.tag || 'Inconnu', inline: true },
                    { name: 'Durée prévue', value: newMember.communicationDisabledUntil ? `Jusqu'à ${newMember.communicationDisabledUntil.toLocaleString('fr-FR')}` : 'Inconnue', inline: true }
                ]
            );
            
            await bot.notifyUser(null, embed);
            
        } catch (error) {
            logger.error('Erreur lors de la protection anti-timeout:', error);
            
            // If we can't remove timeout, at least notify
            const embed = createProtectionEmbed(
                'Tentative de Timeout Détectée',
                'Impossible de supprimer automatiquement le timeout (permissions insuffisantes)',
                [
                    { name: 'Statut', value: 'Protection échouée', inline: true },
                    { name: 'Action requise', value: 'Intervention manuelle nécessaire', inline: true }
                ]
            );
            
            await bot.notifyUser(null, embed);
        }
    }
}

// Anti-role removal protection
async function handleAntiRoleProtection(oldMember, newMember, bot, guildData) {
    if (!guildData.modules.antiRole) return;
    
    // Only protect the authorized user
    if (newMember.id !== bot.config.authorizedUserId) return;
    
    // Check for removed roles
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
    const protectedRoles = guildData.protectedRoles || [];
    
    for (const [roleId, role] of removedRoles) {
        if (protectedRoles.includes(roleId)) {
            // Check if bot performed the action (avoid infinite loops)
            const flagKey = `antiRole_${newMember.guild.id}_${newMember.id}_${roleId}`;
            if (bot.protectionFlags.has(flagKey)) {
                bot.protectionFlags.delete(flagKey);
                continue;
            }
            
            try {
                bot.protectionFlags.set(flagKey, true);
                await newMember.roles.add(role, 'Protection anti-suppression de rôle activée');
                
                // Find who removed the role
                let moderator = null;
                try {
                    const auditLogs = await newMember.guild.fetchAuditLogs({
                        type: 25, // MEMBER_ROLE_UPDATE
                        limit: 5
                    });
                    
                    const roleLog = auditLogs.entries.find(entry => 
                        entry.target.id === newMember.id &&
                        entry.changes.some(change => 
                            change.key === '$remove' && 
                            change.new.some(r => r.id === roleId)
                        ) &&
                        Date.now() - entry.createdTimestamp < 10000
                    );
                    
                    if (roleLog) {
                        moderator = roleLog.executor;
                    }
                } catch (error) {
                    logger.debug('Impossible de récupérer les logs d\'audit pour anti-role');
                }
                
                await bot.logAction(newMember.guild.id, 'antiRole', {
                    type: 'restored',
                    user: newMember.user.tag,
                    role: role.name,
                    roleId: role.id,
                    moderator: moderator?.tag || 'Inconnu'
                });
                
                const embed = createProtectionEmbed(
                    'Protection Anti-Rôle',
                    'Rôle protégé restauré automatiquement',
                    [
                        { name: 'Rôle', value: role.name, inline: true },
                        { name: 'Retiré par', value: moderator?.tag || 'Inconnu', inline: true }
                    ]
                );
                
                await bot.notifyUser(null, embed);
                
            } catch (error) {
                logger.error(`Erreur lors de la restauration du rôle ${role.name}:`, error);
                
                const embed = createProtectionEmbed(
                    'Protection Anti-Rôle Échouée',
                    `Impossible de restaurer le rôle ${role.name}`,
                    [
                        { name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false },
                        { name: 'Action requise', value: 'Vérifiez les permissions du bot', inline: false }
                    ]
                );
                
                await bot.notifyUser(null, embed);
            }
        }
    }
}

// Alert for protected role assignments
async function handleRoleAlerts(oldMember, newMember, bot, guildData) {
    if (!guildData.notifications?.protectedRoleAlert) return;
    
    // Check for added roles
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const protectedRoles = guildData.protectedRoles || [];
    
    for (const [roleId, role] of addedRoles) {
        if (protectedRoles.includes(roleId)) {
            // Alert for protected role assignment
            const embed = createProtectionEmbed(
                '🚨 Alerte Rôle Protégé',
                `Le rôle protégé **${role.name}** a été attribué à ${newMember.user.tag}`,
                [
                    { name: 'Utilisateur', value: newMember.user.tag, inline: true },
                    { name: 'Rôle', value: role.name, inline: true },
                    { name: 'Serveur', value: newMember.guild.name, inline: true }
                ]
            );
            
            await bot.notifyUser(null, embed);
            
            await bot.logAction(newMember.guild.id, 'alert', {
                type: 'protectedRoleAssigned',
                user: newMember.user.tag,
                role: role.name,
                roleId: role.id
            });
        }
    }
}

// Anti-rename protection
async function handleAntiRenameProtection(oldMember, newMember, bot, guildData) {
    if (!guildData.modules.antiRename) return;
    
    // Only protect the authorized user
    if (newMember.id !== bot.config.authorizedUserId) return;
    
    // Check if nickname was changed
    if (oldMember.nickname !== newMember.nickname) {
        // Store original nickname if not already stored
        if (!guildData.originalNickname) {
            guildData.originalNickname = oldMember.nickname;
            await bot.guildData.set(newMember.guild.id, guildData);
            await require('../utils/database').saveConfig(newMember.guild.id, guildData);
        }
        
        // Check if bot performed the action (avoid infinite loops)
        const flagKey = `antiRename_${newMember.guild.id}_${newMember.id}`;
        if (bot.protectionFlags.has(flagKey)) {
            bot.protectionFlags.delete(flagKey);
            return;
        }
        
        try {
            bot.protectionFlags.set(flagKey, true);
            await newMember.setNickname(guildData.originalNickname, 'Protection anti-rename activée');
            
            // Find who changed the nickname
            let moderator = null;
            try {
                const auditLogs = await newMember.guild.fetchAuditLogs({
                    type: 24, // MEMBER_UPDATE
                    limit: 5
                });
                
                const nicknameLog = auditLogs.entries.find(entry => 
                    entry.target.id === newMember.id &&
                    entry.changes.some(change => change.key === 'nick') &&
                    Date.now() - entry.createdTimestamp < 10000
                );
                
                if (nicknameLog) {
                    moderator = nicknameLog.executor;
                }
            } catch (error) {
                logger.debug('Impossible de récupérer les logs d\'audit pour anti-rename');
            }
            
            await bot.logAction(newMember.guild.id, 'antiRename', {
                type: 'reverted',
                user: newMember.user.tag,
                oldNickname: oldMember.nickname,
                newNickname: newMember.nickname,
                restoredNickname: guildData.originalNickname,
                moderator: moderator?.tag || 'Inconnu'
            });
            
            const embed = createProtectionEmbed(
                'Protection Anti-Rename',
                'Pseudonyme restauré automatiquement',
                [
                    { name: 'Ancien pseudo', value: oldMember.nickname || 'Aucun', inline: true },
                    { name: 'Tentative de changement', value: newMember.nickname || 'Aucun', inline: true },
                    { name: 'Restauré', value: guildData.originalNickname || 'Aucun', inline: true },
                    { name: 'Modifié par', value: moderator?.tag || 'Inconnu', inline: true }
                ]
            );
            
            await bot.notifyUser(null, embed);
            
        } catch (error) {
            logger.error('Erreur lors de la protection anti-rename:', error);
            
            const embed = createProtectionEmbed(
                'Protection Anti-Rename Échouée',
                'Impossible de restaurer le pseudonyme original',
                [
                    { name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false },
                    { name: 'Action requise', value: 'Vérifiez les permissions du bot', inline: false }
                ]
            );
            
            await bot.notifyUser(null, embed);
        }
    }
}