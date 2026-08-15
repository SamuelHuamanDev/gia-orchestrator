"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const env_1 = require("./config/env");
const redisService_1 = __importStar(require("./services/redisService"));
const geminiService_1 = require("./services/geminiService");
const flightSearch_1 = require("./tools/flightSearch");
const geminiService_2 = require("./services/geminiService");
// Inicializamos la aplicación de Express
const app = (0, express_1.default)();
// Middleware para que Express pueda leer JSON en el body de las peticiones HTTP
app.use(express_1.default.json());
// Endpoint básico para comprobar que nuestro backend está vivo (Healthcheck)
app.get('/health', (_, res) => {
    res.json({ status: 'ok', message: '🚀 GIA Backend PoC está corriendo' });
});
app.post('/chat', async (req, res) => {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
        return res.status(400).json({ error: 'Faltan parámetros: sessionId y message' });
    }
    try {
        const startTime = Date.now();
        // 1. Recuperar historial de conversación desde Redis
        const historyStr = await redisService_1.default.get(`chat:${sessionId}`);
        const history = historyStr ? JSON.parse(historyStr) : [];
        // 2. Inicializar el Chat de Gemini con contexto y la Tool habilitada
        const chat = geminiService_1.ai.chats.create({
            model: geminiService_2.MODEL_NAME,
            history: history,
            config: {
                systemInstruction: "Eres GIA, la asistente virtual B2B de Agil Smart. Tu labor es ayudar a los agentes de viaje a cotizar vuelos. Eres concisa, amable y profesional. Si el usuario pide cotizar un vuelo, asegúrate de tener origen, destino y fecha de salida antes de buscar. Si falta algún dato, pídelo.",
                tools: [{ functionDeclarations: [flightSearch_1.buscarVuelosDeclaration] }]
            }
        });
        // 3. Enviar el mensaje del usuario al modelo
        let response = await chat.sendMessage({ message });
        // 4. Interceptar: ¿El modelo decidió usar nuestra Tool de búsqueda?
        if (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0];
            if (call.name === 'buscarVuelos') {
                // Ejecutamos la búsqueda en nuestros GDS simulados
                const vuelosResult = await (0, flightSearch_1.executeBuscarVuelos)(call.args);
                // Le devolvemos los resultados de la API al modelo
                response = await chat.sendMessage({
                    message: [{
                            functionResponse: {
                                name: 'buscarVuelos',
                                response: { vuelos: vuelosResult }
                            }
                        }]
                });
            }
        }
        // 5. Guardar el historial actualizado en Redis para el próximo mensaje
        const newHistory = await chat.getHistory();
        await redisService_1.default.set(`chat:${sessionId}`, JSON.stringify(newHistory));
        const totalTime = Date.now() - startTime;
        console.log(`⏱️  Tiempo total del request: ${totalTime}ms`);
        // 6. Enviar la respuesta final al usuario
        res.json({ reply: response.text, processingTimeMs: totalTime });
    }
    catch (error) {
        console.error('❌ Error en el chat:', error);
        res.status(500).json({ error: 'Error procesando el mensaje' });
    }
});
// Arrancamos Redis y luego el servidor Express
(0, redisService_1.connectRedis)().then(() => {
    app.listen(env_1.config.port, () => {
        console.log(`Servidor escuchando en el puerto ${env_1.config.port}`);
    });
});
