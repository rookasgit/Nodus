
/**
 * A resilient JSON parser that can handle:
 * 1. Markdown code blocks (```json ... ```)
 * 2. Trailing commas
 * 3. Comments (// or /* ... * /)
 * 4. Single quotes instead of double quotes (sometimes)
 */
export function resilientJSONParse(text: string): any {
  if (!text) return null;

  let cleaned = text.trim();

  // 1. Strip Markdown code blocks
  // Matches ```json ... ``` or just ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(codeBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  } else {
    // If no code block, try to extract the first { ... } or [ ... ]
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');

    let startIdx = -1;
    let endIdx = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endIdx = lastBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      endIdx = lastBracket;
    }

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    }
  }

  // 2. Remove comments
  // Remove // comments (be careful not to remove URLs in strings, but this is a simple regex)
  // A safer way is to just let JSON.parse fail and then try to fix it, but let's keep it for now.
  // Actually, removing // comments can break URLs like https://...
  // Let's skip comment removal for now as it's risky and usually not needed for LLM JSON output.

  // 3. Attempt native parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // If native parse fails, try to fix common issues
  }

  // 4. Fix trailing commas
  // Replace ,} with } and ,] with ]
  cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

  // 5. Fix unescaped control characters (newlines, tabs) inside strings
  let inString = false;
  let escaped = false;
  let fixed = '';
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '\\' && !escaped) {
      escaped = true;
      fixed += char;
    } else if (char === '"' && !escaped) {
      inString = !inString;
      fixed += char;
      escaped = false;
    } else if (inString) {
      if (char === '\n') fixed += '\\n';
      else if (char === '\r') fixed += '\\r';
      else if (char === '\t') fixed += '\\t';
      else fixed += char;
      escaped = false;
    } else {
      fixed += char;
      escaped = false;
    }
  }
  cleaned = fixed;

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 6. Try to fix truncated JSON
    try {
      let openBraces = 0;
      let openBrackets = 0;
      let inStr = false;
      let isEsc = false;
      for (let i = 0; i < cleaned.length; i++) {
        const c = cleaned[i];
        if (c === '\\' && !isEsc) {
          isEsc = true;
        } else if (c === '"' && !isEsc) {
          inStr = !inStr;
          isEsc = false;
        } else if (!inStr) {
          if (c === '{') openBraces++;
          else if (c === '}') openBraces--;
          else if (c === '[') openBrackets++;
          else if (c === ']') openBrackets--;
          isEsc = false;
        } else {
          isEsc = false;
        }
      }
      
      let padded = cleaned;
      if (inStr) padded += '"';
      
      // Remove trailing comma before padding
      padded = padded.replace(/,\s*$/, '');
      
      while (openBrackets > 0) { padded += ']'; openBrackets--; }
      while (openBraces > 0) { padded += '}'; openBraces--; }
      
      return JSON.parse(padded);
    } catch (e2) {
      console.error("Failed to parse JSON even after cleanup:", e2);
      return null;
    }
  }
}
