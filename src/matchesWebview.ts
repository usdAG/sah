import * as vscode from 'vscode';
import * as path from 'path';
import { Match } from './matches';

const sanitizeContent = (string: string) => {
  return string
    .replace(/./g, (s) => {
      return (s.match(/[a-z0-9\s]+/i)) ? s : "&#" + s.charCodeAt(0) + ";";
    });
}

let selectedStatus = "unprocessed"
let selectedCriticality = 0;
let selectedCategory = "all";
let selectedRule = "all";
let excludedPath: string[] = [];


export const setStatus = (newStatus: string, panel: vscode.WebviewPanel) => {
  selectedStatus = newStatus;
  selectedCriticality = 0;
  selectedCategory = "all"
  selectedRule = "all"
  panel.webview.postMessage({
    command: 'updateState',
    newState: {
      status: selectedStatus,
      criticality: selectedCriticality,
      category: selectedCategory,
      rule: selectedRule
    }
  });
};


export const setCriticality = (newCriticality: number, panel: vscode.WebviewPanel) => {
  selectedCriticality = newCriticality;
  selectedCategory = "all"
  selectedRule = "all"
  panel.webview.postMessage({
    command: 'updateState',
    newState: {
      status: selectedStatus,
      criticality: selectedCriticality,
      category: selectedCategory,
      rule: selectedRule
    }
  });
};

export const setCategory = (newCategory: string, panel: vscode.WebviewPanel) => {
  selectedCategory = newCategory;
  selectedRule = "all"
  panel.webview.postMessage({
    command: 'updateState',
    newState: {
      status: selectedStatus,
      criticality: selectedCriticality,
      category: selectedCategory,
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
      category: selectedCategory,
      rule: selectedRule
    }
  });
};

export const setExcludedPath = (newExcludedPaths: string[]) => {
  excludedPath = [...newExcludedPaths]; // Overwrite with new values
};
 
function generateCategorySelection(matches: Array<Match>) {
  console.debug("start generateCategorySelection")
  // Extract unique categories from array using Set
  // then convert back to an array and sort alphabetically
  const categories = Array.from(new Set(matches.map((m) => m.pattern.description))).sort();

  return `
    <option value="all" id="category-selection">All Categories</option>
    ${categories.map((category) => `<option value="${category}">${category}</option>`).join('')}
  `;
}

function generateRuleSelection(rules: Array<Match>) {
  console.debug("start generateRuleSelection")
  const categories = Array.from(new Set(rules.map((m) => m.pattern.pattern))).sort();

  return `
    <option value="all" id="rules-selection">All Rules/Patterns</option>
    ${categories.map((rules) => `<option value="${rules}">${rules}</option>`).join('')}
  `;
}

const generateMatchesWebview = (
  matches: Array<Match>, webview: vscode.Webview, localPath: string, currentPage = 1, pageSize = 20
) => {
  let matchesString: string = '';
  // create a copy of matches for later use - CategorySelection with all matches
  let _matches = [...matches];
  console.debug(`filter: ${selectedStatus}|${selectedCriticality}|${selectedCategory}|${selectedRule}|`)

  // Filter for Status
  if (selectedStatus !== "all") {
    console.debug('Status filter with: ', selectedStatus)
    _matches = _matches.filter((m) => m.status == selectedStatus);    
  }
  console.debug(_matches)

  // Filter for Criticality 
  // if selectedCriticality > 5 (6 7) sort them asc or desc
  if (selectedCriticality > 5){
    // don't add "console.debug" into a sorting algo :D
    console.debug('Criticality filter with', selectedCriticality)
    _matches.sort((a, b) => {      
      if (selectedCriticality == 6) {
        return a.pattern.criticality - b.pattern.criticality; // Ascending
      } else {
        return b.pattern.criticality - a.pattern.criticality; // Descending
      }
    });
    console.debug("end sorting")
  } else {
    // else filter _matches dependent on selected criticality
    _matches = selectedCriticality == 0 ? _matches : _matches.filter((m) => m.pattern.criticality == selectedCriticality);
    console.debug('Criticality filter with', selectedCriticality);      
  }
  console.debug(_matches)

  const categorySelectionHTML = generateCategorySelection(_matches)
  
  // Filter for Category
  if (selectedCategory !== "all") {
    console.debug('Category filter with', selectedCategory); 
    _matches = _matches.filter((m) => m.pattern.description == selectedCategory);    
  }
  console.debug(_matches)

  const ruleSelectionHTML = generateRuleSelection(_matches)
  // Filter for Rule
  if (selectedRule !== "all") {
    console.debug('Rule filter with', selectedRule); 
    _matches = _matches.filter((m) => m.pattern.pattern == selectedRule);    
  }
  // Filter for Excluded from FileView
  if (excludedPath.length > 0) {
    console.debug("Filter for Excluded from FileView")
    _matches = _matches.filter((m) => !excludedPath.includes(m.path));
  } else {
    console.debug("Not Filtering for Excluded from FileView (excludedPath <= 0)")
  }

  console.debug("Generationg HTML with matches")
  const totalMatches = _matches.length;
  const totalPages = Math.ceil(totalMatches / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  // Get only the matches for the current page
  const paginatedMatches = _matches.slice(startIndex, endIndex);
  console.debug(`Rendering page ${currentPage}/${totalPages} with ${ _matches.length} matches`);
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

    // construct HTML for single match
    matchesString += `
    <div id="${m.matchId}" class="match-container">
      <div>
        <b>Match found in file </b>
        <span class="file-highlight">${relativePath}</span>
        <b>, line ${m.lineNumber}:</b>
      </div>
        <div class="icon-bar">      
        <div class="jump-to-code-btn" data-match="${m.matchId}" title="Jump to code">&#8631;</div>
        <div class="finding-btn" data-match="${m.matchId}" title="Finding">&#8982;</div>
        <div class="falsePositive-btn" data-match="${m.matchId}" title="False Positive">&#10006;</div>
        <div class="saveForLater-btn" data-match="${m.matchId}" title="Save for later">&#128427;</div>
    </div>
    <p>
      <div class="code-line">${sanitizeContent(m.lineContent)
        .replace(highlightedCodeLine !== null ? highlightedCodeLine[0] : '', (str) => `<span class="match-highlight">${str}</span>`)}</div>
    </p>
    <table class="match-meta">
      <tr>
        <td>Type:</td>
        <td>${m.pattern.id}</td>
      </tr>      
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
          <input type="text" 
           class="comment-input" 
           data-match="${m.matchId}" 
           placeholder="No comment yet..." 
           title="${m.comment ? m.comment : 'No comment yet...'}"
           value="${m.comment ? m.comment : ''}" />
        </td>
      </tr>
    </table>    
    <br><br></div>`;
  });
  console.debug("Fininshed creating HTML with Matches")
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
  <select id="category-selection">
    ${categorySelectionHTML}
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
