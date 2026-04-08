# Gitea Notifications VSCode Extension

View your Gitea notifications and Pull Requests directly inside VS Code, built for self-hosted instances and enterprise environments.

## ✨ Nouveautés version 1.1.0

✅ **Nouveau module Pull Requests**
- Liste automatique des Pull Requests ouvertes sur le repository courant
- Détection automatique du repository Git du workspace
- Actions directement depuis VS Code:
  - ✅ Approuver une PR
  - ⚠️ Demander des modifications
  - 💬 Ajouter un commentaire
  - 🔀 Fusionner une PR
- Affichage statut, auteur, branches et conflits
- Icônes colorées par état

✅ **Améliorations générales**
- Deux sections natives pliables dans le même panneau
- Gestion automatique connexion VPN / état hors ligne
- Badge compteur notifications uniquement
- Polling indépendant pour notifications et PRs
- Tous les cas d'erreur gérés et messages clairs

## Features

✅ Notifications list grouped by repository
✅ Unread count badge on the activity bar
✅ Mark notifications as read individually or all at once
✅ Open notification directly in your browser
✅ Auto-refresh with configurable interval
✅ Secure token storage in system keychain
✅ Shows PR/Issue author directly in the list
✅ Detailed tooltip on hover
✅ **Pull Requests list integrated**
✅ **Automatic Git repository detection**
✅ **PR Review actions directly from VS Code**
✅ **Offline / VPN connectivity detection**

## Configuration

1. Install the extension
2. Open command palette (`Ctrl+Shift+P`)
3. Run command `Gitea: Configurer le Token API`
4. Enter your Gitea server URL and personal access token

### Creating your Gitea token

1. Go to your Gitea account > Settings > Applications
2. Create new token with these permissions:
   - `notifications:read`
   - `notifications:write`
   - `user:read`
   - `repository:read`
   - `pullrequest:write`
3. Copy this token into the extension configuration

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitea.serverUrl` | `https://gitea.vpn` | Your Gitea server URL |
| `gitea.pollingInterval` | `60` | Auto refresh interval notifications (seconds) |
| `gitea.pullRequestsPollingInterval` | `600` | Auto refresh interval PR (seconds) |
| `gitea.showUnreadBadge` | `true` | Show unread count badge |

## Available Commands

| Command | Description |
|---------|-------------|
| `Gitea: Configurer le Token API` | Configure your access credentials |
| `Gitea: Rafraîchir les notifications` | Force refresh notification list |
| `Gitea: Rafraîchir les Pull Requests` | Force refresh PR list |
| `Gitea: Marquer comme lu` | Mark selected notification as read |
| `Gitea: Marquer toutes les notifications comme lues` | Mark all notifications as read |
| `Gitea: Ouvrir dans le navigateur` | Open notification/PR in default browser |
| `Gitea: ✅ Approuver la PR` | Approve a Pull Request |
| `Gitea: ⚠️ Demander des modifications` | Request changes on a PR |
| `Gitea: 💬 Ajouter un commentaire` | Add comment to a PR |
| `Gitea: 🔀 Fusionner la PR` | Merge a Pull Request |

## Development

### Install dependencies
```bash
npm install
```

### Compile
```bash
npm run compile
```

### Watch mode
```bash
npm run watch
```

### Debug
Press `F5` in VS Code to launch extension in debug mode.

### Package
```bash
npm run package
```

## License

MIT

---

✌️ Created with ❤️ by Nicolas Pellerin
