import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import type { GiteaPullRequest, GiteaRepository } from '../api/types';
import { PullRequestState } from '../api/types';
import { GiteaClient } from '../api/gitea-client';

export enum PRTreeItemType {
    NOT_CONNECTED = 'pr-not-connected',
    OFFLINE = 'pr-offline',
    CONNECTED = 'pr-connected',
    REPOSITORY = 'pr-repository',
    PULL_REQUEST = 'pull-request',
    LOADING = 'pr-loading',
    EMPTY = 'pr-empty'
}

class PRTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: PRTreeItemType,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly pullRequest?: GiteaPullRequest,
        public readonly repository?: GiteaRepository
    ) {
        super(label, collapsibleState);

        this.contextValue = type;

        switch(type) {
            case PRTreeItemType.PULL_REQUEST:
                if (pullRequest) {
                    // Icône selon l'état du PR
                    switch(pullRequest.state) {
                        case PullRequestState.OPEN:
                            this.iconPath = new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.green'));
                            break;
                        case PullRequestState.MERGED:
                            this.iconPath = new vscode.ThemeIcon('git-merge', new vscode.ThemeColor('charts.purple'));
                            break;
                        case PullRequestState.CLOSED:
                            this.iconPath = new vscode.ThemeIcon('git-pull-request-closed', new vscode.ThemeColor('charts.red'));
                            break;
                    }

                    // Description: #numbre | auteur
                    let descParts: string[] = [];
                    descParts.push(`#${pullRequest.number}`);
                    
                    if (pullRequest.user) {
                        descParts.push(`par ${pullRequest.user.full_name || pullRequest.user.login}`);
                    }

                    if (pullRequest.mergeable === false) {
                        descParts.push('⚠️ Conflit');
                    }

                    this.description = descParts.join(' ');

                    // Tooltip complet
                    this.tooltip = pullRequest.title;
                    this.tooltip += `\n\nAuteur: ${pullRequest.user.full_name || pullRequest.user.login}`;
                    this.tooltip += `\nBranche: ${pullRequest.head.ref} → ${pullRequest.base.ref}`;
                    
                    if (pullRequest.additions !== undefined && pullRequest.deletions !== undefined) {
                        this.tooltip += `\nModifications: +${pullRequest.additions} -${pullRequest.deletions} dans ${pullRequest.changed_files} fichier(s)`;
                    }

                    this.tooltip += `\nCréé le: ${new Date(pullRequest.created_at).toLocaleDateString()}`;
                }
                break;

            case PRTreeItemType.REPOSITORY:
                this.iconPath = new vscode.ThemeIcon('repo');
                break;

            case PRTreeItemType.NOT_CONNECTED:
                this.iconPath = new vscode.ThemeIcon('debug-disconnect');
                break;

            case PRTreeItemType.OFFLINE:
                this.iconPath = new vscode.ThemeIcon('cloud-off');
                break;

            case PRTreeItemType.LOADING:
                this.iconPath = new vscode.ThemeIcon('loading~spin');
                break;

            case PRTreeItemType.EMPTY:
                this.iconPath = new vscode.ThemeIcon('pass');
                break;
        }
    }
}

export class PullRequestProvider implements vscode.TreeDataProvider<PRTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PRTreeItem | undefined | null | void> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<PRTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private pullRequests: GiteaPullRequest[] = [];
    private isConnected = false;
    private isOffline = false;
    private isLoading = false;
    private currentOwner: string | undefined;
    private currentRepo: string | undefined;
    private giteaClient: GiteaClient | undefined;

    setClient(client: GiteaClient): void {
        Logger.debug('PR Provider: Client Gitea défini');
        this.giteaClient = client;
    }

    refresh(): void {
        Logger.debug('PR Provider: Refresh demandé');
        this._onDidChangeTreeData.fire();
    }

    setConnected(connected: boolean): void {
        Logger.debug(`PR Provider: État connexion = ${connected}`);
        this.isConnected = connected;
        this.isOffline = false;
        this.refresh();
    }

    setOffline(offline: boolean): void {
        Logger.debug(`PR Provider: État hors ligne = ${offline}`);
        this.isOffline = offline;
        this.refresh();
    }

    setLoading(loading: boolean): void {
        Logger.debug(`PR Provider: État chargement = ${loading}`);
        this.isLoading = loading;
        this.refresh();
    }

    setPullRequests(pullRequests: GiteaPullRequest[]): void {
        Logger.info(`PR Provider: ${pullRequests.length} pull requests reçues`);
        this.pullRequests = pullRequests;
        this.isOffline = false;
        this.refresh();
    }

    setRepository(owner: string, repo: string): void {
        Logger.debug(`PR Provider: Repository défini: ${owner}/${repo}`);
        this.currentOwner = owner;
        this.currentRepo = repo;
    }

    dispose(): void {
        Logger.debug('PR Provider: Nettoyage des ressources');
        this.pullRequests = [];
        this.isConnected = false;
        this.isOffline = false;
        this.isLoading = false;
        this.currentOwner = undefined;
        this.currentRepo = undefined;
    }

    getTreeItem(element: PRTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: PRTreeItem): Thenable<PRTreeItem[]> {
        if (this.isLoading) {
            return Promise.resolve([
                new PRTreeItem(
                    'Chargement des Pull Requests...',
                    PRTreeItemType.LOADING,
                    vscode.TreeItemCollapsibleState.None
                )
            ]);
        }

        if (this.isOffline) {
            return Promise.resolve([
                new PRTreeItem(
                    '⚠️ Hors ligne - Impossible de joindre Gitea',
                    PRTreeItemType.OFFLINE,
                    vscode.TreeItemCollapsibleState.None
                ),
                new PRTreeItem(
                    'Vérifiez votre connexion VPN ou réseau',
                    PRTreeItemType.OFFLINE,
                    vscode.TreeItemCollapsibleState.None
                )
            ]);
        }

        if (!this.isConnected) {
            const configItem = new PRTreeItem(
                '🔑 Configurer le token API',
                PRTreeItemType.NOT_CONNECTED,
                vscode.TreeItemCollapsibleState.None
            );
            configItem.command = {
                command: 'gitea-notifications.setToken',
                title: 'Configurer le token API'
            };

            return Promise.resolve([
                new PRTreeItem(
                    'Non connecté',
                    PRTreeItemType.NOT_CONNECTED,
                    vscode.TreeItemCollapsibleState.None
                ),
                configItem
            ]);
        }

        if (!element) {
            // Grouper les PR par repository de destination
            const repositories = new Map<number, { repository: GiteaRepository, pullRequests: GiteaPullRequest[] }>();

            this.pullRequests.forEach(pr => {
                const repoId = pr.base.repo.id;
                if (!repositories.has(repoId)) {
                    repositories.set(repoId, {
                        repository: pr.base.repo,
                        pullRequests: []
                    });
                }
                repositories.get(repoId)!.pullRequests.push(pr);
            });

            const items: PRTreeItem[] = [];

            repositories.forEach((data) => {
                const openCount = data.pullRequests.filter(pr => pr.state === PullRequestState.OPEN).length;
                items.push(new PRTreeItem(
                    `${data.repository.full_name} (${openCount})`,
                    PRTreeItemType.REPOSITORY,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    undefined,
                    data.repository
                ));
            });

            if (items.length === 0) {
                // Toujours afficher le repository même si aucun PR
                if (this.currentOwner && this.currentRepo) {
                    items.push(new PRTreeItem(
                        `${this.currentOwner}/${this.currentRepo}`,
                        PRTreeItemType.REPOSITORY,
                        vscode.TreeItemCollapsibleState.Expanded
                    ));
                }
                
                items.push(new PRTreeItem(
                    '✅ Aucune Pull Request ouverte',
                    PRTreeItemType.EMPTY,
                    vscode.TreeItemCollapsibleState.None
                ));
            }

            return Promise.resolve(items);
        }

        if (element.type === PRTreeItemType.REPOSITORY && element.repository) {
            const repoPullRequests = this.pullRequests.filter(
                pr => pr.base.repo.id === element.repository!.id
            );

            return Promise.resolve(
                repoPullRequests
                    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                    .map(pullRequest => {
                        const item = new PRTreeItem(
                            pullRequest.title,
                            PRTreeItemType.PULL_REQUEST,
                            vscode.TreeItemCollapsibleState.None,
                            pullRequest
                        );
                        item.command = {
                            command: 'gitea-pull-requests.openInBrowser',
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
