import * as vscode from 'vscode';

export class TokenManager {
    private static SECRET_KEY = 'gitea-api-token';
    private static instance: TokenManager;

    private constructor(private context: vscode.ExtensionContext) {}

    public static init(context: vscode.ExtensionContext): TokenManager {
        if (!TokenManager.instance) {
            TokenManager.instance = new TokenManager(context);
        }
        return TokenManager.instance;
    }

    public static getInstance(): TokenManager {
        if (!TokenManager.instance) {
            throw new Error('TokenManager non initialisé');
        }
        return TokenManager.instance;
    }

    public async saveToken(token: string): Promise<void> {
        await this.context.secrets.store(TokenManager.SECRET_KEY, token);
    }

    public async getToken(): Promise<string | undefined> {
        return await this.context.secrets.get(TokenManager.SECRET_KEY);
    }

    public async deleteToken(): Promise<void> {
        await this.context.secrets.delete(TokenManager.SECRET_KEY);
    }

    public async hasToken(): Promise<boolean> {
        const token = await this.getToken();
        return !!token;
    }
}
