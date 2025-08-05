import * as vscode from 'vscode';
import * as path from 'path';
import { getHtmlHeader } from './webHelpers';


const generateStartWebview = (webview: vscode.Webview, localPath: string) => {
  // get path to stylesheet
  const stylesheetPath = vscode.Uri.file(
    path.join(localPath, 'src', 'media', 'start.css'),
  );

  const htmlHeader = getHtmlHeader(webview, localPath, 'Welcome to SAH!');

  return `
<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='UTF-8'>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource}; img-src ${webview.cspSource};">
  <link rel="stylesheet" type="text/css" href=${webview.asWebviewUri(stylesheetPath)} />
  <title>Static Analysis Hero</title>
<head>
<body>
  ${htmlHeader}
  <p><i>To get started run a scan with "SAH: Scan Code""</i></p>
</body>
</html>`;
};

export default generateStartWebview;
