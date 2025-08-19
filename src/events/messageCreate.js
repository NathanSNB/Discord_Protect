const { Events } = require('discord.js');
const { logger } = require('../utils/database');
const { createProtectionEmbed } = require('../utils/embeds');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, bot) {
        // Ignore bot messages and non-guild messages
        if (message.author.bot || !message.guild) return;
        
        // Only handle messages that start with the prefix
        if (!message.content.startsWith(bot.config.prefix)) {
            // Check for anti-ping protection
            if (await handleAntiPing(message, bot)) return;
            return;
        }

        // Check if user is authorized
        if (message.author.id !== bot.config.authorizedUserId) {
            await message.delete().catch(() => {});
            return;
        }

        const args = message.content.slice(bot.config.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = bot.commands.get(commandName);
        if (!command) return;

        // Check cooldowns
        if (!checkCooldown(message.author.id, commandName, bot)) {
            const reply = await message.reply('⏳ Veuillez patienter avant d\'utiliser cette commande à nouveau.');
            setTimeout(() => reply.delete().catch(() => {}), 3000);
            return;
        }

        try {
            await command.execute(message, args, bot);
            
            // Delete command message if configured
            if (bot.config.deleteCommandMessages) {
                await message.delete().catch(() => {});
            }
            
            // Log command usage
            await bot.logAction(message.guild.id, 'command', {
                command: commandName,
                user: message.author.tag,
                channel: message.channel.name
            });

        } catch (error) {
            logger.error(`Erreur lors de l'exécution de la commande ${commandName}:`, error);
            
            const errorEmbed = createProtectionEmbed(
                'Erreur de commande',
                `Une erreur s'est produite lors de l'exécution de \`${commandName}\``,
                [{ name: 'Erreur', value: error.message || 'Erreur inconnue', inline: false }]
            );
            
            await message.channel.send({ embeds: [errorEmbed] }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 10000);
            });
        }
    }
};

// Check command cooldown
function checkCooldown(userId, commandName, bot) {
    const now = Date.now();
    const cooldownAmount = bot.config.cooldownDuration;
    
    if (!bot.cooldowns.has(commandName)) {
        bot.cooldowns.set(commandName, new Map());
    }
    
    const timestamps = bot.cooldowns.get(commandName);
    
    if (timestamps.has(userId)) {
        const expirationTime = timestamps.get(userId) + cooldownAmount;
        
        if (now < expirationTime) {
            return false;
        }
    }
    
    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);
    
    return true;
}

// Handle anti-ping protection
async function handleAntiPing(message, bot) {
    const guildData = await bot.getGuildData(message.guild.id);
    
    if (!guildData.modules.antiPing) return false;
    
    // Check if message mentions the authorized user
    if (message.mentions.users.has(bot.config.authorizedUserId)) {
        // Don't delete messages from the authorized user themselves
        if (message.author.id === bot.config.authorizedUserId) return false;
        
        try {
            await message.delete();
            
            await bot.logAction(message.guild.id, 'antiPing', {
                user: message.author.tag,
                userId: message.author.id,
                channel: message.channel.name,
                content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '')
            });
            
            // Send notification to authorized user
            const embed = createProtectionEmbed(
                'Anti-Ping Activé',
                `Message supprimé de ${message.author.tag}`,
                [
                    { name: 'Salon', value: message.channel.toString(), inline: true },
                    { name: 'Contenu', value: message.content.substring(0, 200) || 'Aucun contenu texte', inline: false }
                ]
            );
            
            await bot.notifyUser(null, embed);
            
            return true;
        } catch (error) {
            logger.error('Erreur lors de la suppression du message anti-ping:', error);
        }
    }
    
    return false;
}