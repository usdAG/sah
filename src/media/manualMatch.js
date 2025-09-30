// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();  

const createFindingButton = document.getElementById("add-finding");


createFindingButton.addEventListener('click', ()=>{
  const description = document.getElementById("description").value;
  const criticality = document.getElementById("criticality-selection").value;
  const category = document.getElementById("category").value;
  const proof = document.getElementById("proof").value;
  const proofPath = document.getElementById("proofPath").value;
  const proofStartLine = document.getElementById("proofStartLine").value;
  vscode.postMessage({
    command: 'createFindingObject',
    data: {
      description,
      criticality,
      category,
      proof,
      proofPath,
      proofStartLine
    }  
  });    
})