# Gitea Notifications VSCode Extension

View your Gitea notifications and Pull Requests directly inside VS Code. Built for self-hosted instances and enterprise environments.


## ✨ Features

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


## ⚙️ Configuration

1. Install the extension
2. Open the Gitea panel in the activity bar
3. Click **🔑 Setup API Token**
4. Enter your Gitea server URL and personal access token

> 💡 You can also run `Gitea: Setup API Token` from the command palette (`Ctrl+Shift+P`)


### Creating your Gitea access token

1. Go to your Gitea account > **Settings** > **Applications**
2. Enter a name for your token
3. Click **Generate Token**
4. Copy this token into the extension configuration


## 🆕 What's new in version 2.0.2

✅ **Automatic PR refresh after merge**
- Merged PRs are immediately removed from the list
- No manual refresh required anymore

✅ **Merge strategy selector**
- Choose merge method directly in VS Code
- 4 available strategies with clear descriptions
- Full compatibility with all Gitea versions

✅ **Fixed PR approval**
- Properly works on Gitea <= 1.19
- Approval status is correctly registered

✅ **Full English localization**
- All user interface, logs and errors are now in English

✅ **Pull Requests module**
- Automatic Pull Requests listing for current repository
- Automatic Git repository detection
- Actions directly from VS Code:
  - ✅ Approve PR
  - ⚠️ Request changes
  - 💬 Add comment
  - 🔀 Merge PR
- Status, author, branches and conflicts indicators
- Color coded icons by status

✅ **General improvements**
- Two native collapsible sections in the same panel
- Automatic VPN / offline connection state detection
- Unread notification counter badge
- Independent polling intervals for notifications and PRs
- Proper error handling with clear messages


## ⚙️ Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitea.serverUrl` | `https://gitea.vpn` | Your Gitea server URL |
| `gitea.pollingInterval` | `60` | Auto refresh interval notifications (seconds) |
| `gitea.pullRequestsPollingInterval` | `600` | Auto refresh interval PR (seconds) |
| `gitea.showUnreadBadge` | `true` | Show unread count badge |


## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `Gitea: Setup API Token` | Configure your access credentials |
| `Gitea: Refresh notifications` | Force refresh notification list |
| `Gitea: Refresh Pull Requests` | Force refresh PR list |
| `Gitea: Mark as read` | Mark selected notification as read |
| `Gitea: Mark all as read` | Mark all notifications as read |
| `Gitea: Open in browser` | Open notification/PR in default browser |
| `Gitea: Approve PR` | Approve a Pull Request |
| `Gitea: Request changes` | Request changes on a PR |
| `Gitea: Add comment` | Add comment to a PR |
| `Gitea: Merge PR` | Merge a Pull Request |


## License

MIT

---

✌️ Created with ❤️ by Nicolas Pellerin
