import * as vscode from 'vscode';
import * as path from 'path';
import { Match, toggledMatchIds, criticalityOptions, statusOptions } from './matches';
import { logger } from './logging';

export const sanitizeContent = (string: string) => {
  return string
    .replace(/./g, (s) => {
      return (s.match(/[a-z0-9\s]+/i)) ? s : "&#" + s.charCodeAt(0) + ";";
    });
}

// global vars for filters 
let selectedStatus = "all" // "unprocessed"
let selectedCriticality = "0";
let selectedRule = "all";
export let excludedPath: string[] = [];

// 3 functions to apply the filters 
// --> update from right to left if something changes
export const setStatus = (newStatus: string, panel: vscode.WebviewPanel) => {
  selectedStatus = newStatus;
  selectedCriticality = "0";
  selectedRule = "all"
  panel.webview.postMessage({
    command: 'updateState',
    newState: {
      status: selectedStatus,
      criticality: selectedCriticality,
      rule: selectedRule
    }
  });
};


export const setCriticality = (newCriticality: string, panel: vscode.WebviewPanel) => {
  selectedCriticality = newCriticality;
  selectedRule = "all"
  panel.webview.postMessage({
    command: 'updateState',
    newState: {
      status: selectedStatus,
      criticality: selectedCriticality,
      rule: selectedRule
    }
  });
};

export const setRule = (newRule: string, panel: vscode.WebviewPanel) => {
  selectedRule = newRule;
  panel.webview.postMessage({
    command: 'updateState',
    newState: {
      status: selectedStatus,
      criticality: selectedCriticality,
      rule: selectedRule
    }
  });
};

export const setExcludedPath = (newExcludedPaths: string[]) => {
  excludedPath = [...newExcludedPaths]; // Overwrite with new values
};
 

function generateRuleSelection(rules: Array<Match>) {
  logger.debug("start generateRuleSelection")
  const _rules = Array.from(new Set(rules.map((m) => m.pattern.pattern))).sort();

  return `
    <option value="all" id="rules-selection">All Rules/Patterns</option>
    ${_rules.map((rules) => `<option value="${rules}">${formatDashedString(rules)}</option>`).join('')}
  `;
}

function applyStatusFilter(matches: Match[]){
  if (selectedStatus !== "all") {
    logger.debug('Status filter with: ', selectedStatus)
    matches = matches.filter((m) => m.status == selectedStatus);    
  }
  return matches
}

function applyCriticalityFilter(_matches: Match[]){
  if (selectedCriticality !== "0"){
    const selectedLabel = criticalityOptions.find(option => option.value === selectedCriticality)?.label ?? "";
    _matches = _matches.filter(m => m.pattern.criticality === selectedLabel);
  }
  return _matches
}

function getCriticalityIcon(selectedCriticalityLabel: string): string {
  return criticalityOptions.find(option => option.label === selectedCriticalityLabel)?.icon ?? "";
}

function orderMatchesByCriticality(_matches: Match[]){
  return _matches.sort((a, b) => {
    const getRank = (label: string) =>
    criticalityOptions.find(opt => opt.label === label)?.value ?? '0';

    return parseInt(getRank(b.pattern.criticality)) - parseInt(getRank(a.pattern.criticality));
  });
}

function applyRuleFilter(_matches: Match[]){
  // Filter for Rule
  if (selectedRule !== "all") {
    logger.debug('Rule filter with', selectedRule); 
    _matches = _matches.filter((m) => m.pattern.pattern == selectedRule);    
  }
  return _matches
}

function applyExlusionFilter(_matches: Match[]){
  if (excludedPath.length > 0) {
    logger.debug("Filter for Excluded from FileView")
    _matches = _matches.filter((m) => !excludedPath.includes(m.path));
  } else {
    logger.debug("Not Filtering for Excluded from FileView (excludedPath <= 0)")
  }
  return _matches
}

function formatDashedString(input: string): string {
  // Make detection type readable by replacing dashes with space and capitalization
  return input
    .split('-')
    .filter(Boolean) // removes empty strings caused by consecutive dashes
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const generateMatchesWebview = (
  matches: Array<Match>, webview: vscode.Webview, localPath: string, currentPage = 1, pageSize = 20
) => {
  let matchesString: string = '';
  // create a copy of matches for later use - CategorySelection with all matches
  let _matches = [...matches];
  logger.debug(`filter: ${selectedStatus}|${selectedCriticality}|${selectedRule}|`)


  /*
  Filter for Status, Criticality, Rule and Exclusion from the FileView
  */
  
  _matches = applyStatusFilter(_matches)  
  _matches = applyCriticalityFilter(_matches)
  const ruleSelectionHTML = generateRuleSelection(_matches)
  _matches = applyRuleFilter(_matches)  
  _matches = applyExlusionFilter(_matches)
  _matches = orderMatchesByCriticality(_matches)

  logger.debug("Generating HTML with matches")

  const totalMatches = _matches.length;
  const totalPages = Math.ceil(totalMatches / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  // Get only the matches for the current page
  const paginatedMatches = _matches.slice(startIndex, endIndex);
  logger.debug(`Rendering page ${currentPage}/${totalPages} with ${ _matches.length} matches`);

  if (totalMatches == 0) {
    matchesString += `
      <div class="no-match-container">
        <p><strong>There are no matches!</strong><br></p>
        <p>Please adjust filters, scan code or load project.</p>
      </div>
    `
  }

  // loop over all _matches and append HTML for each one to matchesString
  paginatedMatches.forEach((m) => {
    
    const relativePath = m.path.replace(vscode.workspace.rootPath !== undefined ? vscode.workspace.rootPath : '', '.');

    // modfication for the description 
    const MAX_DESC_LEN = 80;
    const fullDesc = sanitizeContent(m.pattern.description);
    const truncatedDesc =
    fullDesc.length > MAX_DESC_LEN
    ? fullDesc.slice(0, MAX_DESC_LEN) + '...'
    : fullDesc;

    // need this to show after the pagination 
    // so its still selected to not get a visual bug in which
    // it is selected in the backend but not in the frontent xD
    const isToggled = toggledMatchIds.has(m.matchId);

    // construct HTML for single match
    matchesString += `
      <div id="${m.matchId}" class="match-container">
        <div class="match-input">
          <input
            type="checkbox"
            title="Select"
            id="checkbox${m.matchId}"
            class="match-toggle"
            ${isToggled ? 'checked' : ''}
          />
        </div>

        <div class="match-content">
          <div>
            <b>
              ${getCriticalityIcon(m.pattern.criticality)}
              Match #${m.matchId} found in file&nbsp;
            </b>
            <span class="file-highlight jump-to-code-btn" data-match="${m.matchId}">${relativePath}</span>
            <b>, line ${m.lineNumber}:</b>
          </div>
          <div class="icon-bar">
            <div class="jump-to-code-btn"   data-match="${m.matchId}" title="Jump to code">&#8631;</div>
            <div class="finding-btn"        data-match="${m.matchId}" title="Finding">&#8982;</div>
            <div class="falsePositive-btn"  data-match="${m.matchId}" title="False Positive">&#10006;</div>
            <div class="saveForLater-btn"   data-match="${m.matchId}" title="Save for later">&#x1F570;</div>
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
              <td>${formatDashedString(m.pattern.id)}</td>
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
              <td>${getCriticalityIcon(m.pattern.criticality)}&nbsp;${m.pattern.criticality}</td>
            </tr>
            <tr>
              <td>Status:</td>
              <td>${m.status}</td>
            </tr>
            <tr>
              <td>Comment:</td>
              <td>
                <input
                  type="text"
                  class="comment-input"
                  data-match="${m.matchId}"
                  placeholder="No comment yet..."
                  title="${m.comment || 'No comment yet...'}"
                  value="${m.comment || ''}"
                />
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
  });

  logger.debug("Fininshed creating HTML with Matches")
  // get path to stylesheet
  const stylesheetPath = vscode.Uri.file(
    path.join(localPath, 'src', 'media', 'matches.css'),
  );

  // get path to script
  const scriptPath = vscode.Uri.file(
    path.join(localPath, 'src', 'media', 'matches.js'),
  );

  const logoPath = vscode.Uri.file(
    path.join(localPath, 'src', 'media', 'logo.png'),
  );
  logger.debug(logoPath.toString());
  const logoUri = webview.asWebviewUri(logoPath);


  const paginationPanel = `
    <div class="pagination">
      <span>Total Matches: ${totalMatches} | Page ${currentPage} of ${totalPages}</span>

      <button id="first-page" data-page="1" ${currentPage === 1 ? 'disabled' : ''}>⇤ First</button>
      <button id="prev-page" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>

      <span class="page-info">Page ${currentPage} / ${totalPages}</span>

      <button id="next-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
      <button id="last-page" data-page="${totalPages}" ${currentPage === totalPages ? 'disabled' : ''}>Last ⇥</button>
    </div>
  `

  const statusSelectHtml = `
    <select id="status-selection">
      ${statusOptions.map(opt => `
        <option value="${opt.value}" ${opt.value === selectedStatus ? 'selected' : ''}>
          ${opt.label}
        </option>
      `).join('')}
    </select>
  `;

  const criticalitySelectHtml = `
    <select id="criticality-selection">
      ${criticalityOptions.map(opt => `
        <option value="${opt.value}" ${opt.value === selectedCriticality ? 'selected' : ''}>
          ${opt.label}
        </option>
      `).join('')}
    </select>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource}; img-src ${webview.cspSource};">
  <link rel="stylesheet" type="text/css" href=${webview.asWebviewUri(stylesheetPath)} />
  <title>SAH Matches</title>
<head>
<body>
  <img src="${logoUri}" />
  <h2>Matched Patterns: </h2>
  ${statusSelectHtml}
  ${criticalitySelectHtml}
  <select id="rules-selection">
    ${ruleSelectionHTML}
  </select>
  <button id="file-view">Show file Selection</button>
  <button id="jmp-to-semgrep">Switch to Scan View</button>

  ${paginationPanel}<br>

  <div id="matches">
    ${matchesString}
  </div>

  <div id="action-bar" class="hidden">
    <button id="btn-finding">Mark as Finding</button>
    <button id="btn-false-positive">Mark as False Positive</button>
    <button id="btn-save-later">Save for Later</button>
    <button id="btn-unselect-all">Unselect All</button>
  </div>

  ${paginationPanel}

  <script src=${webview.asWebviewUri(scriptPath)}></script>
</body>
</html>`;
};

export default generateMatchesWebview;
