const { createInfoEmbed } = require('../utils/embeds');

module.exports = {
    data: {
        name: 'all',
        description: 'Documentation complète de toutes les commandes disponibles'
    },
    async execute(message, args, bot) {
        try {
            // Main commands embed
            const mainEmbed = createInfoEmbed(
                '📚 Guide Complet des Commandes',
                `**Préfixe:** \`${bot.config.prefix}\`\n**Utilisateur autorisé:** <@${bot.config.authorizedUserId}>\n\n*Toutes les commandes sont en français et optimisées pour votre protection.*`,
                [
                    {
                        name: '⚙️ **Commandes de Configuration**',
                        value: [
                            '`=setup` - Configuration interactive complète',
                            '`=dashboard` - Tableau de bord en temps réel', 
                            '`=log [nombre] [filtre]` - Journaux d\'activité (1-20)',
                            '`=permissions` - Vérification des permissions du bot',
                            '`=all` - Cette documentation complète'
                        ].join('\n'),
                        inline: false
                    }
                ]
            );
            
            // Voice commands embed
            const voiceEmbed = createInfoEmbed(
                '🎤 Commandes Vocales',
                'Gestion avancée des salons vocaux et protection'
            );
            
            voiceEmbed.addFields([
                {
                    name: '🔒 **Vocal Privé (`=pv`)**',
                    value: [
                        '`=pv` - Rendre privé/public le salon actuel',
                        '`=pv add @utilisateur` - Ajouter un membre autorisé',
                        '`=pv remove @utilisateur` - Retirer un membre autorisé',
                        '`=pv list` - Voir les membres autorisés'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🚫 **Anti-Move (`=amoov`)**',
                    value: [
                        '`=amoov` - Activer/désactiver l\'anti-déplacement',
                        '*Ramène automatiquement dans le salon d\'origine*',
                        '*Punit après 3 tentatives par timeout*'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '⛓️ **Système de Chaînes (`=chain`)**',
                    value: [
                        '`=chain @utilisateur` - Créer/supprimer une chaîne',
                        '*L\'utilisateur vous suit automatiquement*',
                        '*Se libère automatiquement à la déconnexion*'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '⏰ **Réveil (`=wakeup`)**',
                    value: [
                        '`=wakeup @utilisateur` - Réveiller par déplacements',
                        '*Déplace rapidement à travers tous les salons*',
                        '*Nombre de déplacements configurable*'
                    ].join('\n'),
                    inline: false
                }
            ]);
            
            // Protection commands embed
            const protectionEmbed = createInfoEmbed(
                '🛡️ Commandes de Protection',
                'Gestion des protections et anti-raid'
            );
            
            protectionEmbed.addFields([
                {
                    name: '🔒 **Protection des Salons**',
                    value: [
                        '`=lockname` - Verrouiller le nom du salon actuel',
                        '`=lockname #salon lock` - Verrouiller un salon spécifique',
                        '`=lockname #salon unlock` - Déverrouiller un salon'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🚨 **Anti-Raid**',
                    value: [
                        '`=remove @utilisateur` - Retirer toutes les permissions',
                        '`=add @utilisateur <role_id>` - Ajouter un rôle spécifique',
                        '`=add @utilisateur <config_json>` - Restaurer une config',
                        '`=export @utilisateur` - Exporter la config des rôles'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📵 **Anti-Ping**',
                    value: [
                        '`=aping` - Activer/désactiver l\'anti-ping',
                        '*Supprime tous les messages qui vous mentionnent*',
                        '*Logs détaillés des tentatives*'
                    ].join('\n'),
                    inline: false
                }
            ]);
            
            // Protection modules embed
            const modulesEmbed = createInfoEmbed(
                '🔧 Modules de Protection Automatiques',
                'Protection passive continue sans commandes'
            );
            
            modulesEmbed.addFields([
                {
                    name: '🛡️ **Protection Personnelle**',
                    value: [
                        '**Anti-Mute/Deafen** - Annule mute/sourd vocal forcé',
                        '**Anti-Timeout** - Supprime les timeouts automatiquement', 
                        '**Anti-Rôle** - Restaure les rôles protégés supprimés',
                        '**Anti-Kick/Ban** - Crée une invitation de retour',
                        '**Anti-Rename** - Protège votre pseudonyme',
                        '**Anti-Permissions** - Protège les permissions des rôles'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🎤 **Protection Vocale**',
                    value: [
                        '**Salons Privés** - Expulsion automatique des intrus',
                        '**Anti-Move** - Retour automatique + sanction',
                        '**Système Chaînes** - Suivi vocal automatique',
                        '**Wakeup System** - Déplacements multiples rapides'
                    ].join('\n'),
                    inline: false
                }
            ]);
            
            // Usage examples embed
            const examplesEmbed = createInfoEmbed(
                '💡 Exemples d\'Utilisation',
                'Cas d\'usage courants et bonnes pratiques'
            );
            
            examplesEmbed.addFields([
                {
                    name: '🚀 **Première Configuration**',
                    value: [
                        '1. `=permissions` - Vérifier les permissions',
                        '2. `=setup` - Configuration interactive',
                        '3. `=dashboard` - Vérifier le statut',
                        '4. `=log 5` - Tester les journaux'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🔍 **Surveillance**',
                    value: [
                        '`=dashboard` - Vue d\'ensemble temps réel',
                        '`=log 15 protection` - Activité de protection',
                        '`=log 10 voice` - Activité vocale',
                        '`=log 20` - Toute l\'activité récente'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🎯 **Gestion Vocale**',
                    value: [
                        '`=pv` puis `=pv add @ami` - Salon privé avec ami',
                        '`=amoov` - Activer anti-déplacement',
                        '`=chain @assistant` - Créer une chaîne',
                        '`=wakeup @dormeur` - Réveiller quelqu\'un'
                    ].join('\n'),
                    inline: false
                }
            ]);
            
            // Important notes embed
            const notesEmbed = createInfoEmbed(
                '⚠️ Notes Importantes',
                'Informations cruciales pour une utilisation optimale'
            );
            
            notesEmbed.addFields([
                {
                    name: '🔐 **Sécurité**',
                    value: [
                        '• Seul l\'utilisateur autorisé peut utiliser les commandes',
                        '• Messages de commande supprimés automatiquement',
                        '• Notifications DM pour les actions importantes',
                        '• Logs détaillés de toutes les actions'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '⚙️ **Recommandations**',
                    value: [
                        '• Accordez la permission "Administrateur" au bot',
                        '• Placez le rôle du bot au-dessus des autres',
                        '• Configurez les rôles protégés via `=setup`',
                        '• Surveillez régulièrement avec `=dashboard`'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🆘 **Support**',
                    value: [
                        '• `=permissions` pour diagnostiquer les problèmes',
                        '• `=log error` pour voir les erreurs récentes',
                        '• Configuration sauvegardée automatiquement',
                        '• Reset possible via `=setup` → Réinitialiser'
                    ].join('\n'),
                    inline: false
                }
            ]);
            
            // Send all embeds
            await message.channel.send({ embeds: [mainEmbed] });
            await message.channel.send({ embeds: [voiceEmbed] });
            await message.channel.send({ embeds: [protectionEmbed] });
            await message.channel.send({ embeds: [modulesEmbed] });
            await message.channel.send({ embeds: [examplesEmbed] });
            await message.channel.send({ embeds: [notesEmbed] });
            
        } catch (error) {
            console.error('Erreur lors de l\'affichage de la documentation:', error);
            await message.channel.send('❌ Une erreur est survenue lors de l\'affichage de la documentation.');
        }
    }
};