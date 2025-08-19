const { Events, ActivityType } = require('discord.js');
const { logger } = require('../utils/database');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client, bot) {
        logger.info(`Bot connecté en tant que ${client.user.tag}`);
        logger.info(`Présent sur ${client.guilds.cache.size} serveur(s)`);
        
        // Set bot activity
        client.user.setActivity('🛡️ Protection active', { 
            type: ActivityType.Watching 
        });
        
        // Load guild data for all servers
        for (const guild of client.guilds.cache.values()) {
            try {
                await bot.getGuildData(guild.id);
                logger.info(`Configuration chargée pour ${guild.name} (${guild.id})`);
            } catch (error) {
                logger.error(`Erreur lors du chargement de la configuration pour ${guild.name}:`, error);
            }
        }
        
        logger.info('Bot Discord Protect prêt et opérationnel');
        
        // Send notification to authorized user
        try {
            const user = await client.users.fetch(bot.config.authorizedUserId);
            await user.send('🛡️ **Discord Protect** est maintenant en ligne et opérationnel !');
        } catch (error) {
            logger.warn('Impossible d\'envoyer la notification de démarrage à l\'utilisateur autorisé');
        }
    }
};