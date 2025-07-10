/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as path from 'path';
import { logger } from './logging';
import { generateSemgrepOutputFilename } from './semgrepBuilder';

// hack to set the value of an exportable?!
export const jsonData = {
  data: undefined as any
};
export let absolute_path: string;

export function isRelative(inputPath: string): boolean{
  // this function validates that the input path from the semgrep import is relative!
  // this is necessary because the save also needs the relative paths to be compatable between users
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder is open.');
          return false
        }
        const absolutePath = path.join(workspaceFolder, inputPath);  
    if (!fs.existsSync(absolutePath)) {
      return false;
    }
    return true;
  } catch (error) {
    logger.error("While validatining whether or not the path is relative an error accured ", error)
    // If any error occurs return false
    return false;
  }
}


export async function handleOutputPathSelection(config: string, panel: vscode.WebviewPanel) {
  // returns a postMessage to the webView with the updated OutputPath 
  let isFolder = false;
  let selectedPath = "";

  const choice = await vscode.window.showQuickPick(['File', 'Folder'], {
      placeHolder: 'Select target type: File or Folder',
    });

    if (!choice) {
      vscode.window.showWarningMessage('No option selected.');
      return;
    }

    isFolder = choice === 'Folder';    
  
  if (isFolder){
    
    const options: vscode.OpenDialogOptions = {      
      canSelectFolders: true,
      openLabel: "Select a folder to save the Semgrep output"
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (!fileUri) {
      vscode.window.showWarningMessage("No folder or file was selected.");
      return;
    }
    try {
      const stat = await vscode.workspace.fs.stat(fileUri[0]);

      if (stat.type === vscode.FileType.Directory) {
        selectedPath = generateSemgrepOutputFilename(config,fileUri[0].fsPath)
        
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Error checking selected path: ${err}`);
      return;
    }

  } else {
    const options: vscode.SaveDialogOptions = {
      filters: { 'JSON Files': ['json'], 'All Files': ['*'] },
      saveLabel: "Select file for Semgrep output"
    };

  const fileUri = await vscode.window.showSaveDialog(options);

    if (!fileUri) {
      vscode.window.showWarningMessage("No file was selected.");
      return;
    }

    selectedPath = fileUri.fsPath;
    logger.debug("SelectedPath:", selectedPath)

  }  
   // Post the selected path to the webview
   logger.debug("SelectedPath updated:",selectedPath)
  panel.webview.postMessage({
      command: "outputPathBtnResponse",
      path: selectedPath,
    });
}

export async function handlePathSelection(
  command: string,
  type: string,
  label: string,  
  panel: vscode.WebviewPanel
) {
  let isFolder = false;

  // If type is dynamic as for file or folder
  if (type === 'dynamic') {
    const choice = await vscode.window.showQuickPick(['File', 'Folder'], {
      placeHolder: 'Select target type: File or Folder',
    });

    if (!choice) {
      vscode.window.showWarningMessage('No option selected.');
      return;
    }

    isFolder = choice === 'Folder';    
  }

  const options = {
    canSelectFiles: type === 'file' || !isFolder,
    canSelectFolders: type === 'folder' || isFolder,
    openLabel: label
  };

  const fileUri = await vscode.window.showOpenDialog(options);

  if (!fileUri || fileUri.length === 0) {
    vscode.window.showWarningMessage(`No ${isFolder ? 'folder' : 'file'} selected.`);
    return;
  }

  // Post the selected path to the webview with 'Response' sufix
  panel.webview.postMessage({
    command: `${command}Response`,
    path: fileUri[0].fsPath,
  });
}



// Check if semgrep is accessable in the PATH
export async function checkSemgrepPath(): Promise<string | undefined> {
  return new Promise((resolve) => {
    // windows - 'cmd.exe /c where semgrep' - unix 'which semgrep'
    // Powershell doesnt return the output of where?!  
    let child;
    if (process.platform === 'win32') {
      child = spawn('cmd.exe', ['/c', 'where', 'semgrep'],{shell:true});
    } else {
      child = spawn('which', ['semgrep']);
    }

    let output = '';  
    const env = {...process.env};
    logger.debug("Env for semgrep childprocess:",env)
    child.stdout.on('data', (data) => {
      output += data.toString();
      logger.debug("Accumulted output data from semgrep childprocess", output)
    });

    child.stderr.on('data', (err) => {
      // if we get data from stderr its properly not found 
      logger.debug("Error while getting semgrep:",err)
      resolve(undefined)
    });
    child.on('error', (err) => { logger.error('Semgrep childprocess spawn error(?!)', err); });
    child.on('exit', (code) => {
      if (code === 0 && output.trim().length > 0) {
        resolve(output.trim());
      } else {
        resolve(undefined);
      }
    });
  });
}

  