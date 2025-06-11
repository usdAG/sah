(function () {
  // eslint-disable-next-line no-undef
  const vscode = acquireVsCodeApi();  

  /*
  semgrep import 
  */
  const startImportSemgrep = document.getElementById('startImportSemgrep');
  const finalImportSemgrep = document.getElementById('finalImportSemgrep');
  const semgrepPath = document.getElementById('semgrepPath');
  const pathStatus = document.getElementById('pathStatus');
  const semgrepScanImportPath = document.getElementById('semgrepScanImportPath');
  const semgrepScanImportPathBtn = document.getElementById('semgrepScanImportPathBtn')
  const semgrepPathLabel = document.getElementById('semgrepPathLabel');
  //store the relativePath to strip it from the userinput
  let relativePath = "";

  startImportSemgrep.addEventListener('click', ()=>{
    vscode.postMessage({
      command: 'startImportSemgrepBtn'      
    });    
  })
  finalImportSemgrep.addEventListener('click', ()=>{
    // only allow import if valid path
    if (pathStatus.innerHTML == '✔️ Path is valid!'){
      vscode.postMessage({
          command: 'finalSemgrepImport'          
      })
    }
  })

  semgrepPath.addEventListener('input', () => {
    vscode.postMessage({
      command: 'validatePath',
      path: semgrepPath.value
    })
  });

  semgrepScanImportPathBtn.addEventListener('click', () => {
    vscode.postMessage({
      command: 'startSemgrepImport',
      path: semgrepScanImportPath.value
    });
    // Only display the warning if invalid
    if (pathStatus.innerHTML == '❌ Path is invalid!'){
      semgrepPathLabel.style.visibility="visible";
      semgrepPath.style.visibility="visible";
    }
    if (pathStatus.innerHTML == '✔️ Path is valid!'){
      vscode.postMessage({
          command: 'finalSemgrepImport'          
      })
    }
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
          pathStatus.style.color = 'green';
      } else {
          pathStatus.innerHTML = '❌ Path is invalid!';
          pathStatus.style.color = 'red';
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
  const scanTarget = document.getElementById('scanTarget');
  const configPath = document.getElementById('configPath');
  const outputPath = document.getElementById('outputPath');
  const scanTargetBtn = document.getElementById('scanTargetWizard');
  const configPathBtn = document.getElementById('configPathWizard');
  const outputPathBtn = document.getElementById('outputPathWizard');
  const excludePattern = document.getElementById('excludePattern');
  const includePattern = document.getElementById('includePattern');
  const scanStatus = document.getElementById('scanStatus')
  const importSemgrepScanResults = document.getElementById('importSemgrepScanResults');

  scanTargetBtn.addEventListener('click', ()=>{
    vscode.postMessage({
      command: 'scanTargetBtn'
    });
  })

  configPathBtn.addEventListener('click', ()=>{
    vscode.postMessage({
      command: 'configPathBtn'
    });
  })

  outputPathBtn.addEventListener('click', ()=>{
    vscode.postMessage({
      command: 'outputPathBtn'
    });
  })

  importSemgrepScanResults.addEventListener('click', () =>{
    if (scanStatus.innerHTML != '✅ Scan completed!' &&
       scanStatus.innerHTML != '⏳ Scanning in progress...'){
      scanStatus.classList.add('show');
      scanStatus.innerHTML = 'There is no scan to import (or still ongoing)'
      scanStatus.style.color = 'red';
    }else{
      vscode.postMessage({
        command: 'importSemgrepScanResults'
      })
    }
  })

  startSemgrepScan.addEventListener('click', () => {
    scanStatus.classList.add('show');
    scanStatus.style.color = 'white';
    scanStatus.innerHTML = '⏳ Scanning in progress...';

    vscode.postMessage({
      command: 'startSemgrepScan',
      target: scanTarget.value,
      config: configPath.value,
      include: includePattern.value,
      exclude: excludePattern.value,
      output: outputPath.value,
    });
  });

  window.addEventListener('message', (event) => {
    const message = event.data;    
    if (message.command === 'scanTargetBtnResponse') {
      scanTarget.value = message.path
    }
    if (message.command === 'configPathBtnResponse') {
      configPath.value = message.path
    }
    if (message.command === 'outputPathBtnResponse') {
      const currentDate = new Date();
      const formattedDate = currentDate.toISOString().split('T')[0].replace(/-/g, ''); // Convert to YYYYMMDD
      const cleanedConfig = configPath.value.replace(/\//g, '_'); 
      let output = `${formattedDate}_semgrep_${cleanedConfig}.json`;
      outputPath.value = message.path + "/" + output
    }
    if (message.command === 'scanComplete') {

      scanStatus.style.color = 'green';
      scanStatus.innerHTML = '✅ Scan completed!';
    }  
    if (message.command === 'scanFailed') {
      scanStatus.style.color = 'red';
      scanStatus.innerHTML = `❌ ${message.errorMessage}`;
    }
    if (message.command ==='updateTime') {
      scanStatus.style.color = 'white';
      scanStatus.innerHTML = `⏳ Scanning in progress...${message.data}`;
    }
  
  });
  
}());
