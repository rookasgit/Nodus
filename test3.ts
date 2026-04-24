import { extractPartialField, parseAgentResponse } from './src/lib/streamExtractor.js';
const stream = '{"provocation": "Data confirms a €50k+ compliance floor, acting as a regressive tax on early-stage AI.", "full_analysis": "1. **Verified Data Points**: Compliance for high-risk AI costs €50k-€200k annually [1.1]."}';
console.log(parseAgentResponse(stream));
