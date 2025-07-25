import dotenv from 'dotenv'

dotenv.config()

const config = {
    API_KEY: process.env.API_KEY,
    WEBHOOK_SECRET: process.env.BITNOB_WEBHOOK_SECRET,
    WEBHOOK_URL: process.env.BITNOB_WEBHOOK_URL
}

export default config;