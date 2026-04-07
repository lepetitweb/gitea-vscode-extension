# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-04-07

### ✨ First public release

- Initial VS Code extension release
- Gitea notifications display directly in activity bar
- Notifications grouped by repository
- Unread counter badge
- Mark single or all notifications as read
- Open notification directly in browser
- Configurable auto refresh interval
- Secure token storage using system keychain
- PR/Issue author displayed in notification list
- Detailed tooltip when hovering notifications
- Full support for self-hosted Gitea instances

### ⚙️ Available Settings
- `gitea.serverUrl`: Your Gitea server address
- `gitea.pollingInterval`: Refresh interval in seconds
- `gitea.showUnreadBadge`: Toggle unread counter badge

### 🎯 Available Commands
- `Gitea: Setup API Token`
- `Gitea: Refresh notifications`
- `Gitea: Mark as read`
- `Gitea: Mark all as read`
- `Gitea: Open in browser`
