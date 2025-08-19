const { createInfoEmbed, createErrorEmbed, createWarningEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'export',
        description: 'Exporter la configuration des rôles d\'un utilisateur au format JSON'
    },
    async execute(message, args, bot) {
        const targetUser = message.mentions.users.first();
        
        if (!targetUser) {
            const embed = createErrorEmbed(
                'Utilisateur Manquant',
                'Vous devez mentionner un utilisateur pour exporter sa configuration.',
                [{ name: 'Usage', value: '`=export @utilisateur`', inline: false }]
            );
            
            await message.channel.send({ embeds: [embed] });
            return;
        }
        
        try {
            const guildData = await bot.getGuildData(message.guild.id);
            let userConfig = null;
            let configSource = null;
            
            // Check if user has a saved configuration from =remove
            if (guildData.removedUserConfigs?.[targetUser.id]) {
                userConfig = guildData.removedUserConfigs[targetUser.id];
                configSource = 'saved';
            } else {
                // Get current configuration
                try {
                    const targetMember = await message.guild.members.fetch(targetUser.id);
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
                    
                    userConfig = {
                        userId: targetUser.id,
                        username: targetUser.tag,
                        roles: currentRoles,
                        exportedAt: Date.now(),
                        exportedBy: message.author.id,
                        nickname: targetMember.nickname,
                        joinedAt: targetMember.joinedAt?.getTime()
                    };
                    configSource = 'current';
                    
                } catch (fetchError) {
                    const embed = createWarningEmbed(
                        'Utilisateur Introuvable',
                        `${targetUser.tag} n'est pas sur ce serveur.`,
                        [
                            { name: 'Alternatives', value: 'Vérifiez si une configuration sauvegardée existe via `=remove`', inline: false }
                        ]
                    );
                    
                    await message.channel.send({ embeds: [embed] });
                    return;
                }
            }
            
            if (!userConfig || !userConfig.roles || userConfig.roles.length === 0) {
                const embed = createWarningEmbed(
                    'Aucune Configuration',
                    `${targetUser.tag} n'a aucun rôle à exporter.`,
                    [
                        { name: 'Information', value: configSource === 'saved' ? 'Configuration sauvegardée vide' : 'Aucun rôle actuel trouvé', inline: false }
                    ]
                );
                
                await message.channel.send({ embeds: [embed] });
                return;
            }
            
            // Create JSON export
            const exportData = {
                version: "1.0",
                exportInfo: {
                    guildId: message.guild.id,
                    guildName: message.guild.name,
                    exportedAt: Date.now(),
                    exportedBy: message.author.id,
                    exportedByTag: message.author.tag,
                    source: configSource
                },
                user: {
                    id: userConfig.userId,
                    tag: userConfig.username,
                    nickname: userConfig.nickname || null,
                    joinedAt: userConfig.joinedAt || null
                },
                roles: userConfig.roles,
                stats: {
                    totalRoles: userConfig.roles.length,
                    adminRoles: userConfig.roles.filter(r => BigInt(r.permissions) & BigInt('0x8')).length, // Administrator permission
                    coloredRoles: userConfig.roles.filter(r => r.color !== 0).length,
                    hoistedRoles: userConfig.roles.filter(r => r.hoist).length,
                    mentionableRoles: userConfig.roles.filter(r => r.mentionable).length
                }
            };
            
            const jsonString = JSON.stringify(exportData, null, 2);
            
            // Create summary embed
            const embed = createInfoEmbed(
                '📤 Export de Configuration',
                `Configuration exportée pour ${targetUser.tag}`,
                [
                    {
                        name: '👤 **Utilisateur**',
                        value: [
                            `**Nom:** ${userConfig.username}`,
                            `**ID:** ${userConfig.userId}`,
                            `**Pseudonyme:** ${userConfig.nickname || 'Aucun'}`,
                            `**Source:** ${configSource === 'saved' ? '💾 Configuration sauvée' : '🔄 Configuration actuelle'}`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '📊 **Statistiques**',
                        value: [
                            `**Total rôles:** ${exportData.stats.totalRoles}`,
                            `**Admin:** ${exportData.stats.adminRoles}`,
                            `**Colorés:** ${exportData.stats.coloredRoles}`,
                            `**Affichés séparément:** ${exportData.stats.hoistedRoles}`,
                            `**Mentionnables:** ${exportData.stats.mentionableRoles}`
                        ].join('\n'),
                        inline: true
                    }
                ]
            );
            
            if (configSource === 'saved') {
                const savedAt = new Date(userConfig.removedAt || userConfig.exportedAt);
                const removedBy = userConfig.removedBy ? `<@${userConfig.removedBy}>` : 'Inconnu';
                
                embed.addFields([{
                    name: '💾 **Configuration Sauvée**',
                    value: [
                        `**Sauvée le:** ${savedAt.toLocaleString('fr-FR')}`,
                        `**Supprimée par:** ${removedBy}`,
                        `**Rôles supprimés:** ${userConfig.removedRoles?.length || 0}`,
                        `**Échecs suppression:** ${userConfig.failedRoles?.length || 0}`
                    ].join('\n'),
                    inline: false
                }]);
            }
            
            // Show roles list (limited)
            const rolesList = userConfig.roles.slice(0, 15).map(role => 
                `• **${role.name}** (${role.id})${role.color !== 0 ? ` 🎨` : ''}${BigInt(role.permissions) & BigInt('0x8') ? ` 👑` : ''}`
            ).join('\n');
            
            embed.addFields([{
                name: `🎭 **Rôles (${Math.min(15, userConfig.roles.length)}/${userConfig.roles.length})**`,
                value: rolesList + (userConfig.roles.length > 15 ? `\n... +${userConfig.roles.length - 15} autres dans le JSON` : ''),
                inline: false
            }]);
            
            embed.addFields([{
                name: '🔧 **Utilisation**',
                value: [
                    `\`=add @${targetUser.tag} restore\` - Restaurer (si config sauvée)`,
                    '`=add @utilisateur <JSON>` - Restaurer depuis JSON',
                    'Copiez le JSON ci-dessous pour la sauvegarde externe'
                ].join('\n'),
                inline: false
            }]);
            
            await message.channel.send({ embeds: [embed] });
            
            // Send JSON in code block (split if too long)
            const maxLength = 1990; // Discord limit minus code block markers
            
            if (jsonString.length <= maxLength) {
                await message.channel.send(`\`\`\`json\n${jsonString}\`\`\``);
            } else {
                // Split JSON into multiple messages
                const lines = jsonString.split('\n');
                let currentBlock = '';
                let partNumber = 1;
                
                for (const line of lines) {
                    if (currentBlock.length + line.length + 1 > maxLength) {
                        await message.channel.send(`\`\`\`json\n${currentBlock}\`\`\``);
                        currentBlock = line;
                        partNumber++;
                    } else {
                        currentBlock += (currentBlock ? '\n' : '') + line;
                    }
                }
                
                if (currentBlock) {
                    await message.channel.send(`\`\`\`json\n${currentBlock}\`\`\``);
                }
                
                const splitEmbed = createInfoEmbed(
                    'JSON Divisé',
                    `La configuration JSON a été divisée en ${partNumber} parties en raison de sa taille.`
                );
                
                await message.channel.send({ embeds: [splitEmbed] });
            }
            
            await bot.logAction(message.guild.id, 'antiRaid', {
                type: 'configExported',
                target: targetUser.tag,
                user: message.author.tag,
                rolesCount: userConfig.roles.length,
                source: configSource,
                size: jsonString.length
            });
            
        } catch (error) {
            console.error('Erreur lors de l\'export:', error);
            
            const embed = createErrorEmbed(
                'Erreur d\'Export',
                'Une erreur est survenue lors de l\'export de la configuration.',
                [
                    { name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false },
                    { name: 'Vérifications', value: [
                        '• L\'utilisateur existe-t-il ?',
                        '• Y a-t-il une configuration à exporter ?',
                        '• Les permissions sont-elles suffisantes ?'
                    ].join('\n'), inline: false }
                ]
            );
            
            await message.channel.send({ embeds: [embed] });
        }
    }
};