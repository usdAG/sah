/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "./logging";
import { checkSemgrepPath, isRelative, jsonData } from "./semgrep";
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { finalImportSemgrepJson } from "./semgrepImporter";
import { buildSemgrepCommand, generateSemgrepOutputFilename } from "./semgrepBuilder";
import { resetMatchValuesTestSection } from "./testSectionMatchesWebview";


interface SemgrepErrorSpan {
  file: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
}

interface SemgrepError {
  code: number;
  level: string;
  type: string;
  message?: string;
  short_msg?: string;
  long_msg?: string;
  spans?: SemgrepErrorSpan[];
}

let hasFailed = false
export const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

export async function startSemgrepScan(
  config: string,
  outputFile: string,
  include: string,
  exclude: string,
  panel: vscode.WebviewPanel,
  isTest: boolean
): Promise<void> {

  // reset the testsection matches and reload window to celan up
  if(isTest){
    resetMatchValuesTestSection()
    vscode.commands.executeCommand('extension.showMatchesTestSection');
  }
  const cleanup = () => {
    if (isTest) {
      if (!path.isAbsolute(outputFile)){
        outputFile = workspaceFolder + "/" + outputFile;
      }      
      logger.debug("delete outputFile", outputFile)
      try {
        fs.rmSync(outputFile);
      }
      catch (e) {
        logger.warn(`cleanup failed: ${(e as Error).message}`);
      }
    }
  };


  if (config === "") config = "auto";
  logger.debug("workspaceFolder", workspaceFolder)
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

  // add semgrepPath and configs 
  let semgrepCommand = buildSemgrepCommand(semgrepPath, config)

  // if this is a testrun add semgrep_temp_test_run to the path and storeit it later delete it
  if (isTest) {
    outputFile = 'semgrep_temp_test_run.json'
  }

  outputFile = generateSemgrepOutputFilename(config, outputFile);

  // yank the isRelative function and use it here to validate if the outputfile 
  // already exist to add a warning with yes overwrite or no abort for the user
  if (isRelative(outputFile)) {
    const choice = await vscode.window.showWarningMessage(
      `The file "${outputFile}" already exists. Overwrite it?`,
      { modal: true }, // this blocks the entire vscode 
      'Yes',
      'No'
    );

    if (choice === 'No') {
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
    hasFailed = false;
    let isFinished = false
    if (process.platform === 'win32') {
      // we don't have the pty for windows :|      
      // after hours trying to get the node-pty-win working i think this is the best way
      // just redirect stderr to stdout 
      // downside --> no live counter /time remaining
      // cmd >>>>> powershell
      child = spawn(shell, ['/c', `${semgrepCommand} 2>&1`], {
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
      // saveguard against huge overhead from regex searching the semgrep json output (doesnt work?)

      if (hasFailed) return
      if (isFinished) return
      // remove all Ansi chars
      // https://stackoverflow.com/questions/25245716/remove-all-ansi-colors-styles-from-strings


      // eslint-disable-next-line no-control-regex
      const SemgrepOutput = data.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

      // Regular expression for the output --> if ther is a version exit --> reduce overhead for large json output 
      const regex_output = /{"version":/;
      const match_output = SemgrepOutput.match(regex_output)
      if (match_output){isFinished = true; return}

      //logger.debug(SemgrepOutput)
      // Regular expression ("0% -:--:--" and "0% 0:00:00")
      const regex = /(\d+%\s*).*?([-\d]{1,2}:[-\d]{2}:[-\d]{2})/;
      const match = SemgrepOutput.match(regex);
            
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
      } else {        
        // check that its not "Loading rules form registry"
        // Unicode Braille Patterns  u2800-u28FF
        // https://en.wikipedia.org/wiki/Braille_Patterns
        // also exclude other semgrep patterns
        // --> only get the error message

        if (!SemgrepOutput.match(/.*[\u2800-\u28FF]*\s*Loading rules from registry.*|SUPPLY CHAIN RULES|Semgrep CLI|Code rules:/)) {
          if (SemgrepOutput.match(/^Nothing to scan\.$/)) {
            vscode.window.showErrorMessage(`Semgrep didn't found anything to Scan!`);
          }
          logger.debug("adding", SemgrepOutput);
          stdoutData += SemgrepOutput;
        }
      }
    });

    child.stderr.on('data', (data) => {
      if (isFinished) { return }
      logger.error('Child process [STDERR]:', data.toString());
      vscode.window.showErrorMessage(`Semgrep Error: ${data.toString()}`);
      reject(new Error(`Semgrep Error (child.stderr): ${data.toString()}`)); // Reject if there is an error
    });

    // If the exit is called its very likly that something failed because the stdout out
    // capture should resolve before the exit call is captured
    child.on('exit', (code) => {
      if (isFinished) { return }
      logger.debug(`[EXIT]: Process exited with code ${code}`);
      logger.debug(stdoutData)
      //reject(new Error(`Semgrep Scan Failed with exit code ${code} Stdout:${stdoutData}`)); // Reject on failure
    });

    child.on('error', (error) => {
      if (isFinished) { return }
      logger.error(`Child process [ERROR]:`, error);
      //vscode.window.showErrorMessage(`Semgrep Error: ${error.message}`);
      //reject(new Error(`Semgrep Error: ${error.message}`)); // Reject if there is an error
    });

    // lifesaver :D --> way better then parsing the stdout stderr err and exit 
    child.on('close', async () => {
      await importJsonFromOutputPath(outputFile)
      try {
        await parseOutputForErrors();
      } catch (err:any) {
        logger.error(`Parsed Semgrep error (parseOutputForErrors):`, err.toString());
        vscode.window.showErrorMessage(`Semgrep Error: ${err.toString()}`);
        if (isTest) { cleanup() }
        reject(err);
      }

      if (isTest) {
          finalImportSemgrepJson(isTest);
          cleanup()
          logger.debug("Result ammount after scan", jsonData.data.results.length)         
      } else if (!hasFailed && isFinished && jsonData.data.results.length >0) {
        finalImportSemgrepJson(isTest);
      }
      resolve()
    });
  });
}


async function importJsonFromOutputPath(outputFile: string) {
  logger.debug("importJsonFromOutputPath")

  // this is needed because the user can set a outputPath
  // outside of the project root :P

  if (!path.isAbsolute(outputFile)){
    outputFile = workspaceFolder + "/" + outputFile;
  }
  if (!fs.existsSync(outputFile)) {
    vscode.window.showErrorMessage(`absoluteOutputFile not found: ${outputFile}`);
    return;
  }

  try {
    const data = await fs.promises.readFile(outputFile, 'utf-8');
    logger.debug("Starting to JSON parse semgrep data")
    jsonData.data = JSON.parse(data);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to read or parse Semgrep output file: ${err.message}`);
  }
}


async function parseOutputForErrors(): Promise<void> {

  // check if there is an error field in the json output
  if (jsonData.data.errors && Array.isArray(jsonData.data.errors) && jsonData.data.errors.length > 0) {
    logger.debug("jsonData.data.errors",jsonData.data.errors)
    const errorMessages = jsonData.data.errors
    .map((error: SemgrepError) => `Semgrep ${error.level}: ${error.message || error.short_msg || error.long_msg || 'Unknown error'}`)
    .join('\n ');
    // reject --> show in the webview
    throw new Error(errorMessages);
  }
  return
  if (jsonData.data.results.length == 0) {
    vscode.window.showWarningMessage('Semgrep didn\'t found any Matches!');
    hasFailed = true
    throw new Error('Semgrep didn\'t find any Matches!');
  }
}