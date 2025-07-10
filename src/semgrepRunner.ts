/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "./logging";
import { checkSemgrepPath,isRelative, jsonData } from "./semgrep";
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { finalImportSemgrepJson } from "./semgrepImporter";
import { buildSemgrepCommand, generateSemgrepOutputFilename } from "./semgrepBuilder";
interface SemgrepError {
  code: number;
  level: string;
  type: string;
  message: string;
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
  logger.debug("workspaceFolder",workspaceFolder)
  let semgrepPath = await checkSemgrepPath();
  logger.debug("semgrepPath", semgrepPath)
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


  outputFile = generateSemgrepOutputFilename(config, outputFile);
  // yank the isRelative function and use it here to validate if the outputfile 
  // already exist to add a warning with yes overwrite or no abort for the user
  if (isRelative(outputFile)){
    const choice = await vscode.window.showWarningMessage(
    `The file "${outputFile}" already exists. Overwrite it?`,
    { modal: true }, // this blocks the entire vscode 
    'Yes',
    'No'
  );

  if (choice === 'No') {
    // user chose “No” or dismissed the dialog
    return;
  }
  }
  
  logger.debug("Output path:", outputFile);
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


  logger.debug("Executing Semgrep command:", semgrepCommand);

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

    // post a message to the Webview
    panel.webview.postMessage({
      command: 'scanStart',
    });

    // Display stdout (progress bar + results) which includes PTY
    child.stdout.on('data', async (data) => {
      if (isFinished){return}
      // remove all Ansi chars
      // https://stackoverflow.com/questions/25245716/remove-all-ansi-colors-styles-from-strings

      
      // eslint-disable-next-line no-control-regex
      const SemgrepOutput = data.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      
      //logger.debug(SemgrepOutput)
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

        logger.debug(`[PROGRESS]: ${progressPercent} Time elapsed: ${timeRemaining}`);

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
            logger.debug(_jsonData.errors)
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
          logger.debug("No errors found :D");
        } catch (parseError) {
          // known error if the output to stdout of the scan is to long it breaks
          logger.debug(`Failed to parse Semgrep output ${parseError}`);
        }
        //reject(new Error(`Failed to parse Semgrep ${SemgrepOutput}`));
      } else if (regexEndOfScanMatch){
        logger.debug("Scan Summary called")
        logger.debug(outputFile)
        isFinished = true
        if (fs.existsSync(outputFile)){
          logger.debug("File exists")
        } else {
          // if its a relative path try to combine the workspacePath and the output path
          outputFile = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath + "/" + outputFile;
          if (fs.existsSync(outputFile)){
            logger.debug("File exists after combination")
          } else {
            logger.debug("File still deosnt exist")
            logger.debug(outputFile)
            vscode.window.showErrorMessage(`Failed to parse output path: ${outputFile}`)
          }
        }

        fs.readFile(outputFile, 'utf-8', (err, data) => {
          if (err) {
            vscode.window.showErrorMessage(`Failed to read Semgrep output file: ${err.message}`);
            return;
          }
          try {
            logger.debug("Starting to JSON parse semgrep data")
            jsonData.data = JSON.parse(data);            
            //logger.debug('Semgrep JSON Output:', jsonData);   
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
          logger.debug("adding", SemgrepOutput);
          stdoutData += SemgrepOutput;
        }      
      }
    });

    child.stderr.on('data', (data) => {
      if (isFinished){return}
      logger.error('Child process [STDERR]:', data.toString());
      vscode.window.showErrorMessage(`Semgrep Error: ${data.toString()}`);
      reject(new Error(`Semgrep Error: ${data.toString()}`)); // Reject if there is an error
    });

    // If the exit is called its very likly that something failed because the stdout out
    // capture should resolve before the exit call is captured
    child.on('exit', (code) => {
      if (isFinished){return}
      logger.debug(`[EXIT]: Process exited with code ${code}`);
      logger.debug(stdoutData)
      reject(new Error(`Semgrep Scan Failed with exit code ${code} Stdout:${stdoutData}`)); // Reject on failure
    });

    child.on('error', (error) => {
      if (isFinished){return}
      logger.error(`Child process [ERROR]:`, error);
      vscode.window.showErrorMessage(`Semgrep Error: ${error.message}`);
      reject(new Error(`Semgrep Error: ${error.message}`)); // Reject if there is an error
    });
  });
}