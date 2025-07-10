import * as vscode from 'vscode';
import * as path from 'path';

const generateStartWebview = (webview: vscode.Webview, localPath: string) => {
  // get path to stylesheet
  const stylesheetPath = vscode.Uri.file(
    path.join(localPath, 'src', 'media', 'start.css'),
  );

  let ASCIIheader = '<pre>';
ASCIIheader += ' _____  ___   _   _ <br>';
ASCIIheader += '/  ___|/ _ \\ | | | |<br>';
ASCIIheader += '\\ `--./ /_\\ \\| |_| |<br>';
ASCIIheader += ' `--. \\  _  ||  _  |<br>';
ASCIIheader += '/\\__/ / | | || | | |<br>';
ASCIIheader += '\\____/\\_| |_/\\_| |_/<br>';

  return `
<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='UTF-8'>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource};">
  <link rel="stylesheet" type="text/css" href=${webview.asWebviewUri(stylesheetPath)} />
  <title>SAH Matches</title>
<head>
<body>
  <h3>${ASCIIheader}</h3><br>
  <h2>Welcome to SAH!</h2>
  <p><i>To get started run a Semgrep scan with "SAH Semgrep""</i></p>
</body>
</html>`;
};

export default generateStartWebview;
