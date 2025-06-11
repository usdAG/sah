import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { setExcludedPath } from "./matchesWebview";

/*
https://code.visualstudio.com/api/extension-guides/tree-view
*/

export class FileExplorerProvider implements vscode.TreeDataProvider<FileNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<FileNode | undefined | void> =
    new vscode.EventEmitter<FileNode | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<FileNode | undefined | void> =
    this._onDidChangeTreeData.event;

  // A set of file/folder paths that have been explicitly excluded.
  private excludedPaths: Set<string> = new Set();
  // Toggles: when true - show all nodes (marking the excluded ones visually)
  // when false, hide excluded nodes
  private showExcluded: boolean = false;

  constructor(private workspaceRoot: string) {}

  public getExcludedPaths(): Set<string> {
    return this.excludedPaths;
  }
  
  refresh(): void {
    this._onDidChangeTreeData.fire();    
  }

  /*
  https://stackoverflow.com/questions/65905635/how-to-add-toggle-menu-to-view-title-with-vscode-extension
  This is a workaround to change the "title" of a button by creating two buttons and only showing
  one based on a boolean value :D
  */
  toggleExcluded(): void {
    this.showExcluded = !this.showExcluded;
    vscode.commands.executeCommand('setContext', 'fileExplorer:showExcluded', this.showExcluded);
    this.refresh();
  }

  getTreeItem(element: FileNode): vscode.TreeItem {
    if (this.excludedPaths.has(element.filePath)) {
      element.description = " (excluded)";
      element.contextValue = "excluded";
    } else {
      element.description = "";
      element.contextValue = element.collapsibleState === vscode.TreeItemCollapsibleState.None
        ? "file"
        : "folder";
    }
    return element;
  }

  // overwrite the getChildren implementation to hide files and folders
  getChildren(element?: FileNode): Thenable<FileNode[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage("No workspace found");
      return Promise.resolve([]);
    }

    // Determine the directory to list: either the workspace root or the parent node's filePath
    const dirPath = element ? element.filePath : this.workspaceRoot;
    // If this folder is excluded and not showing excluded nodes --> don't list children
    if (element && this.excludedPaths.has(element.filePath) && !this.showExcluded) {
      return Promise.resolve([]);
    }
    return Promise.resolve(this.readDirectory(dirPath));
  }

  // Read the directory and return an array of FileNodes
  private readDirectory(dirPath: string): FileNode[] {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath);
    const nodes = entries.map(entry => {
      const fullPath = path.join(dirPath, entry);
      const isDirectory = fs.statSync(fullPath).isDirectory();
      const isExcluded = this.excludedPaths.has(fullPath);
      return new FileNode(
        entry,
        fullPath,
        isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        isExcluded
      );
    });

    // If toggle is off - filter out nodes that are excluded
    if (!this.showExcluded) {
      return nodes.filter(node => !node.isExcluded);
    }
    return nodes;
  }

  // Helper to update the view and call showMatchesList (the Webview)
  private updateView(): void {
    this.refresh();
    setExcludedPath(Array.from(this.excludedPaths));
    vscode.commands.executeCommand('extension.showMatchesList');
  }

  // Mark a file/folder as excluded - if its a folder --> recursively exclude all its children
  exclude(filePath: string) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      const allPaths = this.getAllNodes(filePath);
      allPaths.forEach(p => this.excludedPaths.add(p));
    } else {
      this.excludedPaths.add(filePath);
    }
    this.updateView();
  }


  // Shows only matches in a defined subtree. Excludes all other paths.
  onlyShowMatchesIn(filePath: string){
    const allNodes = this.getAllNodes(this.workspaceRoot);
    const subTree = new Set(this.getAllNodes(filePath));
    this.excludedPaths = new Set(allNodes.filter(node => !subTree.has(node)));
    this.updateView();
  }

  // Remove a file/folder from the exclusion - if its a folder --> recursively unexclude all its children
  unexclude(filePath: string) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      const allPaths = this.getAllNodes(filePath);
      allPaths.forEach(p => this.excludedPaths.delete(p));
    } else {
      this.excludedPaths.delete(filePath);
    }
    this.updateView();
  }
  
  // Restrict the view to only show the chain (folders) that lead to the target file
  // Get chain of paths from the workspace root to the target file
  // Exclude all nodes that are not in the chain
  // Done :D
  showMatchesForFile(filePath: string) {
    vscode.window.showInformationMessage(`Processing matches for: ${filePath}`);
    const allNodes = this.getAllNodes(this.workspaceRoot);    
    const chainPaths = this.getChainPaths(filePath);    
    this.excludedPaths = new Set(allNodes.filter(node => !chainPaths.has(node)));
    this.updateView();
  }

  // Recursively get all file and folder paths from the given directory
  // Call reddirSync with withFileTypes to get an array
  // Append to nodes if its a directory call function recursive
  // --> return nodes
  private getAllNodes(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) return [];
    let nodes: string[] = [dirPath];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      nodes.push(fullPath);
      if (entry.isDirectory()) {
        nodes = nodes.concat(this.getAllNodes(fullPath));
      }
    }
    return nodes;
  }

  // Build a set of paths representing the chain from the workspace root to the target
  // strip the dirname for the resolved path --> do this until you are the root
  // --> return chain
  private getChainPaths(target: string): Set<string> {
    const chain = new Set<string>();
    let current = path.resolve(target);
    const root = path.resolve(this.workspaceRoot);
    while (true) {
      chain.add(current);
      if (current === root) break;
      const parent = path.dirname(current);
      if (parent === current) break; // safeguard against infinite loop.
      current = parent;
    }
    return chain;
  }

  resetExclusion(): void {
    this.unexclude(this.workspaceRoot)
    this.updateView()
  }
}

export class FileNode extends vscode.TreeItem {
  public isExcluded: boolean = false;

  constructor(
    public readonly label: string,
    public readonly filePath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    isExcluded: boolean = false
  ) {
    super(label, collapsibleState);
    this.tooltip = filePath;
    this.isExcluded = isExcluded;
    // Initially set contextValue based on whether the node is a file or folder.
    this.contextValue = collapsibleState === vscode.TreeItemCollapsibleState.None ? "file" : "folder";
  }
}
