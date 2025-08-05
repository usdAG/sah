/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { allMatches, Match, updateAllMatches } from './matches';
import { logger } from './logging';

let currentProject: string;

export const saveProject = () => {
  if (currentProject) {
    const allMatchesParsed: Array<Match> = [];
    allMatches.forEach((m) => {
      const matchParsed = m;
      matchParsed.pattern.pattern = m.pattern.pattern;
      allMatchesParsed.push(matchParsed);
    });
    const finalJSON = {
      matches: allMatchesParsed
    };
    fs.writeFileSync(currentProject, JSON.stringify(finalJSON, null, 2));
    logger.debug("Project saved to disk");
    // vscode.window.showInformationMessage("Project Saved")
  } else {
    displayNoProjectWarning()
  }
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const newProject = (callback: Function) => {
  const homedir = vscode.Uri.file(os.homedir());

  vscode.window.showSaveDialog({ saveLabel: 'Save', defaultUri: homedir, filters: { JSON: ['json'] } }).then((uri) => {
    if (!uri) {
      vscode.window.showErrorMessage('Please select a file location to save the project');
      return;
    }
    let file = uri.fsPath;
    if (!file.endsWith(".json")) {
      file += ".json";
    }

    fs.promises.writeFile(file, '{}')
      .then(() => {
        currentProject = file;
        vscode.window.showInformationMessage('New Project has been created!');
        callback();
      })
      .catch((error: any) => {
        vscode.window.showErrorMessage('Project could not be created!');
        logger.error("While saving an error accured", error);
      });
  });
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const loadProject = (callback: Function) => {
  logger.debug("loadProject")
  const homedir = vscode.Uri.file(os.homedir());
  vscode.window.showOpenDialog({ openLabel: 'Load', defaultUri: homedir, filters: { JSON: ['json'] } }).then((uri) => {
    if (uri !== undefined && uri.length === 1) {
      fs.readFile(uri[0].fsPath, (err, data) => {
        if (err) { throw err; }
        currentProject = uri[0].fsPath;
        const result = (JSON.parse(data.toString()));
        updateAllMatches(result.matches ? result.matches : []);
        callback();
      });
    }
  });
};

export const displayNoProjectWarning = () => {
  if (!currentProject) {
    const warningMsg = 'No project selected! Your changes will not be saved. Please create a new project or load an existing one in order to save your changes.';
    vscode.window.showWarningMessage(
      warningMsg,
      'Create Project',
      'Load Project'
    ).then(selection => {
      if (selection === 'Create Project') {
        // set a callback
        newProject(() => {});
      } else if (selection === "Load Project") {
        loadProject(() => {
          vscode.commands.executeCommand('extension.showMatchesList');
        });
      }
    });
  }
};

export function getDefaultPath(): vscode.Uri {
  // Return folder in which currentProject config is stored, if set
  const defaultFolder = path.dirname(currentProject) || os.homedir();
  return vscode.Uri.file(defaultFolder);
}

export function getCurrentProject(): string {
  return currentProject ?? "";
}