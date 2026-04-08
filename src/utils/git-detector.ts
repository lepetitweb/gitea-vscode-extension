import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

export interface GitRepositoryInfo {
    host: string;
    owner: string;
    repo: string;
    remoteUrl: string;
}

export class GitDetector {
    /**
     * Détecte le repository Gitea depuis le workspace courant (méthode asynchrone)
     */
    public static async detectRepository(): Promise<GitRepositoryInfo | null> {
        Logger.debug('Détection du repository Git en cours...');
        
        try {
            const workspaceRoot = GitDetector.getWorkspaceRoot();
            if (!workspaceRoot) {
                Logger.warn('Aucun workspace ouvert dans VS Code');
                return null;
            }

            const gitConfigPath = path.join(workspaceRoot, '.git', 'config');
            
            if (!fs.existsSync(gitConfigPath)) {
                Logger.warn(`Aucun repository Git trouvé dans le workspace: ${workspaceRoot}`);
                return null;
            }

            const configContent = await fs.promises.readFile(gitConfigPath, 'utf8');
            const remoteOrigin = GitDetector.extractRemoteOrigin(configContent);
            
            if (!remoteOrigin) {
                Logger.warn('Remote origin non configuré dans le fichier .git/config');
                return null;
            }

            const repoInfo = GitDetector.parseGitUrl(remoteOrigin);
            if (!repoInfo) {
                Logger.warn(`L'URL du remote origin ne correspond pas à un format supporté: ${remoteOrigin}`);
                return null;
            }

            Logger.info(`Repository Gitea détecté avec succès: ${repoInfo.owner}/${repoInfo.repo} sur ${repoInfo.host}`);
            return repoInfo;

        } catch (error) {
            Logger.error('Erreur lors de la détection du repository Git', error);
            return null;
        }
    }

    /**
     * Détecte le repository Gitea depuis le workspace courant (méthode synchrone)
     */
    public static detectRepositorySync(): GitRepositoryInfo | null {
        Logger.debug('Détection synchrone du repository Git en cours...');
        
        try {
            const workspaceRoot = GitDetector.getWorkspaceRoot();
            if (!workspaceRoot) {
                Logger.warn('Aucun workspace ouvert dans VS Code');
                return null;
            }

            const gitConfigPath = path.join(workspaceRoot, '.git', 'config');
            
            if (!fs.existsSync(gitConfigPath)) {
                Logger.warn(`Aucun repository Git trouvé dans le workspace: ${workspaceRoot}`);
                return null;
            }

            const configContent = fs.readFileSync(gitConfigPath, 'utf8');
            const remoteOrigin = GitDetector.extractRemoteOrigin(configContent);
            
            if (!remoteOrigin) {
                Logger.warn('Remote origin non configuré dans le fichier .git/config');
                return null;
            }

            const repoInfo = GitDetector.parseGitUrl(remoteOrigin);
            if (!repoInfo) {
                Logger.warn(`L'URL du remote origin ne correspond pas à un format supporté: ${remoteOrigin}`);
                return null;
            }

            Logger.info(`Repository Gitea détecté avec succès: ${repoInfo.owner}/${repoInfo.repo} sur ${repoInfo.host}`);
            return repoInfo;

        } catch (error) {
            Logger.error('Erreur lors de la détection synchrone du repository Git', error);
            return null;
        }
    }

    /**
     * Récupère le répertoire racine du workspace courant
     */
    private static getWorkspaceRoot(): string | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        
        // Prend le premier workspace ouvert
        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * Extrait l'URL du remote origin depuis le contenu du fichier config
     */
    private static extractRemoteOrigin(configContent: string): string | null {
        // Pattern pour matcher la section [remote "origin"] et la valeur url
        const remotePattern = /\[remote\s+"origin"\][^[]*url\s*=\s*(.+)/i;
        const match = configContent.match(remotePattern);
        
        if (!match) {
            return null;
        }

        return match[1].trim();
    }

    /**
     * Parse une URL Git pour extraire host, owner et repo
     * Supporte les formats:
     * - https://gitea.host/owner/repo.git
     * - http://gitea.host/owner/repo.git
     * - git@gitea.host:owner/repo.git
     * - ssh://git@gitea.host/owner/repo.git
     */
    public static parseGitUrl(url: string): GitRepositoryInfo | null {
        url = url.trim();
        
        // Cas 1: Protocol HTTP/HTTPS
        const httpRegex = /^(https?):\/\/(?:[^@]+@)?([^\/]+)\/([^\/]+)\/([^\/\.]+)(?:\.git)?$/i;
        let match = url.match(httpRegex);
        
        if (match) {
            return {
                host: match[2],
                owner: match[3],
                repo: match[4],
                remoteUrl: url
            };
        }

        // Cas 2: Format SSH avec protocole explicite
        const sshRegex = /^ssh:\/\/(?:git@)?([^\/]+)\/([^\/]+)\/([^\/\.]+)(?:\.git)?$/i;
        match = url.match(sshRegex);
        
        if (match) {
            return {
                host: match[1],
                owner: match[2],
                repo: match[3],
                remoteUrl: url
            };
        }

        // Cas 3: Format SSH raccourci git@host:owner/repo.git
        const gitSshRegex = /^git@([^:]+):([^\/]+)\/([^\/\.]+)(?:\.git)?$/i;
        match = url.match(gitSshRegex);
        
        if (match) {
            return {
                host: match[1],
                owner: match[2],
                repo: match[3],
                remoteUrl: url
            };
        }

        return null;
    }
}
