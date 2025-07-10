import * as vscode from 'vscode';
import * as path from 'path';
import { Match, toggledMatchIds } from './matches';
import { logger } from './logging';

const sanitizeContent = (string: string) => {
  return string
    .replace(/./g, (s) => {
      return (s.match(/[a-z0-9\s]+/i)) ? s : "&#" + s.charCodeAt(0) + ";";
    });
}

// global vars for filters 
let selectedStatus = "unprocessed"
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
    ${_rules.map((rules) => `<option value="${rules}">${rules}</option>`).join('')}
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

  // Filter for Criticality 
  const criticalityRank = {
    INFO: 1,
    LOW: 2,
    MEDIUM: 3,
    HIGH: 4,
    CRITICAL: 5
  };
  logger.debug('Criticality filter with', selectedCriticality);    
  // if selectedCriticality (6 7) sort them asc or desc
  // typescript maaaagic
  if (selectedCriticality === "6") {
    // Ascending
    _matches.sort((a, b) => 
      criticalityRank[a.pattern.criticality as keyof typeof criticalityRank] - criticalityRank[b.pattern.criticality as keyof typeof criticalityRank]
    );
  } 
  else if (selectedCriticality === "7") {
    // Descending
    _matches.sort((a, b) => 
      criticalityRank[b.pattern.criticality as keyof typeof criticalityRank] - criticalityRank[a.pattern.criticality as keyof typeof criticalityRank]
    );
  } 
  else if (selectedCriticality !== "0"){
    // else filter _matches dependent on selected criticality
    const selectedLabel = {
      "1": "INFO",
      "2": "LOW",
      "3": "MEDIUM",
      "4": "HIGH",
      "5": "CRITICAL"
    }[selectedCriticality];
    _matches = _matches.filter(m => m.pattern.criticality === selectedLabel);
    
  }
  return _matches
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

  logger.debug("Generating HTML with matches")

  const totalMatches = _matches.length;
  const totalPages = Math.ceil(totalMatches / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  // Get only the matches for the current page
  const paginatedMatches = _matches.slice(startIndex, endIndex);
  logger.debug(`Rendering page ${currentPage}/${totalPages} with ${ _matches.length} matches`);

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
            <b>Match found in file </b>
            <span class="file-highlight">${relativePath}</span>
            <b>, line ${m.lineNumber}:</b>
          </div>
          <div class="icon-bar">
            <div class="jump-to-code-btn"   data-match="${m.matchId}" title="Jump to code">&#8631;</div>
            <div class="finding-btn"        data-match="${m.matchId}" title="Finding">&#8982;</div>
            <div class="falsePositive-btn"  data-match="${m.matchId}" title="False Positive">&#10006;</div>
            <div class="saveForLater-btn"   data-match="${m.matchId}" title="Save for later">&#128427;</div>
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
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
  <link rel="stylesheet" type="text/css" href=${webview.asWebviewUri(stylesheetPath)} />
  <title>SAH Matches</title>
<head>
<body>
  <h2>Matched Patterns: </h2>
  <select id="status-selection">
    <option value="unprocessed">Unprocessed</options>
    <option value="finding">Finding</options>
    <option value="falsePositive">False positive</options>
    <option value="saveForLater">Save for later</options>
    <option value="all">All</options>
  </select>
  <select id="criticality-selection">
    <option value="0">All Criticalities</options>
    <option value="1">INFO</options>
    <option value="2">LOW</options>
    <option value="3">MEDIUM</options>
    <option value="4">HIGH</options>
    <option value="5">CRITICAL</options>
    <option value="6">Ascending Order</options>
    <option value="7">Descending Order</options>
  </select>
  <select id="rules-selection">
    ${ruleSelectionHTML}
  </select>
  <button id="file-view">Show file Selection</button>
  <button id="jmp-to-semgrep">Switch to Semgrep</button>
  <div class="pagination">
    <span>Total Matches: ${totalMatches} | Page ${currentPage} of ${totalPages}</span>
    
    <button id="first-page" data-page="1" ${currentPage === 1 ? 'disabled' : ''}>⇤ First</button>
    <button id="prev-page" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>

    <span class="page-info">Page ${currentPage} / ${totalPages}</span>

    <button id="next-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
    <button id="last-page" data-page="${totalPages}" ${currentPage === totalPages ? 'disabled' : ''}>Last ⇥</button>
  </div>

  <div id="matches">
    ${matchesString}
  </div>

  <div id="action-bar" class="hidden">
    <button id="btn-finding">Mark as Finding</button>
    <button id="btn-false-positive">Mark as False Positive</button>
    <button id="btn-save-later">Save for Later</button>
    <button id="btn-unselect-all">Unselect All</button>
  </div>
  <div class="pagination">
    <span>Total Matches: ${totalMatches} | Page ${currentPage} of ${totalPages}</span>
    
    <button id="first-page" data-page="1" ${currentPage === 1 ? 'disabled' : ''}>⇤ First</button>
    <button id="prev-page" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>

    <span class="page-info">Page ${currentPage} / ${totalPages}</span>

    <button id="next-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
    <button id="last-page" data-page="${totalPages}" ${currentPage === totalPages ? 'disabled' : ''}>Last ⇥</button>
  </div>
  <script src=${webview.asWebviewUri(scriptPath)}></script>
</body>
</html>`;
};

export default generateMatchesWebview;
