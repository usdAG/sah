// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

/*
semgrep scan 
*/
const startSemgrepScan = document.getElementById('startSemgrepScan');
const configPath       = document.getElementById('configPath');
const configPathBtn    = document.getElementById('configPathWizard');
const excludePattern   = document.getElementById('excludePattern');
const includePattern   = document.getElementById('includePattern');
const scanStatus       = document.getElementById('scanStatus');


configPathBtn.addEventListener('click', ()=>{
  vscode.postMessage({
    command: 'configPathBtn'
  });
})


startSemgrepScan.addEventListener('click', () => {   
  vscode.postMessage({
    command: 'startSemgrepScan',      
    config: configPath.value,
    include: includePattern.value,
    exclude: excludePattern.value,
    output: "",
    isTest: true
  });
});


window.addEventListener('message', (event) => {
  const message = event.data;    
  if (message.command === 'configPathBtnResponse') {
    configPath.value = message.path
    if (message.isFolder === false){
      vscode.postMessage({
        command: 'createSplitView',
        filePath: message.path
      })
    }
  }
  if (message.command === 'scanComplete') {
    scanStatus.style.color = 'green';
    scanStatus.innerHTML = `✅ Scan completed! Found ${message.matchesCount} Matches`;
  }
  if (message.command === 'scanFailed') {
    scanStatus.style.color = 'red';
    const errorMessage = message.errorMessage.replace(/\n/g, '<br><br>');
    scanStatus.innerHTML = `❌Semgrep Error:<br> ${errorMessage}`;
  }
  if (message.command === 'updateTime') {
    scanStatus.style.color = 'white';
    scanStatus.innerHTML = `⏳ Scanning in progress...${message.data}`;
  }
  if (message.command === 'scanStart') {
    scanStatus.classList.add('show');
    scanStatus.style.color = 'white';
    scanStatus.innerHTML = '⏳ Scanning in progress...';
  }
});
