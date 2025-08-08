// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();  

/*
semgrep import 
*/
const startImportSemgrep       = document.getElementById('startImportSemgrep');
const semgrepPath              = document.getElementById('semgrepPath');
const pathStatus               = document.getElementById('pathStatus');
const semgrepScanImportPath    = document.getElementById('semgrepScanImportPath');
const semgrepScanImportPathBtn = document.getElementById('semgrepScanImportPathBtn')
const semgrepPathLabel         = document.getElementById('semgrepPathLabel');
// store the relativePath to strip it from the userinput
let relativePath = "";

startImportSemgrep.addEventListener('click', ()=>{
  vscode.postMessage({
    command: 'startImportSemgrepBtn'      
  });    
})


semgrepScanImportPathBtn.addEventListener('click', () => {
  vscode.postMessage({
    command: 'startSemgrepImport',
    path: semgrepScanImportPath.value
  });
});

window.addEventListener('message', (event) => {
  const message = event.data;    

  // Event handle for the selected Path callback
  if (message.command === 'startImportSemgrepBtnResponse') {
    semgrepScanImportPath.value = message.path
  }
  // Event handler for validating the path
  if (message.command === 'validatePathResponse') {
    if (message.isValid) {
        pathStatus.innerHTML = '✔️ Path is valid!';
        semgrepPathLabel.style.visibility="invisible";
        pathStatus.style.color = 'green';
    } else {
        pathStatus.innerHTML = '❌ Path is invalid!';
        pathStatus.style.color = 'red';
        semgrepPathLabel.style.visibility="visible";
        semgrepPath.style.visibility="visible";
    }
  }
  // Event handler for updating the relative path after Semgrep import
  if (message.command === 'relativePath') {
    semgrepPath.value = message.path;
    relativePath = message.path;
    vscode.postMessage({
      command: 'validatePath',
      path: relativePath
    })
  }
});

/*
semgrep scan 
*/
const startSemgrepScan = document.getElementById('startSemgrepScan');
const configPath       = document.getElementById('configPath');
const outputPath       = document.getElementById('outputPath');
const configPathBtn    = document.getElementById('configPathWizard');
const outputPathBtn    = document.getElementById('outputPathWizard');
const excludePattern   = document.getElementById('excludePattern');
const includePattern   = document.getElementById('includePattern');
const scanStatus       = document.getElementById('scanStatus');
const goToMatches      = document.getElementById('goToMatches');

configPathBtn.addEventListener('click', ()=>{
  vscode.postMessage({
    command: 'configPathBtn'
  });
})

// add a listener that create a filepicker and
// appends default folder if a folder is selected
outputPathBtn.addEventListener('click', ()=>{
  vscode.postMessage({
    command: 'outputPathBtn',
    config: configPath.value
  });
})

startSemgrepScan.addEventListener('click', () => {   
  vscode.postMessage({
    command: 'startSemgrepScan',      
    config: configPath.value,
    include: includePattern.value,
    exclude: excludePattern.value,
    output: outputPath.value,
  });
});

goToMatches.addEventListener('click', () => {
  vscode.postMessage({
    command: 'showMatches'
  })
});

window.addEventListener('message', (event) => {
  const message = event.data;    
  if (message.command === 'configPathBtnResponse') {
    configPath.value = message.path
  }
  if (message.command === 'outputPathBtnResponse') {     
    outputPath.value = message.path
  }
  if (message.command === 'scanComplete') {
    scanStatus.style.color = 'green';
    scanStatus.innerHTML = `✅ Scan completed! Found ${message.matchesCount} Matches`;
  }
  if (message.command === 'scanFailed') {
    scanStatus.style.color = 'red';
    scanStatus.innerHTML = `❌ ${message.errorMessage}`;
  }
  if (message.command === 'updateTime') {
    scanStatus.innerHTML = `⏳ Scanning in progress...${message.data}`;
  }
  if (message.command === 'scanStart') {
    scanStatus.classList.add('show');
    scanStatus.innerHTML = '⏳ Scanning in progress...';
  }
});
