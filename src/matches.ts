import * as vscode from 'vscode';
import * as path from 'path';
import { Pattern } from './patterns';
import { logger } from './logging';
import { fileExplorerProvider } from './extension';

export interface Match {
  pattern: Pattern;
  lineNumber: number;
  path: string;
  lineContent: string;
  matchId: number;
  detectionType: string;
  status: string; // default: unprocessed ; finding, falsePositive, saveForLater
  comment?: string;
  selected: boolean; // this is for the multiselect in the MatchesWebview
}

export const criticalityOptions = [
  { value: '0', label: 'All Criticalities', icon: '' },
  { value: '1', label: 'INFO', icon: '&#x1F535;' },
  { value: '2', label: 'LOW', icon: '&#x1F7E1;' },
  { value: '3', label: 'MEDIUM', icon: '&#x1F7E0;' },
  { value: '4', label: 'HIGH', icon: '&#x1F534;' },
  { value: '5', label: 'CRITICAL', icon: '&#x1F534;' },
];

export const statusOptions = [
  { value: 'all', label: 'All Matches' },
  { value: 'unprocessed', label: 'Unprocessed' },
  { value: 'finding', label: 'Findings' },
  { value: 'falsePositive', label: 'False Positive' },
  { value: 'saveForLater', label: 'Saved for later' }
];


export let allMatches: Array<Match> = [];
export const toggledMatchIds: Set<number> = new Set<number>();
let matchIdCounter = 0;


// finds and returns match from allMatches where matchId === id
const findMatchById = (id: string) => {
  return allMatches.find(match => match.matchId.toString() === id);
};


// move cursor to the line in the code where the entry point is located
export async function jumpToCode(matchId: string): Promise<void> {
  const match = findMatchById(matchId);
  // early return if there is no match found
  if (!match) { return; }

  // better approach then prefixing file://
  // returns a vscode.Uri

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder is open.');
    return;
  }

  const documentPath = path.join(workspaceFolder, match.path);
  // returns a promise that resolves to the document which is needed
  // for the showTextDocument 
  const document = await vscode.workspace.openTextDocument(documentPath);

  // set focus back to source code file
  // there is no real range for the editor --> use a zero space Range xD
  // Semgrep doesnt provide a range !?
  vscode.window.showTextDocument(document, 1, false).then(() => {
    // we need to get the full line of the code because semgrep
    // only returns the snippet --> lineContent is the snippet
    // --> get the index of the pattern in the "real" line and
    // set it as a vscode Range to mark as selected when jumping to the code
    
    const lineIdx = match.lineNumber - 1; // whyyyyyyyy xD
    const fullLineText = document.lineAt(lineIdx).text;
    logger.debug(fullLineText)
    let startCol = fullLineText.indexOf(match.lineContent);
    startCol = startCol >= 0 ? startCol : 0; // safeguard
    const matchLength = match.lineContent.length;

    const startPos = new vscode.Position(lineIdx, startCol);
    const endPos   = new vscode.Position(lineIdx, startCol + matchLength);

    const editor = vscode.window.activeTextEditor

    if (!editor){ return;}

    // set the selection to the "[startPos --> startPos + matchLength}""
    editor.selection = new vscode.Selection(startPos, endPos);
    editor.revealRange(new vscode.Range(startPos, endPos), 
                   vscode.TextEditorRevealType.InCenter);
  });
  
};

export const setStatusAs = (matchId: string, status: string) => {
  const match = allMatches.find(m => m.matchId.toString() === matchId);
  if (match) {
    match.status = status;
  }
  vscode.commands.executeCommand('extension.showMatchesList');
};

export function updateToggleState(matchId: number, checked: boolean) {
  if (checked) {
    addToggledMatch(matchId)
  } else {
    removeToggledMatch(matchId);
  }

  const match = allMatches.find(m => m.matchId === matchId);
  if (match) { match.selected = checked; }
  logger.debug("toggledMatchIds: ", [...toggledMatchIds])
}

export function addToggledMatch(matchId: number) {
  toggledMatchIds.add(matchId);
  const match = allMatches.find(m => m.matchId === matchId);
  if (match) match.selected = true;
}

export function removeToggledMatch(matchId: number) {
  toggledMatchIds.delete(matchId);
  const match = allMatches.find(m => m.matchId === matchId);
  if (match) match.selected = false;
}

export function clearAllToggledMatches() {
  toggledMatchIds.clear();
  allMatches.forEach(m => m.selected = false);
  vscode.commands.executeCommand('extension.showMatchesList');
}


export function setBatchAction(action: string) {
  allMatches.filter(m => m.selected).forEach(m => m.status = action) 
  clearAllToggledMatches()  
}


export const resetMatchValues = () => {
  allMatches.splice(0);
  matchIdCounter = 0;
};

export function buildFindingsMap(matches: Match[]): Map<string, number> {
  const findingsMap = new Map<string, number>();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";

  for (const match of matches) {
    const absolutePath = path.resolve(workspaceRoot, match.path);
    const count = findingsMap.get(absolutePath) ?? 0;
    findingsMap.set(absolutePath, count + 1);
  }

  return findingsMap;
}

export const updateAllMatches = (allMatchesNew: Array<Match>) => {
  allMatches = allMatchesNew;
  // Update the FileExplorer to show finding count
  fileExplorerProvider.findingsMap = buildFindingsMap(allMatches);
  fileExplorerProvider.refresh();
};

export const addSemgrepMatch = (startLine: number, proof: string, path: string, pattern: Pattern) => {
  logger.debug("addSemgrepMatch")
  matchIdCounter += 1;
  const newMatch: Match = {
    pattern: pattern,
    path: path,
    lineNumber: startLine,
    lineContent: proof,
    matchId: matchIdCounter,
    status: "unprocessed",
    detectionType : "semgrep",
    selected: false
  };
  allMatches.push(newMatch);
};


export async function addComment(comment: string, matchId: number){
  logger.debug("Adding Comment:", comment, matchId);
  const matchIdx = allMatches.findIndex((m) => m.matchId == matchId);
  if (matchIdx !== -1) {
    allMatches[matchIdx].comment = comment;
    updateAllMatches(allMatches);
  } else {
    vscode.window.showErrorMessage(`Match with ID ${matchId} not found.`);
  }
}

export function deduplicateMatches(matches: Array<Match>): Array<Match> {
  vscode.window.showInformationMessage(`Starting deduplication of ${matches.length} matches...`);

  // only filter file path, lineNumber and the lineContent (code snipped) which is the
  // Improvements for more granular merging: Filter for Criticality,
  // number of overlapped matches usw.
  // This filter only deduplicates the "exact" same Match (usefull if the scan
  // was run with the same rule)
    
  const seen = new Map();
  const filteredMatches: Match[] = [];

  // loop over all matches (O(n)) and create a key based
  // on path lineNUmber and lineContent
  // if there is a match --> merge them to one 
  for (const match of matches){
    // unpack match
    const { path, lineNumber, lineContent, detectionType } = match;
    const key = `${path}:${lineNumber}:${lineContent}`;
    logger.debug(`Processing: ${key} - ${detectionType}`);

    if (seen.has(key)) {
      // currently there is no use to this (anymore --> only semgrep is left)
      // --> maybe add user findings 
      // seen.get(key).detectionType += `, ${match.detectionType}`;
      continue;
    }
    seen.set(key, match);
    filteredMatches.push(match);
  }

  vscode.window.showInformationMessage(
    `Deduplication completed: ${matches.length} → ${filteredMatches.length} unique matches.`
  );

  return filteredMatches;
}