// import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import type {
    GiteaUser,
    GiteaNotification,
    NotificationQueryOptions,
    GiteaPullRequest,
    GiteaPullRequestReview,
    GiteaPullRequestComment
} from './types';

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

        /**
         * Vérifie la connectivité avec le serveur Gitea
         */
        public async pingServer(): Promise<boolean> {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(`${this.baseUrl}/api/v1/version`, {
                    headers: this.getHeaders(),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                return response.ok;
            } catch (error) {
                return false;
            }
        }

        /**
         * Récupère toutes les Pull Requests assignées à l'utilisateur courant
         */
        public async getAssignedPullRequests(owner: string, repo: string): Promise<GiteaPullRequest[]> {
            const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls?state=open`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Impossible de récupérer les PR assignés: ${response.statusText}`);
            }

            return await response.json() as GiteaPullRequest[];
        }

        /**
         * Récupère les détails complets d'une Pull Request
         */
        public async getPullRequestDetails(owner: string, repo: string, number: number): Promise<GiteaPullRequest> {
            const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${number}`, {
                headers: this.getHeaders()
            });
    
            if (!response.ok) {
                throw new Error(`Impossible de récupérer le PR: ${response.statusText}`);
            }
    
            return await response.json() as GiteaPullRequest;
        }

        /**
         * Récupère tous les commentaires d'une Pull Request
         */
        public async getPullRequestComments(owner: string, repo: string, number: number): Promise<GiteaPullRequestComment[]> {
            // Gitea uses issues endpoint for PR comments
            const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/issues/${number}/comments`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Impossible de récupérer les commentaires du PR: ${response.statusText}`);
            }

            return await response.json() as GiteaPullRequestComment[];
        }

        /**
         * Soumet une review sur une Pull Request
         */
        public async submitPullRequestReview(owner: string, repo: string, number: number, review: any): Promise<GiteaPullRequestReview> {
            // Gitea API requires properly formatted payload
            const payload = {
                body: review.body || '',
                event: review.event
            };

            Logger.debug(`Submitting PR review payload: ${JSON.stringify(payload)}`);
            
            const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${number}/reviews`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const responseText = await response.text();
                Logger.error(`API Error response: ${responseText}`);
                throw new Error(`Impossible de soumettre la review: ${response.statusText} - ${responseText}`);
            }

            const result = await response.json();
            Logger.debug(`Review submitted successfully: ${JSON.stringify(result)}`);
            
            return result as GiteaPullRequestReview;
        }

        /**
         * Fusionne une Pull Request
         */
        public async mergePullRequest(owner: string, repo: string, number: number, options: any): Promise<boolean> {
            const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${number}/merge`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(options)
            });

            if (!response.ok) {
                throw new Error(`Failed to merge PR: ${response.statusText}`);
            }

            return true;
        }

        /**
         * Approuve une Pull Request
         */
        public async approvePullRequest(owner: string, repo: string, number: number, comment?: string): Promise<GiteaPullRequestReview> {
            return this.submitPullRequestReview(owner, repo, number, {
                event: 'APPROVE',
                body: comment || ''
            });
        }

        /**
         * Demande des modifications sur une Pull Request
         */
        public async requestChangesPullRequest(owner: string, repo: string, number: number, comment: string): Promise<GiteaPullRequestReview> {
            return this.submitPullRequestReview(owner, repo, number, {
                event: 'REQUEST_CHANGES',
                body: comment
            });
        }

        /**
         * Ajoute un commentaire sur une Pull Request
         */
        public async addCommentPullRequest(owner: string, repo: string, number: number, comment: string): Promise<GiteaPullRequestReview> {
            return this.submitPullRequestReview(owner, repo, number, {
                event: 'COMMENT',
                body: comment
            });
        }

        /**
         * Récupère la liste des fichiers modifiés dans un PR
         */
        public async getPullRequestFiles(owner: string, repo: string, number: number): Promise<any[]> {
            const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${number}/files`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Impossible de récupérer les fichiers du PR: ${response.statusText}`);
            }

            return await response.json();
        }

        /**
         * Récupère la liste des reviews et leurs commentaires
         */
        public async getPullRequestReviews(owner: string, repo: string, number: number): Promise<any[]> {
            const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${number}/reviews`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Impossible de récupérer les reviews du PR: ${response.statusText}`);
            }

            return await response.json();
        }
}
