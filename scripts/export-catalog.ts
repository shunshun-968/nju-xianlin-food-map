import {writeFile} from 'node:fs/promises';
import {catalog} from '../src/data/catalog';
await writeFile('data/demo-catalog.json',JSON.stringify(catalog,null,2));
console.log('Exported demo catalog. Not surveyed data.');
