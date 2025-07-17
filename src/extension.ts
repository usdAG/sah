/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import * as path from 'path';
import generateMatchesWebview, {
  excludedPath, setRule, setStatus
} from './matchesWebview';
import { setCriticality } from './matchesWebview';
import {
  addComment, allMatches, clearAllToggledMatches, deduplicateMatches,
  jumpToCode, setBatchAction, setStatusAs, toggledMatchIds, updateAllMatches,
  updateToggleState
} from './matches';
import {
  newProject, loadProject, saveProject, displayNoProjectWarning,
} from './projects';
import generateStartWebview from './startWebview';
import generateSemgrepWebview from './semgrepWebview';
import {
  isRelative,  handlePathSelection, handleOutputPathSelection,
  jsonData
} from './semgrep';
import { FileExplorerProvider, FileNode } from './fileView';
import { logger } from './logging';
import { startSemgrepScan } from './semgrepRunner';
import { finalImportSemgrepJson, startImportSemgrepJson } from './semgrepImporter';
import generateTestSectionWebview from './testSection';

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

  // fileExplorerProvider is defined in fileView.ts
  vscode.window.registerTreeDataProvider("fileExplorer", fileExplorerProvider);

  // push a lot of commands for the fileExplorer
  context.subscriptions.push(
    vscode.commands.registerCommand("fileExplorer.refresh", () => fileExplorerProvider.refresh()),
    vscode.commands.registerCommand("fileExplorer.excludeFile", (uri: vscode.Uri) =>
      fileExplorerProvider.excludeFile(uri.fsPath)
    ),
    vscode.commands.registerCommand("fileExplorer.excludeFolder", (uri: vscode.Uri) =>
      fileExplorerProvider.excludeFolder(uri.fsPath)
    ),
    vscode.commands.registerCommand("fileExplorer.unexcludeFile", (uri: vscode.Uri) =>
      fileExplorerProvider.unexcludeFile(uri.fsPath)
    ),
    vscode.commands.registerCommand("fileExplorer.unexcludeFolder", (uri: vscode.Uri) =>
      fileExplorerProvider.unexcludeFolder(uri.fsPath)
    ),
    vscode.commands.registerCommand("fileExplorer.showMatchesForFolder", (uri: vscode.Uri) => 
      fileExplorerProvider.showMatchesForFolder(uri.fsPath)
    ),
    vscode.commands.registerCommand("fileExplorer.showMatchesForFile", (uri: vscode.Uri) => {
      if (uri && uri.fsPath) {
          fileExplorerProvider.showMatchesForFile(uri.fsPath);   
      }
    }),
    // now the same but with nodes form the treeView
    vscode.commands.registerCommand("fileExplorer.excludeFileNode", (node: FileNode) =>
      fileExplorerProvider.excludeFile(node.filePath)
    ),
    vscode.commands.registerCommand("fileExplorer.excludeFolderNode", (node: FileNode) =>
      fileExplorerProvider.excludeFolder(node.filePath)
    ),
    vscode.commands.registerCommand("fileExplorer.unexcludeFileNode", (node: FileNode) =>
      fileExplorerProvider.unexcludeFile(node.filePath)
    ),
    vscode.commands.registerCommand("fileExplorer.unexcludeFolderNode", (node: FileNode) =>
      fileExplorerProvider.unexcludeFolder(node.filePath)
    ),    
    vscode.commands.registerCommand("fileExplorer.toggleHidden", () => 
      fileExplorerProvider.toggleExcluded()
    ),
    vscode.commands.registerCommand("fileExplorer.toggleVisible", () => 
      fileExplorerProvider.toggleExcluded()
    ),
    vscode.commands.registerCommand("fileExplorer.resetExclusion", () => 
      fileExplorerProvider.resetExclusion()
    ),
    vscode.commands.registerCommand("fileExplorer.resetExclusionShortText", () => 
      fileExplorerProvider.resetExclusion()
    ),
  );
  /* End Register Tree View */

  /* Commands for Logging*/
  context.subscriptions.push(
    vscode.commands.registerCommand('SAH.setLogLevelDebug', () => logger.setLogLevel('debug')),
    vscode.commands.registerCommand('SAH.setLogLevelInfo',  () => logger.setLogLevel('info')),
    vscode.commands.registerCommand('SAH.setLogLevelWarn',  () => logger.setLogLevel('warn')),
    vscode.commands.registerCommand('SAH.setLogLevelError', () => logger.setLogLevel('error')),
    vscode.commands.registerCommand('SAH.setLogLevelOff',   () => logger.setLogLevel('off'))
  );


  // Main commands for project (Exportet Commands in the Commands box --> Crtl + Shift + P)
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.importSemgrepScan", () => {
      displayNoProjectWarning();
      activePanel().webview.html = generateSemgrepWebview(activePanel().webview, localPath);
      //importSemgrepJson()
    }),
    vscode.commands.registerCommand("extension.newProject", () => {
      const callback = () => {
        // set HTML content
        activePanel().webview.html = generateStartWebview(activePanel().webview, localPath);
      };
      newProject(callback);
    }),
    vscode.commands.registerCommand("extension.loadProject", () => {
      // set HTML content
      const callback = () => {
        vscode.commands.executeCommand('extension.showMatchesList');
      };
      loadProject(callback);
    }),
    vscode.commands.registerCommand("extension.showMatchesList", () => {
      // set HTML content
      const htmlContent = generateMatchesWebview(allMatches, activePanel().webview, localPath);

      // Log the size of the HTML content
      logger.debug(`Generated HTML size: ${htmlContent.length} characters`);
      logger.debug(`Approximate memory usage: ${(Buffer.byteLength(htmlContent, 'utf8') / 1024 / 1024).toFixed(2)} MB`);
      saveProject()
      activePanel().webview.html = htmlContent;
    }),
    vscode.commands.registerCommand("extension.saveProject", () => saveProject()),
    vscode.commands.registerCommand("extension.deduplicateMatches", () => {
      const newMatches = deduplicateMatches(allMatches)
      updateAllMatches(newMatches)
      vscode.commands.executeCommand('extension.showMatchesList');
    }),
    // https://stackoverflow.com/questions/70074231/in-a-vs-code-extension-open-the-markdown-preview-of-the-readme-md-of-the-extens
    vscode.commands.registerCommand("extension.showHelp", () => {
      const readmePath = context.asAbsolutePath("README.md");
      vscode.commands.executeCommand("markdown.showPreview", vscode.Uri.file(readmePath));
    })
  )

  // Test Section
  vscode.commands.registerCommand("extension.openRuleTester", () => {
    activePanel().webview.html = generateTestSectionWebview(activePanel().webview, localPath);
  })

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

    /* 
    A handlers "list/dict" that maps the command from the frontend to the function 
    --> command "jmp" calls the hJump

    To add a new command create and add your command name here!  

    */
    const handlers: Record<string, (message: any) => any> = {
      jmp                        : hJump,
      setStatusAsFinding         : hSetStatusAs('finding'),
      setStatusAsFalsePositive   : hSetStatusAs('falsePositive'),
      setStatusAsSaveForLater    : hSetStatusAs('saveForLater'),
      setCriticality             : hSetCriticality,
      setStatus                  : hSetStatus,
      setRule                    : hSetRule,
      showMatches                : hShowMatches,
      showSemgrep                : hShowSemgrep,
      startSemgrepImport         : hStartSemgrepImport,
      validatePath               : hValidatePath,
      configPathBtn              : hConfigPathBtn,
      outputPathBtn              : hOutputPathBtn,
      startImportSemgrepBtn      : hStartImportSemgrepBtn,
      startSemgrepScan           : hStartSemgrepScan,
      importSemgrepScanResults   : hImportSemgrepScanResults,
      addComment                 : hAddComment,
      showMessage                : hShowMessage,
      openFileViewer             : hOpenFileViewer,
      changePage                 : hChangePage,
      isFileExclusionSet         : hIsFileExclusionSet,
      toggleMatch                : hToggleMatch,
      getToggledMatches          : hGetToggledMatches,
      batchAction                : hBatchAction,
      clearAllSelcted            : hClearAllSelected,
      createSplitView            : hCreateSplitView,
    };

    const post            = (msg: any) => panel.webview.postMessage(msg);
    const cmd             = (c: string) => vscode.commands.executeCommand(c);
    const log             = (...a: any[]) => logger.debug('[msg]', ...a);
    const showMatchesList = () => cmd('extension.showMatchesList');

    function hJump(message:any){ 
      jumpToCode(message.data);
    }
    function hSetStatusAs(type: 'finding' | 'falsePositive' | 'saveForLater') {
      return (message: any) => setStatusAs(message.data, type);
    }
    function hSetCriticality(message: any){
      setCriticality(message.criticality, panel);
      showMatchesList();
    }
    function hSetStatus(message: any){
      setStatus(message.status, panel);
      showMatchesList();
    }
    function hSetRule(message: any){
      setRule(message.rule, panel);
      showMatchesList();
    }
    function hShowMatches(){
      showMatchesList();
    }
    function hShowSemgrep(){
      cmd('extension.importSemgrepScan');
    }
    function hStartSemgrepImport(message: any){
      startImportSemgrepJson(panel, message.path);
    }
    function hValidatePath(message: any) {
      post({ command: 'validatePathResponse', isValid: isRelative(message.path) });
    }
    function hConfigPathBtn() {
      handlePathSelection(
        'configPathBtn',
        'dynamic',
        'Select config file/folder to use for the scan',
        panel
      );
    }
    function hOutputPathBtn(message: any){
      handleOutputPathSelection(message.config, panel);
    }
    function hStartImportSemgrepBtn() {
      handlePathSelection(
        'startImportSemgrepBtn',
        'file',
        'Select a JSON semgrep Scan',
        panel
      );
    }
    async function hStartSemgrepScan(message: any) {
      displayNoProjectWarning();
      try {
        await startSemgrepScan(message.config, message.output, message.include, message.exclude, panel, message.isTest);
        post({ command: 'scanComplete', matchesCount: jsonData.data.results.length });
      } catch (e: any) {
        post({ command: 'scanFailed', errorMessage: e?.message ?? 'Unknown error' });
      }
    }
    function hImportSemgrepScanResults(){
      displayNoProjectWarning();
      finalImportSemgrepJson();
    }
    async function hAddComment(message: any){
      await addComment(message.data, message.data_id);
    }
    function hShowMessage(message: any){
      vscode.window.showInformationMessage(message.message);
    }
    function hOpenFileViewer() {
      cmd('workbench.view.explorer');
      cmd('fileExplorer.focus');
    }
    function hChangePage(message: any){
      panel.webview.html = generateMatchesWebview(allMatches, panel.webview, localPath, message.page);
    }
    function hIsFileExclusionSet() {
      const value = excludedPath.length > 0    ;
      post({ command: 'isFileExclusionSetResponse', status: value });
    }

    function hToggleMatch(message: any){ 
      updateToggleState(Number(message.matchId), Boolean(message.checked));
    }
    function hGetToggledMatches(){
      const selected = Array.from(toggledMatchIds)      
      post({ command: 'getToggledMatchesResponse', selectedMatches: selected });
    }
    function hBatchAction(message: any){
      setBatchAction(message.action);
    }
    function hClearAllSelected(){
      clearAllToggledMatches();
    }
    async function hCreateSplitView(message: any){
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(message.filePath));
      await vscode.window.showTextDocument(document, {
        viewColumn : vscode.ViewColumn.One,   // always left-most column
        preview    : false                    // keep it open even after losing focus
      });

      /* 2. reveal (or move) the web-view to the right --------------------------- */
      //
      // When you pass `ViewColumn.Beside`, VS Code always shows the view in a column
      // next to the *currently active* editor.  Because we just focused the file
      // above, the active editor is in column 1 – so "beside" means column 2.
      //
      panel.reveal(vscode.ViewColumn.Beside);
    }

    // listen for messages from the webview
    // this now calles the function based on the command set in the handlers
    panel.webview.onDidReceiveMessage(
      async (message) => {
        log(message.command);
        const functionHandle = handlers[message.command];
        if (!functionHandle){
          logger.warn('Unknown command', message.command);
          return;
        }
        try {
          await functionHandle(message);
        }
        catch (e){ 
          logger.error('handler failed', e);
        }
      },
      undefined,
      context.subscriptions,
    );
    active = true;
    return panel;
  };
};

export const deactivate = () => { };


