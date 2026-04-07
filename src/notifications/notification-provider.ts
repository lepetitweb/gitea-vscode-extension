import * as vscode from 'vscode';
import type { GiteaNotification, GiteaRepository } from '../api/types';

export enum TreeItemType {
    NOT_CONNECTED = 'not-connected',
    CONNECTED = 'connected',
    REPOSITORY = 'repository',
    NOTIFICATION = 'notification',
    LOADING = 'loading'
}

class NotificationTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: TreeItemType,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly notification?: GiteaNotification,
        public readonly repository?: GiteaRepository
    ) {
        super(label, collapsibleState);

        this.contextValue = type;

        switch(type) {
            case TreeItemType.NOTIFICATION:
                this.iconPath = notification?.unread
                    ? new vscode.ThemeIcon('bell-dot')
                    : new vscode.ThemeIcon('bell');
                
                // Construire la description avec auteur et type
                let descParts: string[] = [notification?.subject.type || ''];
                
                if (notification?.subject.user) {
                    descParts.push(`par ${notification.subject.user.full_name || notification.subject.user.login}`);
                }
                
                if (notification?.subject.state) {
                    descParts.push(`(${notification.subject.state})`);
                }
                
                this.description = descParts.filter(Boolean).join(' ');
                
                // Ajouter tooltip complet
                this.tooltip = notification?.subject.title;
                if (notification?.subject.user) {
                    this.tooltip += `\nAuteur: ${notification.subject.user.full_name || notification.subject.user.login}`;
                }
                break;
            case TreeItemType.REPOSITORY:
                this.iconPath = new vscode.ThemeIcon('repo');
                break;
            case TreeItemType.NOT_CONNECTED:
                this.iconPath = new vscode.ThemeIcon('debug-disconnect');
                break;
            case TreeItemType.LOADING:
                this.iconPath = new vscode.ThemeIcon('loading~spin');
                break;
        }
    }
}

export class NotificationProvider implements vscode.TreeDataProvider<NotificationTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<NotificationTreeItem | undefined | null | void> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<NotificationTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private notifications: GiteaNotification[] = [];
    private isConnected = false;
    private isLoading = false;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setConnected(connected: boolean): void {
        this.isConnected = connected;
        this.refresh();
    }

    setLoading(loading: boolean): void {
        this.isLoading = loading;
        this.refresh();
    }

    setNotifications(notifications: GiteaNotification[]): void {
        this.notifications = notifications;
        this.refresh();
    }

    getTreeItem(element: NotificationTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: NotificationTreeItem): Thenable<NotificationTreeItem[]> {
        if (this.isLoading) {
            return Promise.resolve([
                new NotificationTreeItem(
                    'Chargement des notifications...',
                    TreeItemType.LOADING,
                    vscode.TreeItemCollapsibleState.None
                )
            ]);
        }

        if (!this.isConnected) {
            const configItem = new NotificationTreeItem(
                '🔑 Configurer le token API',
                TreeItemType.NOT_CONNECTED,
                vscode.TreeItemCollapsibleState.None
            );
            configItem.command = {
                command: 'gitea-notifications.setToken',
                title: 'Configurer le token API'
            };

            return Promise.resolve([
                new NotificationTreeItem(
                    'Non connecté',
                    TreeItemType.NOT_CONNECTED,
                    vscode.TreeItemCollapsibleState.None
                ),
                configItem
            ]);
        }

        if (!element) {
            // Grouper les notifications par repository
            const repositories = new Map<number, { repository: GiteaRepository, notifications: GiteaNotification[] }>();

            this.notifications.forEach(notification => {
                const repoId = notification.repository.id;
                if (!repositories.has(repoId)) {
                    repositories.set(repoId, {
                        repository: notification.repository,
                        notifications: []
                    });
                }
                repositories.get(repoId)!.notifications.push(notification);
            });

            const items: NotificationTreeItem[] = [];

            repositories.forEach((data) => {
                const unreadCount = data.notifications.filter(n => n.unread).length;
                items.push(new NotificationTreeItem(
                    `${data.repository.full_name} (${unreadCount})`,
                    TreeItemType.REPOSITORY,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    undefined,
                    data.repository
                ));
            });

            if (items.length === 0) {
                items.push(new NotificationTreeItem(
                    '✅ Aucune notification',
                    TreeItemType.CONNECTED,
                    vscode.TreeItemCollapsibleState.None
                ));
            }

            return Promise.resolve(items);
        }

        if (element.type === TreeItemType.REPOSITORY && element.repository) {
            const repoNotifications = this.notifications.filter(
                n => n.repository.id === element.repository!.id
            );

            return Promise.resolve(
                repoNotifications.map(notification => {
                    const item = new NotificationTreeItem(
                        notification.subject.title,
                        TreeItemType.NOTIFICATION,
                        vscode.TreeItemCollapsibleState.None,
                        notification
                    );
                    item.command = {
                        command: 'gitea-notifications.openInBrowser',
                        title: 'Ouvrir dans le navigateur',
                        arguments: [item]
                    };
                    return item;
                })
            );
        }

        return Promise.resolve([]);
    }
}
