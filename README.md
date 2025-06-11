# README

## SAH - Static Analysis Hero

Finds vulnerabilities in source code using pattern matching, allows easy organization and export of findings.
SAH is used while having the project to review open in VSCode.
Open the command palette (`Ctrl + Shift + P`) and type "SAH" for all available commands.
Additionally some commands are available from the context menu (right click), and from keyboard shortcut.
Results in this plugin are organized as *Matches*.
A match is a possible finding, based on a list of regular expressions or semgrep rules, that should hint at common vulnerabilities.

### Usage

- [README](#readme)
  - [SAH - Static Analysis Hero](#sah---static-analysis-hero)
    - [Usage](#usage)
      - [Install](#install)
      - [Review Projects](#review-projects)
        - [New Project](#new-project)
        - [Load Project](#load-project)
      - [Scan For Potential Findings](#scan-for-potential-findings)
        - [Semgrep Scan](#semgrep-scan)
      - [Import semgrep Scan](#import-semgrep-scan)
      - [Review Matches](#review-matches)
    - [Blacklist Files And Directories](#blacklist-files-and-directories)
    - [Command Palette](#command-palette)

#### Install

To build this plugin, you need a recent version of nodejs and npm on your machine.


```
sudo apt install npm nodejs
git clone git@github.com:usdAG/sah.git
cd visual-source-code-plugin
npm install
npm install vsce
node_modules/vsce/vsce package
```

You can the install the resulting .vsix file in VSCode via the `Extensions: Install from VSIX...` command.

#### Review Projects

##### New Project

To start a review project open command palette and run `SAH New Project`.
Create a file that should be used as a project file.
All actions will automatically be saved to this file.

##### Load Project

To resume a previous project, or import a project file, run `SAH Load Project` from the command palette and select the respective project file.
If there is no review project loaded, all actions are temporary only!

#### Scan For Potential Findings

To add a scan, you can either run a new *semgrep* scan or import an existing one into the TOL.

##### Semgrep Scan

Call the `SAH Semgrep` dialog from the command palette.  
The SAH allows you to start scans from within the plugin.

This requires an install of semgrep on the local system.  
Installation is recommended by using `pipx` -> `pipx install semgrep`  

The dialog lets you define the following parameters:
- The path to scan (by default the working directory opened in the VSCode Workspace)
- The config to use for the scan: This can either be an OS path to rules or a standard ruleset such as `p/owasp-top-ten` available in the [semgrep registry](https://semgrep.dev/r)
- The outpath writes the scan to a chosen location on disk for archival
- Include Patterns/ Exclude Patterns tune the scanning engine of semgrep to include/ exclude resources for scanning

When finished configuring you can start the scan by clicking the "Start Scan" button.   
After the scan is finished results are automatically imported into the matches view. 


#### Import semgrep Scan

If you already have a semgrep scan you can import them also in `SAH semgrep`. An exemplary command to run a semgrep scan, importable by the SAH, is as follows: `semgrep scan -c "<ruleset>" --json -o <outputfile>`.
Some important notices:
- `--json` is required as the plugin can only parse the JSON output of semgrep
- The SAH creates links from the findings to the affected files. In order for this to work it currently requires your semgrep scans to *NOT* include the full paths, but scan from the project/worksapce root. This can be achieved by scanning a path like `.` or removing the path entirely. Tip: If you already performed a scan and the paths don't match just edit the json file.

#### Review Matches

You can get an overview of all matches by using the `SAH Show Matches List` commmand. 

It enables you to review and work through the list of issues. 
You can also categorize them with the buttons on every match. This enables priorization of certain matches. 

To only get matches from a certain file right click the file in the workspace explorer.

You can filter the matches to only show matches from certain paths in the workspace or exclude other paths. This can be done by going to the "File Explorer" on the bottom left of the workspace panel.  
By right clicking on a folder you can either exclude it or show matches only from this path. Reset is possible in the top bar of this File Explorer.  

### Blacklist Files And Directories

You may not want to search every single file or directory in the project. In this case, create a file in your project folder called '`.sahignore`'. This file should contain names of all the files and directories that you want to be excluded from the code scan. 
In lieu of a `.sahignore` file, a default blacklist is used containing some commonly blacklisted files and directories (`node_modules`, `package-lock.json` etc.)

### Command Palette

- `SAH Add To Finding`: Open dialog to add a code snippet to a finding.
- `SAH Load Project`: Open FS window to select and load a review project file.
- `SAH Create New Finding`: Open dialog to create a new finding.
- `SAH Scan Code`: Scan the currently opened workspace directory for potential findings.
- `SAH New Project`: Open FS window to name a review project file and create a new review project.
- `SAH Show Findingslist`: Switch to *Findings* view in the SAH panel.
- `SAH Show Matcheslist`: Switch to *Matches* view in the SAH panel.
- `SAH Semgrep`: Import a semgrep scan or perform a semgrep scan from within the SAH
