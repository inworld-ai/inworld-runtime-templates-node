import * as process from 'node:process';

import * as dotenv from 'dotenv';

dotenv.config({ path: './__tests__/.env.test' });

process.env.INWORLD_ADDON_POOL_SIZE = '128';
process.env.DISABLE_TELEMETRY = 'true';
