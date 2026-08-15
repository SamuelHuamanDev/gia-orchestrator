import express from 'express';
import { config } from './core/config/env';
import redisClient, { connectRedis } from './core/services/redisService';
import { ai } from './core/services/geminiService';
import { buscarVuelosDeclaration, executeBuscarVuelos } from './tools/flightSearch';
import { MODEL_NAME } from './core/services/geminiService';
import { systemInstruction } from './core/constants/systemInstruction';
import { FlightSearchCriteria } from './domain/flightSearch/entities';

const app = express();
app.use(express.json());

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
        const historyStr = await redisClient.get(`chat:${sessionId}`);
        const history = historyStr ? JSON.parse(historyStr) : [];

        // 2. Inicializar el Chat de Gemini con contexto y la Tool habilitada
        const chat = ai.chats.create({
            model: MODEL_NAME,
            history: history,
            config: {
                systemInstruction,
                tools: [{ functionDeclarations: [buscarVuelosDeclaration] }]
            }
        });

        // 3. Enviar el mensaje del usuario al modelo
        let response = await chat.sendMessage({ message });

        // 4. Interceptar: ¿El modelo decidió usar nuestra Tool de búsqueda?
        if (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0];

            if (call.name === 'buscarVuelos' && !!call.args) {
                // Ejecutamos la búsqueda en nuestros GDS simulados
                const vuelosResult = await executeBuscarVuelos(call.args as unknown as FlightSearchCriteria, sessionId);

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
        await redisClient.set(`chat:${sessionId}`, JSON.stringify(newHistory));

        const totalTime = Date.now() - startTime;
        console.log(`⏱️  Tiempo total del request: ${totalTime}ms`);

        // 6. Enviar la respuesta final al usuario
        res.json({ reply: response.text, processingTimeMs: totalTime });

    } catch (error) {
        console.error('❌ Error en el chat:', error);
        res.status(500).json({ error: 'Error procesando el mensaje' });
    }
});

// Arrancamos Redis y luego el servidor Express
connectRedis().then(() => {
    app.listen(config.port, () => {
        console.log(`Servidor escuchando en el puerto ${config.port}`);
    });
});
