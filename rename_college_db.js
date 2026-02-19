
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { run } from './backend/src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

async function renameCollege() {
    try {
        console.log('🚀 Updating college name in system_settings...');

        await run(
            "UPDATE system_settings SET value = 'Beautex Technical Training College' WHERE key = 'college_name'"
        );

        await run(
            "UPDATE system_settings SET value = 'BTTC' WHERE key = 'college_abbr'"
        );

        console.log('✅ College name updated to "Beautex Technical Training College"');
        console.log('✅ College abbreviation updated to "BTTC"');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating college name:', error);
        process.exit(1);
    }
}

renameCollege();
