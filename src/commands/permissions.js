const { createInfoEmbed, createSuccessEmbed, createWarningEmbed } = require('../utils/embeds');
const { getPermissionsReport } = require('../utils/permissions');

module.exports = {
    data: {
        name: 'permissions',
        description: 'Vérification complète des permissions du bot'
    },
    async execute(message, args, bot) {
        const guildData = await bot.getGuildData(message.guild.id);
        const guild = message.guild;
        
        try {
            // Get comprehensive permissions report
            const report = getPermissionsReport(guild, guildData.modules);
            
            // Create main permissions embed
            const permEmbed = report.overall.includes('Toutes') ? createSuccessEmbed(
                'Vérification des Permissions',
                report.overall
            ) : createWarningEmbed(
                'Vérification des Permissions', 
                report.overall
            );
            
            // Add general status
            permEmbed.addFields([
                {
                    name: '🔧 **Statut Général**',
                    value: [
                        `👑 Administrateur: ${report.isAdmin ? '✅ Oui' : '❌ Non'}`,
                        `📊 Permissions essentielles: ${report.essential.status ? '✅ Complètes' : '⚠️ Manquantes'}`,
                        `⚙️ Modules fonctionnels: ${Object.values(report.modules).filter(m => m.hasPermissions).length}/${Object.keys(report.modules).length}`
                    ].join('\n'),
                    inline: false
                }
            ]);
            
            // Add missing essential permissions if any
            if (report.essential.missing.length > 0) {
                permEmbed.addFields([{
                    name: '❌ **Permissions Essentielles Manquantes**',
                    value: report.essential.missing.map(p => `• ${p}`).join('\n'),
                    inline: false
                }]);
            }
            
            // Create module status embed
            const moduleEmbed = createInfoEmbed(
                'État des Modules de Protection',
                'Vérification des permissions par module'
            );
            
            const protectionModules = [];
            const voiceModules = [];
            const otherModules = [];
            
            for (const [moduleName, moduleData] of Object.entries(report.modules)) {
                const status = moduleData.active ? 
                    (moduleData.hasPermissions ? '🟢 Actif & Fonctionnel' : '🟡 Actif mais Permissions Manquantes') :
                    '🔴 Désactivé';
                
                const moduleInfo = `${getModuleName(moduleName)}: ${status}`;
                
                if (['antiMute', 'antiTimeout', 'antiRole', 'antiKickBan', 'antiRename', 'antiPermissions', 'lockName', 'antiPing'].includes(moduleName)) {
                    protectionModules.push(moduleInfo);
                } else if (['privateVoice', 'antiMove', 'chainSystem', 'wakeupSystem'].includes(moduleName)) {
                    voiceModules.push(moduleInfo);
                } else {
                    otherModules.push(moduleInfo);
                }
            }
            
            if (protectionModules.length > 0) {
                moduleEmbed.addFields([{
                    name: '🛡️ **Modules de Protection**',
                    value: protectionModules.join('\n'),
                    inline: false
                }]);
            }
            
            if (voiceModules.length > 0) {
                moduleEmbed.addFields([{
                    name: '🎤 **Modules Vocaux**',
                    value: voiceModules.join('\n'),
                    inline: false
                }]);
            }
            
            // Create detailed missing permissions embed if needed
            const missingPerms = [];
            for (const [moduleName, moduleData] of Object.entries(report.modules)) {
                if (moduleData.active && !moduleData.hasPermissions && moduleData.missing.length > 0) {
                    missingPerms.push(`**${getModuleName(moduleName)}:**\n${moduleData.missing.map(p => `• ${p}`).join('\n')}`);
                }
            }
            
            if (missingPerms.length > 0) {
                const missingEmbed = createWarningEmbed(
                    'Permissions Manquantes par Module',
                    'Les modules suivants nécessitent des permissions supplémentaires:'
                );
                
                // Split into multiple fields if too long
                let currentField = '';
                for (const perm of missingPerms) {
                    if (currentField.length + perm.length > 1024) {
                        missingEmbed.addFields([{
                            name: '⚠️ **Permissions Requises**',
                            value: currentField,
                            inline: false
                        }]);
                        currentField = perm;
                    } else {
                        currentField += (currentField ? '\n\n' : '') + perm;
                    }
                }
                
                if (currentField) {
                    missingEmbed.addFields([{
                        name: missingEmbed.data.fields?.length > 0 ? '⚠️ **Permissions Requises (suite)**' : '⚠️ **Permissions Requises**',
                        value: currentField,
                        inline: false
                    }]);
                }
                
                await message.channel.send({ embeds: [permEmbed, moduleEmbed, missingEmbed] });
            } else {
                await message.channel.send({ embeds: [permEmbed, moduleEmbed] });
            }
            
            // Add recommendations embed if needed
            if (report.recommendations.length > 0) {
                const recEmbed = createInfoEmbed(
                    'Recommandations',
                    'Suggestions pour améliorer le fonctionnement du bot'
                );
                
                recEmbed.addFields([{
                    name: '💡 **Conseils**',
                    value: report.recommendations.join('\n\n'),
                    inline: false
                }]);
                
                // Add setup instructions
                recEmbed.addFields([{
                    name: '🔧 **Instructions de Configuration**',
                    value: [
                        '1. Assurez-vous que le bot a un rôle avec les permissions nécessaires',
                        '2. Placez le rôle du bot au-dessus des rôles qu\'il doit gérer',
                        '3. Pour un fonctionnement optimal, accordez la permission "Administrateur"',
                        '4. Utilisez `=setup` pour configurer les modules selon vos besoins'
                    ].join('\n'),
                    inline: false
                }]);
                
                await message.channel.send({ embeds: [recEmbed] });
            }
            
        } catch (error) {
            console.error('Erreur lors de la vérification des permissions:', error);
            
            const errorEmbed = createWarningEmbed(
                'Erreur de Vérification',
                'Une erreur est survenue lors de la vérification des permissions.',
                [
                    { name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false },
                    { name: 'Action', value: 'Réessayez dans quelques instants', inline: false }
                ]
            );
            
            await message.channel.send({ embeds: [errorEmbed] });
        }
    }
};

function getModuleName(moduleId) {
    const names = {
        'antiMute': 'Anti-Mute/Deafen',
        'antiTimeout': 'Anti-Timeout', 
        'antiRole': 'Anti-Rôle',
        'antiKickBan': 'Anti-Kick/Ban',
        'antiRename': 'Anti-Rename',
        'antiPermissions': 'Anti-Permissions',
        'lockName': 'Verrouillage Nom',
        'privateVoice': 'Vocal Privé',
        'antiMove': 'Anti-Move',
        'chainSystem': 'Système Chaîne',
        'wakeupSystem': 'Système Réveil',
        'antiPing': 'Anti-Ping'
    };
    
    return names[moduleId] || moduleId;
}