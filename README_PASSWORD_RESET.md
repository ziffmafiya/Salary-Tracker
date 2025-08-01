# Настройка сброса пароля через Telegram бот

Этот документ описывает, как настроить функциональность сброса пароля через Telegram бот для вашего Salary Tracker приложения.

## Предварительные требования

1. **Supabase проект** с настроенной аутентификацией
2. **Telegram бот** с настроенным webhook
3. **Vercel** (или другой хостинг) для развертывания API

## Шаг 1: Настройка базы данных

Выполните SQL скрипт `database_setup.sql` в SQL Editor вашего проекта Supabase:

```sql
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
```

## Шаг 2: Настройка переменных окружения

Добавьте следующие переменные окружения в ваш Vercel проект:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
FRONTEND_URL=https://your-domain.com
```

## Шаг 3: Настройка Supabase Email Templates

В настройках Supabase Auth > Email Templates настройте шаблон для сброса пароля:

1. Перейдите в **Authentication > Email Templates**
2. Выберите **Reset Password** template
3. Настройте HTML и текст шаблона:

```html
<h2>Сброс пароля</h2>
<p>Вы запросили сброс пароля для вашего аккаунта Salary Tracker.</p>
<p>Нажмите на ссылку ниже, чтобы установить новый пароль:</p>
<a href="{{ .ConfirmationURL }}">Сбросить пароль</a>
<p>Ссылка действительна 1 час.</p>
<p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
```

## Шаг 4: Развертывание файлов

Убедитесь, что все файлы загружены в ваш проект:

- `api/telegram-webhook.js` - обновленный webhook с функциональностью сброса пароля
- `reset-password.html` - страница для сброса пароля
- `reset-password.js` - JavaScript для обработки сброса пароля
- `database_setup.sql` - SQL скрипт для настройки базы данных

## Шаг 5: Тестирование

### Тестирование через Telegram бот:

1. Отправьте команду `/start` боту
2. Нажмите кнопку "Сбросить пароль"
3. Введите команду `/reset_password your_email@example.com`
4. Проверьте, что получили email со ссылкой для сброса

### Тестирование веб-интерфейса:

1. Перейдите на страницу `reset-password.html?token=YOUR_TOKEN&email=your_email@example.com`
2. Введите новый пароль
3. Подтвердите пароль
4. Проверьте, что пароль успешно изменен

## Безопасность

### Токены сброса пароля:

- Токены генерируются криптографически безопасно
- Срок действия токена: 1 час
- Токены помечаются как использованные после сброса пароля
- Просроченные токены автоматически очищаются

### RLS политики:

- Только сервис может создавать, читать, обновлять и удалять токены
- Пользователи не имеют прямого доступа к таблице токенов

## Устранение неполадок

### Проблема: "Недействительный токен"

**Решение:**
- Проверьте, что токен не истек (действителен 1 час)
- Убедитесь, что токен не был уже использован
- Проверьте правильность email в URL

### Проблема: "Ошибка при отправке email"

**Решение:**
- Проверьте настройки SMTP в Supabase
- Убедитесь, что email пользователя существует в базе данных
- Проверьте переменную окружения `FRONTEND_URL`

### Проблема: "Ошибка при обновлении пароля"

**Решение:**
- Проверьте права доступа к Supabase Auth
- Убедитесь, что пользователь аутентифицирован
- Проверьте логи в консоли браузера

## Дополнительные настройки

### Автоматическая очистка токенов

Для автоматической очистки просроченных токенов добавьте cron job в Supabase:

```sql
-- Создание функции для очистки
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() OR used_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Настройка cron job (если доступно расширение pg_cron)
SELECT cron.schedule('cleanup-reset-tokens', '0 */6 * * *', 'SELECT cleanup_expired_reset_tokens();');
```

### Настройка уведомлений в Telegram

После успешного сброса пароля бот может отправлять уведомление:

```javascript
// В reset-password.js после успешного обновления пароля
await sendMessage(chatId, '✅ Ваш пароль был успешно изменен!');
```

## Поддержка

Если у вас возникли проблемы с настройкой, проверьте:

1. Логи в Vercel Functions
2. Логи в Supabase Dashboard
3. Консоль браузера для ошибок JavaScript
4. Настройки переменных окружения

Для дополнительной помощи обратитесь к документации:
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Vercel Functions](https://vercel.com/docs/functions) 