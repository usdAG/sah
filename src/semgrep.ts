import * as vscode from 'vscode';
import * as fs from 'fs';
import { addSemgrepMatch } from './matches';
import { Pattern } from './patterns';
import { saveProject } from './projects';
import { spawn } from 'child_process';
import * as path from 'path';
export let importedMatches : number = 0;  
export let jsonData : any;
export let absolute_path: string;

interface SemgrepError {
  code: number;
  level: string;
  type: string;
  message: string;
}

// loads the JSON file and sends the path of the first scanned file of the scan
export async function startImportSemgrepJson(panel: vscode.WebviewPanel, file_path: string){
  console.debug(file_path)
  try {
    try {
      // Datei einlesen
      const fileContent = fs.readFileSync(file_path, 'utf-8');

      // JSON parsen
      jsonData = JSON.parse(fileContent);
    } catch (error) {
        vscode.window.showErrorMessage(`Invalid JSON file at : ${path}`);
        return;
    }   
    console.debug(`Importing: ${jsonData.results.length} Matches` )
    if (jsonData.results && Array.isArray(jsonData.results)) {
      for (const result of jsonData.results) {
        console.debug(`Relative path ${result.path}`)         
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
    finalImportSemgrepJson()
    }
  } catch (error) {
      vscode.window.showErrorMessage(`An error occurred loading the scan: ${error}`);
  }
}

// function to import the Semgrep after the Path has been validated
export async function finalImportSemgrepJson(){
  try{
    if (jsonData.results && Array.isArray(jsonData.results)) {
      for (const result of jsonData.results) {

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder is open.');
          return;
        }

        const absolutePath = path.join(workspaceFolder, result.path);                
        console.debug(`Resolved path: ${absolutePath}`);
        const startLine = result.start.line;
        const startCol = result.start.col;
        const endLine = result.end.line;
        const endCol = result.end.col;
        let proof = ""
        await vscode.workspace.openTextDocument(absolutePath).then((file)=>{
          proof = file.getText(new vscode.Range(startLine-1, startCol-1, endLine-1, endCol-1));              
        });
        let criticality : number = 0
        switch(result.extra.severity){
        case "INFO":
        case "INFORMATIONAL":
            criticality = 1;
            break;
        case "LOW":
            criticality = 2;
        case "WARNING":
        case "MEDIUM":
            criticality = 3;
            break;
        case "ERROR":
        case "HIGH":
            criticality = 4;
            break;
        case "CRITICAL":
            criticality = 5;
            break;
        default:
            criticality = 0;
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

        addSemgrepMatch(startLine, proof, result.path, pattern);
        importedMatches += 1;
      };
    } else{
      vscode.window.showInformationMessage("The scan seems to be empty, no matches imported");
    }
    saveProject();
    vscode.window.showInformationMessage(`Imported ${importedMatches} semgrep matches.`)
    vscode.commands.executeCommand('extension.showMatchesList');
  } catch (error) {
      vscode.window.showErrorMessage(`An error occurred loading the scan: ${error} `);
  }
}


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
    // If any error occurs return false
    return false;
  }
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

export async function startSemgrepScan(
  config: string,
  outputFile: string,
  include: string,
  exclude: string,
  panel: vscode.WebviewPanel
): Promise<void> {
  if (config === "") config = "auto";
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  console.debug("workspaceFolder",workspaceFolder)
  let semgrepPath = await checkSemgrepPath();
  console.log("semgrepPath",semgrepPath)
  if (!semgrepPath) {
    let placeholder;
    if (process.platform === 'win32') {      
      placeholder = `C:\\Users\\username}\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\semgrep.exe`;      
    } else {
      placeholder = '/usr/local/bin/semgrep';
    }
    // Ask the user to provide the path to the Semgrep binary
    semgrepPath = await vscode.window.showInputBox({
      prompt: 'Semgrep is not accessible in the system PATH. Please provide the path to the Semgrep binary:',
      placeHolder: placeholder
    });
  } else {
    semgrepPath = "semgrep"
  }

  if (!semgrepPath) {
    vscode.window.showErrorMessage("The Semgrep path is required!");
    return;
  }
  
  let semgrepCommand = buildSemgrepCommand(semgrepPath, config)


  
  function generateSemgrepOutputFilename(config: string, output?: string): string {
    /*
    Generate a Semgrep output filename based on config and output hint.
    If output is a folder, generate filename in that folder.
    */
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().split('T')[0].replace(/-/g, '');

    function defaultNameFragment(config: string): string {
      return config
        .split(',')
        .map(c => c.trim())
        .filter(Boolean)
        .map(c => {
          if (c === "auto") return "auto";
          if (c.startsWith("http://") || c.startsWith("https://")) {
            const segment = c.split('//').pop();
            if (!segment) {
              vscode.window.showWarningMessage(`Invalid config URL: "${c}" - no rule or filename found after the last slash.`);
              return c.replace(/\W+/g, "_");
            }
            return segment.replace(/\W+/g, "_");
          }
          return c.replace(/^.*[\\/]/, '').replace(/\W+/g, "_");
        })
        .slice(0, 3)
        .join("__");
    }

    const defaultFilename = `${formattedDate}_semgrep_${defaultNameFragment(config)}.json`;

    if (!output || output.trim() === "") {
      return defaultFilename;
    }

    try {
      // If path exists and is a directory (synchronously, safe for UI):
      if (fs.existsSync(output) && fs.statSync(output).isDirectory()) {
        // Place generated file in the given directory
        return path.join(output, defaultFilename);
      }
    } catch (e) {
      vscode.window.showErrorMessage(`Error while trying to join your folder with the defaultFilename: "${e}"`);
    }

    // If output has no ".json", append .json
    if (!output.endsWith('.json')) {
      return `${output}.json`;
    } else {
      return output;
    }
  }

  outputFile = generateSemgrepOutputFilename(config, outputFile);
  console.log(outputFile);
  semgrepCommand += ` --json-output '${outputFile}'`; // Dont use " here :P

  // we need multiple --include/--exclude
  // see https://semgrep.dev/docs/cli-reference
  if (include !== "") {
    include
      .split(',')
      .map(s => s.trim())      
      .forEach(pattern => {
        semgrepCommand += ` --include ${pattern}`;
      });
  }

  if (exclude !== "") {
    exclude
      .split(',')
      .map(s => s.trim())      
      .forEach(pattern => {
        semgrepCommand += ` --exclude ${pattern}`;
      });
  }


  console.debug("Executing Semgrep command:", semgrepCommand);

  vscode.window.showInformationMessage('Starting Semgrep Scan!');


  // Try to read the $SHELL variable --> fallback is manual input form the user
  let shell = process.env.SHELL;
  if (process.platform === 'win32') {
    shell = "cmd.exe"
  }

  if (!shell) {
    vscode.window.showErrorMessage("Could not detect default shell!");
    shell = await vscode.window.showInputBox({
      prompt: "Could not detect default shell - Enter your shell path (/bin/bash, /bin/zsh)",
      placeHolder: "/bin/bash"
    });
  } 

  // Check if the user canceled the input
  if (!shell) {
    vscode.window.showErrorMessage("Shell path is required!");
    return;
  }

  return new Promise<void>((resolve, reject) => {
    let child;
    let stdoutData = "";
    let hasFailed = false;
    let isFinished = false
    if (process.platform === 'win32') {      
      // we don't have the pty for windows :|      
      // after hours trying to get the node-pty-win working i think this is the best way
      // just redirect stderr to stdout 
      // downside --> no live counter /time remaining
      // cmd >>>>> powershell
      child = spawn(shell,['/c',`${semgrepCommand} 2>&1`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: workspaceFolder // use the workspaceFolder Path as cwd to always get the correct relative file structure
      })

    } else {
      // Use script to capture live output with a pseudo-TTY (PTY)
      child = spawn('script', ['-q', '/dev/null', '-c', `${shell} -c "` + semgrepCommand + '"'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: workspaceFolder// use the workspaceFolder Path as cwd to always get the correct relative file structure
      });      
    }
    // Display stdout (progress bar + results) which includes PTY
    child.stdout.on('data', async (data) => {
      if (isFinished){return}
      // remove all Ansi chars
      // https://stackoverflow.com/questions/25245716/remove-all-ansi-colors-styles-from-strings

      
      // eslint-disable-next-line no-control-regex
      const SemgrepOutput = data.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      
      //console.debug(SemgrepOutput)
      // Regular expression ("0% -:--:--" and "0% 0:00:00")
      const regex = /(\d+%\s*).*?([-\d]{1,2}:[-\d]{2}:[-\d]{2})/;
      const match = SemgrepOutput.match(regex);
      
      // Regular expression for the output
      const regex_output = /{"version":".+?"/;
      const match_output = SemgrepOutput.match(regex_output)

      // check for the 'Scan Summary' to determin if the Scan is finished --> read from output file
      const regexEndOfScan = /Scan Summary/;
      const regexEndOfScanMatch = SemgrepOutput.match(regexEndOfScan)

      if (match) {        
        // eslint-disable-next-line no-control-regex
        const progressPercent = match[1];
        const timeRemaining = match[2];

        console.debug(`[PROGRESS]: ${progressPercent} Time elapsed: ${timeRemaining}`);

        // Update the Webview each time
        panel.webview.postMessage({
          command: 'updateTime',
          data: `Progress: ${progressPercent} Time elapsed: ${timeRemaining}`,
        });        
      } else if(match_output) {

        try {
          // Parse the JSON data from stdout
          // there is a bug with the stdout,
          // which occurs if the output is too long and then split the output in half!?
          // --> workaround check for the "Scan Summary" and read from the output file
          const _jsonData = JSON.parse(SemgrepOutput.trim());

          // check if there is an error field in the json output
          if (_jsonData.errors && Array.isArray(_jsonData.errors) && _jsonData.errors.length > 0) {
            console.debug(_jsonData.errors)
            let outputMessage: string = ""
            _jsonData.errors.forEach((error: SemgrepError) => {
              const message = `\nSemgrep ${error.level}: ${error.message}\n`;
              outputMessage += message
            });
            // reject --> show in the webview
            reject(new Error(outputMessage));
          }
          if (_jsonData.results.length == 0){
            vscode.window.showWarningMessage('Semgrep didn\'t found any Matches!');
            hasFailed = true
            reject(new Error('Semgrep didn\'t found any Matches!'))
            return
          }
          console.debug("No errors found :D");
        } catch (parseError) {
          // known error if the output to stdout of the scan is to long it breaks
          console.debug(`Failed to parse Semgrep output ${parseError}`);
        }
        //reject(new Error(`Failed to parse Semgrep ${SemgrepOutput}`));
      } else if (regexEndOfScanMatch){
        console.debug("Scan Summary called")
        console.debug(outputFile)
        isFinished = true
        if (fs.existsSync(outputFile)){
          console.debug("File exists")
        } else {
          // if its a relative path try to combine the workspacePath and the output path
          outputFile = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath + "/" + outputFile;
          if (fs.existsSync(outputFile)){
            console.debug("File exists after combination")
          } else {
            console.debug("File still deosnt exist")
            console.debug(outputFile)
            vscode.window.showErrorMessage(`Failed to parse output path: ${outputFile}`)
          }
        }

        fs.readFile(outputFile, 'utf-8', (err, data) => {
          if (err) {
            vscode.window.showErrorMessage(`Failed to read Semgrep output file: ${err.message}`);
            return;
          }
          try {
            jsonData = JSON.parse(data);            
            //console.debug('Semgrep JSON Output:', jsonData);   
            if (!hasFailed){
              finalImportSemgrepJson(); 
            }
          } catch (parseError) {
            vscode.window.showErrorMessage(`Failed to parse Semgrep output from file JSON: ${parseError}`);
          }
          resolve()
        });
        
      } else {

        // saveguard against huge overhead from regex searching the semgrep json output
        if (hasFailed) return

        // check that its not "Loading rules form registry"
        // Unicode Braille Patterns  u2800-u28FF
        // https://en.wikipedia.org/wiki/Braille_Patterns
        // also exclude other semgrep patterns
        // --> only get the error message

        if (!SemgrepOutput.match(/.*[\u2800-\u28FF]*\s*Loading rules from registry.*|SUPPLY CHAIN RULES|Semgrep CLI|Code rules:/)) {
          if (SemgrepOutput.match(/^Nothing to scan\.$/)){
            vscode.window.showErrorMessage(`Semgrep didn't found anything to Scan!`);
          }
          console.debug("adding", SemgrepOutput);
          stdoutData += SemgrepOutput;
        }      
      }
    });

    child.stderr.on('data', (data) => {
      if (isFinished){return}
      console.error('[STDERR]:', data.toString());
      vscode.window.showErrorMessage(`Semgrep Error: ${data.toString()}`);
      reject(new Error(`Semgrep Error: ${data.toString()}`)); // Reject if there is an error
    });

    // If the exit is called its very likly that something failed because the stdout out
    // capture should resolve before the exit call is captured
    child.on('exit', (code) => {
      if (isFinished){return}
      console.debug(`[EXIT]: Process exited with code ${code}`);
      console.debug(stdoutData)
      reject(new Error(`Semgrep Scan Failed with exit code ${code} Stdout:${stdoutData}`)); // Reject on failure
    });

    child.on('error', (error) => {
      if (isFinished){return}
      console.error(`[ERROR]:`, error);
      vscode.window.showErrorMessage(`Semgrep Error: ${error.message}`);
      reject(new Error(`Semgrep Error: ${error.message}`)); // Reject if there is an error
    });
  });
}

// Check if semgrep is accessable
async function checkSemgrepPath(): Promise<string | undefined> {
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
    //const env = {...process.env};
    //console.log(env)
    child.stdout.on('data', (data) => {
      output += data.toString();
      console.log(output)
    });

    child.stderr.on('data', () => {
      // if we get data from stderr its properly not found 
      resolve(undefined)
      //console.log("ERROR",data)
    });
    child.on('error', (err) => { console.log('spawn error', err); });
    child.on('exit', (code) => {
      if (code === 0 && output.trim().length > 0) {
        resolve(output.trim());
      } else {
        resolve(undefined);
      }
    });
  });
}

  
function buildSemgrepCommand(semgrepPath: string, config: string): string {
  /*
  Create the semgrep command 
  1. check if file exits --> yes add as config
  2. check if directory --> yes search recursive for all leafes/files
  3. check if its http:// https:// p/ r/ --> yes add as config
  4. if not its not "auto" display a warning
  5. add it   
  */
  const configs: string[] = [];

  for (let c of config.split(',')) {
    c = c.trim();

    // check for filesystem existence (files or directories)
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      configs.push(`--config "${c}"`);
    } else if (fs.existsSync(c) && fs.statSync(c).isDirectory()) {
      for (const file of findAllFiles(c)) {
        configs.push(`--config "${file}"`);
      }
    }
    // check for URL, registry id, or fallback
    else if (/^(\w+:\/\/)/.test(c) || /^([pr]\/)/.test(c)) {
      configs.push(`--config ${c}`);
    } else {
      if (c !== "auto"){
        // Add a "safeguard" - its a warning        
          vscode.window.showWarningMessage(
          `The config value "${c}" was not recognized as a local file, directory, or a valid Semgrep registry/URL. This may cause Semgrep to fail. Please check your config value.`
        );
      }        
      configs.push(`--config '${c}'`);
    }
  }

  const configArgs = configs.join(' ');
  let semgrepCommand = `${semgrepPath} scan ${configArgs} --strict --json`;
  return semgrepCommand;
}

function findAllFiles(dir: string): string[] {
  let files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(findAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}