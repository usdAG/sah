/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logging';
import { addSemgrepMatch, updateAllMatches, allMatches } from './matches';
import { Pattern } from './patterns';
import { saveProject } from './projects';
import { jsonData } from './semgrep';
import { addSemgrepMatchTestSection } from './testSectionMatchesWebview';
export let importedMatches : number = 0;  


// loads the JSON file and sends the path of the first scanned file of the scan
export async function startImportSemgrepJson(panel: vscode.WebviewPanel, file_path: string){
  logger.debug(file_path)
  try {
    try {
      // Datei einlesen
      const fileContent = fs.readFileSync(file_path, 'utf-8');

      // JSON parsen
      jsonData.data = JSON.parse(fileContent);
    } catch (error) {
        logger.error("Unable to parse SemgrepContnent: ", error)
        vscode.window.showErrorMessage(`Invalid JSON file at : ${path}`);
        return;
    }
    logger.debug(`Importing: ${jsonData.data.results.length} Matches` )
    if (jsonData.data.results && Array.isArray(jsonData.data.results)) {
      for (const result of jsonData.data.results) {
        logger.debug(`Relative path ${result.path}`)         
        panel.webview.postMessage({
            command: 'relativePath',
            path: result.path
        });
        // early exit if path is not validated 
        if (path.isAbsolute(result.path)) {
          vscode.window.showErrorMessage(`Path is absolute: ${result.path}`);
          return;
        }
        break
      }
    finalImportSemgrepJson(false)
    }
  } catch (error) {
      vscode.window.showErrorMessage(`An error occurred loading the scan (StartImportSemgrep): ${error}`);
  }
}

// function to import the Semgrep after the Path has been validated
export async function finalImportSemgrepJson(isTest: boolean){
  logger.debug("Starting to import semgrepJson")
  try{
    if (jsonData.data.results && Array.isArray(jsonData.data.results)) {
      for (const result of jsonData.data.results) {

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder is open.');
          return;
        }

        const absolutePath = path.join(workspaceFolder, result.path);                
        logger.debug(`Resolved path: ${absolutePath}`);
        const startLine = result.start.line;
        const startCol = result.start.col;
        const endLine = result.end.line;
        const endCol = result.end.col;
        let proof = ""
        await vscode.workspace.openTextDocument(absolutePath).then((file)=>{
          proof = file.getText(new vscode.Range(startLine-1, startCol-1, endLine-1, endCol-1));              
        });
        let criticality : string = ""
        switch(result.extra.severity){
          case "INFO":
              criticality = "INFO"
              break
          case "INFORMATIONAL":
              criticality = "INFO";
              break;
          case "LOW":
              criticality = "LOW";
              break;
          case "WARNING":
          case "MEDIUM":
              criticality = "MEDIUM";
              break;
          case "ERROR":
          case "HIGH":
              criticality = "HIGH";
              break;
          case "CRITICAL":
              criticality = "CRITICAL";
              break;
          default:
              criticality = "DID NOT MATCH - INFO LOW MEDIUM HIGH CRITICAL";
              break;
        }

        const ruleSplinters = result.check_id.toString().split(".");
        const ruleName = ruleSplinters.at(ruleSplinters.length-1);
        const pattern : Pattern = {
            id: ruleName,
            description: result.extra.message,
            criticality: criticality,
            pattern: ruleName,
            lang: "semgrep"
        };

        if(isTest){
          addSemgrepMatchTestSection(startLine, proof, result.path, pattern);
        }else {
          addSemgrepMatch(startLine, proof, result.path, pattern);
          importedMatches += 1;
        }
      };
    } else {
      vscode.window.showInformationMessage("The scan seems to be empty, no matches imported");
    }
    if(!isTest) {
      saveProject();
      updateAllMatches(allMatches); // required to update file explorer
      vscode.window.showInformationMessage(`Imported ${importedMatches} semgrep matches.`);
      vscode.commands.executeCommand('extension.showMatchesList');
    } else {
      vscode.commands.executeCommand('extension.showMatchesTestSection');
    }

  } catch (error) {
      vscode.window.showErrorMessage(`An error occurred loading the scan (finalImportSemgrep): ${error} `);
  }
}
