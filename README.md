# Gitea Notifications VSCode Extension

View your Gitea notifications directly inside VS Code, built for self-hosted instances and enterprise environments.

## Features

✅ Notifications list grouped by repository
✅ Unread count badge on the activity bar
✅ Mark notifications as read individually or all at once
✅ Open notification directly in your browser
✅ Auto-refresh with configurable interval
✅ Secure token storage in system keychain
✅ Shows PR/Issue author directly in the list
✅ Detailed tooltip on hover

## Configuration

1. Install the extension
2. Open command palette (`Ctrl+Shift+P`)
3. Run command `Gitea: Setup API Token`
4. Enter your Gitea server URL and personal access token

### Creating your Gitea token

1. Go to your Gitea account > Settings > Applications
2. Create new token with these permissions:
   - `notifications:read`
   - `notifications:write`
   - `user:read`
3. Copy this token into the extension configuration

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitea.serverUrl` | `https://gitea.vpn` | Your Gitea server URL |
| `gitea.pollingInterval` | `60` | Auto refresh interval in seconds |
| `gitea.showUnreadBadge` | `true` | Show unread count badge |

## Available Commands

| Command | Description |
|---------|-------------|
| `Gitea: Setup API Token` | Configure your access credentials |
| `Gitea: Refresh notifications` | Force refresh notification list |
| `Gitea: Mark as read` | Mark selected notification as read |
| `Gitea: Mark all as read` | Mark all notifications as read |
| `Gitea: Open in browser` | Open notification in default browser |

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
