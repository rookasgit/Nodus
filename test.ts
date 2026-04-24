import { resilientJSONParse } from './src/utils/jsonParser.js';

const res = resilientJSONParse('{"provocation": "Compliance costs of €50k-€200k annually create a measurable capital barrier, not a guaranteed moat."}');
console.log(res);
