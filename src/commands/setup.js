const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    EmbedBuilder,
    ComponentType
} = require('discord.js');
const { createConfigEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'setup',
        description: 'Configuration interactive de tous les modules de protection'
    },
    async execute(message, args, bot) {
        const guildData = await bot.getGuildData(message.guild.id);
        
        try {
            const setupEmbed = createSetupEmbed(guildData);
            const components = createSetupComponents();
            
            const setupMessage = await message.channel.send({
                embeds: [setupEmbed],
                components: components
            });
            
            // Create collector for interactions
            const collector = setupMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });
            
            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== bot.config.authorizedUserId) {
                    await interaction.reply({ content: '❌ Seul l\'utilisateur autorisé peut utiliser cette configuration.', ephemeral: true });
                    return;
                }
                
                await handleSetupInteraction(interaction, bot, guildData, setupMessage);
            });
            
            collector.on('end', async () => {
                try {
                    const disabledComponents = components.map(row => {
                        const newRow = new ActionRowBuilder();
                        row.components.forEach(component => {
                            if (component.data.custom_id) {
                                component.setDisabled(true);
                                newRow.addComponents(component);
                            }
                        });
                        return newRow;
                    });
                    
                    await setupMessage.edit({ components: disabledComponents });
                } catch (error) {
                    // Message might be deleted
                }
            });
            
        } catch (error) {
            console.error('Erreur lors de la configuration:', error);
            await message.channel.send('❌ Une erreur est survenue lors de l\'ouverture de la configuration.');
        }
    }
};

function createSetupEmbed(guildData) {
    const embed = createConfigEmbed(
        'Configuration des Modules de Protection',
        'Utilisez les boutons ci-dessous pour configurer chaque module.',
        [
            {
                name: '🛡️ **Modules de Protection**',
                value: [
                    `Anti-Mute: ${getStatusEmoji(guildData.modules.antiMute)}`,
                    `Anti-Timeout: ${getStatusEmoji(guildData.modules.antiTimeout)}`,
                    `Anti-Rôle: ${getStatusEmoji(guildData.modules.antiRole)}`,
                    `Anti-Kick/Ban: ${getStatusEmoji(guildData.modules.antiKickBan)}`,
                    `Anti-Rename: ${getStatusEmoji(guildData.modules.antiRename)}`,
                    `Anti-Permissions: ${getStatusEmoji(guildData.modules.antiPermissions)}`,
                    `Verrouillage Nom: ${getStatusEmoji(guildData.modules.lockName)}`
                ].join('\n'),
                inline: true
            },
            {
                name: '🎤 **Modules Vocaux**',
                value: [
                    `Vocal Privé: ${getStatusEmoji(guildData.modules.privateVoice)}`,
                    `Anti-Move: ${getStatusEmoji(guildData.modules.antiMove)}`,
                    `Système Chaîne: ${getStatusEmoji(guildData.modules.chainSystem)}`,
                    `Réveil: ${getStatusEmoji(guildData.modules.wakeupSystem)}`,
                    `Anti-Ping: ${getStatusEmoji(guildData.modules.antiPing)}`
                ].join('\n'),
                inline: true
            },
            {
                name: '⚙️ **Configuration Avancée**',
                value: [
                    `Rôles protégés: ${guildData.protectedRoles?.length || 0}`,
                    `Salons verrouillés: ${guildData.lockedChannels?.length || 0}`,
                    `Notifications DM: ${getStatusEmoji(guildData.notifications?.dmAlerts)}`
                ].join('\n'),
                inline: false
            }
        ]
    );
    
    return embed;
}

function getStatusEmoji(status) {
    return status ? '🟢 Activé' : '🔴 Désactivé';
}

function createSetupComponents() {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('setup_protection')
                .setLabel('Protection')
                .setEmoji('🛡️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('setup_voice')
                .setLabel('Vocal')
                .setEmoji('🎤')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('setup_roles')
                .setLabel('Rôles Protégés')
                .setEmoji('👤')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('setup_advanced')
                .setLabel('Paramètres Avancés')
                .setEmoji('⚙️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('setup_notifications')
                .setLabel('Notifications')
                .setEmoji('📢')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('setup_reset')
                .setLabel('Réinitialiser')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Danger)
        );
    
    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('setup_close')
                .setLabel('Fermer')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return [row1, row2, row3];
}

async function handleSetupInteraction(interaction, bot, guildData, setupMessage) {
    const customId = interaction.customId;
    
    switch (customId) {
        case 'setup_protection':
            await handleProtectionSetup(interaction, bot, guildData);
            break;
        case 'setup_voice':
            await handleVoiceSetup(interaction, bot, guildData);
            break;
        case 'setup_roles':
            await handleRolesSetup(interaction, bot, guildData);
            break;
        case 'setup_advanced':
            await handleAdvancedSetup(interaction, bot, guildData);
            break;
        case 'setup_notifications':
            await handleNotificationsSetup(interaction, bot, guildData);
            break;
        case 'setup_reset':
            await handleResetConfig(interaction, bot, guildData);
            break;
        case 'setup_close':
            await setupMessage.delete();
            return;
    }
    
    // Update main setup message
    const updatedEmbed = createSetupEmbed(guildData);
    await setupMessage.edit({ embeds: [updatedEmbed] });
}

async function handleProtectionSetup(interaction, bot, guildData) {
    const protectionModules = [
        { id: 'antiMute', name: 'Anti-Mute/Deafen', description: 'Protection contre le mute/deafen vocal forcé' },
        { id: 'antiTimeout', name: 'Anti-Timeout', description: 'Protection contre les timeouts de communication' },
        { id: 'antiRole', name: 'Anti-Rôle', description: 'Protection des rôles contre la suppression' },
        { id: 'antiKickBan', name: 'Anti-Kick/Ban', description: 'Protection contre les expulsions/bans' },
        { id: 'antiRename', name: 'Anti-Rename', description: 'Protection du pseudonyme contre les modifications' },
        { id: 'antiPermissions', name: 'Anti-Permissions', description: 'Protection des permissions de rôles' },
        { id: 'lockName', name: 'Verrouillage Nom', description: 'Protection des noms de salons' },
        { id: 'antiPing', name: 'Anti-Ping', description: 'Suppression auto des messages qui vous mentionnent' }
    ];
    
    const options = protectionModules.map(module => ({
        label: module.name,
        value: module.id,
        description: module.description,
        emoji: guildData.modules[module.id] ? '🟢' : '🔴'
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('protection_select')
        .setPlaceholder('Sélectionnez un module de protection à configurer')
        .addOptions(options);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    const embed = createConfigEmbed(
        'Configuration des Modules de Protection',
        'Sélectionnez un module pour l\'activer ou le désactiver.'
    );
    
    const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
    
    try {
        const selectInteraction = await response.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            time: 60000
        });
        
        const moduleId = selectInteraction.values[0];
        guildData.modules[moduleId] = !guildData.modules[moduleId];
        
        await bot.guildData.set(interaction.guild.id, guildData);
        await require('../utils/database').saveConfig(interaction.guild.id, guildData);
        
        const module = protectionModules.find(m => m.id === moduleId);
        const status = guildData.modules[moduleId] ? 'activé' : 'désactivé';
        
        await selectInteraction.update({
            content: `✅ Module **${module.name}** ${status} avec succès.`,
            embeds: [],
            components: []
        });
        
    } catch (error) {
        await interaction.editReply({
            content: '⏰ Temps écoulé pour la sélection.',
            components: []
        });
    }
}

async function handleVoiceSetup(interaction, bot, guildData) {
    // Similar to protection setup but for voice modules
    const voiceModules = [
        { id: 'privateVoice', name: 'Vocal Privé', description: 'Système de salons vocaux privés' },
        { id: 'antiMove', name: 'Anti-Move', description: 'Protection contre les déplacements vocaux' },
        { id: 'chainSystem', name: 'Système Chaîne', description: 'Système de chaînes vocales' },
        { id: 'wakeupSystem', name: 'Réveil', description: 'Système de réveil par déplacements' }
    ];
    
    const options = voiceModules.map(module => ({
        label: module.name,
        value: module.id,
        description: module.description,
        emoji: guildData.modules[module.id] ? '🟢' : '🔴'
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('voice_select')
        .setPlaceholder('Sélectionnez un module vocal à configurer')
        .addOptions(options);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    const embed = createConfigEmbed(
        'Configuration des Modules Vocaux',
        'Sélectionnez un module vocal pour l\'activer ou le désactiver.'
    );
    
    const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
    
    try {
        const selectInteraction = await response.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            time: 60000
        });
        
        const moduleId = selectInteraction.values[0];
        guildData.modules[moduleId] = !guildData.modules[moduleId];
        
        await bot.guildData.set(interaction.guild.id, guildData);
        await require('../utils/database').saveConfig(interaction.guild.id, guildData);
        
        const module = voiceModules.find(m => m.id === moduleId);
        const status = guildData.modules[moduleId] ? 'activé' : 'désactivé';
        
        await selectInteraction.update({
            content: `✅ Module **${module.name}** ${status} avec succès.`,
            embeds: [],
            components: []
        });
        
    } catch (error) {
        await interaction.editReply({
            content: '⏰ Temps écoulé pour la sélection.',
            components: []
        });
    }
}

async function handleRolesSetup(interaction, bot, guildData) {
    const guild = interaction.guild;
    const managedRoles = guild.roles.cache
        .filter(role => role.id !== guild.id && !role.managed && role.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .first(25); // Discord limit
    
    if (managedRoles.length === 0) {
        await interaction.reply({
            content: '❌ Aucun rôle gérable trouvé sur ce serveur.',
            ephemeral: true
        });
        return;
    }
    
    const options = managedRoles.map(role => ({
        label: role.name,
        value: role.id,
        description: `Position: ${role.position} | Membres: ${role.members.size}`,
        emoji: guildData.protectedRoles?.includes(role.id) ? '✅' : '⬜'
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('roles_select')
        .setPlaceholder('Sélectionnez les rôles à protéger')
        .setMaxValues(Math.min(options.length, 25))
        .addOptions(options);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    const embed = createConfigEmbed(
        'Configuration des Rôles Protégés',
        `Sélectionnez les rôles à protéger contre la suppression.\n\n**Rôles actuellement protégés:** ${guildData.protectedRoles?.length || 0}`
    );
    
    const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
    
    try {
        const selectInteraction = await response.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            time: 60000
        });
        
        guildData.protectedRoles = selectInteraction.values;
        
        await bot.guildData.set(interaction.guild.id, guildData);
        await require('../utils/database').saveConfig(interaction.guild.id, guildData);
        
        const roleNames = selectInteraction.values
            .map(roleId => guild.roles.cache.get(roleId)?.name)
            .filter(Boolean)
            .join(', ');
        
        await selectInteraction.update({
            content: `✅ **${selectInteraction.values.length}** rôle(s) protégé(s) configuré(s):\n${roleNames}`,
            embeds: [],
            components: []
        });
        
    } catch (error) {
        await interaction.editReply({
            content: '⏰ Temps écoulé pour la sélection.',
            components: []
        });
    }
}

async function handleAdvancedSetup(interaction, bot, guildData) {
    const embed = createConfigEmbed(
        'Paramètres Avancés',
        'Configuration des paramètres avancés des modules.',
        [
            {
                name: '🚫 Anti-Move',
                value: [
                    `Max tentatives: **${guildData.antiMoveSettings.maxAttempts}**`,
                    `Durée punition: **${Math.round(guildData.antiMoveSettings.punishmentDuration / 1000 / 60)}** minutes`,
                    `Type punition: **${guildData.antiMoveSettings.punishmentType}**`
                ].join('\n'),
                inline: true
            },
            {
                name: '⏰ Wakeup System',
                value: [
                    `Nombre de moves: **${guildData.wakeupSettings.movesCount}**`,
                    `Délai entre moves: **${guildData.wakeupSettings.moveDelay}**ms`
                ].join('\n'),
                inline: true
            }
        ]
    );
    
    await interaction.reply({
        embeds: [embed],
        content: '🔧 Utilisez les commandes spécifiques pour modifier ces paramètres en détail.',
        ephemeral: true
    });
}

async function handleNotificationsSetup(interaction, bot, guildData) {
    const notifications = guildData.notifications;
    
    const embed = createConfigEmbed(
        'Configuration des Notifications',
        'Paramètres actuels des notifications DM.'
    );
    
    const toggleButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('notif_dm')
                .setLabel(`DM Alertes: ${notifications.dmAlerts ? 'ON' : 'OFF'}`)
                .setEmoji(notifications.dmAlerts ? '🟢' : '🔴')
                .setStyle(notifications.dmAlerts ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('notif_admin')
                .setLabel(`Admin Rôle: ${notifications.adminRoleAlert ? 'ON' : 'OFF'}`)
                .setEmoji(notifications.adminRoleAlert ? '🟢' : '🔴')
                .setStyle(notifications.adminRoleAlert ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('notif_role')
                .setLabel(`Rôle Protégé: ${notifications.protectedRoleAlert ? 'ON' : 'OFF'}`)
                .setEmoji(notifications.protectedRoleAlert ? '🟢' : '🔴')
                .setStyle(notifications.protectedRoleAlert ? ButtonStyle.Success : ButtonStyle.Danger)
        );
    
    const response = await interaction.reply({
        embeds: [embed],
        components: [toggleButtons],
        ephemeral: true
    });
    
    try {
        const buttonInteraction = await response.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 60000
        });
        
        switch (buttonInteraction.customId) {
            case 'notif_dm':
                notifications.dmAlerts = !notifications.dmAlerts;
                break;
            case 'notif_admin':
                notifications.adminRoleAlert = !notifications.adminRoleAlert;
                break;
            case 'notif_role':
                notifications.protectedRoleAlert = !notifications.protectedRoleAlert;
                break;
        }
        
        await bot.guildData.set(interaction.guild.id, guildData);
        await require('../utils/database').saveConfig(interaction.guild.id, guildData);
        
        await buttonInteraction.update({
            content: '✅ Paramètres de notification mis à jour.',
            embeds: [],
            components: []
        });
        
    } catch (error) {
        await interaction.editReply({
            content: '⏰ Temps écoulé pour la sélection.',
            components: []
        });
    }
}

async function handleResetConfig(interaction, bot, guildData) {
    const confirmButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_reset')
                .setLabel('Confirmer la réinitialisation')
                .setEmoji('⚠️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('cancel_reset')
                .setLabel('Annuler')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const embed = createConfigEmbed(
        '⚠️ Réinitialisation de la Configuration',
        'Êtes-vous sûr de vouloir réinitialiser toute la configuration ?\n\n**Cette action est irréversible !**'
    );
    
    const response = await interaction.reply({
        embeds: [embed],
        components: [confirmButton],
        ephemeral: true
    });
    
    try {
        const confirmInteraction = await response.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30000
        });
        
        if (confirmInteraction.customId === 'confirm_reset') {
            // Reset to default configuration
            const defaultConfig = require('../utils/database').loadConfig().defaultSettings;
            Object.assign(guildData, {
                modules: { ...defaultConfig.modules },
                protectedRoles: [...defaultConfig.protectedRoles],
                lockedChannels: [...defaultConfig.lockedChannels],
                antiMoveSettings: { ...defaultConfig.antiMoveSettings },
                wakeupSettings: { ...defaultConfig.wakeupSettings },
                notifications: { ...defaultConfig.notifications },
                logs: [],
                privateVoiceChannels: {},
                chainedUsers: {},
                antiMoveAttempts: {}
            });
            
            await bot.guildData.set(interaction.guild.id, guildData);
            await require('../utils/database').saveConfig(interaction.guild.id, guildData);
            
            await confirmInteraction.update({
                content: '✅ Configuration réinitialisée avec succès.',
                embeds: [],
                components: []
            });
        } else {
            await confirmInteraction.update({
                content: '❌ Réinitialisation annulée.',
                embeds: [],
                components: []
            });
        }
        
    } catch (error) {
        await interaction.editReply({
            content: '⏰ Temps écoulé pour la confirmation.',
            components: []
        });
    }
}