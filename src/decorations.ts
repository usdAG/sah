import * as vscode from 'vscode';
import { allMatches, normalizeCriticality } from './matches';

const criticalityColors: Record<string, { bg: string; ruler: string }> = {
  'INFO':     { bg: 'rgba(0, 120, 255, 0.15)',  ruler: 'rgba(0, 120, 255, 0.6)'  },
  'LOW':      { bg: 'rgba(255, 220, 0, 0.20)',  ruler: 'rgba(255, 220, 0, 0.8)'  },
  'MEDIUM':   { bg: 'rgba(255, 140, 0, 0.20)',  ruler: 'rgba(255, 140, 0, 0.8)'  },
  'HIGH':     { bg: 'rgba(220, 50, 50, 0.20)',  ruler: 'rgba(220, 50, 50, 0.8)'  },
  'CRITICAL': { bg: 'rgba(200, 0, 0, 0.25)',    ruler: 'rgba(200, 0, 0, 0.9)'    },
};

const decorationTypes: Record<string, vscode.TextEditorDecorationType> = Object.fromEntries(
  Object.entries(criticalityColors).map(([crit, colors]) => [
    crit,
    vscode.window.createTextEditorDecorationType({
      backgroundColor: colors.bg,
      isWholeLine: true,
      overviewRulerColor: colors.ruler,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    }),
  ])
);

export function applyMatchDecorations(editor: vscode.TextEditor): void {
  const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
  const fileMatches = allMatches.filter(m => m.path === relativePath);

  const grouped: Record<string, vscode.DecorationOptions[]> = {};

  for (const match of fileMatches) {
    const crit = normalizeCriticality(match.pattern.criticality);
    if (!grouped[crit]) { grouped[crit] = []; }
    const line = match.lineNumber - 1;
    grouped[crit].push({
      range: new vscode.Range(line, 0, line, 0),
      hoverMessage: new vscode.MarkdownString(
        `**${match.pattern.description}**\n\nCriticality: ${crit} | Status: ${match.status}`
      ),
    });
  }

  for (const [crit, decorationType] of Object.entries(decorationTypes)) {
    editor.setDecorations(decorationType, grouped[crit] ?? []);
  }
}

export function refreshAllOpenEditorDecorations(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    applyMatchDecorations(editor);
  }
}

export function disposeDecorations(): void {
  for (const decorationType of Object.values(decorationTypes)) {
    decorationType.dispose();
  }
}
