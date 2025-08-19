const { createSuccessEmbed, createErrorEmbed, createWarningEmbed, createInfoEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'add',
        description: 'Ajouter un rôle spécifique ou restaurer une configuration complète'
    },
    async execute(message, args, bot) {
        const targetUser = message.mentions.users.first();
        
        if (!targetUser) {
            const embed = createInfoEmbed(
                'Usage de la Commande Add',
                'Ajouter des rôles ou restaurer une configuration utilisateur',
                [
                    {
                        name: '📝 **Syntaxes Disponibles**',
                        value: [
                            '`=add @utilisateur <role_id>` - Ajouter un rôle spécifique',
                            '`=add @utilisateur restore` - Restaurer la config sauvée',
                            '`=add @utilisateur <config_json>` - Restaurer depuis JSON'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '💡 **Exemples**',
                        value: [
                            '`=add @user 123456789` - Ajoute le rôle avec l\'ID 123456789',
                            '`=add @user restore` - Restaure la config après `=remove`',
                            '`=add @user {"roles":[...]}` - Restaure depuis export JSON'
                        ].join('\n'),
                        inline: false
                    }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        if (args.length < 2) {
            const embed = createErrorEmbed(
                'Arguments Manquants',
                'Vous devez spécifier un rôle ID, "restore", ou une configuration JSON.',
                [{ name: 'Usage', value: '`=add @utilisateur <role_id|restore|config_json>`', inline: false }]
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        const parameter = args.slice(1).join(' ');
        
        try {
            const targetMember = await message.guild.members.fetch(targetUser.id);
            const guildData = await bot.getGuildData(message.guild.id);
            
            if (parameter.toLowerCase() === 'restore') {
                await handleRestore(message, bot, guildData, targetUser, targetMember);
            } else if (parameter.startsWith('{')) {
                await handleJsonRestore(message, bot, guildData, targetUser, targetMember, parameter);
            } else {
                await handleSingleRole(message, bot, targetUser, targetMember, parameter);
            }
            
        } catch (error) {
            console.error('Erreur lors de l\'ajout:', error);
            
            const embed = createErrorEmbed(
                'Erreur d\'Ajout',
                'Une erreur est survenue lors de l\'ajout des rôles.',
                [
                    { name: 'Erreur', value: error.message || 'Membre introuvable', inline: false },
                    { name: 'Vérifications', value: [
                        '• L\'utilisateur est-il sur le serveur ?',
                        '• Le bot a-t-il les permissions requises ?',
                        '• Le rôle existe-t-il ?'
                    ].join('\n'), inline: false }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
        }
    }
};

async function handleSingleRole(message, bot, targetUser, targetMember, roleId) {
    const role = message.guild.roles.cache.get(roleId);
    
    if (!role) {
        const embed = createErrorEmbed(
            'Rôle Introuvable',
            `Aucun rôle trouvé avec l'ID: \`${roleId}\``,
            [{ name: 'Vérification', value: 'Assurez-vous que l\'ID du rôle est correct', inline: false }]
        );
        
        await message.channel.send({ embeds: [embed] });
        return;
    }
    
    // Check if bot can manage this role
    const botMember = await message.guild.members.fetch(bot.client.user.id);
    if (role.position >= botMember.roles.highest.position) {
        const embed = createWarningEmbed(
            'Rôle Trop Élevé',
            `Impossible d'ajouter le rôle **${role.name}** : il est plus haut que mon rôle le plus élevé.`,
            [
                { name: 'Rôle cible', value: `${role.name} (position ${role.position})`, inline: true },
                { name: 'Mon rôle le plus élevé', value: `${botMember.roles.highest.name} (position ${botMember.roles.highest.position})`, inline: true }
            ]
        );
        
        await message.channel.send({ embeds: [embed] });
        return;
    }
    
    if (targetMember.roles.cache.has(role.id)) {
        const embed = createWarningEmbed(
            'Rôle Déjà Présent',
            `${targetUser.tag} possède déjà le rôle **${role.name}**.`
        );
        
        await message.channel.send({ embeds: [embed] });
        return;
    }
    
    try {
        await targetMember.roles.add(role, 'Ajout manuel de rôle via commande');
        
        await bot.logAction(message.guild.id, 'antiRaid', {
            type: 'roleAdded',
            target: targetUser.tag,
            user: message.author.tag,
            role: role.name,
            roleId: role.id
        });
        
        const embed = createSuccessEmbed(
            '✅ Rôle Ajouté',
            `Le rôle **${role.name}** a été ajouté à ${targetUser.tag}.`,
            [
                { name: 'Utilisateur', value: targetUser.tag, inline: true },
                { name: 'Rôle ajouté', value: role.name, inline: true },
                { name: 'Couleur', value: role.hexColor || 'Défaut', inline: true }
            ]
        );
        
        await message.channel.send({ embeds: [embed] });
        
    } catch (error) {
        const embed = createErrorEmbed(
            'Échec d\'Ajout',
            `Impossible d'ajouter le rôle **${role.name}** à ${targetUser.tag}.`,
            [{ name: 'Erreur', value: error.message, inline: false }]
        );
        
        await message.channel.send({ embeds: [embed] });
    }
}

async function handleRestore(message, bot, guildData, targetUser, targetMember) {
    const savedConfig = guildData.removedUserConfigs?.[targetUser.id];
    
    if (!savedConfig) {
        const embed = createWarningEmbed(
            'Aucune Configuration Sauvée',
            `Aucune configuration sauvegardée trouvée pour ${targetUser.tag}.`,
            [
                { name: 'Information', value: 'La configuration est sauvée automatiquement lors de l\'utilisation de `=remove`', inline: false },
                { name: 'Alternative', value: 'Utilisez `=add @user <config_json>` avec une configuration exportée', inline: false }
            ]
        );
        
        await message.channel.send({ embeds: [embed] });
        return;
    }
    
    await restoreFromConfig(message, bot, guildData, targetUser, targetMember, savedConfig);
}

async function handleJsonRestore(message, bot, guildData, targetUser, targetMember, jsonString) {
    try {
        const config = JSON.parse(jsonString);
        
        if (!config.roles || !Array.isArray(config.roles)) {
            throw new Error('Configuration JSON invalide: propriété "roles" manquante ou invalide');
        }
        
        await restoreFromConfig(message, bot, guildData, targetUser, targetMember, config);
        
    } catch (parseError) {
        const embed = createErrorEmbed(
            'JSON Invalide',
            'Impossible de parser la configuration JSON fournie.',
            [
                { name: 'Erreur', value: parseError.message, inline: false },
                { name: 'Format attendu', value: '`{"roles":[{"id":"...","name":"..."}]}`', inline: false }
            ]
        );
        
        await message.channel.send({ embeds: [embed] });
    }
}

async function restoreFromConfig(message, bot, guildData, targetUser, targetMember, config) {
    const roles = config.roles || [];
    let addedRoles = [];
    let failedRoles = [];
    let skippedRoles = [];
    
    for (const roleData of roles) {
        try {
            const role = message.guild.roles.cache.get(roleData.id);
            
            if (!role) {
                failedRoles.push(`${roleData.name} (rôle supprimé)`);
                continue;
            }
            
            if (targetMember.roles.cache.has(role.id)) {
                skippedRoles.push(role.name);
                continue;
            }
            
            // Check if bot can manage this role
            const botMember = await message.guild.members.fetch(bot.client.user.id);
            if (role.position >= botMember.roles.highest.position) {
                failedRoles.push(`${role.name} (trop élevé)`);
                continue;
            }
            
            await targetMember.roles.add(role, 'Restauration de configuration');
            addedRoles.push(role.name);
            
        } catch (error) {
            failedRoles.push(`${roleData.name} (${error.message})`);
        }
    }
    
    // Remove the saved configuration after successful restoration
    if (addedRoles.length > 0 && guildData.removedUserConfigs?.[targetUser.id]) {
        delete guildData.removedUserConfigs[targetUser.id];
        await bot.guildData.set(message.guild.id, guildData);
        await require('../utils/database').saveConfig(message.guild.id, guildData);
    }
    
    await bot.logAction(message.guild.id, 'antiRaid', {
        type: 'configRestored',
        target: targetUser.tag,
        user: message.author.tag,
        addedRoles: addedRoles.length,
        failedRoles: failedRoles.length,
        skippedRoles: skippedRoles.length,
        totalRoles: roles.length
    });
    
    const embed = createSuccessEmbed(
        '🔄 Configuration Restaurée',
        `Configuration restaurée pour ${targetUser.tag}.`,
        [
            { name: '✅ Rôles ajoutés', value: `${addedRoles.length}`, inline: true },
            { name: '⚠️ Ignorés (déjà présents)', value: `${skippedRoles.length}`, inline: true },
            { name: '❌ Échecs', value: `${failedRoles.length}`, inline: true }
        ]
    );
    
    if (addedRoles.length > 0) {
        embed.addFields([{
            name: '✅ **Rôles Ajoutés**',
            value: addedRoles.slice(0, 10).join(', ') + (addedRoles.length > 10 ? `\n... +${addedRoles.length - 10} autres` : ''),
            inline: false
        }]);
    }
    
    if (failedRoles.length > 0) {
        embed.addFields([{
            name: '❌ **Échecs**',
            value: failedRoles.slice(0, 5).join('\n') + (failedRoles.length > 5 ? `\n... +${failedRoles.length - 5} autres` : ''),
            inline: false
        }]);
    }
    
    await message.channel.send({ embeds: [embed] });
}