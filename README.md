# Static Analysis Hero (SAH)

## Introduction

SAH is a Visual Studio Code extension for efficient and effective security code reviews. It integrates external code scanning tools (e.g. semgrep / opengrep) and provides a toolbox for reviewing source code for security vulnerabilities.

SAH is used while having the project to review open in VSCode. Open the command palette (`Ctrl + Shift + P`) and type "SAH" for all available commands. Additionally, some commands are available from the context menu (right click), and from keyboard shortcut.

Results in this plugin are organized as *Matches*. A match is a possible security vulnerability, based on a list of regular expressions or semgrep / opengrep rule. Upon manual inspection, matches can be categorized as findings or false positives.

### Table of Contents
- [Installation](#installation)
- [Usage](#usage)
  - [Working with Projects](#working-with-projects)
    - [New Project](#new-project)
    - [Load Project](#load-project)
  - [Scan For Potential Findings](#scan-for-potential-findings)
    - [Scan Code](#scan-code)
    - [Import Semgrep / Opengrep Scan](#import-semgrep--opengrep-scan)
    - [Scanning Sandbox](#scanning-sandbox)
  - [Review Matches](#review-matches)
    - [Blacklist Files And Directories](#blacklist-files-and-directories)
- [Command Palette](#command-palette)
- [Contribution & Dev Setup](#contribution--dev-setup)
  - [Development Setup](#development-setup)
  - [Debugging in VSCode](#debugging-in-vscode)


## Installation

1. Download the `.vsix`-file from the Releases section in GitHub.
2. In VSCode, navigate to the Extensions menu and select `Install from VSIX...`.
3. After installation, launch SAH from the command palette (`Ctrl + Shift + P`).

If you want to build SAH from source, see instructions in the section [Contribution & Dev Setup](#contribution--dev-setup) below.


## Usage

### Working with Projects

#### New Project

To start a review project, open the command palette and choose `SAH: New Project`.
Select a file that will be used to preserve the project state (in JSON format).
All actions will automatically be saved to this file.

#### Load Project

To resume a project, or import a project file, run `SAH: Load Project` from the command palette and select the respective project file.
If there is no review project loaded, all actions are temporary only!


### Scan For Potential Findings

To add a scan, you can either run a new *semgrep*/ *opengrep* scan or import scan results into the tool.

#### Scan Code

Call the `SAH: Scan Code` command from the command palette.  SAH allows you to start semgrep scans from within the plugin.

This requires an install of semgrep/ opengrep on the local system.  
Installation is recommended by using `pipx` (e.g. for semgrep `pipx install semgrep`).

The interface lets you define the following parameters:
- The *config* to use for the scan: Either point to custom rules on disk or provide the name(s) of a standard ruleset, such as `p/owasp-top-ten` available in the [semgrep registry](https://semgrep.dev/r)
- The *output destination*  specifies a path to write the scan results on disk (in addition to storing the results in the project file)
- Optional: *Include Patterns* / *Exclude Patterns* tune the scanning engine of semgrep to include or exclude resources for scanning

After configuration, start the scan. Progress will be transparent during the scan and the results are automatically imported into the matches view.

*Note that semgrep requires an active Internet connection to download / update rules from the registry.*


#### Import Semgrep / Opengrep Scan

It is possible to import existing semgrep/opengrep scan results into SAH. To do so, use the upper section in the `SAH: Scan Code` command. For example, run the following command in a terminal and select the resulting outputfile for import: `semgrep scan -c "<ruleset>" --json -o <outputfile>`.

Important notes:
- `--json` is required as the plugin can only parse the JSON output of semgrep
- SAH creates links from the findings to the affected files. In order for this to work, it currently requires your semgrep scans to *NOT* include the full paths, but scan from the project/workspace root. This can be achieved by scanning a path like `.` or removing the path entirely. Tip: If you already performed a scan and the paths don't match, manually edit the json file.


#### Scanning Sandbox

With the `SAH: Scanning Sandbox` command you can open the scanning sandbox. It allows you to quickly develop new rules in a running project and test their detection capabilities in the codebase - without importing the results into the project state. You can either specify a ruleset or a single rule - that will conveniently be opened in a separate tab inside VSCode for quick edits - to run against the current workspace. It directly integrates a view of all matches found with this rule. 

Using the scanning sandbox is useful for developing new or enhancing existing rules. Once your satisfied with the results of your scan, you can directly import the results into the project - and thus the *Matches View* - for further review.


### Review Matches

In order to list all matches, use the `SAH: Show Matches List` commmand. This provides an overview with various filter options.

For each match, multiple utility functions are available:

- *Jump to code*: Opens the corresponding file and selects the exact match in the correct line of the file
- *Finding*: After review, set the status of this match to finding when it represents an actual vulnerability (true positive)
- *False Positive*: After review, set the status of this match to false positive when there is no vulnerability
- *Save for Later*: Use this status to mark this finding for follow-up review (e.g. when passing on the project to another person)

*Tip:* While performing the manual code review, filter for the status "Unprocessed" to hide matches which have already been classified.

To narrow down the manual analysis, use the context menu with a *right click* on a file in the workspace. This allows to

- *SAH: Only show Matches for this file*: Filter matches for a single file
- *SAH: Exclude File/Folder*: Filter matches *not* in a single file or folder
- *SAH: Reset the exclusion of all files/folders*

Finally, SAH provides an additional *File Explorer* in the bottom left panel that shows excluded files (toggle with button) as well as the number of findings per file.

#### Blacklist Files And Directories

You may not want to search every single file or directory in the project. In this case, create a file in your project folder called '`.semgrepignore`'. This file should contain names of all the files and directories that you want to be excluded from the code scan. 
In lieu of a `.semgrepignore` file, a default blacklist is used containing some commonly blacklisted files and directories (`node_modules`, `package-lock.json`, etc.)

## Command Palette

- `SAH: New Project`: Create a new project on disk to work with SAH and save your progress
- `SAH: Load Project`: Open FS window to select and load a review project file.
- `SAH: Save Project`: Manually save the current state to the project state
- `SAH: Scan Code`: Scan the currently opened workspace directory for potential findings.
- `SAH: Show Matches List`: Switch to *Matches* view in the SAH panel.
- `SAH: Scanning Sandbox`: Allows you to easily test/ adjust rules on your current workspace and import resulting matches afterwards
- `SAH: Show Help`: Renders this README inside VSCode for quick help
- `SAH: Set Log Level to <LEVEL>`: Allows you to update the Loglevel for troubleshooting. Levels are: Off, Debug, Info, Warn, Error.


## Contribution & Dev Setup

### Development Setup

To build this plugin, you need a recent version of nodejs and npm, as well as vsce to create the `vsix` package.

```
sudo apt install npm nodejs
git clone ssh://git@github.com:usdAG/sah
cd sah
npm install --legacy-peer-deps
npm install '@vscode/vsce' --legacy-peer-deps
node_modules/@vscode/vsce/vsce package
```

### Debugging in VSCode
In VS Code, open the code of SAH. Then use `F5` to launch a debugging session.