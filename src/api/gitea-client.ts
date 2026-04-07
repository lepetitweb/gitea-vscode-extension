import * as vscode from 'vscode';
import type { GiteaUser, GiteaNotification, NotificationQueryOptions } from './types';

export class GiteaClient {
    private baseUrl: string;
    private token: string;

    constructor(baseUrl: string, token: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;
    }

    private getHeaders(): Record<string, string> {
        return {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    public async getCurrentUser(): Promise<GiteaUser> {
        const response = await fetch(`${this.baseUrl}/api/v1/user`, {
            headers: this.getHeaders(),
            // @ts-ignore
            agent: new (require('https').Agent)({ rejectUnauthorized: false })
        });

        if (!response.ok) {
            throw new Error(`Impossible de se connecter: ${response.statusText}`);
        }

        return await response.json() as GiteaUser;
    }

    public async getNotifications(options?: NotificationQueryOptions): Promise<GiteaNotification[]> {
        const params = new URLSearchParams();

        if (options) {
            Object.entries(options).forEach(([key, value]) => {
                if (value !== undefined) {
                    params.append(key, String(value));
                }
            });
        }

        const queryString = params.toString();
        const url = `${this.baseUrl}/api/v1/notifications${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Impossible de récupérer les notifications: ${response.statusText}`);
        }

        return await response.json() as GiteaNotification[];
    }

    public async markNotificationAsRead(notificationId: number): Promise<void> {
        const response = await fetch(`${this.baseUrl}/api/v1/notifications/threads/${notificationId}`, {
            method: 'PATCH',
            headers: this.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Impossible de marquer la notification comme lue: ${response.statusText}`);
        }
    }

    public async markAllNotificationsAsRead(): Promise<void> {
        const response = await fetch(`${this.baseUrl}/api/v1/notifications`, {
            method: 'PUT',
            headers: this.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Impossible de marquer toutes les notifications comme lues: ${response.statusText}`);
        }
    }

    /**
     * Récupère les détails complets d'une Pull Request
     */
        public async getPullRequest(owner: string, repo: string, number: number): Promise<any> {
            const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${number}`, {
                headers: this.getHeaders()
            });
    
            if (!response.ok) {
                throw new Error(`Impossible de récupérer le PR: ${response.statusText}`);
            }
    
            return await response.json();
        }
    
        /**
         * Récupère les détails complets d'un Issue
         */
        public async getIssue(owner: string, repo: string, number: number): Promise<any> {
            const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/issues/${number}`, {
                headers: this.getHeaders()
            });
    
            if (!response.ok) {
                throw new Error(`Impossible de récupérer l'issue: ${response.statusText}`);
            }
    
            return await response.json();
        }
}
