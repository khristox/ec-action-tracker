import * as mammoth from 'mammoth';

export const parseWordDocument = async (file) => {
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

const extractStructuredData = (text) => {
  const lines = text.split('\n').filter(line => line.trim());
  
  const minutes = {
    topic: '',
    discussion: '',
    decisions: '',
    actions: []
  };
  
  // Try to find topic (usually first few lines)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line.length > 5 && line.length < 200 && !line.match(/^(date|time|location|attendee)/i)) {
      minutes.topic = line;
      break;
    }
  }
  
  // Find discussion and decisions sections
  let currentSection = null;
  let discussionLines = [];
  let decisionsLines = [];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('discussion') || lowerLine.includes('agenda') || lowerLine.includes('key points')) {
      currentSection = 'discussion';
      continue;
    }
    
    if (lowerLine.includes('decision') || lowerLine.includes('resolution') || lowerLine.includes('conclusion')) {
      currentSection = 'decisions';
      continue;
    }
    
    if (lowerLine.includes('action item') || lowerLine.includes('action point') || line.match(/^\d+\./)) {
      if (line.match(/^\d+\./)) {
        minutes.actions.push({ description: line.replace(/^\d+\./, '').trim() });
      } else if (lowerLine.includes('action')) {
        const actionText = line.replace(/action item:?/i, '').trim();
        if (actionText) minutes.actions.push({ description: actionText });
      }
      continue;
    }
    
    if (currentSection === 'discussion' && line.trim()) {
      discussionLines.push(line);
    } else if (currentSection === 'decisions' && line.trim()) {
      decisionsLines.push(line);
    }
  }
  
  minutes.discussion = discussionLines.length > 0 
    ? `<p>${discussionLines.join('</p><p>')}</p>`
    : '<p></p>';
    
  minutes.decisions = decisionsLines.length > 0
    ? `<p>${decisionsLines.join('</p><p>')}</p>`
    : '<p></p>';
  
  if (!minutes.topic) {
    minutes.topic = 'Imported Meeting Minutes';
  }
  
  return minutes;
};