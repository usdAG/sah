// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

let state = vscode.getState() || {};
/*
semgrep scan 
*/
const startSemgrepScan = document.getElementById('startSemgrepScan');
const configPath       = document.getElementById('configPath');
const configPathBtn    = document.getElementById('configPathWizard');
const excludePattern   = document.getElementById('excludePattern');
const includePattern   = document.getElementById('includePattern');
const scanStatus       = document.getElementById('scanStatus');


if (state.config  !== undefined) configPath.value     = state.config;
if (state.include !== undefined) includePattern.value = state.include;
if (state.exclude !== undefined) excludePattern.value = state.exclude;


configPathBtn.addEventListener('click', ()=>{
  vscode.postMessage({
    command: 'configPathBtn'
  });
})


startSemgrepScan.addEventListener('click', () => {   
  state.config = configPath.value
  state.include = includePattern.value
  state.exclude = excludePattern.value

  vscode.setState(state);
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


// matches view

document.querySelectorAll(".pagination button").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.getAttribute("data-page");
    vscode.postMessage({ command: "changePageTestSection", page: parseInt(page) });
  });
});

// show more show less button in matches webview
document.querySelectorAll('.desc-toggle-btn').forEach(btn => {
  const cell = btn.closest('.desc-cell');
  const textSpan = cell.querySelector('.desc-text');
  const fullDesc = btn.dataset.fulldesc;
  const truncDesc = btn.dataset.truncdesc;

  btn.addEventListener('click', () => {
    const expanded = cell.classList.toggle('expanded');
    if (expanded) {
      textSpan.textContent = fullDesc;
      btn.textContent = 'Show less';
    } else {
      textSpan.textContent = truncDesc;
      btn.textContent = 'Show more';
    }
  });
});