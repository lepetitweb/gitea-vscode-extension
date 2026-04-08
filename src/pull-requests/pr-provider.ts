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
    EMPTY = 'pr-empty',
    DETAIL_TEXT = 'pr-detail-text',
    ACTION_BUTTON = 'pr-action-button'
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

            case PRTreeItemType.DETAIL_TEXT:
                // Pas d'icône pour les lignes de détail
                this.iconPath = undefined;
                // Désactiver l'indicateur de clic
                this.command = undefined;
                break;

            case PRTreeItemType.ACTION_BUTTON:
                // Les boutons d'action gardent leur icône
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
    private expandedPRs: Set<number> = new Set();

    setClient(client: GiteaClient): void {
        Logger.debug('PR Provider: Client Gitea défini');
        this.giteaClient = client;
    }

    /**
     * Marque une PR comme étant dépliée / ouverte
     */
    markPRExpanded(prNumber: number, expanded: boolean): void {
        if (expanded) {
            this.expandedPRs.add(prNumber);
            Logger.debug(`PR #${prNumber} marked as expanded`);
        } else {
            this.expandedPRs.delete(prNumber);
            Logger.debug(`PR #${prNumber} marked as collapsed`);
        }
    }

    /**
     * Vérifie si une PR doit être affichée dépliée par défaut
     */
    isPRExpanded(prNumber: number): boolean {
        return this.expandedPRs.has(prNumber);
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
        // Force complete refresh by clearing first
        this.pullRequests = [];
        this.refresh();
        // Wait next tick then restore actual PRs
        setTimeout(() => {
            this.pullRequests = pullRequests;
            this.isOffline = false;
            this.refresh();
        }, 10);
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

    async getChildren(element?: PRTreeItem): Promise<PRTreeItem[]> {
        if (this.isLoading) {
            return [
                new PRTreeItem(
                    'Chargement des Pull Requests...',
                    PRTreeItemType.LOADING,
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }

        if (this.isOffline) {
            return [
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
            ];
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

            return [
                new PRTreeItem(
                    'Non connecté',
                    PRTreeItemType.NOT_CONNECTED,
                    vscode.TreeItemCollapsibleState.None
                ),
                configItem
            ];
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

            return items;
        }

        if (element.type === PRTreeItemType.REPOSITORY && element.repository) {
            const repoPullRequests = this.pullRequests.filter(
                pr => pr.base.repo.id === element.repository!.id
            );

            return repoPullRequests
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .map(pullRequest => {
                    const isExpanded = this.isPRExpanded(pullRequest.number);
                    Logger.debug(`PR #${pullRequest.number} restore state: expanded=${isExpanded}`);
                    
                    const item = new PRTreeItem(
                        pullRequest.title,
                        PRTreeItemType.PULL_REQUEST,
                        isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
                        pullRequest
                    );
                    // Remove direct browser opening on click
                    item.command = undefined;
                    return item;
                });
        }

        // Si c'est un item Pull Request, retourner les détails et les boutons d'action
        if (element.type === PRTreeItemType.PULL_REQUEST && element.pullRequest) {
            const pr = element.pullRequest;
            const children: PRTreeItem[] = [];

            // Section Details
            children.push(new PRTreeItem(
                `  **Details**`,
                PRTreeItemType.DETAIL_TEXT,
                vscode.TreeItemCollapsibleState.None
            ));
            
            children.push(new PRTreeItem(
                `    PR #${pr.number} from ${pr.user?.full_name || pr.user?.login || 'Unknown'}`,
                PRTreeItemType.DETAIL_TEXT,
                vscode.TreeItemCollapsibleState.None
            ));
            
            children.push(new PRTreeItem(
                `    Branch: ${pr.head.ref} → ${pr.base.ref}`,
                PRTreeItemType.DETAIL_TEXT,
                vscode.TreeItemCollapsibleState.None
            ));
            
            if (pr.additions !== undefined && pr.deletions !== undefined) {
                children.push(new PRTreeItem(
                    `    Changes: +${pr.additions} -${pr.deletions} in ${pr.changed_files} file(s)`,
                    PRTreeItemType.DETAIL_TEXT,
                    vscode.TreeItemCollapsibleState.None
                ));
            }

            if (pr.mergeable === false) {
                children.push(new PRTreeItem(
                    `    ⚠️ Merge conflicts detected`,
                    PRTreeItemType.DETAIL_TEXT,
                    vscode.TreeItemCollapsibleState.None
                ));
            }

            // Separator
            children.push(new PRTreeItem(
                `  ────────────────────────────`,
                PRTreeItemType.DETAIL_TEXT,
                vscode.TreeItemCollapsibleState.None
            ));

            // Comments section
            children.push(new PRTreeItem(
                `  **Comments**`,
                PRTreeItemType.DETAIL_TEXT,
                vscode.TreeItemCollapsibleState.None
            ));

            // Load comments asynchronously
            if (this.giteaClient && pr.base?.repo) {
                try {
                    const allComments: any[] = [];

                    // Load regular comments
                    try {
                        const issueComments = await this.giteaClient.getPullRequestComments(
                            pr.base.repo.owner.login,
                            pr.base.repo.name,
                            pr.number
                        );
                        allComments.push(...issueComments);
                    } catch (e) {
                        Logger.debug('No regular comments found');
                    }

                    // Load review comments
                    try {
                        const reviews = await this.giteaClient.getPullRequestReviews(
                            pr.base.repo.owner.login,
                            pr.base.repo.name,
                            pr.number
                        );
                        
                        reviews.forEach(review => {
                            if (review.body && review.body.trim().length > 0) {
                                allComments.push(review);
                            }
                        });
                    } catch (e) {
                        Logger.debug('No review comments found');
                    }

                    // Sort all comments by date
                    allComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                    if (allComments.length > 0) {
                        allComments.forEach(comment => {
                            let commentIcon = '💬';
                            if (comment.state) {
                                // This is a review comment
                                commentIcon = '📝';
                            }

                            let dateStr = 'Invalid date';
                            const dateValue = comment.created_at || comment.submitted_at;
                            Logger.debug(`Parsing comment date: ${JSON.stringify(dateValue)} (created_at: ${JSON.stringify(comment.created_at)}, submitted_at: ${JSON.stringify(comment.submitted_at)})`);
                            try {
                                const commentDate = new Date(dateValue);
                                Logger.debug(`Parsed date object: ${commentDate.toString()}, isValid: ${!isNaN(commentDate.getTime())}`);
                                
                                if (!isNaN(commentDate.getTime())) {
                                    dateStr = commentDate.toLocaleDateString();
                                }
                            } catch (e) {
                                Logger.debug(`Date parsing error: ${e}`);
                            }

                            const author = comment.user?.full_name || comment.user?.login || 'Unknown';
                            
                            children.push(new PRTreeItem(
                                `    ${commentIcon} ${author} (${dateStr})`,
                                PRTreeItemType.DETAIL_TEXT,
                                vscode.TreeItemCollapsibleState.None
                            ));
                            
                            // Wrap long comment text
                            const commentLines = comment.body?.split('\n').filter((l: string) => l.trim()) || [];
                            commentLines.slice(0, 3).forEach((line: string) => {
                                children.push(new PRTreeItem(
                                    `      ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`,
                                    PRTreeItemType.DETAIL_TEXT,
                                    vscode.TreeItemCollapsibleState.None
                                ));
                            });
                            
                            if (commentLines.length > 3) {
                                children.push(new PRTreeItem(
                                    `      [...]`,
                                    PRTreeItemType.DETAIL_TEXT,
                                    vscode.TreeItemCollapsibleState.None
                                ));
                            }
                        });
                    } else {
                        children.push(new PRTreeItem(
                            `    No comments on this PR`,
                            PRTreeItemType.DETAIL_TEXT,
                            vscode.TreeItemCollapsibleState.None
                        ));
                    }
                } catch (err) {
                    Logger.error('Failed to load PR comments', err);
                    children.push(new PRTreeItem(
                        `    ⚠️ Failed to load comments`,
                        PRTreeItemType.DETAIL_TEXT,
                        vscode.TreeItemCollapsibleState.None
                    ));
                }
            }

            // Separator before changed files
            children.push(new PRTreeItem(
                `  ────────────────────────────`,
                PRTreeItemType.DETAIL_TEXT,
                vscode.TreeItemCollapsibleState.None
            ));

            // Changed files section
            children.push(new PRTreeItem(
                `  **Changed files**`,
                PRTreeItemType.DETAIL_TEXT,
                vscode.TreeItemCollapsibleState.None
            ));

            // Load changed files
            if (this.giteaClient && pr.base?.repo) {
                try {
                    const files = await this.giteaClient.getPullRequestFiles(
                        pr.base.repo.owner.login,
                        pr.base.repo.name,
                        pr.number
                    );

                    if (files.length > 0) {
                        files.forEach(file => {
                            let statusIcon = '📄';
                            if (file.status === 'added') statusIcon = '➕';
                            if (file.status === 'removed') statusIcon = '➖';
                            if (file.status === 'modified') statusIcon = '✏️';
                            if (file.status === 'renamed') statusIcon = '🔄';

                            const fileItem = new PRTreeItem(
                                `    ${statusIcon} ${file.filename}  (+${file.additions} -${file.deletions})`,
                                PRTreeItemType.ACTION_BUTTON,
                                vscode.TreeItemCollapsibleState.None
                            );
                            
                            fileItem.command = {
                                command: 'vscode.open',
                                title: `View diff`,
                                arguments: [
                                    vscode.Uri.parse(`${pr.html_url}/files`)
                                ]
                            };
                            
                            children.push(fileItem);
                        });
                    }
                } catch (err) {
                    Logger.error('Failed to load PR changed files', err);
                }
            }

            // Separator before actions
            children.push(new PRTreeItem(
                `  ────────────────────────────`,
                PRTreeItemType.DETAIL_TEXT,
                vscode.TreeItemCollapsibleState.None
            ));

            // Section Actions
            children.push(new PRTreeItem(
                `  **Actions**`,
                PRTreeItemType.DETAIL_TEXT,
                vscode.TreeItemCollapsibleState.None
            ));

            // Approve Button
            const approveItem = new PRTreeItem(
                `    ✅ Approve PR`,
                PRTreeItemType.ACTION_BUTTON,
                vscode.TreeItemCollapsibleState.None
            );
            approveItem.command = {
                command: 'gitea-pull-requests.approve',
                title: 'Approve PR',
                arguments: [element]
            };
            children.push(approveItem);

            // Request Changes Button
            const changesItem = new PRTreeItem(
                `    ⚠️ Request changes / Reject PR`,
                PRTreeItemType.ACTION_BUTTON,
                vscode.TreeItemCollapsibleState.None
            );
            changesItem.command = {
                command: 'gitea-pull-requests.requestChanges',
                title: 'Request changes / Reject PR',
                arguments: [element]
            };
            children.push(changesItem);

            // Add Comment Button
            const commentItem = new PRTreeItem(
                `    💬 Add comment`,
                PRTreeItemType.ACTION_BUTTON,
                vscode.TreeItemCollapsibleState.None
            );
            commentItem.command = {
                command: 'gitea-pull-requests.addComment',
                title: 'Add comment',
                arguments: [element]
            };
            children.push(commentItem);

            // Merge Button
            const mergeItem = new PRTreeItem(
                `    🔀 Merge PR`,
                PRTreeItemType.ACTION_BUTTON,
                vscode.TreeItemCollapsibleState.None
            );
            mergeItem.command = {
                command: 'gitea-pull-requests.merge',
                title: 'Merge PR',
                arguments: [element]
            };
            children.push(mergeItem);

            // Open in Browser Button
            const browserItem = new PRTreeItem(
                `    🌐 Open in Gitea`,
                PRTreeItemType.ACTION_BUTTON,
                vscode.TreeItemCollapsibleState.None
            );
            browserItem.command = {
                command: 'gitea-pull-requests.openInBrowser',
                title: 'Open in Gitea',
                arguments: [element]
            };
            children.push(browserItem);

            return children;
        }

        return [];
    }
}
