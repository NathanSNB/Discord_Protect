const { PermissionsBitField } = require('discord.js');

// Required permissions for different modules
const MODULE_PERMISSIONS = {
    antiMute: [PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.DeafenMembers],
    antiTimeout: [PermissionsBitField.Flags.ModerateMembers],
    antiRole: [PermissionsBitField.Flags.ManageRoles],
    antiKickBan: [PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.BanMembers, PermissionsBitField.Flags.CreateInstantInvite],
    antiRename: [PermissionsBitField.Flags.ManageNicknames],
    antiPermissions: [PermissionsBitField.Flags.ManageRoles],
    lockName: [PermissionsBitField.Flags.ManageChannels],
    privateVoice: [PermissionsBitField.Flags.MoveMembers, PermissionsBitField.Flags.ManageChannels],
    antiMove: [PermissionsBitField.Flags.MoveMembers],
    chainSystem: [PermissionsBitField.Flags.MoveMembers],
    wakeupSystem: [PermissionsBitField.Flags.MoveMembers],
    antiPing: [PermissionsBitField.Flags.ManageMessages]
};

// All essential permissions
const ESSENTIAL_PERMISSIONS = [
    PermissionsBitField.Flags.ViewChannels,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ReadMessageHistory,
    PermissionsBitField.Flags.UseExternalEmojis,
    PermissionsBitField.Flags.AddReactions
];

// Check if bot has required permissions
function checkPermissions(guild, modules = {}) {
    const botMember = guild.members.cache.get(guild.client.user.id);
    if (!botMember) return { hasPermissions: false, missing: ['Bot member not found'] };

    const missing = [];
    const hasPermissions = {};

    // Check essential permissions first
    for (const permission of ESSENTIAL_PERMISSIONS) {
        if (!botMember.permissions.has(permission)) {
            missing.push(getPermissionName(permission));
        }
    }

    // Check module-specific permissions
    for (const [moduleName, isActive] of Object.entries(modules)) {
        if (isActive && MODULE_PERMISSIONS[moduleName]) {
            const modulePermissions = MODULE_PERMISSIONS[moduleName];
            const moduleMissing = [];
            
            for (const permission of modulePermissions) {
                if (!botMember.permissions.has(permission)) {
                    moduleMissing.push(getPermissionName(permission));
                }
            }
            
            hasPermissions[moduleName] = moduleMissing.length === 0;
            
            if (moduleMissing.length > 0) {
                missing.push(...moduleMissing);
            }
        } else {
            hasPermissions[moduleName] = true; // Not active, so no permissions needed
        }
    }

    return {
        hasPermissions: missing.length === 0,
        missing: [...new Set(missing)], // Remove duplicates
        moduleStatus: hasPermissions,
        isAdmin: botMember.permissions.has(PermissionsBitField.Flags.Administrator)
    };
}

// Get human-readable permission name
function getPermissionName(permission) {
    const names = {
        [PermissionsBitField.Flags.Administrator]: 'Administrateur',
        [PermissionsBitField.Flags.ViewChannels]: 'Voir les salons',
        [PermissionsBitField.Flags.SendMessages]: 'Envoyer des messages',
        [PermissionsBitField.Flags.ReadMessageHistory]: 'Lire l\'historique des messages',
        [PermissionsBitField.Flags.ManageMessages]: 'Gérer les messages',
        [PermissionsBitField.Flags.UseExternalEmojis]: 'Utiliser des émojis externes',
        [PermissionsBitField.Flags.AddReactions]: 'Ajouter des réactions',
        [PermissionsBitField.Flags.MuteMembers]: 'Rendre muet des membres',
        [PermissionsBitField.Flags.DeafenMembers]: 'Rendre sourd des membres',
        [PermissionsBitField.Flags.MoveMembers]: 'Déplacer des membres',
        [PermissionsBitField.Flags.ManageRoles]: 'Gérer les rôles',
        [PermissionsBitField.Flags.ManageChannels]: 'Gérer les salons',
        [PermissionsBitField.Flags.ManageNicknames]: 'Gérer les pseudonymes',
        [PermissionsBitField.Flags.KickMembers]: 'Expulser des membres',
        [PermissionsBitField.Flags.BanMembers]: 'Bannir des membres',
        [PermissionsBitField.Flags.ModerateMembers]: 'Modérer les membres (timeout)',
        [PermissionsBitField.Flags.CreateInstantInvite]: 'Créer des invitations instantanées'
    };

    return names[permission] || 'Permission inconnue';
}

// Check if bot can manage a specific role
function canManageRole(guild, roleId) {
    const botMember = guild.members.cache.get(guild.client.user.id);
    const role = guild.roles.cache.get(roleId);
    
    if (!botMember || !role) return false;
    
    // Bot needs Manage Roles permission
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) return false;
    
    // Bot's highest role must be higher than the target role
    return botMember.roles.highest.position > role.position;
}

// Check if bot can manage a specific member
function canManageMember(guild, memberId) {
    const botMember = guild.members.cache.get(guild.client.user.id);
    const targetMember = guild.members.cache.get(memberId);
    
    if (!botMember || !targetMember) return false;
    
    // Can't manage guild owner
    if (targetMember.id === guild.ownerId) return false;
    
    // Bot's highest role must be higher than target's highest role
    return botMember.roles.highest.position > targetMember.roles.highest.position;
}

// Get detailed permissions report
function getPermissionsReport(guild, modules) {
    const result = checkPermissions(guild, modules);
    const report = {
        overall: result.hasPermissions ? 'Toutes les permissions requises sont présentes' : 'Certaines permissions manquent',
        isAdmin: result.isAdmin,
        essential: {
            status: ESSENTIAL_PERMISSIONS.every(p => guild.members.cache.get(guild.client.user.id)?.permissions.has(p)),
            missing: result.missing.filter(p => ESSENTIAL_PERMISSIONS.some(ep => getPermissionName(ep) === p))
        },
        modules: {},
        recommendations: []
    };

    // Check each module
    for (const [moduleName, isActive] of Object.entries(modules)) {
        if (MODULE_PERMISSIONS[moduleName]) {
            const modulePermissions = MODULE_PERMISSIONS[moduleName];
            const moduleMissing = modulePermissions.filter(p => !guild.members.cache.get(guild.client.user.id)?.permissions.has(p));
            
            report.modules[moduleName] = {
                active: isActive,
                hasPermissions: moduleMissing.length === 0,
                missing: moduleMissing.map(getPermissionName),
                required: modulePermissions.map(getPermissionName)
            };
        }
    }

    // Generate recommendations
    if (result.missing.length > 0) {
        if (!result.isAdmin) {
            report.recommendations.push('🔧 Recommandation: Donnez le rôle "Administrateur" au bot pour un fonctionnement optimal');
        }
        report.recommendations.push('⚠️ Permissions manquantes détectées - certains modules pourraient ne pas fonctionner');
        report.recommendations.push('📋 Vérifiez que le rôle du bot est placé au-dessus des rôles à gérer');
    }

    return report;
}

module.exports = {
    MODULE_PERMISSIONS,
    ESSENTIAL_PERMISSIONS,
    checkPermissions,
    getPermissionName,
    canManageRole,
    canManageMember,
    getPermissionsReport
};