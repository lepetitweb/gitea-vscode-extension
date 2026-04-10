# Gitea Notifications - Technical Specification

A comprehensive technical document describing the VS Code extension architecture, code structure, and functionality. This document is designed to help an AI or developer understand the entire system for making modifications or additions.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [File Structure](#file-structure)
4. [Core Components](#core-components)
5. [Extension Lifecycle](#extension-lifecycle)
6. [API Integration](#api-integration)
7. [UI Components](#ui-components)
8. [Commands](#commands)
9. [Configuration](#configuration)
10. [Extension Manifest](#extension-manifest)
11. [Development Workflow](#development-workflow)
12. [Adding New Features](#adding-new-features)

---

## Project Overview

**Extension Name**: Gitea Notifications
**Publisher**: npellerin
**Version**: 1.1.0
**VS Code Version**: ^1.80.0
**License**: MIT

This extension integrates Gitea notifications directly into VS Code, allowing developers to:
- View notifications grouped by repository
- See unread count badges
- Mark notifications as read
- Open notifications in browser
- Auto-refresh at configurable intervals
- View assigned Pull Requests
- Approve, comment, request changes and merge PR directly from VS Code
- Automatic Git repository detection
- VPN / offline connectivity detection

---

## Architecture Overview

The extension follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                    │
├─────────────────────────────────────────────────────────────┤
│  extension.ts                                                │
│  ├── Activates extension on view:gitea-notifications        │
│  ├── Registers commands                                      │
│  ├── Manages polling intervals                              │
│  └── Coordinates all components                             │
├─────────────┬──────────────┬───────────────┬────────────────┤
│   API       │   Auth       │ Notifications │    Utils      │
│ gitea-client│ token-manager│ provider      │    logger     │
└─────────────┴──────────────┴───────────────┴────────────────┘
```

### Data Flow

```
User Action / Timer
        │
        ▼
┌───────────────────┐
│  extension.ts     │  ← Registers commands, handles events
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  GiteaClient      │  ← HTTP calls to Gitea API
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Notification     │  ← Transforms data for UI
│  Provider         │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  VS Code UI      │  ← TreeView, StatusBar, Notifications
└───────────────────┘
```

---

## File Structure

```
src/
├── extension.ts              # Main entry point
├── api/
│   ├── gitea-client.ts       # API client for Gitea
│   └── types.ts               # TypeScript interfaces
├── auth/
│   └── token-manager.ts      # Secure token storage
├── notifications/
│   └── notification-provider.ts  # Tree data provider
└── utils/
    └── logger.ts              # Logging utility
```

### File Responsibilities

| File | Purpose |
|------|---------|
| [`extension.ts`](src/extension.ts) | Main entry point, command registration, lifecycle management |
| [`api/gitea-client.ts`](src/api/gitea-client.ts) | HTTP client for Gitea API |
| [`api/types.ts`](src/api/types.ts) | TypeScript interfaces for API entities |
| [`auth/token-manager.ts`](src/auth/token-manager.ts) | Secure token storage using VS Code secrets |
| [`notifications/notification-provider.ts`](src/notifications/notification-provider.ts) | Tree view data provider |
| [`utils/logger.ts`](src/utils/logger.ts) | Output channel logging |

---

## Core Components

### 1. GiteaClient (`src/api/gitea-client.ts`)

**Purpose**: HTTP client for communicating with Gitea API

**Key Methods**:

| Method | Purpose | API Endpoint |
|--------|---------|--------------|
| `getCurrentUser()` | Get authenticated user info | `/api/v1/user` |
| `getNotifications(options?)` | Fetch notifications | `/api/v1/notifications` |
| `markNotificationAsRead(id)` | Mark single notification read | `/api/v1/notifications/threads/{id}` |
| `markAllNotificationsAsRead()` | Mark all notifications read | `/api/v1/notifications` |
| `getPullRequest(owner, repo, number)` | Get PR details | `/api/v1/repos/{owner}/{repo}/pulls/{number}` |
| `getIssue(owner, repo, number)` | Get issue details | `/api/v1/repos/{owner}/{repo}/issues/{number}` |

**Usage Example**:
```typescript
const client = new GiteaClient('https://gitea.example.com', 'my-token');
const user = await client.getCurrentUser();
const notifications = await client.getNotifications({ all: true });
```

### 2. TokenManager (`src/auth/token-manager.ts`)

**Purpose**: Secure storage of API token using VS Code's secret storage

**Key Methods**:

| Method | Purpose |
|--------|---------|
| `init(context)` | Initialize singleton with extension context |
| `saveToken(token)` | Store token in system keychain |
| `getToken()` | Retrieve stored token |
| `deleteToken()` | Remove token from storage |
| `hasToken()` | Check if token exists |

**Implementation Details**:
- Uses VS Code's `ExtensionContext.secrets` API
- Stores token in system keychain (Windows Credential Manager / macOS Keychain)
- Singleton pattern ensures single instance

### 3. NotificationProvider (`src/notifications/notification-provider.ts`)

**Purpose**: Provides data for VS Code TreeView

**Key Methods**:

| Method | Purpose |
|--------|---------|
| `refresh()` | Trigger tree view refresh |
| `setConnected(connected)` | Update connection state |
| `setLoading(loading)` | Show loading indicator |
| `setNotifications(notifications)` | Update notification list |
| `getTreeItem(element)` | Return tree item |
| `getChildren(element)` | Return child elements |

**Tree Structure**:
```
Root
├── Repository A (5 unread)
│   ├── Notification: PR #123 - Fix bug
│   ├── Notification: Issue #456 - Question
│   └── ...
├── Repository B (2 unread)
│   └── ...
└── Repository C (0 unread)
    └── ...
```

**TreeItem Types**:
- `NOT_CONNECTED` - Shows when no token configured
- `CONNECTED` - Shows when connected with no notifications
- `REPOSITORY` - Group header for repository
- `NOTIFICATION` - Individual notification item
- `LOADING` - Loading indicator

### 4. Logger (`src/utils/logger.ts`)

**Purpose**: Centralized logging to VS Code Output Channel

**Methods**:

| Method | Purpose |
|--------|---------|
| `init()` | Initialize output channel |
| `info(message)` | Log info message |
| `warn(message)` | Log warning |
| `debug(message)` | Log debug message |
| `error(message, error?)` | Log error with stack trace |
| `show()` | Show output channel |

**Output**: Writes to "Gitea Notifications" output channel with timestamps

---

## Extension Lifecycle

### Activation

The extension activates on `onView:gitea-notifications` event (line 33 in package.json).

**Activation Flow** (`extension.ts` lines 15-160):

```typescript
1. activate(context)
   │
   ├── Logger.init()
   │
   ├── TokenManager.init(context)
   │
   ├── Create TreeView 'gitea-notifications'
   │
   ├── Create StatusBarItem
   │
   ├── Register 5 commands:
   │   ├── gitea-notifications.setToken
   │   ├── gitea-notifications.refresh
   │   ├── gitea-notifications.markAsRead
   │   ├── gitea-notifications.markAllAsRead
   │   └── gitea-notifications.openInBrowser
   │
   └── Check for saved token → auto-connect if found
```

### Deactivation

Called when extension is disabled or VS Code closes.

```typescript
function deactivate() {
    clearInterval(pollingInterval);  // Stop polling
    statusBarItem.dispose();          // Clean up UI
    Logger.info('Extension disabled');
}
```

### Polling Mechanism

The extension automatically refreshes notifications at a configurable interval:

```typescript
function startPolling(): void {
    // Get interval from config (default: 60 seconds)
    const interval = config.get('pollingInterval') * 1000;
    
    pollingInterval = setInterval(refreshNotifications, interval);
}
```

---

## API Integration

### Authentication

Uses Bearer token authentication:
```typescript
private getHeaders(): Record<string, string> {
    return {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
}
```

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/user` | GET | Verify credentials |
| `/api/v1/notifications` | GET | Fetch notifications |
| `/api/v1/notifications/threads/{id}` | PATCH | Mark as read |
| `/api/v1/notifications` | PUT | Mark all as read |
| `/api/v1/repos/{owner}/{repo}/pulls/{num}` | GET | Get PR details |
| `/api/v1/repos/{owner}/{repo}/issues/{num}` | GET | Get issue details |

### Error Handling

All API methods include error handling:
```typescript
if (!response.ok) {
    throw new Error(`Error message: ${response.statusText}`);
}
```

---

## UI Components

### TreeView (`gitea-notifications`)

Located in activity bar (left sidebar).

**Features**:
- Grouped by repository
- Shows unread count per repository
- Collapsible tree structure
- Context menu on right-click

**Icons**:
- `bell-dot` - Unread notification
- `bell` - Read notification
- `repo` - Repository group
- `loading~spin` - Loading state

### Status Bar Item

Shows in bottom-left of VS Code.

**States**:
- `$(bell) Gitea` - Connected, no unread
- `$(bell-dot) N` - Connected, N unread notifications
- Click opens token configuration

### Badge on Activity Bar Icon

Shows total unread count on the Gitea icon in activity bar.

---

## Commands

All commands are prefixed with `gitea-notifications.`

### 1. setToken
**Command**: `gitea-notifications.setToken`  
**Title**: `Gitea: Setup API Token`
**Trigger**: Status bar click or command palette

**Flow**:
1. Show input box for server URL
2. Show input box for API token (password field)
3. Save to global configuration and secrets
4. Test connection
5. Start polling if successful

### 2. refresh
**Command**: `gitea-notifications.refresh`  
**Title**: `Gitea: Refresh notifications`
**Trigger**: Button in tree view title

### 3. markAsRead
**Command**: `gitea-notifications.markAsRead`  
**Title**: `Gitea: Mark as read`
**Trigger**: Right-click on notification  
**Availability**: Only on notification items

### 4. markAllAsRead
**Command**: `gitea-notifications.markAllAsRead`  
**Title**: `Gitea: Mark all as read`
**Trigger**: Button in tree view title

### 5. openInBrowser
**Command**: `gitea-notifications.openInBrowser`  
**Title**: `Gitea: Open in browser`
**Trigger**: Click on notification  
**Availability**: Only on notification items

---

## Configuration

Configurable via VS Code Settings (`Cmd+,` → Extensions → Gitea).

### Settings in package.json

```json
"configuration": {
    "properties": {
        "gitea.serverUrl": {
            "type": "string",
            "default": "https://gitea.vpn",
            "description": "Gitea server URL"
        },
        "gitea.pollingInterval": {
            "type": "number",
            "default": 60,
            "minimum": 10,
            "description": "Refresh interval in seconds"
        },
        "gitea.showUnreadBadge": {
            "type": "boolean",
            "default": true,
            "description": "Show unread count badge"
        }
    }
}
```

### Accessing in Code

```typescript
const serverUrl = vscode.workspace.getConfiguration('gitea').get('serverUrl') as string;
const pollingInterval = vscode.workspace.getConfiguration('gitea').get('pollingInterval') as number;
```

---

## Extension Manifest

### package.json Key Fields

| Field | Value | Purpose |
|-------|-------|---------|
| `name` | `gitea-notifications` | Internal name |
| `displayName` | `Gitea Notifications` | Display name |
| `publisher` | `npellerin` | Marketplace publisher |
| `version` | `1.0.2` | Semantic version |
| `main` | `./out/extension.js` | Compiled entry point |
| `engines.vscode` | `^1.80.0` | Minimum VS Code version |
| `activationEvents` | `onView:gitea-notifications` | Lazy activation |
| `categories` | `["Programming Languages", "Other"]` | Marketplace categories |

### Contributes Section

Defines commands, views, and menus:

```json
{
    "views": { "gitea-notifications-view": [{ "id": "gitea-notifications", "name": "Notifications" }] },
    "viewsContainers": { "activitybar": [{ "id": "gitea-notifications-view", "title": "Gitea" }] },
    "commands": [...],
    "menus": { "view/title": [...], "view/item/context": [...] },
    "configuration": { ... }
}
```

---

## Development Workflow

### Prerequisites
- Node.js 18+
- VS Code 1.80+
- TypeScript 5.0+

### Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run compile` | Compile TypeScript |
| `npm run watch` | Watch mode compilation |
| `npm run package` | Create VSIX package |
| `npx vsce publish` | Publish to marketplace |

### Debugging
1. Press `F5` in VS Code
2. Opens new window with extension loaded
3. Breakpoints work in source files

---

## Adding New Features

### Adding a New API Method

1. Add method to `GiteaClient` in [`gitea-client.ts`](src/api/gitea-client.ts):

```typescript
public async getRepoDetails(owner: string, repo: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}`, {
        headers: this.getHeaders()
    });
    
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    
    return await response.json();
}
```

2. Add TypeScript interface in [`types.ts`](src/api/types.ts):

```typescript
export interface GiteaRepositoryDetails {
    id: number;
    name: string;
    full_name: string;
    description: string;
    // ... other fields
}
```

3. Use in [`extension.ts`](src/extension.ts):

```typescript
const details = await giteaClient.getRepoDetails('owner', 'repo');
```

### Adding a New Command

1. Add command definition in `package.json`:

```json
{
    "command": "gitea-notifications.myNewCommand",
    "title": "Gitea: My New Command"
}
```

2. Register command in [`extension.ts`](src/extension.ts):

```typescript
const myCommand = vscode.commands.registerCommand('gitea-notifications.myNewCommand', async () => {
    // Command implementation
});

context.subscriptions.push(myCommand);
```

3. Add menu entry if needed in `package.json`:

```json
{
    "command": "gitea-notifications.myNewCommand",
    "when": "view == gitea-notifications"
}
```

### Adding a New Tree Item Type

1. Add type to enum in [`notification-provider.ts`](src/notifications/notification-provider.ts):

```typescript
export enum TreeItemType {
    NOTIFICATION = 'notification',
    MY_NEW_TYPE = 'my-new-type'  // Add this
}
```

2. Handle in `NotificationTreeItem` constructor:

```typescript
switch(type) {
    case TreeItemType.MY_NEW_TYPE:
        this.iconPath = new vscode.ThemeIcon('my-icon');
        break;
}
```

3. Handle in `getChildren`:

```typescript
if (element.type === TreeItemType.MY_NEW_TYPE) {
    // Return children
}
```

### Adding Configuration Setting

1. Add in `package.json`:

```json
"gitea.myNewSetting": {
    "type": "string",
    "default": "default-value",
    "description": "My new setting description"
}
```

2. Access in code:

```typescript
const value = vscode.workspace.getConfiguration('gitea').get('myNewSetting');
```

---

## API Response Types

### GiteaUser
```typescript
interface GiteaUser {
    id: number;
    login: string;
    full_name: string;
    email: string;
    avatar_url: string;
    html_url: string;
}
```

### GiteaNotification
```typescript
interface GiteaNotification {
    id: number;
    repository: GiteaRepository;
    subject: GiteaNotificationSubject;
    unread: boolean;
    updated_at: string;
    url: string;
    pinned: boolean;
}
```

### GiteaNotificationSubject
```typescript
interface GiteaNotificationSubject {
    title: string;
    type: NotificationSubjectType;
    url: string;
    html_url: string;
    state?: string;
    user?: GiteaUser;
}
```

### NotificationSubjectType
```typescript
type NotificationSubjectType = 'Issue' | 'PullRequest' | 'Commit' | 'Release';
```

---

## Common Patterns

### Async/Await Error Handling
```typescript
try {
    const data = await someAsyncOperation();
    // Handle success
} catch (err: any) {
    Logger.error('Operation failed', err);
    vscode.window.showErrorMessage(`Error: ${err.message}`);
}
```

### TreeView Refresh
```typescript
notificationProvider.setNotifications(notifications);
notificationProvider.refresh();
```

### Configuration Updates
```typescript
await vscode.workspace.getConfiguration('gitea')
    .update('serverUrl', newValue, vscode.ConfigurationTarget.Global);
```

### External Browser Opening
```typescript
vscode.env.openExternal(vscode.Uri.parse('https://example.com'));
```

---

## Security Considerations

1. **Token Storage**: Uses VS Code's secret storage (system keychain)
2. **No Secrets in Package**: `.env` excluded via `.vscodeignore`
3. **HTTPS Only**: API calls should use HTTPS
4. **Certificate Validation**: Disabled for self-signed certs in dev

---

## Testing

### Manual Testing
1. `npm run compile`
2. Press F5
3. Configure token in new window
4. Test all commands

### Package Testing
```bash
npm run package
code --install-extension gitea-notifications-*.vsix
```

---

## Publishing

```bash
# Update version in package.json
npm run compile
npx vsce publish
```

---

This specification should provide complete understanding of the extension for any modification or enhancement work.
