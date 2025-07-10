/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';

class Logger {
  // https://code.visualstudio.com/api/references/vscode-api#OutputChannel
  private channel = vscode.window.createOutputChannel('SAH');
  private logLevel: 'debug' | 'info' | 'warn' | 'error' | 'off';

  constructor() {
    this.logLevel = vscode.workspace.getConfiguration('SAH').get('logLevel', 'info');
  }

  public setLogLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'off') {
    this.logLevel = level;
    vscode.window.showInformationMessage(`SAH log level set to ${level}.`);
  }

  debug(msg: string, ...args: any[]) {
    if (['debug'].includes(this.logLevel)) this.log('DEBUG', msg, args);
  }
  info(msg: string, ...args: any[]) {
    if (['debug', 'info'].includes(this.logLevel)) this.log('INFO', msg, args);
  }
  warn(msg: string, ...args: any[]) {
    if (['debug', 'info', 'warn'].includes(this.logLevel)) this.log('WARN', msg, args);
  }
  error(msg: string, ...args: any[]) {
    if (['debug', 'info', 'warn', 'error'].includes(this.logLevel)) this.log('ERROR', msg, args);
  }

  private log(level: string, msg: string, args: any[]) {
    const formatted = `[${level.padEnd(5)}] ${new Date().toISOString()} ${msg} ${args.map(a => JSON.stringify(a)).join(' ')}`;
    this.channel.appendLine(formatted);
  }
}


export const logger = new Logger();
logger.info('Logger activated');
