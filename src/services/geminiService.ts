import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env';

// Instanciamos el SDK oficial de Google usando nuestra API Key
export const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

export const MODEL_NAME = 'gemini-3.5-flash-lite';