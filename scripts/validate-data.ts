import { catalog } from '../src/data/catalog';
import { validateCatalog } from '../src/domain';
const errors = validateCatalog(catalog);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Valid: ${catalog.venues.length} venues / ${catalog.floors.length} floors / ${catalog.stalls.length} stalls. All positions are schematic.`,
  );
