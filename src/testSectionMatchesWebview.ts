import * as vscode from 'vscode';
import * as path from 'path';
import { Match } from './matches';
import { Pattern } from './patterns';
import { logger } from './logging';
import { sanitizeContent } from './matchesWebview';
import * as fs from 'fs';


export let allMatchesTestSection: Array<Match> = [];
let matchIdCounterTestSection = 0;

export const updateAllMatches = (allMatchesTestSectionNew: Array<Match>) => {
  allMatchesTestSection = allMatchesTestSectionNew;
};

export const resetMatchValuesTestSection = () => {
  allMatchesTestSection.splice(0);
  matchIdCounterTestSection = 0;
};

export const addSemgrepMatchTestSection = (startLine: number, proof: string, path: string, pattern: Pattern) => {
  logger.debug("addSemgrepMatch")
  matchIdCounterTestSection += 1;
  const newMatch: Match = {
    pattern: pattern,
    path: path,
    lineNumber: startLine,
    lineContent: proof,
    matchId: matchIdCounterTestSection,
    status: "unprocessed",
    detectionType : "semgrep",
    selected: false
  };
  allMatchesTestSection.push(newMatch);
};


export function generateTestSectionMatchesWebview(
  matches: Match[],
  webview: vscode.Webview,
  extensionRoot: string,
  currentPage = 1,
  pageSize = 20
): string {

  const templatePath = path.join(extensionRoot, 'src', 'media', 'testSection.html');
  let html = fs.readFileSync(templatePath, 'utf8');


  const csp = webview.cspSource;
  const testSectionCssUri  = webview.asWebviewUri(vscode.Uri.file(path.join(extensionRoot, 'src', 'media', 'testSection.css')));
  const matchesCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionRoot, 'src', 'media', 'matches.css')));
  const testSectionJsUri   = webview.asWebviewUri(vscode.Uri.file(path.join(extensionRoot, 'src', 'media', 'testSection.js')));


  const totalMatches = matches.length;
  const totalPages   = Math.ceil(totalMatches / pageSize);
  const startIndex   = (currentPage - 1) * pageSize;
  const pageMatches  = matches.slice(startIndex, startIndex + pageSize);

  const MAX_DESC_LEN = 80;
  const matchesHtml = pageMatches.map(m => {
    const relativePath = m.path.replace(vscode.workspace.rootPath ?? '', '.');
    const fullDesc = sanitizeContent(m.pattern.description);
    const truncatedDesc = fullDesc.length > 80
      ? fullDesc.slice(0, 80) + '…'
      : fullDesc;

    return `
       <div id="${m.matchId}" class="match-container">

        <div class="match-content">
          <div>
            <b>Match found in file </b>
            <span class="file-highlight">${relativePath}</span>
            <b>, line ${m.lineNumber}:</b>
          </div>          
          <p>
            <div class="code-line">
              ${sanitizeContent(m.lineContent)
                .replace(
                  m.pattern.pattern,
                  (str) => `<span class="match-highlight">${str}</span>`
                )}
            </div>
          </p>
          <table class="match-meta">
            <tr>
              <td>Type:</td>
              <td>${m.pattern.id}</td>
            </tr>
            <tr>
              <td>Description:</td>
              <td class="desc-cell">
                <span class="desc-text">${truncatedDesc}</span>
                ${
                  fullDesc.length > MAX_DESC_LEN
                    ? `<button
                        class="desc-toggle-btn"
                        data-fulldesc="${fullDesc.replace(/"/g, '&quot;')}"
                        data-truncdesc="${truncatedDesc.replace(/"/g, '&quot;')}"
                      >Show more</button>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td>Criticality:</td>
              <td>${m.pattern.criticality}</td>
            </tr>            
          </table>
        </div>
      </div>
    `;
  }).join('\n');

  const buildPagination = () => `
    <div class="pagination">
      <span>Total: ${totalMatches} | Page ${currentPage}/${totalPages}</span>
      <button data-page="1"  ${currentPage === 1 ? 'disabled' : ''}>⇤ First</button>
      <button data-page="${currentPage-1}" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>
      <button data-page="${currentPage+1}" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
      <button data-page="${totalPages}" ${currentPage === totalPages ? 'disabled' : ''}>Last ⇥</button>
    </div>`;

  html = html
    .replace(/{{cspSource}}/g, csp)
    .replace(/{{testSectionCssUri}}/g, testSectionCssUri.toString())
    .replace(/{{matchesCssUri}}/g, matchesCssUri.toString())
    .replace(/{{testSectionJsUri}}/g, testSectionJsUri.toString())
    .replace(/{{matches}}/g, matchesHtml)
    .replace(/{{paginationTop}}/g, buildPagination())
    .replace(/{{paginationBottom}}/g, buildPagination());
  return html;
}