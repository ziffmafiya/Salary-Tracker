-- SQL скрипт для настройки базы данных Salary Tracker
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase

-- Создание таблицы для токенов сброса пароля
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    telegram_chat_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Создание RLS (Row Level Security) политик
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Политика для вставки токенов (только сервис может создавать токены)
CREATE POLICY "Service can insert reset tokens" ON password_reset_tokens
    FOR INSERT WITH CHECK (true);

-- Политика для чтения токенов (только сервис может читать токены)
CREATE POLICY "Service can read reset tokens" ON password_reset_tokens
    FOR SELECT USING (true);

-- Политика для обновления токенов (только сервис может обновлять токены)
CREATE POLICY "Service can update reset tokens" ON password_reset_tokens
    FOR UPDATE USING (true);

-- Политика для удаления токенов (только сервис может удалять токены)
CREATE POLICY "Service can delete reset tokens" ON password_reset_tokens
    FOR DELETE USING (true);

-- Функция для очистки просроченных токенов
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() OR used_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Создание cron job для автоматической очистки просроченных токенов (если у вас есть расширение pg_cron)
-- SELECT cron.schedule('cleanup-reset-tokens', '0 */6 * * *', 'SELECT cleanup_expired_reset_tokens();');

-- Комментарии к таблице
COMMENT ON TABLE password_reset_tokens IS 'Таблица для хранения токенов сброса пароля через Telegram бот';
COMMENT ON COLUMN password_reset_tokens.email IS 'Email пользователя, запросившего сброс пароля';
COMMENT ON COLUMN password_reset_tokens.token IS 'Уникальный токен для сброса пароля';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Время истечения токена';
COMMENT ON COLUMN password_reset_tokens.telegram_chat_id IS 'ID чата Telegram, откуда был запрошен сброс';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Время использования токена (NULL если не использован)'; 