import { extractPartialField } from './src/lib/streamExtractor.js';
const stream = '{"provocation": "Compliance costs of €50k-€200k annually", "full_analysis": "1. **Verified Data Points**: Compliance for high-risk AI costs €50k-€200k annually [1.1]."}';
console.log(extractPartialField(stream, 'full_analysis'));
