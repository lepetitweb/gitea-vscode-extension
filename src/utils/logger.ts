import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;

    public static init(): void {
        if (!Logger.outputChannel) {
            Logger.outputChannel = vscode.window.createOutputChannel('Gitea Notifications');
        }
    }

    public static info(message: string): void {
        Logger.log('INFO', message);
    }

    public static error(message: string, error?: any): void {
        Logger.log('ERROR', message);
        if (error) {
            Logger.log('ERROR', `${error.message}`);
            if (error.stack) {
                Logger.log('ERROR', `${error.stack}`);
            }
        }
    }

    public static debug(message: string): void {
        Logger.log('DEBUG', message);
    }

    public static warn(message: string): void {
        Logger.log('WARN', message);
    }

    private static log(level: string, message: string): void {
        Logger.outputChannel.appendLine(`[${level}] ${message}`);
    }

    public static show(): void {
        Logger.outputChannel.show();
    }
}
