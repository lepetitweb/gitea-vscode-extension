import * as vscode from 'vscode';
import { TokenManager } from './auth/token-manager';
import { GiteaClient } from './api/gitea-client';
import { NotificationProvider, TreeItemType } from './notifications/notification-provider';
import { PullRequestProvider } from './pull-requests/pr-provider';
import { GitDetector } from './utils/git-detector';
import { Logger } from './utils/logger';
import type { GiteaNotification } from './api/types';

// Obtenir une référence sur la vue notifications pour le badge
let notificationTreeView: vscode.TreeView<unknown>;

let statusBarItem: vscode.StatusBarItem;
let notificationProvider: NotificationProvider;
let pullRequestsProvider: PullRequestProvider;
let pollingInterval: NodeJS.Timeout | undefined;
let prPollingInterval: NodeJS.Timeout | undefined;
let giteaClient: GiteaClient | undefined;
let gitDetector: GitDetector;

async function fetchPullRequests(): Promise<void> {
	if (!giteaClient) { return; }
	
	const repoInfo = await GitDetector.detectRepository();
	if (!repoInfo) {
		Logger.debug('Aucun repository Git détecté, impossible de récupérer les PR');
		return;
	}

	try {
		pullRequestsProvider.setLoading(true);
		Logger.debug(`Récupération PR pour ${repoInfo.owner}/${repoInfo.repo}`);
		
		const pullRequests = await giteaClient.getAssignedPullRequests(repoInfo.owner, repoInfo.repo);
		Logger.info(`${pullRequests.length} PR récupérées`);
		
		pullRequestsProvider.setPullRequests(pullRequests);
	} catch (err: any) {
		Logger.error('Erreur récupération PR', err);
	} finally {
		pullRequestsProvider.setLoading(false);
	}
}

export async function activate(context: vscode.ExtensionContext) {
	Logger.init();
	Logger.info('✅ Extension Gitea Notifications activée avec succès');

	// Initialiser les services
	TokenManager.init(context);
	notificationProvider = new NotificationProvider();
	pullRequestsProvider = new PullRequestProvider();

	// Récupérer la référence sur la vue notifications pour pouvoir mettre à jour le badge
	notificationTreeView = vscode.window.createTreeView('gitea-notifications', {
		treeDataProvider: notificationProvider
	});

	// Enregistrer le Tree View Pull Requests
	const prTreeView = vscode.window.createTreeView('gitea-pull-requests', {
		treeDataProvider: pullRequestsProvider
	});

	// Sauvegarder l'état déplié des PR
	prTreeView.onDidExpandElement(e => {
		if (e.element.type === 'pull-request' && e.element.pullRequest) {
			pullRequestsProvider.markPRExpanded(e.element.pullRequest.number, true);
		}
	});

	prTreeView.onDidCollapseElement(e => {
		if (e.element.type === 'pull-request' && e.element.pullRequest) {
			pullRequestsProvider.markPRExpanded(e.element.pullRequest.number, false);
		}
	});

	// Initialiser GitDetector - utiliser les méthodes statiques
	void GitDetector.detectRepository();

	// Créer le badge de la barre de statut
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.name = 'Gitea Notifications';
	statusBarItem.text = '$(bell) Gitea';
	statusBarItem.tooltip = 'Gitea Notifications';
	statusBarItem.command = 'gitea-notifications.setToken';
	statusBarItem.show();

	// Enregistrer les commandes
	const setTokenCommand = vscode.commands.registerCommand('gitea-notifications.setToken', async () => {
		Logger.info('🔧 Commande configuration token appelée');

		const serverUrl = await vscode.window.showInputBox({
			prompt: 'URL du serveur Gitea',
			placeHolder: 'https://gitea.vpn',
			value: vscode.workspace.getConfiguration('gitea').get('serverUrl') as string
		});

		if (!serverUrl) {
			Logger.info('❌ URL serveur non fournie');
			return;
		}

		Logger.info(`URL serveur: ${serverUrl}`);

		const token = await vscode.window.showInputBox({
			prompt: 'Token API Gitea',
			placeHolder: 'Entrez votre token d\'accès',
			password: true
		});

		if (!token) {
			Logger.info('❌ Token non fourni');
			return;
		}

		Logger.info('✅ Token reçu, enregistrement en cours...');

		await vscode.workspace.getConfiguration('gitea').update('serverUrl', serverUrl, vscode.ConfigurationTarget.Global);
		await TokenManager.getInstance().saveToken(token);

		try {
			Logger.info('🔌 Tentative de connexion au serveur...');
			giteaClient = new GiteaClient(serverUrl, token);
			
			// Vérifier connectivité
			await giteaClient.pingServer();
			
			const user = await giteaClient.getCurrentUser();

			Logger.info(`✅ Connexion réussie en tant que ${user.login}`);
			vscode.window.showInformationMessage(`✅ Connecté en tant que ${user.login}`);
			notificationProvider.setConnected(true);
			pullRequestsProvider.setConnected(true);
			pullRequestsProvider.setClient(giteaClient);
			
			// Détecter repository courant
			const repoInfo = await GitDetector.detectRepository();
			if (repoInfo) {
				pullRequestsProvider.setRepository(repoInfo.owner, repoInfo.repo);
			}
			
			await refreshNotifications();
			await fetchPullRequests();
			startPolling();
			updateStatusBar();
		} catch (err: any) {
			Logger.error('❌ Erreur de connexion', err);
			vscode.window.showErrorMessage(`❌ Erreur de connexion: ${err.message}`);
			await TokenManager.getInstance().deleteToken();
			notificationProvider.setConnected(false);
		}
	});

	const refreshCommand = vscode.commands.registerCommand('gitea-notifications.refresh', async () => {
		Logger.info('🔄 Commande rafraîchissement appelée');
		await refreshNotifications();
	});

	const markAsReadCommand = vscode.commands.registerCommand('gitea-notifications.markAsRead', async (item) => {
		if (item?.notification && giteaClient) {
			Logger.info(`📝 Marquer notification ${item.notification.id} comme lue`);
			try {
				await giteaClient.markNotificationAsRead(item.notification.id);
				vscode.window.showInformationMessage('✅ Notification marquée comme lue');
				await refreshNotifications();
			} catch (err: any) {
				Logger.error('❌ Erreur marquage notification comme lue', err);
				vscode.window.showErrorMessage(`❌ Erreur: ${err.message}`);
			}
		}
	});

	const markAllAsReadCommand = vscode.commands.registerCommand('gitea-notifications.markAllAsRead', async () => {
		if (giteaClient) {
			Logger.info('📝 Marquer toutes les notifications comme lues');
			try {
				await giteaClient.markAllNotificationsAsRead();
				vscode.window.showInformationMessage('✅ Toutes les notifications marquées comme lues');
				await refreshNotifications();
			} catch (err: any) {
				Logger.error('❌ Erreur marquage toutes les notifications', err);
				vscode.window.showErrorMessage(`❌ Erreur: ${err.message}`);
			}
		}
	});

	const openInBrowserCommand = vscode.commands.registerCommand('gitea-notifications.openInBrowser', (item) => {
		if (item?.notification?.subject.html_url) {
			Logger.info(`🌐 Ouvrir notification dans le navigateur: ${item.notification.subject.html_url}`);
			vscode.env.openExternal(vscode.Uri.parse(item.notification.subject.html_url));
		}
	});

	// Commandes Pull Requests
	const refreshPRCommand = vscode.commands.registerCommand('gitea-pull-requests.refresh', async () => {
		Logger.info('🔄 Commande rafraîchissement Pull Requests appelée');
		await fetchPullRequests();
		pullRequestsProvider.refresh();
	});

	const openPRInBrowserCommand = vscode.commands.registerCommand('gitea-pull-requests.openInBrowser', (item) => {
		if (item?.pullRequest?.html_url) {
			Logger.info(`🌐 Ouvrir Pull Request dans le navigateur: ${item.pullRequest.html_url}`);
			vscode.env.openExternal(vscode.Uri.parse(item.pullRequest.html_url));
		}
	});

	const approvePRCommand = vscode.commands.registerCommand('gitea-pull-requests.approve', async (item) => {
		if (!item?.pullRequest || !giteaClient) { return; }
		
		const pr = item.pullRequest;
		Logger.info(`✅ Approuver Pull Request #${pr.number}`);

		// Vérifications d'état
		if (pr.state !== 'open') {
			vscode.window.showErrorMessage('❌ Cette Pull Request n\'est pas ouverte');
			return;
		}
		if (pr.draft) {
			vscode.window.showErrorMessage('❌ Impossible d\'approuver une PR en brouillon');
			return;
		}

		const comment = await vscode.window.showInputBox({
			prompt: 'Comment (optional)',
			placeHolder: 'Enter a comment for this approval...'
		});

		try {
			await giteaClient.approvePullRequest(pr.base.repo.owner.login, pr.base.repo.name, pr.number, comment);
			vscode.window.showInformationMessage(`✅ Pull Request #${pr.number} approuvée`);
			pullRequestsProvider.refresh();
		} catch (err: any) {
			Logger.error('❌ Erreur approbation Pull Request', err);
			vscode.window.showErrorMessage(`❌ Erreur approbation: ${err.message}`);
		}
	});

	const requestChangesPRCommand = vscode.commands.registerCommand('gitea-pull-requests.requestChanges', async (item) => {
		if (!item?.pullRequest || !giteaClient) { return; }
		
		const pr = item.pullRequest;
		Logger.info(`⚠️ Demander modifications Pull Request #${pr.number}`);

		if (pr.state !== 'open') {
			vscode.window.showErrorMessage('❌ Cette Pull Request n\'est pas ouverte');
			return;
		}

		const comment = await vscode.window.showInputBox({
			prompt: 'Comment is required',
			placeHolder: 'Describe the requested changes...',
			validateInput: value => {
				if (!value || value.trim().length < 2) {
					return 'You must provide a comment when requesting changes';
				}
				return null;
			}
		});

		if (!comment || comment.trim().length === 0) { return; }

		try {
			await giteaClient.requestChangesPullRequest(pr.base.repo.owner.login, pr.base.repo.name, pr.number, comment);
			vscode.window.showInformationMessage(`⚠️ Changes requested for PR #${pr.number}`);
			pullRequestsProvider.refresh();
		} catch (err: any) {
			Logger.error('❌ Request changes error', err);
			// Extract actual error message from Gitea response
			let errorMessage = err.message;
			try {
				// Try to parse Gitea JSON error message
				const jsonStart = err.message.indexOf('{');
				if (jsonStart > 0) {
					const errorJson = JSON.parse(err.message.substring(jsonStart));
					if (errorJson.message) {
						errorMessage = errorJson.message;
					}
				}
			} catch (e) {
				// Keep original message if parsing fails
			}
			vscode.window.showErrorMessage(`❌ ${errorMessage}`);
		}
	});

	const addCommentPRCommand = vscode.commands.registerCommand('gitea-pull-requests.addComment', async (item) => {
		if (!item?.pullRequest || !giteaClient) { return; }
		
		const pr = item.pullRequest;
		Logger.info(`💬 Ajouter commentaire Pull Request #${pr.number}`);

		const comment = await vscode.window.showInputBox({
			prompt: 'Your comment',
			placeHolder: 'Enter your comment...',
			validateInput: value => value.trim().length < 1 ? 'Comment cannot be empty' : null
		});

		if (!comment) { return; }

		try {
			await giteaClient.addCommentPullRequest(pr.base.repo.owner.login, pr.base.repo.name, pr.number, comment);
			vscode.window.showInformationMessage(`💬 Commentaire ajouté sur PR #${pr.number}`);
			pullRequestsProvider.refresh();
		} catch (err: any) {
			Logger.error('❌ Erreur ajout commentaire', err);
			vscode.window.showErrorMessage(`❌ Erreur: ${err.message}`);
		}
	});

	const mergePRCommand = vscode.commands.registerCommand('gitea-pull-requests.merge', async (item) => {
		if (!item?.pullRequest || !giteaClient) { return; }
		
		const pr = item.pullRequest;
		Logger.info(`🔀 Fusionner Pull Request #${pr.number}`);

		// State validation
		if (pr.state !== 'open') {
			vscode.window.showErrorMessage('❌ This Pull Request is not open');
			return;
		}
		if (pr.draft) {
			vscode.window.showErrorMessage('❌ Cannot merge a draft Pull Request');
			return;
		}
		if (pr.mergeable === false) {
			vscode.window.showErrorMessage('❌ This Pull Request has merge conflicts');
			return;
		}

		// Choose merge strategy
		const mergeStrategies = [
			{ label: '🔀 Create merge commit', description: 'Default - Preserves full history, shows merge point', value: 'merge' },
			{ label: '⏩ Rebase fast-forward', description: 'Linear history, no merge commit, rewrites SHAs', value: 'rebase' },
			{ label: '🔁 Rebase with merge commit', description: 'Best of both - Clean history + merge marker', value: 'rebase-merge' },
			{ label: '📦 Squash all commits', description: 'Single clean commit, loses individual history', value: 'squash' }
		];

		const selectedStrategy = await vscode.window.showQuickPick(mergeStrategies, {
			title: `Select merge strategy for PR #${pr.number}`,
			placeHolder: 'Choose how you want to merge this pull request',
			canPickMany: false
		});

		if (!selectedStrategy) { return; }

		// Final confirmation
		const confirm = await vscode.window.showWarningMessage(
			`Confirm merge PR #${pr.number} using: ${selectedStrategy.label}?`,
			{ modal: true },
			'✅ Yes, merge now'
		);

		if (confirm !== '✅ Yes, merge now') { return; }

		try {
			await giteaClient.mergePullRequest(pr.base.repo.owner.login, pr.base.repo.name, pr.number, {
				Do: selectedStrategy.value,
				DeleteHeadBranch: false
			});
			vscode.window.showInformationMessage(`🔀 Pull Request #${pr.number} fusionnée avec succès`);
			// Rafraichir complètement la liste des PR depuis le serveur pour retirer celle qui vient d'être mergée
			await fetchPullRequests();
		} catch (err: any) {
			Logger.error('❌ Erreur fusion Pull Request', err);
			
			if (err.message.includes('403')) {
				vscode.window.showErrorMessage('❌ You do not have permission to merge this Pull Request');
			} else if (err.message.includes('409')) {
				vscode.window.showErrorMessage('❌ Merge conflict, please resolve conflicts first');
			} else {
				vscode.window.showErrorMessage(`❌ Merge error: ${err.message}`);
			}
		}
	});

	context.subscriptions.push(
		setTokenCommand,
		refreshCommand,
		markAsReadCommand,
		markAllAsReadCommand,
		openInBrowserCommand,
		refreshPRCommand,
		openPRInBrowserCommand,
		approvePRCommand,
		requestChangesPRCommand,
		addCommentPRCommand,
		mergePRCommand,
		statusBarItem,
		notificationTreeView
	);

	// Vérifier si on a déjà un token
	const savedToken = await TokenManager.getInstance().getToken();
	if (savedToken) {
		const serverUrl = vscode.workspace.getConfiguration('gitea').get('serverUrl') as string;
		if (serverUrl) {
			try {
				Logger.info('🔌 Connexion automatique avec token sauvegardé');
				giteaClient = new GiteaClient(serverUrl, savedToken);
				await giteaClient.getCurrentUser();
				Logger.info('✅ Connexion automatique réussie');
				notificationProvider.setConnected(true);
				pullRequestsProvider.setConnected(true);
				pullRequestsProvider.setClient(giteaClient);
				
				// Détecter repository courant
				const repoInfo = await GitDetector.detectRepository();
				if (repoInfo) {
					pullRequestsProvider.setRepository(repoInfo.owner, repoInfo.repo);
				}
				
				await refreshNotifications();
				await fetchPullRequests();
				startPolling();
			} catch (err: any) {
				Logger.error('❌ Connexion automatique échouée', err);
				await TokenManager.getInstance().deleteToken();
				notificationProvider.setConnected(false);
			}
		}
	}

	updateStatusBar();
}

let isOnline = true;
let lastConnectionState = true;

async function checkConnectivity(): Promise<boolean> {
	if (!giteaClient) {
		return false;
	}

	try {
		Logger.debug('🔍 Vérification connectivité serveur...');
		const isReachable = await giteaClient.pingServer();
		
		// Gestion des transitions d'état
		if (isReachable !== lastConnectionState) {
			if (isReachable) {
				Logger.info('✅ Connexion rétablie avec le serveur Gitea');
				notificationProvider.setOffline(false);
				pullRequestsProvider.setOffline(false);
				vscode.window.showInformationMessage('✅ Connexion rétablie');
				
				// Rafraichissement automatique au retour en ligne
				Logger.info('🔄 Rafraichissement automatique après retour connexion');
				await refreshNotifications();
				await fetchPullRequests();
			} else {
				Logger.warn('⚠️ Perte de connexion avec le serveur Gitea');
				notificationProvider.setOffline(true);
				pullRequestsProvider.setOffline(true);
				vscode.window.showWarningMessage('⚠️ Connexion perdue - Vérifiez votre VPN / réseau');
			}
			lastConnectionState = isReachable;
		}

		isOnline = isReachable;
		return isReachable;
	} catch (error) {
		Logger.error('❌ Erreur vérification connectivité', error);
		return false;
	}
}

async function refreshNotifications(): Promise<void> {
	if (!giteaClient) {
		Logger.debug('⚠️ Pas de client Gitea, impossible de rafraîchir');
		return;
	}

	// Vérifier connectivité avant tout appel API
	const connected = await checkConnectivity();
	if (!connected) {
		Logger.warn('⚠️ Hors ligne, annulation du rafraîchissement des notifications');
		return;
	}

	try {
		Logger.info('🔄 Récupération des notifications...');
		notificationProvider.setLoading(true);
		const notifications = await giteaClient.getNotifications();
		Logger.info(`✅ ${notifications.length} notifications récupérées`);
		notificationProvider.setNotifications(notifications);
		updateStatusBar(notifications);
	} catch (err: any) {
		Logger.error('❌ Impossible de récupérer les notifications', err);
		vscode.window.showErrorMessage(`❌ Impossible de récupérer les notifications: ${err.message}`);
	} finally {
		notificationProvider.setLoading(false);
	}
}

function startPolling(): void {
	// Polling Notifications
	const notificationInterval = (vscode.workspace.getConfiguration('gitea').get('pollingInterval') as number) * 1000;
	Logger.info(`⏱️ Démarrage du polling notifications toutes les ${notificationInterval / 1000} secondes`);

	if (pollingInterval) {
		clearInterval(pollingInterval);
	}

	pollingInterval = setInterval(refreshNotifications, notificationInterval);

	// Polling Pull Requests
	const prInterval = (vscode.workspace.getConfiguration('gitea').get('pullRequestsPollingInterval') as number) * 1000;
	Logger.info(`⏱️ Démarrage du polling Pull Requests toutes les ${prInterval / 1000} secondes`);

	if (prPollingInterval) {
		clearInterval(prPollingInterval);
	}

	prPollingInterval = setInterval(async () => {
		Logger.info('🔄 Polling automatique des Pull Requests');
		const connected = await checkConnectivity();
		if (!connected) {
			Logger.warn('⚠️ Hors ligne, annulation du rafraîchissement des Pull Requests');
			return;
		}
		await fetchPullRequests();
	}, prInterval);
}

function updateStatusBar(notifications?: GiteaNotification[]): void {
	if (!notifications) {
		statusBarItem.text = '$(bell) Gitea';
        // Réinitialiser le badge de l'activité bar
        if (notificationTreeView) {
            // @ts-ignore
            notificationTreeView.badge = undefined;
        }
		return;
	}

	const unreadCount = notifications.filter(n => n.unread).length;
	Logger.debug(`📊 Notifications non lues: ${unreadCount}`);

	if (unreadCount > 0) {
		statusBarItem.text = `$(bell-dot) ${unreadCount}`;
        // Afficher le badge sur l'icône de l'activité bar
        Logger.info(`🏷️ Mise à jour du badge: ${unreadCount}`);
        if (notificationTreeView) {
            Logger.info(`🏷️ treeView disponible, mise à jour du badge`);
            // @ts-ignore
            notificationTreeView.badge = {
                value: unreadCount,
                tooltip: `${unreadCount} notifications non lues`
            };
            Logger.info(`🏷️ Badge mis à jour avec succès avec ${unreadCount} notification`);
        } else {
            Logger.warn(`⚠️ treeView non disponible, impossible de mettre à jour le badge`);
        }
	} else {
		statusBarItem.text = '$(bell) Gitea';
        Logger.info(`🏷️ Réinitialisation du badge`);
        if (notificationTreeView) {
            // @ts-ignore
            notificationTreeView.badge = undefined;
        }
	}
}

export function deactivate() {
	if (pollingInterval) {
		clearInterval(pollingInterval);
	}
	if (prPollingInterval) {
		clearInterval(prPollingInterval);
		Logger.info('✅ Polling Pull Requests arrêté proprement');
	}
	statusBarItem.dispose();
	notificationTreeView.dispose();
	pullRequestsProvider.dispose();
	Logger.info('❌ Extension Gitea désactivée');
}
