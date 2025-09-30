import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getHtmlHeader } from './webHelpers';

const selectedCriticality = "5";

export const criticalityOptions = [
  { value: '1', label: 'INFO', icon: '&#x1F535;' },
  { value: '2', label: 'LOW', icon: '&#x1F7E1;' },
  { value: '3', label: 'MEDIUM', icon: '&#x1F7E0;' },
  { value: '4', label: 'HIGH', icon: '&#x1F534;' },
  { value: '5', label: 'CRITICAL', icon: '&#x1F534;' },
];

export const generateFindingCreationWebiew = (webview : vscode.Webview, localPath: string,  selectedCodeSnippet: string, proofPath: string, proofStartLine: number) => {
    console.log(selectedCodeSnippet);
    
    const criticalitySelectHtml = `
    <select id="criticality-selection">
        ${criticalityOptions.map(opt => `
        <option value="${opt.value}" ${opt.value === selectedCriticality ? 'selected' : ''}>
            ${opt.label}
        </option>
        `).join('')}
    </select>
    `;
    const scriptPath = vscode.Uri.file(
    path.join(localPath, 'src', 'media', 'manualMatch.js'),
    );

    const stylesheetPath = vscode.Uri.file(
    path.join(localPath, 'src', 'media', 'manualMatch.css'),
    );
    const htmlHeader = getHtmlHeader(webview, localPath, 'Add Match Manually');

    const htmlPath = path.join(localPath, 'src', 'media', 'manualMatch.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Replace the placeholders with dynamic values
    html = html.replace(/{{cspSource}}/g, webview.cspSource);
    html = html.replace(/{{htmlHeader}}/g,htmlHeader);      
    html = html.replace(/{{stylesheetUri}}/g, webview.asWebviewUri(stylesheetPath).toString());
    html = html.replace(/{{scriptUri}}/g, webview.asWebviewUri(scriptPath).toString());
    html = html.replace(/{{selectedCodeSnippet}}/g,selectedCodeSnippet);
    html = html.replace(/{{criticalitySelectHtml}}/g,criticalitySelectHtml);
    html = html.replace(/{{proofPath}}/g,proofPath);
    html = html.replace(/{{proofStartLine}}/g,proofStartLine.toString());
    
    return html;
} 

