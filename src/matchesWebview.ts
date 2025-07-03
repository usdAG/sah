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

let selectedStatus = "unprocessed"
let selectedCriticality = 0;
let selectedRule = "all";
export let excludedPath: string[] = [];


export const setStatus = (newStatus: string, panel: vscode.WebviewPanel) => {
  selectedStatus = newStatus;
  selectedCriticality = 0;
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


export const setCriticality = (newCriticality: number, panel: vscode.WebviewPanel) => {
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

const generateMatchesWebview = (
  matches: Array<Match>, webview: vscode.Webview, localPath: string, currentPage = 1, pageSize = 20
) => {
  let matchesString: string = '';
  // create a copy of matches for later use - CategorySelection with all matches
  let _matches = [...matches];
  logger.debug(`filter: ${selectedStatus}|${selectedCriticality}|${selectedRule}|`)

  // Filter for Status
  if (selectedStatus !== "all") {
    logger.debug('Status filter with: ', selectedStatus)
    _matches = _matches.filter((m) => m.status == selectedStatus);    
  }
  //logger.debug("Matches for webview generation (after status)",_matches)

  // Filter for Criticality 
  // if selectedCriticality > 5 (6 7) sort them asc or desc
  if (selectedCriticality > 5){
    // don't add "logger.debug" into a sorting algo :D
    logger.debug('Criticality filter with', selectedCriticality)
    _matches.sort((a, b) => {      
      if (selectedCriticality == 6) {
        return a.pattern.criticality - b.pattern.criticality; // Ascending
      } else {
        return b.pattern.criticality - a.pattern.criticality; // Descending
      }
    });
    logger.debug("end sorting")
  } else {
    // else filter _matches dependent on selected criticality
    _matches = selectedCriticality == 0 ? _matches : _matches.filter((m) => m.pattern.criticality == selectedCriticality);
    logger.debug('Criticality filter with', selectedCriticality);      
  }
  //logger.debug("Matches for webview generation (after criticality)",_matches)

  const ruleSelectionHTML = generateRuleSelection(_matches)
  // Filter for Rule
  if (selectedRule !== "all") {
    logger.debug('Rule filter with', selectedRule); 
    _matches = _matches.filter((m) => m.pattern.pattern == selectedRule);    
  }
  // Filter for Excluded from FileView
  if (excludedPath.length > 0) {
    logger.debug("Filter for Excluded from FileView")
    _matches = _matches.filter((m) => !excludedPath.includes(m.path));
  } else {
    logger.debug("Not Filtering for Excluded from FileView (excludedPath <= 0)")
  }

  logger.debug("Generationg HTML with matches")
  const totalMatches = _matches.length;
  const totalPages = Math.ceil(totalMatches / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  // Get only the matches for the current page
  const paginatedMatches = _matches.slice(startIndex, endIndex);
  logger.debug(`Rendering page ${currentPage}/${totalPages} with ${ _matches.length} matches`);
  // loop over all _matches and append HTML for each one to matchesString
  paginatedMatches.forEach((m) => {

    const parsedPattern = typeof m.pattern.pattern === 'string' ? new RegExp(m.pattern.pattern) : m.pattern.pattern;
    const highlightedCodeLine = parsedPattern.exec(m.lineContent);
    const relativePath = m.path.replace(vscode.workspace.rootPath !== undefined ? vscode.workspace.rootPath : '', '.');

    // modfication for the description 
    const MAX_DESC_LEN = 80;
    const fullDesc = sanitizeContent(m.pattern.description);
    const truncatedDesc =
    fullDesc.length > MAX_DESC_LEN
    ? fullDesc.slice(0, MAX_DESC_LEN) + '...'
    : fullDesc;

    // need this to show after pagination that its still seletect to not get a visual bug
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
                highlightedCodeLine !== null ? highlightedCodeLine[0] : '',
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
    <option value="1">Criticality 1</options>
    <option value="2">Criticality 2</options>
    <option value="3">Criticality 3</options>
    <option value="4">Criticality 4</options>
    <option value="5">Criticality 5</options>
    <option value="6">Ascending Order</options>
    <option value="7">Descending Order</options>
  </select>
  <select id="rules-selection">
    ${ruleSelectionHTML}
  </select>
  <button id="file-view">Show file Selection</button>
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
