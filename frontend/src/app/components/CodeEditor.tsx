import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  fontSize?: number;
  tabSize?: number;
}

// Map our language keys to Monaco language identifiers
const MONACO_LANG: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java: 'java',
  cpp: 'cpp',
  go: 'go',
};

export function CodeEditor({ value, onChange, language, fontSize = 14, tabSize = 4 }: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      language={MONACO_LANG[language] ?? language}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 16, bottom: 16 },
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        fontLigatures: true,
        tabSize,
        wordWrap: 'off',
        renderLineHighlight: 'line',
        scrollbar: {
          vertical: 'visible',
          horizontal: 'visible',
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
        overviewRulerLanes: 0,
      }}
    />
  );
}
