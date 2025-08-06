import * as vscode from 'vscode';
import * as path from 'path';
import { getCurrentProject } from './projects';

export function getMediaFileUri(webview: vscode.Webview, localPath: string, filename: string): vscode.Uri {
  const mediaFilePath = vscode.Uri.file(path.join(localPath, 'src', 'media', filename));
  return webview.asWebviewUri(mediaFilePath);
}

export function getHtmlHeader(webview: vscode.Webview, localPath: string, title: string): string {
  const logoUri = getMediaFileUri(webview, localPath, 'logo.png');
  const currentProject = getCurrentProject() || "No project open.";
  return `
  <table cellpadding="10" cellspacing="0" style="margin-bottom: 10px;">
    <tr>
      <td>
        <img src="${logoUri}" alt="SAH Logo" style="width: 80px; height: auto; margin-right: 20px;">
      </td>
      <td style="vertical-align: bottom;">
        <h1 style="margin: 0">${title}</h1>
        <p style="margin: 4px 0 0 0">Project: ${currentProject}</p>
      </td>
    </tr>
  </table>
`
}