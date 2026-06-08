export interface ChangelogLine {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'li' | 'p' | 'hr' | 'empty';
  text: string;
}

export interface ChangelogVersion {
  version: string;
  date: string | null;
  intro: string | null;
  sections: ChangelogSection[];
}

export interface ChangelogSection {
  title: string;
  groups: ChangelogGroup[];
}

interface ChangelogGroup {
  heading: string | null;
  items: string[];
}

function parseLine(line: string): ChangelogLine {
  if (line.startsWith('#### ')) return { type: 'h4', text: line.slice(5) };
  if (line.startsWith('### ')) return { type: 'h3', text: line.slice(4) };
  if (line.startsWith('## ')) return { type: 'h2', text: line.slice(3) };
  if (line.startsWith('# ')) return { type: 'h1', text: line.slice(2) };
  if (line.startsWith('- ')) return { type: 'li', text: line.slice(2) };
  if (line.trim() === '---') return { type: 'hr', text: '' };
  if (line.trim() === '') return { type: 'empty', text: '' };
  return { type: 'p', text: line };
}

export function parseChangelog(markdown: string): ChangelogVersion[] {
  const lines = markdown.split('\n').map(parseLine);
  const versions: ChangelogVersion[] = [];
  let currentVersion: ChangelogVersion | null = null;
  let currentSection: ChangelogSection | null = null;
  let currentGroup: ChangelogGroup | null = null;
  let collectingIntro = false;

  for (const line of lines) {
    if (line.type === 'h2') {
      const match = line.text.match(/^\[([^\]]+)\](?:\s*[—-]\s*(.+))?/);
      currentVersion = {
        version: match?.[1] ?? line.text,
        date: match?.[2] ?? null,
        intro: null,
        sections: [],
      };
      versions.push(currentVersion);
      currentSection = null;
      currentGroup = null;
      collectingIntro = true;
      continue;
    }

    if (line.type === 'h3' && currentVersion) {
      currentSection = { title: line.text, groups: [] };
      currentVersion.sections.push(currentSection);
      currentGroup = { heading: null, items: [] };
      currentSection.groups.push(currentGroup);
      collectingIntro = false;
      continue;
    }

    if (line.type === 'h4' && currentSection) {
      currentGroup = { heading: line.text, items: [] };
      currentSection.groups.push(currentGroup);
      continue;
    }

    if (line.type === 'p' && currentGroup && /\*\*.+\*\*/.test(line.text)) {
      const stripped = line.text.replace(/^\*\*(.+)\*\*$/, '$1');
      if (stripped !== line.text) {
        currentGroup = { heading: stripped, items: [] };
        currentSection?.groups.push(currentGroup);
        continue;
      }
    }

    if (line.type === 'li' && currentGroup) {
      currentGroup.items.push(line.text);
      continue;
    }

    if (line.type === 'p' && currentVersion && collectingIntro) {
      currentVersion.intro = (currentVersion.intro ?? '') + (currentVersion.intro ? ' ' : '') + line.text;
    }
  }

  return versions;
}

export function renderInline(text: string): Array<{ kind: 'text' | 'code' | 'bold'; value: string }> {
  const parts: Array<{ kind: 'text' | 'code' | 'bold'; value: string }> = [];
  const regex = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      parts.push({ kind: 'bold', value: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ kind: 'code', value: match[2] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}
