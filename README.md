# Salary Tracker

Salary Tracker — это простое веб-приложение для отслеживания вашей зарплаты, отработанных часов и анализа доходов. Данные хранятся в базе данных Supabase, что обеспечивает их сохранность и доступность с любого устройства.

## Особенности

-   **Отслеживание доходов:** Добавляйте записи о зарплате и отработанных часах за каждый месяц.
-   **Управление работами:** Создавайте несколько профилей работ с разными базовыми ставками.
-   **Расширенная аналитика:** Просматривайте общую статистику по доходам, часам и средней ставке. Настройки аналитики теперь по умолчанию включают все работы при загрузке страницы.
-   **Визуализация:** Интерактивный график для визуализации доходов или почасовой ставки с течением времени.
-   **Безопасность:** Данные хранятся в вашей личной базе данных Supabase и защищены аутентификацией.
-   **Миграция данных:** Возможность переноса данных из локального хранилища при первом запуске.
-   **Темы:** Светлая и темная темы оформления.
-   **Интеграция с Telegram:** Добавляйте записи о зарплате, получайте статистику и графики прямо из Telegram-бота.

## Настройка и запуск

Для запуска проекта выполните следующие шаги:

### 1. Настройте Supabase

-   Создайте новый проект на [Supabase](https://supabase.com/).
-   Перейдите в настройки проекта -> **API**. Скопируйте **Project URL** и **anon (public) key**.
-   Перейдите в **SQL Editor** и выполните следующие скрипты для создания таблиц и настройки политик безопасности:

    **Основные таблицы (`jobs`, `entries`):**
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
    ```

    **Таблицы для интеграции с Telegram:**
    ```sql
    -- Создание таблицы telegram_users для связывания Telegram ID с user_id
    CREATE TABLE telegram_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
        telegram_id BIGINT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Включение Row Level Security
    ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

    -- Политики для таблицы telegram_users
    CREATE POLICY "Разрешить пользователям управлять своими связями с Telegram"
    ON telegram_users
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

    -- Создание таблицы link_codes для временных кодов связывания
    CREATE TABLE link_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Включение Row Level Security
    ALTER TABLE link_codes ENABLE ROW LEVEL SECURITY;

    -- Политики для таблицы link_codes
    CREATE POLICY "Разрешить пользователям создавать свои коды связывания"
    ON link_codes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Разрешить пользователям читать свои коды связывания"
    ON link_codes
    FOR SELECT
    USING (auth.uid() = user_id);

    CREATE POLICY "Разрешить удаление истекших или использованных кодов"
    ON link_codes
    FOR DELETE
    USING (true); -- Удаление может быть выполнено ботом или по истечении срока
    ```

### 2. Настройте переменные окружения

-   Создайте файл `.env` в корневой директории проекта и добавьте следующие переменные:
    ```
    SUPABASE_URL="ВАШ_SUPABASE_URL"
    SUPABASE_ANON_KEY="ВАШ_SUPABASE_ANON_KEY"
    ```
    Эти переменные будут использоваться для подключения к вашей базе данных Supabase.

-   **Для развертывания на Vercel:**
    Если вы развертываете проект на Vercel, вам необходимо настроить следующие Environment Variables в настройках вашего проекта Vercel:
    *   `SUPABASE_URL`
    *   `SUPABASE_ANON_KEY`
    *   `TELEGRAM_BOT_TOKEN`: Токен вашего Telegram-бота, полученный от BotFather.
    *   `VERCEL_URL`: URL вашего развернутого приложения на Vercel (например, `https://your-app-name.vercel.app`).

### 3. Установите зависимости

-   В корневой директории проекта выполните:
    ```bash
    npm install
    ```

### 4. Запустите приложение

-   **Веб-приложение:** Просто откройте файл `index.html` в вашем любимом браузере.
-   **Telegram-бот (после развертывания на Vercel):**
    1.  Разверните обновленное приложение на Vercel.
    2.  Установите вебхук Telegram, открыв в браузере следующий URL (замените `https://salary-tracker-eight.vercel.app` на ваш `VERCEL_URL`):
        ```
        https://salary-tracker-eight.vercel.app/api/telegram-webhook
        ```
        Вы должны увидеть сообщение об успешной установке вебхука.

## Как использовать

1.  **Регистрация/Вход:** При первом посещении создайте аккаунт или войдите, если он у вас уже есть.
2.  **Добавление работ:** Перейдите в "Job Settings" и добавьте свои места работы, указав базовую ставку и часы.
3.  **Добавление записей:** В форме "Add Salary Data" вносите данные о зарплате за каждый месяц.
4.  **Анализ:** Просматривайте статистику и графики для анализа своих доходов.
5.  **Связывание с Telegram:**
    *   В веб-приложении перейдите в секцию "Telegram Integration" и нажмите "Link Telegram Account".
    *   Скопируйте сгенерированный код (например, `/link ABCDEF`).
    *   Отправьте этот код вашему Telegram-боту.
6.  **Использование Telegram-бота:**
    *   **Добавление зарплаты:** `/addsalary <название_работы> <месяц_ГГГГ-ММ> <зарплата> <часы>`
        *   Пример: `/addsalary Freelance 2023-07 15000 160`
    *   **Получение статистики:** `/stats`
    *   **Получение графика:** `/graph [salary|hourlyrate] [all|year|6months|3months]`
        *   Примеры: `/graph salary year`, `/graph hourlyrate 3months`, `/graph` (по умолчанию зарплата за все время)

## Улучшения

Внесены следующие исправления и улучшения:

-   **Исправлена ошибка `this.getAnalyticsSummary is not a function`**: Добавлена отсутствующая функция `getAnalyticsSummary`.
-   **Исправлено отображение данных**: Обеспечено корректное преобразование `job_id` в `jobId` при загрузке, добавлении и редактировании записей, что решает проблему с пустыми разделами аналитики и истории зарплат.
-   **Исправлено отображение `NaN`**: Добавлены проверки на деление на ноль и некорректные числовые значения в расчетах "Salary Diff" и "Rate Diff".
-   **Автоматический выбор всех работ в Analytics Settings**: При загрузке страницы в настройках аналитики теперь автоматически выбираются все доступные работы.
-   **Интеграция с Telegram-ботом**: Добавлена возможность связывания аккаунта, добавления записей, получения статистики и графиков через Telegram.
