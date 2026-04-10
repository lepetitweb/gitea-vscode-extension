# Changelog

All notable changes to this project will be documented in this file.

## [2.0.2] - 2026-04-10

### ✨ Improvements & Fixes

✅ **Automatic PR refresh after merge**
- PR list is now refreshed immediately after merge operation
- Merged PR is automatically removed from the list without manual refresh

✅ **Fixed PR approval for Gitea <= 1.19**
- Added required `commit_id` parameter to review API calls
- Approval status is now properly recognized by Gitea
- Works correctly on older Gitea versions

✅ **Merge strategy selector**
- 4 merge strategies available when merging a PR:
  * Create merge commit
  * Rebase fast-forward
  * Rebase with merge commit
  * Squash all commits
- Clear descriptions for each strategy
- Confirmation dialog with selected strategy

✅ **Full English localization**
- All user interface text translated to English
- All log messages translated to English
- All error messages translated to English
- No remaining French text anywhere in the extension

---

## [1.1.0] - 2026-04-08

### ✨ Major Release - Pull Requests module

✅ **Complete Pull Request management integration**

- ✅ Automatic Pull Requests listing for current repository
- ✅ Git repository auto detection
- ✅ PR details view with status, author, branches, conflicts indicator
- ✅ Expandable PR details directly in VS Code:
  - PR information and stats
  - Comments list (both general and review comments)
  - Changed files list
- ✅ PR Actions directly from the extension:
  - ✅ Approve PR
  - ⚠️ Request changes / Reject PR
  - 💬 Add comment
  - 🔀 Merge PR
  - 🌐 Open in Gitea
- ✅ Keep PR state is preserved across refreshes
- ✅ Color coded icons by PR status
- ✅ Independent polling interval for PRs

✅ **Improvements**
- Error messages now show actual Gitea response directly to user
- Improved visual layout without unnecessary icons on non-interactive elements
- All UI text now in English
- Proper error handling and logging
- VPN / offline detection works for both notifications and PRs

### ⚙️ New Settings
- `gitea.pullRequestsPollingInterval`: PR refresh interval (default 10 minutes)`

### 🎯 New Commands
- `Gitea: Refresh Pull Requests`
- `Gitea: Approve PR`
- `Gitea: Request changes`
- `Gitea: Add comment`
- `Gitea: Merge PR`
- `Gitea: Open PR in browser`

---

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
- `Gitea: Setup API Token
- `Gitea: Refresh notifications`
- `Gitea: Mark as read`
- `Gitea: Mark all as read`
- `Gitea: Open in browser`
