import * as vscode from 'vscode';
import * as path from 'path';
import { Pattern } from './patterns';

export interface Match {
  pattern: Pattern;
  lineNumber: number;
  path: string;
  lineContent: string;
  matchId: number;
  detectionType: string;
  status: string; // default: unprocessed ; finding, falsePositive, saveForLater
  comment?: string;
}

export let allMatches: Array<Match> = [];

let matchIdCounter = 0;


// finds and returns match from allMatches where matchId === id
const findMatchById = (id: string) => {
  for (let i = 0; i < allMatches.length; i += 1) {
    if (allMatches[i].matchId.toString() === id) {
      return allMatches[i];
    }
  }
  return;
};


// move cursor to the line in the code where the entry point is located
export const jumpToCode = (matchId: string) => {
  const match = findMatchById(matchId);
  if (match !== undefined) {
    // better approach then prefixing file://
    // returns a vscode.Uri

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder is open.');
      return;
    }
    const document = path.join(workspaceFolder, match.path);
    vscode.workspace.openTextDocument(document).then((doc) => {
      // set focus back to source code file
      vscode.window.showTextDocument(doc, 1, false).then(() => {
        const parsedPattern = new RegExp(match.pattern.pattern);
        const execMatch = parsedPattern.exec(match.lineContent);
        const index = execMatch !== null ? execMatch.index : 0;
        const range = new vscode.Range(match.lineNumber - 1, index, match.lineNumber - 1, index);
        const editor = vscode.window.activeTextEditor;
        if (editor !== undefined) {
          editor.selection = new vscode.Selection(range.start, range.end);
          editor.revealRange(range);
        }
      });
    });
  }
};

export const setStatusAs = (matchId: string, status: string) => {
  const match = allMatches.find(m => m.matchId.toString() === matchId);
  if (match) {
    match.status = status;
  }
  vscode.commands.executeCommand('extension.showMatchesList');
};

export const resetMatchValues = () => {
  allMatches.splice(0);
  matchIdCounter = 0;
};


export const updateAllMatches = (allMatchesNew: Array<Match>) => {
  allMatches = allMatchesNew;
};

export const addSemgrepMatch = (startLine: number, proof: string, path: string, pattern: Pattern) => {
  console.debug("addSemgrepMatch")
  matchIdCounter += 1;
  const newMatch: Match = {
    pattern: pattern,
    path: path,
    lineNumber: startLine,
    lineContent: proof,
    matchId: matchIdCounter,
    status: "unprocessed",
    detectionType : "semgrep"
  };
  allMatches.push(newMatch);
};


export async function addComment(data: string,data_id: number){
  vscode.window.showInformationMessage(`${data} ${data_id}`)
  const matchIdx = allMatches.findIndex((m) => m.matchId == data_id);
  if (matchIdx !== -1) {
    allMatches[matchIdx].comment = data;
    updateAllMatches(allMatches);
  } else {
    vscode.window.showErrorMessage(`Match with ID ${data_id} not found.`);
  }
}

export function deduplicateMatches(matches: Array<Match>): Array<Match> {
  vscode.window.showInformationMessage(`Starting deduplication of ${matches.length} matches...`);

  // only filter file path, lineNumber and the lineContent() which is the
    // "Proof" or code snipped)
    // Improvements for more granular merging: Filter for Criticality,
    // number of overlapped matches usw.

    
  const seen = new Map();
  const filteredMatches = matches.filter((match) => {
    const key = `${match.path}:${match.lineNumber}:${match.lineContent}`;
    console.debug(`Processing: ${key} - ${match.detectionType}`);

    if (seen.has(key)) {
      seen.get(key).detectionType += `, ${match.detectionType}`;
      return false;
    }

    seen.set(key, match);
    return true;
  });

  vscode.window.showInformationMessage(
    `Deduplication completed: ${matches.length} → ${filteredMatches.length} unique matches.`
  );

  return filteredMatches;
}