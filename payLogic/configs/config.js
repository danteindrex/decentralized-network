import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

config = {
    API_KEY: process.env.API_KEY,
    WEBHOOK_SECRET: process.env.BITNOB_WEBHOOK_SECRET,
    WEBHOOK_URL: process.env.BITNOB_WEBHOOK_URL
}

export default config;