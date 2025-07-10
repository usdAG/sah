/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import * as fs from 'fs';
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
    vscode.window.showInformationMessage("Project Saved")
  } else {
    vscode.window.showInformationMessage("No project state found! Create a project first!")
  }
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const newProject = (callback: Function) => {
  vscode.window.showSaveDialog({ saveLabel: 'Save', filters: { JSON: ['json'] } }).then((uri) => {
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
  vscode.window.showOpenDialog({ openLabel: 'Load', filters: { JSON: ['json'] } }).then((uri) => {
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
    vscode.window.showWarningMessage(warningMsg, 'OK');
  }
};
