import { parseDocument } from 'yaml';
const doc = parseDocument('translation:\n  ');
console.dir(doc.contents.items[0], { depth: null });
console.log('offset:', 15);
