"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = void 0;
const redis_1 = require("redis");
const redisClient = (0, redis_1.createClient)();
// Capturamos errores para que no crashee la aplicación
redisClient.on('error', (err) => console.error('❌ Error en Redis:', err));
// Función para conectar a la base de datos
const connectRedis = async () => {
    await redisClient.connect();
    console.log('🔗 Conectado a Redis correctamente');
};
exports.connectRedis = connectRedis;
exports.default = redisClient;
