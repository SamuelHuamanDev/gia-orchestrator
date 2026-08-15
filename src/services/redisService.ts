import { createClient } from 'redis';

const redisClient = createClient();

// Capturamos errores para que no crashee la aplicación
redisClient.on('error', (err) => console.error('❌ Error en Redis:', err));

// Función para conectar a la base de datos
export const connectRedis = async () => {
    await redisClient.connect();
    console.log('🔗 Conectado a Redis correctamente');
};

export default redisClient;