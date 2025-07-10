/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function generateSemgrepOutputFilename(config: string, output?: string): string {
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
      .map(config => {

        if (config === "auto") return "auto";

        if (config.startsWith("http://") || config.startsWith("https://")) {
          const segment = config.split('//').pop();
          if (!segment) {
            vscode.window.showWarningMessage(`Invalid config URL: "${config}" - no rule or filename found after the last slash.`);
            return config.replace(/\W+/g, "_");
          }
          return segment.replace(/\W+/g, "_");
        }
        return config.replace(/^.*[\\/]/, '').replace(/\W+/g, "_");
      })
      .slice(0, 3) // only use the first three config file names --> safeguard against overlong filename
      .join("__");
  }

  const defaultFilename = `${formattedDate}_semgrep_${defaultNameFragment(config)}.json`;

  // if no output ise set return the default 
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
  return output.endsWith('.json') ? output : `${output}.json`;
}


export function buildSemgrepCommand(semgrepPath: string, config: string): string {
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
  const semgrepCommand = `${semgrepPath} scan ${configArgs} --strict --json`;
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