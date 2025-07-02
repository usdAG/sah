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

const actionBar = document.getElementById('action-bar');

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

  if(message.command === 'getToggledMatchesResponse') {
    if (message.selectedMatches.length > 0) {
      actionBar.classList.remove('hidden');
    } else {
      actionBar.classList.add('hidden');
    }
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

// multiselect --> sens a message and toogles the select status of the match
document.querySelectorAll('.match-toggle').forEach(checkbox => {
    checkbox.addEventListener('change', event => {
      const cb = /** @type {HTMLInputElement} */(event.currentTarget);
      vscode.postMessage({
        command: 'toggleMatch',
        matchId: cb.id.replace('checkbox', ''),
        checked: cb.checked
      });
      vscode.postMessage({
        command: "getToggledMatches"
      })  
    });
  });

// multiselect action bar

document.getElementById('btn-finding')
  .addEventListener('click', () => {
    vscode.postMessage({ command: 'batchAction', action: 'finding' });
  });

document.getElementById('btn-false-positive')
  .addEventListener('click', () => {
    vscode.postMessage({ command: 'batchAction', action: 'falsePositive' });
  });

document.getElementById('btn-save-later')
  .addEventListener('click', () => {
    vscode.postMessage({ command: 'batchAction', action: 'saveForLater' });
  });

document.getElementById('btn-unselect-all')
  .addEventListener('click', () => {
    vscode.postMessage({ command: 'clearAllSelcted' });
    actionBar.classList.add('hidden');
    // uncheck all the checkboxes in the UI
    document.querySelectorAll('.match-toggle').forEach(cb => {
      cb.checked = false;
    });
  });

// Initialize visibility on load
vscode.postMessage({
  command: "getToggledMatches"
})  


/* logic to move the action bar for select */
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

actionBar.addEventListener('mousedown', e => {
  // start dragging if left‑button and not clicking a button inside
  if (e.button !== 0 || e.target.tagName === 'BUTTON') return;
  isDragging = true;

  // offset between mouse and top-left corner of the bar
  const rect = actionBar.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
});

document.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const newLeft = e.clientX - dragOffsetX;
  const newTop  = e.clientY - dragOffsetY;
  // clamping --> doesn't go off‑screen
  actionBar.style.left   = Math.max(0, newLeft) + 'px';
  actionBar.style.top    = Math.max(0, newTop)  + 'px';
  actionBar.style.bottom = 'auto';
  actionBar.style.right  = 'auto';
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
  }
});