import * as vscode from 'vscode';
import * as path from 'path';
import generateMatchesWebview, { excludedPath, setRule, setStatus } from './matchesWebview';
import { setCriticality } from './matchesWebview';
import {
  addComment,
  allMatches, clearAllToggledMatches, deduplicateMatches,  jumpToCode, setBatchAction, setStatusAs, toggledMatchIds, updateAllMatches,
  updateToggleState
} from './matches';
import {
  newProject, loadProject, saveProject, displayNoProjectWarning,
} from './projects';
import generateStartWebview from './startWebview';
import generateSemgrepWebview from './semgrepWebview';
import { startImportSemgrepJson, isRelative, finalImportSemgrepJson, handlePathSelection, startSemgrepScan, goToMatches, handleOutputPathSelection} from './semgrep';
import { FileExplorerProvider } from './fileView';
import { logger } from './logging';

// Activate the extension.
export const activate = (context: vscode.ExtensionContext) => {
  const localPath = context.extensionPath;
  logger.info('SAH extension activated!');
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
    vscode.commands.registerCommand("fileExplorer.excludeFile", (uri: vscode.Uri) =>
      fileExplorerProvider.excludeFile(uri.fsPath)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.excludeFolder", (uri: vscode.Uri) =>
      fileExplorerProvider.excludeFolder(uri.fsPath)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.unexcludeFile", (uri: vscode.Uri) =>
      fileExplorerProvider.unexcludeFile(uri.fsPath)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.unexcludeFolder", (uri: vscode.Uri) =>
      fileExplorerProvider.unexcludeFolder(uri.fsPath)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.showMatchesForFolder",(uri: vscode.Uri) => 
      fileExplorerProvider.showMatchesForFolder(uri.fsPath)
    )
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.showMatchesForFile", (uri: vscode.Uri) => {
      if (uri && uri.fsPath) {
          //vscode.window.showInformationMessage(`Showing matches for: ${uri.fsPath}`);
          fileExplorerProvider.showMatchesForFile(uri.fsPath);   
      }
    })
  );
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
    vscode.commands.registerCommand('SAH.setLogLevelDebug',   () => logger.setLogLevel('debug')),
    vscode.commands.registerCommand('SAH.setLogLevelInfo',    () => logger.setLogLevel('info')),
    vscode.commands.registerCommand('SAH.setLogLevelWarn',    () => logger.setLogLevel('warn')),
    vscode.commands.registerCommand('SAH.setLogLevelError',   () => logger.setLogLevel('error')),
    vscode.commands.registerCommand('SAH.setLogLevelOff',     () => logger.setLogLevel('off'))
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
        logger.debug("[Message]", message.command)
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
          case 'setRule':
            setRule(message.rule,panel);
            vscode.commands.executeCommand('extension.showMatchesList');
            break;
          case 'showMatches':
            vscode.commands.executeCommand('extension.showMatchesList');
            break;
          case 'startSemgrepImport':
            logger.debug("startSemgrepImport called")
            startImportSemgrepJson(panel, message.path);
            break;
          case 'validatePath':{
            const isValid = isRelative(message.path);
            logger.debug(`validatePath called ${message.path} ${isValid}`)          
            panel.webview.postMessage({
                command: 'validatePathResponse',
                isValid: isValid
            });
            break;
          }        
          case 'configPathBtn':
            // todo migrate this to the same handler
            // as for outputPathBtn
            handlePathSelection(
              'configPathBtn',
              'dynamic',
              'Select config file/folder to use for the scan',
              panel
            );
            break;
        
          case 'outputPathBtn':
            handleOutputPathSelection(message.config, panel)            
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
            logger.debug(message)            
            try {
              await startSemgrepScan( config, output, include, exclude, panel);
              panel.webview.postMessage({
                  command: 'scanComplete',
              });
              
            } catch (error ) {
              logger.debug("extension error")
              // typescript types :D
              if (error instanceof Error) {     
                logger.debug("scanFailed sending")           
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
          case 'goToMatches':
            goToMatches();
            break;
          case 'addComment':
            await addComment(message.data, message.data_id)
            break
          case 'showMessage':
            logger.debug(message.message)
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
          case 'isFileExclusionSet': {     
            const value = excludedPath.length > 0      
            logger.debug("isFileExclusionSet", value)    
            panel.webview.postMessage({
              command: 'isFileExclusionSetResponse',              
              status: value         
            });
            break;
          }
          case 'toggleMatch': {
            const id = Number(message.matchId);
            const checked = Boolean(message.checked)
            logger.debug('toggleMatch',id,checked)
            updateToggleState(id, checked);
            break;
          }
          case 'getToggledMatches': {
            const selected = Array.from(toggledMatchIds)
            logger.debug("toogledMatchIds", selected)
            panel.webview.postMessage({
              command: 'getToggledMatchesResponse',              
              selectedMatches: selected
            });
            break;
          }
          case 'batchAction': {
            setBatchAction(message.action)
            break;
          }
          case 'clearAllSelcted':{
            clearAllToggledMatches()    
            break;        
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
    logger.info(`Generated HTML size: ${htmlContent.length} characters`);
    logger.info(`Approximate memory usage: ${(Buffer.byteLength(htmlContent, 'utf8') / 1024 / 1024).toFixed(2)} MB`);

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

  // https://stackoverflow.com/questions/70074231/in-a-vs-code-extension-open-the-markdown-preview-of-the-readme-md-of-the-extens
  const showHelp = vscode.commands.registerCommand("extension.showHelp", () => {
    const readmePath = context.asAbsolutePath("README.md");
    context.subscriptions.push(showHelp);
    vscode.commands.executeCommand("markdown.showPreview", vscode.Uri.file(readmePath));
  })
};

export const deactivate = () => { };


