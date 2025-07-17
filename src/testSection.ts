/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import * as fs      from 'fs';
import { logger } from './logging';
import * as path from 'path';


const generateTestSectionWebview = (webview: vscode.Webview, localPath: string,
) => {
  logger.debug("Start loading testSectionWebview")

  // get path to stylesheet
  const stylesheetPath = vscode.Uri.file(
    path.join(localPath, 'src', 'media', 'testSection.css'),
  );

  // get path to script  
  const scriptPath = vscode.Uri.file(
    path.join(localPath, 'src', 'media', 'testSection.js'),
  );
  
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

  const htmlPath = path.join(localPath, 'src', 'media', 'testSection.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Replace the placeholders with dynamic values
  html = html.replace(/{{cspSource}}/g, webview.cspSource);
  html = html.replace(/{{stylesheetUri}}/g, webview.asWebviewUri(stylesheetPath).toString());
  html = html.replace(/{{scriptUri}}/g, webview.asWebviewUri(scriptPath).toString());
  html = html.replace(/{{CWD}}/g,cwd)
  return html;

};

export default generateTestSectionWebview;
