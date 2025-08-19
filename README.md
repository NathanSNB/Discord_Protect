# 🛡️ Discord Protect - Bot de Protection Personnelle

Bot Discord avancé de protection personnelle avec interface française complète et fonctionnalités anti-modération.

## ✨ Fonctionnalités Principales

### 🛡️ Modules de Protection Automatiques
- **Anti-Mute/Deafen** - Protection contre le mute/deafen vocal forcé
- **Anti-Timeout** - Suppression automatique des timeouts de communication
- **Anti-Rôle** - Protection des rôles contre la suppression + restauration auto
- **Anti-Kick/Ban** - Protection contre expulsions/bans avec auto-invitation de retour
- **Anti-Rename** - Protection du pseudonyme contre les modifications
- **Anti-Permissions** - Protection des permissions de rôles + recréation auto

### 🎤 Gestion Vocale Avancée
- **Salons Vocaux Privés** - Système complet de salons privés avec gestion des membres
- **Anti-Move** - Protection contre les déplacements forcés avec système de sanctions
- **Système de Chaînes** - Suivi vocal automatique d'utilisateurs spécifiques  
- **Système de Réveil** - Réveil d'utilisateurs par déplacements rapides multi-salons

### ⚙️ Interface de Configuration
- **Configuration Interactive** - Menus déroulants et boutons pour tous les paramètres
- **Dashboard Temps Réel** - Métriques système, statut modules, activité récente
- **Système de Logs Avancé** - Journaux détaillés avec filtres et recherche
- **Vérification Permissions** - Diagnostic complet des permissions du bot

### 🚨 Fonctionnalités Anti-Raid
- **Suppression Permissions** - Retrait complet des permissions avec sauvegarde
- **Restauration Intelligente** - Remise des rôles depuis sauvegarde ou JSON
- **Export Configuration** - Export JSON complet des configurations utilisateurs
- **Alertes Temps Réel** - Notifications DM des actions de protection

## 🚀 Installation et Configuration

### Prérequis
- Node.js 16.0.0 ou plus récent
- Bot Discord avec les permissions appropriées
- Serveur Discord où vous êtes administrateur

### 1. Installation
```bash
git clone https://github.com/NathanSNB/Discord_Protect.git
cd Discord_Protect
npm install
```

### 2. Configuration
1. Copiez `config.example.json` vers `config.json`
2. Éditez `config.json` avec vos informations :

```json
{
  "token": "VOTRE_TOKEN_BOT_DISCORD",
  "clientId": "ID_CLIENT_BOT",
  "authorizedUserId": "VOTRE_ID_UTILISATEUR_DISCORD",
  "prefix": "=",
  "deleteCommandMessages": true,
  "dmNotifications": true
}
```

### 3. Permissions Discord Requises
Le bot nécessite les permissions suivantes (recommandé : **Administrateur**) :
- Voir les salons
- Envoyer des messages  
- Lire l'historique des messages
- Gérer les messages
- Gérer les rôles
- Gérer les pseudonymes
- Gérer les salons
- Expulser des membres
- Bannir des membres
- Modérer les membres (timeout)
- Déplacer des membres
- Rendre muet des membres
- Rendre sourd des membres
- Créer des invitations instantanées

### 4. Lancement
```bash
npm start
```

## 📖 Utilisation

### Commandes Principales

#### Configuration et Monitoring
- `=setup` - Configuration interactive complète avec menus
- `=dashboard` - Tableau de bord temps réel avec métriques
- `=log [nombre] [filtre]` - Affichage des journaux (1-20 entrées)
- `=permissions` - Vérification des permissions du bot
- `=all` - Documentation complète des commandes

#### Gestion Vocale
- `=pv` - Basculer salon vocal privé/public
- `=pv add @utilisateur` - Ajouter membre autorisé au salon privé
- `=pv remove @utilisateur` - Retirer membre autorisé du salon privé
- `=pv list` - Lister les membres autorisés
- `=amoov` - Activer/désactiver protection anti-déplacement
- `=chain @utilisateur` - Créer/supprimer chaîne vocale
- `=wakeup @utilisateur` - Réveiller par déplacements rapides

#### Protection et Anti-Raid
- `=lockname [#salon] [lock/unlock]` - Verrouiller nom de salon
- `=remove @utilisateur` - Supprimer toutes permissions (avec sauvegarde)
- `=add @utilisateur <role_id|restore|config_json>` - Ajouter rôle/restaurer config
- `=export @utilisateur` - Exporter configuration JSON des rôles
- `=aping` - Activer/désactiver suppression auto des mentions

### Configuration des Modules

Utilisez `=setup` pour accéder au menu interactif de configuration :

1. **Modules de Protection** - Activer/désactiver chaque protection
2. **Modules Vocaux** - Configurer les fonctionnalités vocales  
3. **Rôles Protégés** - Sélectionner les rôles à protéger
4. **Paramètres Avancés** - Ajuster les seuils et durées
5. **Notifications** - Configurer les alertes DM

## 🔧 Architecture Technique

### Structure du Projet
```
src/
├── commands/           # Commandes du bot (=setup, =dashboard, etc.)
├── events/            # Gestionnaires d'événements Discord
├── utils/             # Utilitaires (base de données, embeds, permissions)
└── index.js          # Point d'entrée principal

data/                  # Configurations par serveur (JSON)
logs/                  # Journaux système avec rotation
```

### Fonctionnalités Techniques
- **Base de données JSON** - Stockage persistent des configurations par serveur
- **Système d'événements** - Gestion temps réel des changements Discord  
- **Protection anti-boucles** - Flags temporaires pour éviter les conflits
- **Cache mémoire** - Optimisation des performances
- **Gestion d'erreurs robuste** - Recovery automatique et logging
- **Rate-limiting intelligent** - Respect des limites API Discord

## 📊 Dashboard et Monitoring

Le dashboard (`=dashboard`) fournit une vue complète :

### Métriques Système
- Temps de fonctionnement (uptime)
- Utilisation mémoire
- Latence réseau (ping)
- Nombre de serveurs

### État des Modules
- Statut de chaque module de protection
- Activité en cours (salons privés, chaînes actives)
- Configuration actuelle (rôles protégés, notifications)

### Statistiques 24h
- Nombre d'actions de protection
- Commandes utilisées
- Alertes déclenchées
- Erreurs rencontrées

### Activité Récente
- Dernières actions de protection
- Journaux détaillés avec horodatage
- Informations contextuelles (utilisateurs, salons)

## 🔒 Sécurité et Confidentialité

### Contrôle d'Accès
- Commandes utilisables **uniquement** par l'utilisateur autorisé (ID configuré)
- Messages de commande supprimés automatiquement (configurable)
- Cooldown anti-spam sur toutes les commandes

### Protection des Données
- Configurations stockées localement (fichiers JSON)
- Aucune donnée transmise à des services tiers
- Logs avec rotation automatique (conservation 7 jours)
- Export/import de configurations pour sauvegardes

### Audit et Traçabilité  
- Toutes les actions loggées avec détails
- Horodatage précis de chaque événement
- Informations contextuelles (auteur, cible, raison)
- Notifications DM optionnelles pour surveillance

## 🆘 Dépannage

### Problèmes Courants

**Bot ne répond pas aux commandes**
- Vérifiez que l'ID utilisateur autorisé est correct dans `config.json`
- Confirmez que le préfixe est correct (par défaut `=`)
- Vérifiez les permissions du bot sur le serveur

**Modules de protection inactifs**  
- Utilisez `=permissions` pour vérifier les permissions manquantes
- Assurez-vous que le rôle du bot est au-dessus des rôles à gérer
- Activez les modules via `=setup` si nécessaire

**Erreurs de permissions**
- Accordez la permission "Administrateur" pour un fonctionnement optimal
- Vérifiez la hiérarchie des rôles dans les paramètres du serveur
- Consultez `=permissions` pour un diagnostic détaillé

### Support et Logs
- Consultez les logs dans le dossier `logs/` pour les erreurs détaillées
- Utilisez `=log error` pour voir les erreurs récentes
- Le dashboard (`=dashboard`) fournit une vue d'ensemble des problèmes

## 🔄 Mises à Jour et Maintenance

### Mises à Jour
```bash
git pull origin main
npm install
npm start
```

### Sauvegarde des Configurations
Les configurations sont automatiquement sauvegardées dans `data/`. 
Pour une sauvegarde manuelle complète :
```bash
cp -r data/ backup/data-$(date +%Y%m%d)
```

### Nettoyage Automatique
- Logs : rotation automatique tous les 7 jours
- Cache : nettoyage automatique au redémarrage
- Configurations obsolètes : archivage automatique

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

**⚠️ Important :** Ce bot est conçu pour la protection personnelle. Utilisez-le de manière responsable et respectez les conditions d'utilisation de Discord.