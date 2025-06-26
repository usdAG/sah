// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();
const jumpToCodeBtns = document.getElementsByClassName('jump-to-code-btn');
const findingsBtns = document.getElementsByClassName('finding-btn');
const falsePositiveBtns = document.getElementsByClassName('falsePositive-btn');
const saveForLaterBtns = document.getElementsByClassName('saveForLater-btn');

const statusSelection = document.getElementById('status-selection');
const criticalitySelection = document.getElementById('criticality-selection');
const ruleSelect = document.getElementById("rules-selection");
const commentInput = document.getElementsByClassName('comment-input');
const fileViewBtn = document.getElementById('file-view');


let state = vscode.getState();

for (let i = 0; i < jumpToCodeBtns.length; i += 1) {
  const id = jumpToCodeBtns[i].dataset.match;
  jumpToCodeBtns[i].addEventListener('click', () => {
    vscode.postMessage({
      command: 'jmp',
      data: id,
    });
  });
}
for (let i = 0; i < findingsBtns.length; i += 1) {
  const id = findingsBtns[i].dataset.match;
  findingsBtns[i].addEventListener('click', () => {
    vscode.postMessage({
      command: 'setStatusAsFinding',
      data: id,
    });
  });
}
for (let i = 0; i < falsePositiveBtns.length; i += 1) {
  const id = falsePositiveBtns[i].dataset.match;
  falsePositiveBtns[i].addEventListener('click', () => {
    vscode.postMessage({
      command: 'setStatusAsFalsePositive',
      data: id,
    });
  });
}
for (let i = 0; i < saveForLaterBtns.length; i += 1) {
  const id = saveForLaterBtns[i].dataset.match;
  saveForLaterBtns[i].addEventListener('click', () => {
    vscode.postMessage({
      command: 'setStatusAsSaveForLater',
      data: id,
    });
  });
}
for (let i = 0; i < commentInput.length; i += 1) {
  const id = commentInput[i].dataset.match;
  commentInput[i].addEventListener('change', () => {
    vscode.postMessage({
      command: 'addComment',
      data_id: id,
      data: commentInput[i].value
    });
    event.target.setAttribute("title", commentInput[i].value);
  });
}

if(state != null && state.status != null){
  statusSelection.value = state.status;
}
if(state != null && state.criticality != null){
  criticalitySelection.value = state.criticality;
}

/*
validate if the old rule can be set to the new webview 
--> prevents an empty dropdown :P
*/
if(state != null && state.rule != null){
  const validValues = Array.from(ruleSelect.options).map(opt => opt.value);
  if (validValues.includes(state.rule)) {    
    ruleSelect.value = state.rule;
  }
}

statusSelection.addEventListener('input', () =>{    
  vscode.setState({...state, status: statusSelection.value});
  vscode.postMessage({
    command: 'setStatus',
    status: statusSelection.value,
  });
  updateHighlights()
});

criticalitySelection.addEventListener('input', () =>{    
  vscode.setState({...state, criticality: criticalitySelection.value});
  vscode.postMessage({
    command: 'setCriticality',
    criticality: criticalitySelection.value,
  });    
  updateHighlights()
});

ruleSelect.addEventListener("input", () => {
  vscode.setState({...state, rule: ruleSelect.value});
  vscode.postMessage({
    command: "setRule",
    rule: ruleSelect.value
  });
  updateHighlights()
});

fileViewBtn.addEventListener('click', ()=>{
  vscode.postMessage({
    command: 'openFileViewer'
  })
  vscode.postMessage({
    command: "isFileExclusionSet"
  })  
});

document.querySelectorAll(".pagination button").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.getAttribute("data-page");
    vscode.postMessage({ command: "changePage", page: parseInt(page) });
  });
});

window.addEventListener('message', event => {
  const message = event.data;
  
  if (message.command === 'updateState') {
      state = { ...state, ...message.newState };
      vscode.setState(state);
      if (message.newState.status) {
        statusSelection.value = message.newState.status;
      }
      if (message.newState.criticality) {
          criticalitySelection.value = message.newState.criticality;
      }
      if (message.newState.rule) {        
          ruleSelect.value = message.newState.rule;
      }
    }
  if(message.command === 'isFileExclusionSetResponse') {
    if (message.status){
      fileViewBtn.classList.add('highlighted');
      state.isFileExclusionSet = true
    } else {
      fileViewBtn.classList.remove('highlighted');
      state.isFileExclusionSet = false
    }
    updateHighlights()
  }
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


const selectsToUpdate = [
  { element: statusSelection, defaultValue: 'unprocessed' },
  { element: criticalitySelection, defaultValue: '0' },
  { element: ruleSelect, defaultValue: 'all' }  
];

function updateHighlights() {
  selects = selectsToUpdate
  selects.forEach(({ element, defaultValue }) => {
    if (element.value !== defaultValue) {
      element.classList.add('highlighted');
    } else {
      element.classList.remove('highlighted');
    }
  });
}
// also update every time the webview is reloaded
updateHighlights()
// ask everytime if there is still an exclusion
vscode.postMessage({
  command: "isFileExclusionSet"
})  