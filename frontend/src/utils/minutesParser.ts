// minutesParser.ts
import * as mammoth from 'mammoth';

export interface MinuteEntry {
  id: string;
  minuteNumber: string;
  title: string;
  proceedings: string;
  actionItems: string[];
  allToNote: boolean;
  rawText: string;
}

export interface ParsedMinutes {
  meetingInfo: {
    subject?: string;
    date?: string;
    time?: string;
    location?: string;
    recordedBy?: string;
  };
  attendees: Array<{
    name: string;
    designation?: string;
    organization?: string;
    telephone?: string;
  }>;
  agenda: string[];
  minutes: MinuteEntry[];
  resolutions: string[];
}

export const parseWordDocument = async (file: File): Promise<ParsedMinutes> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    
    // Parse the text into structured minutes
    const parsedMinutes = extractStructuredData(text);
    
    return parsedMinutes;
  } catch (error) {
    console.error('Error parsing document:', error);
    throw new Error('Failed to parse document');
  }
};

const extractStructuredData = (text: string): ParsedMinutes => {
  const lines = text.split('\n').filter(line => line.trim());
  const fullText = text;
  
  const result: ParsedMinutes = {
    meetingInfo: {},
    attendees: [],
    agenda: [],
    minutes: [],
    resolutions: []
  };
  
  // Extract meeting metadata
  result.meetingInfo = extractMeetingInfo(fullText);
  
  // Extract attendees from tables or lists
  result.attendees = extractAttendees(fullText);
  
  // Extract agenda items
  result.agenda = extractAgenda(fullText);
  
  // Extract minutes (Min 1:, Minute 1:, 1., etc.)
  result.minutes = extractMinutes(fullText);
  
  // Extract resolutions
  result.resolutions = extractResolutions(fullText);
  
  return result;
};

// Extract meeting metadata
const extractMeetingInfo = (text: string) => {
  const info: any = {};
  
  // Subject
  const subjectMatch = text.match(/SUBJECT:?\s*(.+?)(?=\n|$)/i);
  if (subjectMatch) info.subject = subjectMatch[1].trim();
  
  // Date
  const dateMatch = text.match(/Date:?\s*([0-9]{2}[./][0-9]{2}[./][0-9]{4})/i);
  if (dateMatch) info.date = dateMatch[1].trim();
  
  // Time
  const timeMatch = text.match(/Time:?\s*([0-9:APM\s]+)/i);
  if (timeMatch) info.time = timeMatch[1].trim();
  
  // Location
  const locationMatch = text.match(/Location:?\s*(.+?)(?=\n|$)/i);
  if (locationMatch) info.location = locationMatch[1].trim();
  
  // Recorded by
  const recordedMatch = text.match(/Recorded by:?\s*(.+?)(?=\n|$)/i);
  if (recordedMatch) info.recordedBy = recordedMatch[1].trim();
  
  return info;
};

// Extract attendees from various formats
const extractAttendees = (text: string) => {
  const attendees: any[] = [];
  
  // Pattern for attendee tables/lists
  const attendeePattern = /([A-Za-z\s]+?)\s+(Director|Manager|Officer|MIS|DBA|UNHCR|OPM|MLAS|MDPP|Executive Director|Chair|Secretary)[^\n]+/g;
  let match;
  
  while ((match = attendeePattern.exec(text)) !== null) {
    attendees.push({
      name: match[1].trim(),
      designation: match[2].trim(),
      organization: extractOrganization(match[0])
    });
  }
  
  return attendees.slice(0, 30); // Limit to 30 attendees
};

// Extract agenda items
const extractAgenda = (text: string) => {
  const agenda: string[] = [];
  
  // Find agenda section
  const agendaSection = text.match(/Agenda[\s#]*\n([\s\S]+?)(?=Proceedings|Minute|$)/i);
  if (agendaSection) {
    const lines = agendaSection[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && /^\d+\./.test(trimmed)) {
        agenda.push(trimmed.replace(/^\d+\./, '').trim());
      } else if (trimmed && (trimmed.includes('Prayer') || trimmed.includes('Introduction'))) {
        agenda.push(trimmed);
      }
    }
  }
  
  return agenda;
};

// MAIN FUNCTION: Extract individual minutes
const extractMinutes = (text: string): MinuteEntry[] => {
  const minutes: MinuteEntry[] = [];
  
  // Pattern for different minute formats:
  // - "Min 1:", "Min 1:", "Minute 1:", "MINUTE NO 1"
  // - "Min 1: NIR/13/04/23" (with reference number)
  // - "1. Title" (numbered list)
  const minutePatterns = [
    /Min(?:ute)?\s+(\d+)[:\s]+(.*?)(?=Min(?:ute)?\s+\d+:|$)/gis,
    /MINUTE\s+NO\s+(\d+)[:\s]+(.*?)(?=MINUTE\s+NO\s+\d+:|$)/gis,
    /^\s*(\d+)\.\s+(.*?)(?=^\s*\d+\.|$)/gmis
  ];
  
  let matched = false;
  
  // Try each pattern
  for (const pattern of minutePatterns) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) {
      for (const match of matches) {
        const minuteNum = match[1];
        let content = match[2].trim();
        
        // Extract title (first line of content)
        const lines = content.split('\n');
        const title = lines[0].trim();
        const proceedingText = lines.slice(1).join('\n').trim();
        
        // Extract action items
        const actionItems: string[] = [];
        const actionMatch = proceedingText.match(/Action[:\s]*(.*?)(?=\n\n|\n[A-Z]|$)/is);
        if (actionMatch) {
          const actions = actionMatch[1].split(/\n/);
          for (const action of actions) {
            if (action.trim()) {
              actionItems.push(action.trim());
            }
          }
        }
        
        // Check for "ALL TO NOTE"
        const allToNote = /all\s+to\s+note/i.test(proceedingText);
        
        // Remove action text from proceeding
        let finalProceedings = proceedingText;
        if (actionMatch) {
          finalProceedings = proceedingText.substring(0, actionMatch.index).trim();
        }
        
        minutes.push({
          id: `min-${minuteNum}`,
          minuteNumber: minuteNum,
          title: title,
          proceedings: finalProceedings || title,
          actionItems: actionItems,
          allToNote: allToNote,
          rawText: content
        });
      }
      matched = true;
      break;
    }
  }
  
  // If no minutes found with patterns, try to find by common keywords
  if (!matched) {
    const minuteKeywords = ['Prayer', 'Communication', 'Discussion', 'Resolution'];
    let currentMinute: Partial<MinuteEntry> | null = null;
    let minuteCounter = 1;
    
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Check if this line starts a new minute section
      const isNewMinute = minuteKeywords.some(keyword => 
        trimmed.toLowerCase().startsWith(keyword.toLowerCase()) ||
        trimmed.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (isNewMinute && trimmed.length < 100) {
        if (currentMinute && currentMinute.title) {
          minutes.push({
            id: `min-${minuteCounter}`,
            minuteNumber: minuteCounter.toString(),
            title: currentMinute.title,
            proceedings: currentMinute.proceedings || '',
            actionItems: currentMinute.actionItems || [],
            allToNote: currentMinute.allToNote || false,
            rawText: currentMinute.rawText || ''
          });
          minuteCounter++;
        }
        
        currentMinute = {
          title: trimmed,
          proceedings: '',
          actionItems: [],
          rawText: ''
        };
      } else if (currentMinute) {
        currentMinute.proceedings += (currentMinute.proceedings ? '\n' : '') + trimmed;
        currentMinute.rawText += (currentMinute.rawText ? '\n' : '') + trimmed;
      }
    }
    
    // Add last minute
    if (currentMinute && currentMinute.title) {
      minutes.push({
        id: `min-${minuteCounter}`,
        minuteNumber: minuteCounter.toString(),
        title: currentMinute.title,
        proceedings: currentMinute.proceedings || '',
        actionItems: currentMinute.actionItems || [],
        allToNote: currentMinute.allToNote || false,
        rawText: currentMinute.rawText || ''
      });
    }
  }
  
  return minutes;
};

// Extract resolutions
const extractResolutions = (text: string): string[] => {
  const resolutions: string[] = [];
  
  // Find resolutions section
  const resolutionMatch = text.match(/Resolutions?[\s#]*\n([\s\S]+?)(?=Signatures|Chairperson|$)/i);
  if (resolutionMatch) {
    const lines = resolutionMatch[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && /^[\d\-•*]/.test(trimmed)) {
        resolutions.push(trimmed.replace(/^[\d\-•*]\s*/, ''));
      } else if (trimmed && trimmed.length > 10 && !trimmed.includes(':')) {
        resolutions.push(trimmed);
      }
    }
  }
  
  return resolutions;
};

// Helper: Extract organization from text
const extractOrganization = (text: string): string => {
  const orgs = ['UNHCR', 'OPM', 'NIRA', 'UNDP', 'UNICEF', 'WFP', 'WHO', 'UN'];
  for (const org of orgs) {
    if (text.includes(org)) return org;
  }
  return '';
};

export default { parseWordDocument };