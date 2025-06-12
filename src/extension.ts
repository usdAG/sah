import * as vscode from 'vscode';
import * as path from 'path';
import generateMatchesWebview, { setCategory, setRule, setStatus } from './matchesWebview';
import { setCriticality } from './matchesWebview';
import {
  addComment,
  allMatches, deduplicateMatches, jumpToCode, setStatusAs, updateAllMatches
} from './matches';
import {
  newProject, loadProject, saveProject, displayNoProjectWarning,
} from './projects';
import generateStartWebview from './startWebview';
import generateSemgrepWebview from './semgrepWebview';
import { startImportSemgrepJson, isRelative, finalImportSemgrepJson, handlePathSelection, startSemgrepScan,} from './semgrep';
import { FileExplorerProvider, FileNode } from './fileView';


// Activate the extension.
export const activate = (context: vscode.ExtensionContext) => {
  const localPath = context.extensionPath;

  let panel: vscode.WebviewPanel;
  let active = false;
  const fileExplorerProvider = new FileExplorerProvider(vscode.workspace.rootPath || "");
  
  /*
  Register a Tree View
  https://code.visualstudio.com/api/extension-guides/tree-view
  */

  /*
  Add Context Menu
  https://code.visualstudio.com/api/references/contribution-points#contributes.menus
  */

  vscode.window.registerTreeDataProvider("fileExplorer", fileExplorerProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.refresh", () => fileExplorerProvider.refresh())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.exclude", (node: FileNode) =>
      fileExplorerProvider.exclude(node.filePath)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.unexclude", (node: FileNode) =>
      fileExplorerProvider.unexclude(node.filePath)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.showMatchesIn",(node: FileNode) => 
      fileExplorerProvider.onlyShowMatchesIn(node.filePath)
    )
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.toggleHidden", () => {
      fileExplorerProvider.toggleExcluded();    
    })
  );

  // Add the same logic for toggleHidden
  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.toggleVisible", () => {
      fileExplorerProvider.toggleExcluded();
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.resetExclusion", () => {
      fileExplorerProvider.resetExclusion();
    }),
    vscode.commands.registerCommand("fileExplorer.resetExclusionShortText", () => {
      fileExplorerProvider.resetExclusion();
    }),
  ) 

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.showMatchesForFile", (uri: vscode.Uri) => {
      if (uri && uri.fsPath) {
          //vscode.window.showInformationMessage(`Showing matches for: ${uri.fsPath}`);
          fileExplorerProvider.showMatchesForFile(uri.fsPath);   
      }
    })
  );
  /* End Register Tree View */
  const activePanel = () => {
    if (active) {
      return panel;
    }

    // initialize webview panel
    panel = vscode.window.createWebviewPanel(
      'sah', // type of webview
      'SAH', // title of panel
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src', 'media'))],
      },
    );

    panel.onDidDispose(() => { active = false; });

    // listen for messages from the webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'jmp':
            jumpToCode(message.data);
            break;
          case 'setStatusAsFinding':
            setStatusAs(message.data,"finding")            
            break;
          case 'setStatusAsFalsePositive':
            setStatusAs(message.data,"falsePositive")
            break;
          case 'setStatusAsSaveForLater':
            setStatusAs(message.data,"saveForLater")
            break;
          case 'setCriticality':
            setCriticality(message.criticality,panel);
            vscode.commands.executeCommand('extension.showMatchesList');
            break;
          case 'setStatus':
            setStatus(message.status,panel);
            vscode.commands.executeCommand('extension.showMatchesList');
            break;
          case 'setCategory':
            setCategory(message.category,panel);
            vscode.commands.executeCommand('extension.showMatchesList');
            break;
          case 'setRule':
            setRule(message.rule,panel);
            vscode.commands.executeCommand('extension.showMatchesList');
            break;
          case 'showMatches':
            vscode.commands.executeCommand('extension.showMatchesList');
            break;
          case 'startSemgrepImport':
            console.debug("startSemgrepImport called")
            startImportSemgrepJson(panel, message.path);
            break;
          case 'validatePath':{
            const isValid = isRelative(message.path);
            console.debug(`validatePath called ${message.path} ${isValid}`)          
            panel.webview.postMessage({
                command: 'validatePathResponse',
                isValid: isValid
            });
            break;
          }        
          case 'configPathBtn':
            handlePathSelection(
              'configPathBtn',
              'file',
              'Select config file to use for the scan',
              panel
            );
            break;
        
          case 'outputPathBtn':
            handlePathSelection(
              'outputPathBtn',
              'folder',
              'Select a folder for the output destination',
              panel
            );
            break; 
          
          case 'startImportSemgrepBtn':
            handlePathSelection(
              'startImportSemgrepBtn',
              'file',
              'Select a JSON semgrep Scan',
              panel
            )
            break;
          case 'startSemgrepScan':{           
            const exclude: string = message.exclude
            const include: string  = message.include 
            const output: string  = message.output
            const config: string  = message.config
            displayNoProjectWarning();
            console.debug(message)            
            try {
              await startSemgrepScan( config, output, include, exclude, panel);
              panel.webview.postMessage({
                  command: 'scanComplete',
              });
              
            } catch (error ) {
              console.debug("extension error")
              // typescript types :D
              if (error instanceof Error) {     
                console.debug("scanFailed sending")           
                panel.webview.postMessage({
                    command: 'scanFailed',
                    errorMessage: error.message,
                });
              } else {
                // Fallback if the type is not an Error 
                panel.webview.postMessage({
                    command: 'scanFailed',
                    errorMessage: 'An unknown error occurred',
                });
              }
            }            
            break 
          }
          case 'importSemgrepScanResults':
            displayNoProjectWarning();
            finalImportSemgrepJson()
            break;  

          case 'addComment':
            await addComment(message.data, message.data_id)
            break
          case 'showMessage':
            vscode.window.showInformationMessage(message.message);
            break
          
          case 'openFileViewer':
            // show File Viewer
            vscode.commands.executeCommand('workbench.view.explorer');
            vscode.commands.executeCommand('fileExplorer.focus');
            break
            
          case 'changePage':{
            const newPage = message.page;
            panel.webview.html = generateMatchesWebview(allMatches, panel.webview, localPath, newPage);
            break
          }
          default:
            break;
        }
      },
      undefined,
      context.subscriptions,
    );
    active = true;
    return panel;
  };


  const importSemgrep = vscode.commands.registerCommand('extension.importSemgrepScan', async () => {
    displayNoProjectWarning();
    activePanel().webview.html = generateSemgrepWebview(activePanel().webview, localPath);
    //importSemgrepJson()
    context.subscriptions.push(importSemgrep);
  });


  const newProjectRegister = vscode.commands.registerCommand('extension.newProject', () => {
    const callback = () => {
      // set HTML content
      activePanel().webview.html = generateStartWebview(activePanel().webview, localPath);
    };
    newProject(callback);
    context.subscriptions.push(newProjectRegister);
  });

  const loadProjectRegister = vscode.commands.registerCommand('extension.loadProject', () => {
    // set HTML content
    const callback = () => {
      vscode.commands.executeCommand('extension.showMatchesList');
    };
    loadProject(callback);
    context.subscriptions.push(loadProjectRegister);
  });

  const showMatchesList = vscode.commands.registerCommand('extension.showMatchesList', () => {
    // set HTML content
    const htmlContent = generateMatchesWebview(allMatches, activePanel().webview, localPath);

    // Log the size of the HTML content
    console.log(`Generated HTML size: ${htmlContent.length} characters`);
    console.log(`Approximate memory usage: ${(Buffer.byteLength(htmlContent, 'utf8') / 1024 / 1024).toFixed(2)} MB`);

    activePanel().webview.html = htmlContent;

    context.subscriptions.push(showMatchesList);
  });

  const saveProjectcommand = vscode.commands.registerCommand('extension.saveProject', () =>{
    saveProject()
    context.subscriptions.push(saveProjectcommand);
  });

  const deduplicateMatchesCommand = vscode.commands.registerCommand('extension.deduplicateMatches', () => {
    const newMatches = deduplicateMatches(allMatches)
    updateAllMatches(newMatches)
    context.subscriptions.push(deduplicateMatchesCommand)
    vscode.commands.executeCommand('extension.showMatchesList');
  })
};

export const deactivate = () => { };


