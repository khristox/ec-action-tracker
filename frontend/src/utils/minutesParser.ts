// src/utils/minutesParser.ts
import * as mammoth from 'mammoth';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ActionItem {
  description: string;
  assignedTo?: string;
  dueDate?: string;
}

export interface MinuteEntry {
  id: string;
  minuteNumber: string;
  title: string;
  /** Rich HTML ready to be stored in the `discussion` field */
  discussion: string;
  /** Rich HTML ready to be stored in the `decisions` field */
  decisions: string;
  actionItems: ActionItem[];
  allToNote: boolean;
  rawText: string;
}

export interface ParsedAttendee {
  name: string;
  designation?: string;
  organization?: string;
  telephone?: string;
}

export interface ParsedMinutes {
  meetingInfo: {
    subject?: string;
    date?: string;
    time?: string;
    location?: string;
    recordedBy?: string;
  };
  attendees: ParsedAttendee[];
  agenda: string[];
  minutes: MinuteEntry[];
  resolutions: string[];
}

// ─────────────────────────────────────────────
// Public entry-point
// ─────────────────────────────────────────────

/**
 * Parse a .doc / .docx file and return structured meeting minutes.
 * The `discussion` and `decisions` fields on each MinuteEntry are
 * ready-to-use HTML strings (compatible with your RichTextEditor).
 */
export const parseWordDocument = async (file: File): Promise<ParsedMinutes> => {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Try HTML extraction first (preserves formatting better)
    let htmlResult: { value: string; messages: any[] } | null = null;
    try {
      htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    } catch {
      // fall through to raw text
    }

    const rawResult = await mammoth.extractRawText({ arrayBuffer });
    const rawText = rawResult.value;
    const htmlText = htmlResult?.value ?? '';

    return extractStructuredData(rawText, htmlText);
  } catch (error) {
    console.error('Error parsing document:', error);
    throw new Error('Failed to parse document. Please ensure it is a valid .doc or .docx file.');
  }
};

// ─────────────────────────────────────────────
// Core extraction
// ─────────────────────────────────────────────

const extractStructuredData = (rawText: string, htmlText: string): ParsedMinutes => {
  return {
    meetingInfo: extractMeetingInfo(rawText),
    attendees: extractAttendees(rawText),
    agenda: extractAgenda(rawText),
    minutes: extractMinutes(rawText, htmlText),
    resolutions: extractResolutions(rawText),
  };
};

// ─────────────────────────────────────────────
// Meeting metadata
// ─────────────────────────────────────────────

const extractMeetingInfo = (text: string) => {
  const info: ParsedMinutes['meetingInfo'] = {};

  const match = (pattern: RegExp) => {
    const m = text.match(pattern);
    return m ? m[1].trim() : undefined;
  };

  info.subject = match(/(?:SUBJECT|RE|Title)[:\s]+(.+?)(?=\n)/i);
  info.date = match(/Date[:\s]+(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i);
  info.time = match(/Time[:\s]+([0-9:APMapm\s]+(?:AM|PM)?)/i);
  info.location = match(/(?:Location|Venue|Place)[:\s]+(.+?)(?=\n)/i);
  info.recordedBy = match(/Recorded\s+by[:\s]+(.+?)(?=\n)/i)
    ?? match(/Secretary[:\s]+(.+?)(?=\n)/i)
    ?? match(/Minute\s+Taker[:\s]+(.+?)(?=\n)/i);

  return info;
};

// ─────────────────────────────────────────────
// Attendees
// ─────────────────────────────────────────────

const KNOWN_ORGS = ['UNHCR', 'OPM', 'NIRA', 'UNDP', 'UNICEF', 'WFP', 'WHO', 'UN', 'MLAS', 'MDPP'];
const KNOWN_ROLES = [
  'Director', 'Manager', 'Officer', 'MIS', 'DBA', 'Executive Director',
  'Chair', 'Secretary', 'Coordinator', 'Advisor', 'Analyst', 'Consultant'
];

const extractOrganization = (text: string): string => {
  for (const org of KNOWN_ORGS) {
    if (text.includes(org)) return org;
  }
  return '';
};

const extractAttendees = (text: string): ParsedAttendee[] => {
  const attendees: ParsedAttendee[] = [];
  const seen = new Set<string>();

  // Match lines that look like "Name   Role   Organization"
  const rolePattern = new RegExp(
    `([A-Z][a-zA-Z .'-]+?)\\s{2,}(${KNOWN_ROLES.join('|')})[^\\n]*`,
    'g'
  );

  let match: RegExpExecArray | null;
  while ((match = rolePattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (seen.has(name) || name.split(' ').length < 2) continue;
    seen.add(name);
    attendees.push({
      name,
      designation: match[2].trim(),
      organization: extractOrganization(match[0]),
    });
  }

  return attendees.slice(0, 50);
};

// ─────────────────────────────────────────────
// Agenda
// ─────────────────────────────────────────────

const extractAgenda = (text: string): string[] => {
  const agenda: string[] = [];

  const section = text.match(/(?:Agenda|AGENDA)[^\n]*\n([\s\S]+?)(?=Proceedings|Minutes?|Min\s+\d|$)/i);
  if (!section) return agenda;

  for (const line of section[1].split('\n')) {
    const t = line.trim();
    if (!t) continue;
    // Numbered or bullet items
    if (/^[\d\-•*ivxIVX]+[.)]\s+/.test(t)) {
      agenda.push(t.replace(/^[\d\-•*ivxIVX]+[.)]\s+/, '').trim());
    } else if (t.length > 3 && t.length < 120 && /[A-Za-z]/.test(t)) {
      agenda.push(t);
    }
  }

  return agenda;
};

// ─────────────────────────────────────────────
// Minutes extraction (main logic)
// ─────────────────────────────────────────────

/**
 * Convert plain proceeding text to simple HTML paragraphs,
 * preserving bullet-like lines as <ul> lists.
 */
const textToHtml = (text: string): string => {
  if (!text.trim()) return '';

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out: string[] = [];
  let inList = false;

  for (const line of lines) {
    const isBullet = /^[-•*]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
    if (isBullet) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${line.replace(/^[-•*\d.)+]\s+/, '')}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${line}</p>`);
    }
  }
  if (inList) out.push('</ul>');

  return out.join('\n');
};

/** Pull action items from a block of text */
const parseActionItems = (text: string): { actions: ActionItem[]; cleanText: string } => {
  const actions: ActionItem[] = [];
  const actionSectionMatch = text.match(
    /(?:Action\s*(?:Items?|Required|Points?)?|TODO)[:\s]*\n?([\s\S]+?)(?=\n\n|\n[A-Z][a-z]|Decisions?:|$)/i
  );

  let cleanText = text;

  if (actionSectionMatch) {
    const block = actionSectionMatch[1];
    cleanText = text.substring(0, actionSectionMatch.index ?? 0).trim();

    for (const line of block.split('\n')) {
      const t = line.trim();
      if (!t) continue;

      // Try to detect "Name to do X by Date" patterns
      const byMatch = t.match(/^(.+?)\s+by\s+(.+?)(?:\s*[-–]\s*(.+))?$/i);
      const toMatch = t.match(/^([A-Z][a-z]+ [A-Z][a-z]+)\s+to\s+(.+)/);

      if (toMatch) {
        actions.push({ assignedTo: toMatch[1], description: toMatch[2].trim() });
      } else if (byMatch) {
        actions.push({ description: byMatch[1].trim(), dueDate: byMatch[2].trim() });
      } else if (t.length > 5) {
        actions.push({ description: t.replace(/^[-•*\d.)]+\s*/, '') });
      }
    }
  }

  // Also scan for inline "ALL TO NOTE" / "All to note"
  const allToNote = /all\s+to\s+note/i.test(text);
  if (allToNote && actions.length === 0) {
    actions.push({ description: 'All to note' });
  }

  return { actions, cleanText };
};

/** Split decisions from proceedings text */
const splitDecisions = (text: string): { proceedings: string; decisions: string } => {
  const decisionMarkers = [
    /(?:Decisions?|Resolved|Resolution|RESOLVED)[:\s]*\n?([\s\S]+)/i,
    /(?:It was (?:resolved|agreed|decided) that)([\s\S]+)/i,
  ];

  for (const marker of decisionMarkers) {
    const m = text.match(marker);
    if (m) {
      return {
        proceedings: text.substring(0, m.index ?? 0).trim(),
        decisions: m[0].trim(),
      };
    }
  }

  return { proceedings: text, decisions: '' };
};

const extractMinutes = (rawText: string, _htmlText: string): MinuteEntry[] => {
  const minutes: MinuteEntry[] = [];

  // ── Strategy 1: "Min N:" / "Minute N:" / "MINUTE NO N" headers ──
  const strategy1 = () => {
    const pattern = /(?:Min(?:ute)?\s+(?:NO\.?\s*)?(\d+)[:\s]+|^(\d+)\.\s+)(.+?)(?=(?:Min(?:ute)?\s+(?:NO\.?\s*)?\d+[:\s]|\n\d+\.\s+)|$)/gims;
    const matches = Array.from(rawText.matchAll(pattern));
    if (matches.length < 1) return false;

    for (const match of matches) {
      const num = (match[1] ?? match[2]).trim();
      const content = match[3].trim();
      const firstNewline = content.indexOf('\n');
      const title = firstNewline > 0 ? content.substring(0, firstNewline).trim() : content;
      const body = firstNewline > 0 ? content.substring(firstNewline).trim() : '';

      const { actions, cleanText } = parseActionItems(body);
      const { proceedings, decisions } = splitDecisions(cleanText);
      const allToNote = /all\s+to\s+note/i.test(content);

      minutes.push({
        id: `min-${num}`,
        minuteNumber: num,
        title,
        discussion: textToHtml(proceedings),
        decisions: textToHtml(decisions),
        actionItems: actions,
        allToNote,
        rawText: content,
      });
    }
    return minutes.length > 0;
  };

  // ── Strategy 2: Keyword-based sections ──
  const strategy2 = () => {
    const sectionKeywords = [
      'Prayer', 'Opening', 'Introduction', 'Apologies', 'Agenda', 'Communication',
      'Discussion', 'Any other business', 'AOB', 'Closure', 'Vote of thanks',
    ];

    const keywordPattern = new RegExp(
      `(${sectionKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})[:\\s]*([\\s\\S]*?)(?=${sectionKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|$)`,
      'gi'
    );

    const matches = Array.from(rawText.matchAll(keywordPattern));
    if (matches.length < 2) return false;

    matches.forEach((match, idx) => {
      const title = match[1].trim();
      const body = match[2].trim();
      const { actions, cleanText } = parseActionItems(body);
      const { proceedings, decisions } = splitDecisions(cleanText);

      minutes.push({
        id: `min-kw-${idx + 1}`,
        minuteNumber: String(idx + 1),
        title,
        discussion: textToHtml(proceedings),
        decisions: textToHtml(decisions),
        actionItems: actions,
        allToNote: /all\s+to\s+note/i.test(body),
        rawText: body,
      });
    });
    return minutes.length > 0;
  };

  // ── Strategy 3: Paragraph-based fallback ──
  const strategy3 = () => {
    // Split on double newlines
    const paragraphs = rawText.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 20);
    paragraphs.slice(0, 20).forEach((para, idx) => {
      const lines = para.split('\n');
      const title = lines[0].trim().substring(0, 80);
      const body = lines.slice(1).join('\n').trim();
      const { actions, cleanText } = parseActionItems(body || para);
      const { proceedings, decisions } = splitDecisions(cleanText);

      minutes.push({
        id: `min-p-${idx + 1}`,
        minuteNumber: String(idx + 1),
        title,
        discussion: textToHtml(proceedings || para),
        decisions: textToHtml(decisions),
        actionItems: actions,
        allToNote: false,
        rawText: para,
      });
    });
    return minutes.length > 0;
  };

  if (!strategy1()) {
    if (!strategy2()) {
      strategy3();
    }
  }

  return minutes;
};

// ─────────────────────────────────────────────
// Resolutions
// ─────────────────────────────────────────────

const extractResolutions = (text: string): string[] => {
  const resolutions: string[] = [];

  const section = text.match(/(?:Resolutions?|RESOLUTIONS?)[^\n]*\n([\s\S]+?)(?=Signatures?|Chairperson|$)/i);
  if (!section) return resolutions;

  for (const line of section[1].split('\n')) {
    const t = line.trim();
    if (!t || t.length < 5) continue;
    resolutions.push(t.replace(/^[\d\-•*.)]+\s*/, ''));
  }

  return resolutions;
};

export default { parseWordDocument };