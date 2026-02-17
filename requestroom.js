const { pool } = require('../database/postgres');
const logger = require('../utils/logger');

class RoomController {
    /**
     * GET /api/room/current
     * Возвращает текущее состояние комнаты
     */
    async getCurrentRoom(req, res) {
        try {
            // 1. Получаем всех онлайн персонажей
            const charactersQuery = await pool.query(
                `SELECT 
                    c.id, c.name, c.avatar_url, 
                    c.current_mood, c.mood_value,
                    c.last_active
                FROM characters c
                WHERE c.status = 'online' 
                AND c.current_room = 'main-hall'
                ORDER BY c.last_active DESC`
            );

            // 2. Получаем последние 50 сообщений
            const messagesQuery = await pool.query(
                `SELECT 
                    m.id, m.character_id, m.content, 
                    m.emotion_context, m.created_at,
                    c.name as character_name, c.avatar_url
                FROM messages m
                JOIN characters c ON c.id = m.character_id
                WHERE m.room_id = 'main-hall'
                ORDER BY m.created_at DESC
                LIMIT 50`
            );

            // 3. Получаем статистику комнаты
            const statsQuery = await pool.query(
                `SELECT 
                    COUNT(DISTINCT character_id) as total_participants,
                    COUNT(*) as total_messages,
                    MAX(created_at) as last_message_time
                FROM messages
                WHERE room_id = 'main-hall'
                AND created_at > NOW() - INTERVAL '1 hour'`
            );

            // Формируем ответ
            const response = {
                room: {
                    id: 'main-hall',
                    name: 'Главный зал',
                    online_count: charactersQuery.rows.length,
                    characters: charactersQuery.rows,
                    recent_messages: messagesQuery.rows.reverse(), // переворачиваем для хронологии
                    stats: statsQuery.rows[0]
                },
                timestamp: new Date().toISOString()
            };

            logger.info(`📊 Отправлены данные комнаты (${charactersQuery.rows.length} персонажей)`);
            res.json(response);

        } catch (error) {
            logger.error('Ошибка в getCurrentRoom:', error);
            res.status(500).json({ error: 'Не удалось получить данные комнаты' });
        }
    }

    /**
     * GET /api/room/stats
     * Возвращает статистику комнаты
     */
    async getRoomStats(req, res) {
        try {
            const stats = await pool.query(
                `SELECT 
                    COUNT(DISTINCT c.id) as total_characters,
                    COUNT(DISTINCT CASE WHEN c.status = 'online' THEN c.id END) as online_now,
                    COUNT(m.id) as total_messages_all_time,
                    COUNT(DISTINCT m.character_id) as active_today,
                    AVG(c.mood_value) as average_mood
                FROM characters c
                LEFT JOIN messages m ON m.character_id = c.id 
                    AND m.created_at > NOW() - INTERVAL '24 hours'
                WHERE c.current_room = 'main-hall'`
            );

            res.json({
                stats: stats.rows[0],
                period: '24h'
            });

        } catch (error) {
            logger.error('Ошибка в getRoomStats:', error);
            res.status(500).json({ error: 'Не удалось получить статистику' });
        }
    }
}

module.exports = new RoomController();