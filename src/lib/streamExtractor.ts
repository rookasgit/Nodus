import { resilientJSONParse } from '../utils/jsonParser';

/**
 * Safely extracts a field value from a potentially incomplete JSON string.
 * This is designed for real-time streaming where the JSON structure is not yet complete.
 */
export function extractPartialField(text: string, fieldName: string): string {
  // Remove markdown code blocks if present
  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  const searchStr = `"${fieldName}":`;
  const startIndex = cleanText.indexOf(searchStr);
  if (startIndex === -1) return "";

  let valueStart = cleanText.indexOf('"', startIndex + searchStr.length);
  if (valueStart === -1) return "";
  valueStart += 1; // skip the opening quote

  // Find the end quote, but handle escaped quotes
  let valueEnd = -1;
  for (let i = valueStart; i < cleanText.length; i++) {
    if (cleanText[i] === '"' && (i === 0 || cleanText[i - 1] !== '\\')) {
      valueEnd = i;
      break;
    }
  }

  if (valueEnd === -1) {
    // Return everything from valueStart to the end of the current string
    // We also want to unescape common sequences for the real-time view
    return unescapeJsonString(cleanText.substring(valueStart));
  }

  return unescapeJsonString(cleanText.substring(valueStart, valueEnd));
}

/**
 * Safely parses the final agent response, handling text before/after JSON and fallback extraction.
 */
export function parseAgentResponse(fullText: string): { provocation: string, fullAnalysis: string } {
  let fullAnalysis = '';
  let provocation = fullText;

  // Helper to extract from object
  const extractFromObj = (obj: any) => {
    const p = obj.provocation || obj.maxim || obj.conclusion || obj.quote;
    const a = obj.full_analysis || obj.analysis || obj.strategic_observations;
    return { p, a };
  };

  try {
    // Try to find a JSON block
    const startIndex = fullText.indexOf('{');
    const endIndex = fullText.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonStr = fullText.substring(startIndex, endIndex + 1);
      const parsed = JSON.parse(jsonStr);
      const { p, a } = extractFromObj(Array.isArray(parsed) ? parsed[0] : parsed);
      
      if (p || a) {
        if (p) provocation = typeof p === 'string' ? p : JSON.stringify(p);
        if (a) {
          if (typeof a === 'object' && a !== null && !Array.isArray(a)) {
             fullAnalysis = Object.entries(a)
              .map(([key, value]) => `**${key.replace(/_/g, ' ').toUpperCase()}**\n${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`)
              .join('\n\n');
          } else {
             fullAnalysis = typeof a === 'string' ? a : JSON.stringify(a, null, 2);
          }
        }
        return { provocation, fullAnalysis };
      }
    }
    
    // Fallback to standard replace
    const cleanJson = fullText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    const { p, a } = extractFromObj(Array.isArray(parsed) ? parsed[0] : parsed);
    
    if (p || a) {
      if (p) provocation = typeof p === 'string' ? p : JSON.stringify(p);
      if (a) {
          if (typeof a === 'object' && a !== null && !Array.isArray(a)) {
             fullAnalysis = Object.entries(a)
              .map(([key, value]) => `**${key.replace(/_/g, ' ').toUpperCase()}**\n${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`)
              .join('\n\n');
          } else {
             fullAnalysis = typeof a === 'string' ? a : JSON.stringify(a, null, 2);
          }
      }
    }
  } catch (e) {
    // Fallback to partial extraction if parsing fails
    // Try multiple field names for provocation
    const pFields = ['provocation', 'maxim', 'conclusion', 'quote'];
    let partialProvocation = '';
    for (const field of pFields) {
      partialProvocation = extractPartialField(fullText, field);
      if (partialProvocation) break;
    }

    // Try multiple field names for analysis
    const aFields = ['full_analysis', 'analysis', 'strategic_observations'];
    let partialAnalysis = '';
    for (const field of aFields) {
      partialAnalysis = extractPartialField(fullText, field);
      if (partialAnalysis) break;
    }

    if (partialProvocation || partialAnalysis) {
      if (partialProvocation) provocation = partialProvocation;
      if (partialAnalysis) fullAnalysis = partialAnalysis;
    }
  }

  return { provocation, fullAnalysis };
}

/**
 * Safely parses the final synthesizer response.
 */
export function parseSynthesizerResponse(fullText: string): any {
  return resilientJSONParse(fullText);
}

/**
 * Basic unescaping for partial JSON strings to make them readable during streaming.
 */
function unescapeJsonString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}
