import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: process.env.PORT || 3000,
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    mvSubscriptionKey: '669f9ad39d2943f6908522d00254fa32',
};
