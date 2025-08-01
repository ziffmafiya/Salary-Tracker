# Salary Tracker

Salary Tracker — это простое веб-приложение для отслеживания вашей зарплаты, отработанных часов и анализа доходов. Данные хранятся в базе данных Supabase, что обеспечивает их сохранность и доступность с любого устройства.

## Особенности

-   **Отслеживание доходов:** Добавляйте записи о зарплате и отработанных часах за каждый месяц.
-   **Управление работами:** Создавайте несколько профилей работ с разными базовыми ставками.
-   **Расширенная аналитика:** Просматривайте общую статистику по доходам, часам и средней ставке. Настройки аналитики теперь по умолчанию включают все работы при загрузке страницы.
-   **Визуализация:** Интерактивный график для визуализации доходов или почасовой ставки с течением времени.
-   **Безопасность:** Данные хранятся в вашей личной базе данных Supabase и защищены аутентификацией.
-   **Интеграция с Telegram-ботом:** Добавляйте записи о зарплате и получайте статистику/графики через Telegram-бота.
-   **Миграция данных:** Возможность переноса данных из локального хранилища при первом запуске.
-   **Темы:** Светлая и темная темы оформления.

## Настройка и запуск

Для запуска проекта выполните следующие шаги:

### 1. Настройте Supabase

-   Создайте новый проект на [Supabase](https://supabase.com/).
-   Перейдите в настройки проекта -> **API**. Скопируйте **Project URL** и **anon (public) key**.
-   Перейдите в **SQL Editor** и выполните следующий скрипт для создания таблиц и настройки политик безопасности:

```sql
-- Создание таблицы jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    base_rate FLOAT8 NOT NULL,
    base_hours FLOAT8 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Создание таблицы entries
CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    month TEXT NOT NULL,
    salary FLOAT8 NOT NULL,
    hours FLOAT8 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Включение Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Политики для таблицы jobs
CREATE POLICY "Разрешить пользователям управлять своими работами"
ON jobs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Политики для таблицы entries
CREATE POLICY "Разрешить пользователям управлять своими записями"
ON entries
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Создание таблицы telegram_users для связывания аккаунтов
CREATE TABLE telegram_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
    telegram_chat_id BIGINT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Включение Row Level Security для telegram_users
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

-- Политики для таблицы telegram_users
CREATE POLICY "Разрешить пользователям управлять своими связями с Telegram"
ON telegram_users
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### 2. Настройте переменные окружения

-   Создайте файл `.env` в корневой директории проекта и добавьте следующие переменные:
    ```
    SUPABASE_URL="ВАШ_SUPABASE_URL"
    SUPABASE_ANON_KEY="ВАШ_SUPABASE_ANON_KEY"
    TELEGRAM_BOT_TOKEN="ВАШ_ТОКЕН_ТЕЛЕГРАМ_БОТА"
    ```
    Эти переменные будут использоваться для подключения к вашей базе данных Supabase и для работы Telegram-бота.

-   **Для развертывания на Vercel:**
    Если вы развертываете проект на Vercel, вам необходимо настроить `SUPABASE_URL`, `SUPABASE_ANON_KEY` и `TELEGRAM_BOT_TOKEN` как Environment Variables в настройках вашего проекта Vercel. Это обеспечит безопасное хранение ваших ключей и доступ к ним в производственной среде.

### 3. Запустите приложение

-   Просто откройте файл `index.html` в вашем любимом браузере.

### 4. Настройте Telegram-бота (для Vercel)

-   После развертывания проекта на Vercel, ваш Telegram-бот будет доступен по URL: `https://<ваш-домен-vercel>/api/telegram-webhook`.
-   Установите этот URL как вебхук для вашего бота, открыв в браузере следующую ссылку, заменив `<ВАШ_ТОКЕН_БОТА>` и `<ВАШ_ДОМЕН_VERCEL>` на свои значения:

    `https://api.telegram.org/bot<ВАШ_ТОКЕН_БОТА>/setWebhook?url=https://<ВАШ_ДОМЕН_VERCEL>/api/telegram-webhook`

    Пример: `https://api.telegram.org/bot123456:ABC-DEF/setWebhook?url=https://salary-tracker.vercel.app/api/telegram-webhook`

    После успешной установки вебхука вы должны увидеть сообщение `{"ok":true,"result":true,"description":"Webhook was set"}`.

## Как использовать

1.  **Регистрация/Вход:** При первом посещении создайте аккаунт или войдите, если он у вас уже есть.
2.  **Добавление работ:** Перейдите в "Job Settings" и добавьте свои места работы, указав базовую ставку и часы.
3.  **Добавление записей:** В форме "Add Salary Data" вносите данные о зарплате за каждый месяц.
4.  **Анализ:** Просматривайте статистику и графики для анализа своих доходов. Настройки аналитики теперь по умолчанию включают все работы при загрузке страницы.
5.  **Использование Telegram-бота:**
    *   Начните чат с ботом и используйте команду `/start`.
    *   Авторизуйтесь с помощью команды: `/login <ваш_email> <ваш_пароль>` (используйте email и пароль, которые вы используете для входа на сайт).
    *   После авторизации вы можете использовать следующие команды:
        *   `/jobs`: Показать список ваших работ.
        *   `/add_salary <название_работы> <месяц_ГГГГ-ММ> <зарплата> <часы>`: Добавить или обновить запись о зарплате.
        *   `/stats`: Получить общую статистику по доходам, часам и средней ставке, а также сравнение с предыдущим месяцем.
        *   `/graph [hourly]`: Получить график месячного дохода (по умолчанию) или почасовой ставки (если указано `hourly`).
        *   `/logout`: Отвязать ваш Telegram-аккаунт от аккаунта Supabase.

## Улучшения

Внесены следующие исправления и улучшения:

-   **Исправлена ошибка `this.getAnalyticsSummary is not a function`**: Добавлена отсутствующая функция `getAnalyticsSummary`.
-   **Исправлено отображение данных**: Обеспечено корректное преобразование `job_id` в `jobId` при загрузке, добавлении и редактировании записей, что решает проблему с пустыми разделами аналитики и истории зарплат.
-   **Исправлено отображение `NaN`**: Добавлены проверки на деление на ноль и некорректные числовые значения в расчетах "Salary Diff" и "Rate Diff".
-   **Автоматический выбор всех работ в Analytics Settings**: При загрузке страницы в настройках аналитики теперь автоматически выбираются все доступные работы.
