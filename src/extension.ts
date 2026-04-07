import * as vscode from 'vscode';
import { TokenManager } from './auth/token-manager';
import { GiteaClient } from './api/gitea-client';
import { NotificationProvider, TreeItemType } from './notifications/notification-provider';
import { Logger } from './utils/logger';
import type { GiteaNotification } from './api/types';

let treeView: vscode.TreeView<unknown>;

let statusBarItem: vscode.StatusBarItem;
let notificationProvider: NotificationProvider;
let pollingInterval: NodeJS.Timeout | undefined;
let giteaClient: GiteaClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
	Logger.init();
	Logger.info('✅ Extension Gitea Notifications activée avec succès');

	// Initialiser les services
	TokenManager.init(context);
	notificationProvider = new NotificationProvider();

	// Créer la vue
	treeView = vscode.window.createTreeView('gitea-notifications', {
		treeDataProvider: notificationProvider,
		showCollapseAll: true
	});

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
			const user = await giteaClient.getCurrentUser();

			Logger.info(`✅ Connexion réussie en tant que ${user.login}`);
			vscode.window.showInformationMessage(`✅ Connecté en tant que ${user.login}`);
			notificationProvider.setConnected(true);
			await refreshNotifications();
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

	context.subscriptions.push(
		setTokenCommand,
		refreshCommand,
		markAsReadCommand,
		markAllAsReadCommand,
		openInBrowserCommand,
		statusBarItem
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
				await refreshNotifications();
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

async function refreshNotifications(): Promise<void> {
	if (!giteaClient) {
		Logger.debug('⚠️ Pas de client Gitea, impossible de rafraîchir');
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
	const interval = (vscode.workspace.getConfiguration('gitea').get('pollingInterval') as number) * 1000;
	Logger.info(`⏱️ Démarrage du polling toutes les ${interval / 1000} secondes`);

	if (pollingInterval) {
		clearInterval(pollingInterval);
	}

	pollingInterval = setInterval(refreshNotifications, interval);
}

function updateStatusBar(notifications?: GiteaNotification[]): void {
	if (!notifications) {
		statusBarItem.text = '$(bell) Gitea';
        // Réinitialiser le badge de l'activité bar
        if (treeView) {
            // @ts-ignore
            treeView.badge = undefined;
        }
		return;
	}

	const unreadCount = notifications.filter(n => n.unread).length;
	Logger.debug(`📊 Notifications non lues: ${unreadCount}`);

	if (unreadCount > 0) {
		statusBarItem.text = `$(bell-dot) ${unreadCount}`;
        // Afficher le badge sur l'icône de l'activité bar
        Logger.info(`🏷️ Mise à jour du badge: ${unreadCount}`);
        if (treeView) {
            Logger.info(`🏷️ treeView disponible, mise à jour du badge`);
            // @ts-ignore
            treeView.badge = {
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
        if (treeView) {
            // @ts-ignore
            treeView.badge = undefined;
        }
	}
}

export function deactivate() {
	if (pollingInterval) {
		clearInterval(pollingInterval);
	}
	statusBarItem.dispose();
	Logger.info('❌ Extension Gitea Notifications désactivée');
}
