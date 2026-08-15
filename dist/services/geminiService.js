"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_NAME = exports.ai = void 0;
const genai_1 = require("@google/genai");
const env_1 = require("../config/env");
// Instanciamos el SDK oficial de Google usando nuestra API Key
exports.ai = new genai_1.GoogleGenAI({ apiKey: env_1.config.geminiApiKey });
exports.MODEL_NAME = 'gemini-3.5-flash-lite';
