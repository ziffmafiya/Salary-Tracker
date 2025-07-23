import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const vercelUrl = process.env.VERCEL_URL; // For setting webhook

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Telegram API endpoint
const TELEGRAM_API = `https://api.telegram.org/bot${telegramBotToken}`;

async function sendMessage(chatId, text, replyMarkup = null) {
    const url = `${TELEGRAM_API}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Failed to send message:', data);
        }
        return data;
    } catch (error) {
        console.error('Error sending message:', error);
        return null;
    }
}

async function sendPhoto(chatId, photoUrl, caption = '') {
    const url = `${TELEGRAM_API}/sendPhoto`;
    const payload = {
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'Markdown'
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Failed to send photo:', data);
        }
        return data;
    } catch (error) {
        console.error('Error sending photo:', error);
        return null;
    }
}

// Helper to get user_id from telegram_id
async function getUserIdByTelegramId(telegramId) {
    const { data, error } = await supabase
        .from('telegram_users')
        .select('user_id')
        .eq('telegram_id', telegramId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error fetching user_id by telegram_id:', error);
        return null;
    }
    return data ? data.user_id : null;
}

// Helper to get job_id by job name for a specific user
async function getJobIdByName(userId, jobName) {
    const { data, error } = await supabase
        .from('jobs')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', jobName) // Case-insensitive search
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching job_id by name:', error);
        return null;
    }
    return data ? data.id : null;
}

// Helper to get all jobs for a user
async function getUserJobs(userId) {
    const { data, error } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user jobs:', error);
        return [];
    }
    return data;
}

// Helper to get all entries for a user
async function getUserEntries(userId) {
    const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user entries:', error);
        return [];
    }
    return data;
}

// Function to generate QuickChart URL
function generateQuickChartUrl(labels, data, type, title, yAxisLabel, borderColor, backgroundColor) {
    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: data,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
                fill: false,
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            title: {
                display: true,
                text: title,
                fontColor: '#333'
            },
            scales: {
                xAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'Month',
                        fontColor: '#333'
                    },
                    ticks: {
                        fontColor: '#333'
                    },
                    gridLines: {
                        color: '#eee'
                    }
                }],
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: yAxisLabel,
                        fontColor: '#333'
                    },
                    ticks: {
                        beginAtZero: true,
                        fontColor: '#333'
                    },
                    gridLines: {
                        color: '#eee'
                    }
                }]
            },
            legend: {
                labels: {
                    fontColor: '#333'
                }
            }
        }
    };

    const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
    return `https://quickchart.io/chart?c=${encodedConfig}&width=720&height=400&devicePixelRatio=2`;
}


export default async (req, res) => {
    if (req.method === 'POST') {
        const { message } = req.body;

        if (!message) {
            return res.status(200).send('No message received');
        }

        const chatId = message.chat.id;
        const text = message.text || '';
        const fromId = message.from.id; // Telegram user ID

        console.log(`Received message from ${fromId} in chat ${chatId}: ${text}`);

        let userId = await getUserIdByTelegramId(fromId);

        // Handle /start command
        if (text === '/start') {
            if (userId) {
                await sendMessage(chatId, 'Вы уже связали свой аккаунт. Используйте /addsalary, /stats или /graph.');
            } else {
                await sendMessage(chatId, `Привет! Чтобы связать свой аккаунт Salary Tracker, перейдите в веб-приложение, сгенерируйте код и отправьте его мне командой /link <ваш_код>.`);
            }
            return res.status(200).send('OK');
        }

        // Handle /link command
        if (text.startsWith('/link ')) {
            const linkCode = text.split(' ')[1];
            if (!linkCode) {
                await sendMessage(chatId, 'Пожалуйста, укажите код для связывания. Пример: `/link ABCDEF`');
                return res.status(200).send('OK');
            }

            // Check if the user is already linked
            if (userId) {
                await sendMessage(chatId, 'Ваш аккаунт уже связан.');
                return res.status(200).send('OK');
            }

            // Find the link code in Supabase
            const { data: linkData, error: linkError } = await supabase
                .from('link_codes')
                .select('user_id, expires_at')
                .eq('code', linkCode)
                .single();

            if (linkError && linkError.code !== 'PGRST116') {
                console.error('Error checking link code:', linkError);
                await sendMessage(chatId, 'Произошла ошибка при проверке кода связывания.');
                return res.status(200).send('OK');
            }

            if (!linkData) {
                await sendMessage(chatId, 'Неверный или истекший код связывания. Пожалуйста, сгенерируйте новый код в веб-приложении.');
                return res.status(200).send('OK');
            }

            // Check if the code has expired
            const expiresAt = new Date(linkData.expires_at);
            if (expiresAt < new Date()) {
                await sendMessage(chatId, 'Срок действия кода связывания истек. Пожалуйста, сгенерируйте новый код в веб-приложении.');
                // Optionally delete expired code
                await supabase.from('link_codes').delete().eq('code', linkCode);
                return res.status(200).send('OK');
            }

            // Link the Telegram ID to the user_id
            const { data: newTelegramUser, error: insertError } = await supabase
                .from('telegram_users')
                .insert([{ user_id: linkData.user_id, telegram_id: fromId }])
                .select();

            if (insertError) {
                console.error('Error linking Telegram account:', insertError);
                if (insertError.code === '23505') { // Unique violation (telegram_id already linked)
                    await sendMessage(chatId, 'Этот Telegram аккаунт уже связан с другим пользователем Salary Tracker.');
                } else {
                    await sendMessage(chatId, `Ошибка при связывании аккаунта: ${insertError.message}`);
                }
                return res.status(200).send('OK');
            }

            // Delete the used link code
            await supabase.from('link_codes').delete().eq('code', linkCode);

            await sendMessage(chatId, 'Ваш аккаунт Salary Tracker успешно связан с Telegram!');
            return res.status(200).send('OK');
        }

        if (!userId) {
            await sendMessage(chatId, 'Ваш аккаунт не связан. Пожалуйста, используйте команду /start для инструкций.');
            return res.status(200).send('OK');
        }

        // Handle /addsalary command
        if (text.startsWith('/addsalary ')) {
            const parts = text.split(' ');
            if (parts.length !== 5) {
                await sendMessage(chatId, 'Неверный формат. Используйте: `/addsalary <название_работы> <месяц_ГГГГ-ММ> <зарплата> <часы>`\nПример: `/addsalary Freelance 2023-07 15000 160`');
                return res.status(200).send('OK');
            }

            const jobName = parts[1];
            const month = parts[2];
            const salary = parseFloat(parts[3]);
            const hours = parseFloat(parts[4]);

            if (isNaN(salary) || isNaN(hours) || !/^\d{4}-\d{2}$/.test(month)) {
                await sendMessage(chatId, 'Неверный формат зарплаты, часов или месяца. Месяц должен быть в формате ГГГГ-ММ.');
                return res.status(200).send('OK');
            }

            const jobId = await getJobIdByName(userId, jobName);
            if (!jobId) {
                const userJobs = await getUserJobs(userId);
                const jobList = userJobs.map(j => `- ${j.name}`).join('\n');
                await sendMessage(chatId, `Работа с названием "${jobName}" не найдена. Ваши работы:\n${jobList || 'У вас пока нет работ. Добавьте их через веб-приложение.'}`);
                return res.status(200).send('OK');
            }

            const { data: existingEntry, error: fetchError } = await supabase
                .from('entries')
                .select('id')
                .eq('user_id', userId)
                .eq('job_id', jobId)
                .eq('month', month)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error checking existing entry:', fetchError);
                await sendMessage(chatId, 'Произошла ошибка при проверке существующей записи.');
                return res.status(200).send('OK');
            }

            let result;
            if (existingEntry) {
                // Update existing entry
                result = await supabase
                    .from('entries')
                    .update({ salary, hours })
                    .eq('id', existingEntry.id)
                    .select();
            } else {
                // Insert new entry
                result = await supabase
                    .from('entries')
                    .insert([{ user_id: userId, job_id: jobId, month, salary, hours }])
                    .select();
            }

            if (result.error) {
                console.error('Error adding/updating salary entry:', result.error);
                await sendMessage(chatId, `Ошибка при добавлении/обновлении записи: ${result.error.message}`);
            } else {
                await sendMessage(chatId, `Запись о зарплате для "${jobName}" за ${month} успешно ${existingEntry ? 'обновлена' : 'добавлена'}!`);
            }
            return res.status(200).send('OK');
        }

        // Handle /stats command
        if (text === '/stats') {
            const entries = await getUserEntries(userId);
            if (entries.length === 0) {
                await sendMessage(chatId, 'У вас пока нет записей о зарплате. Добавьте их с помощью команды /addsalary.');
                return res.status(200).send('OK');
            }

            let totalIncome = 0;
            let totalHours = 0;
            entries.forEach(entry => {
                totalIncome += entry.salary;
                totalHours += entry.hours;
            });

            const averageRate = totalHours > 0 ? totalIncome / totalHours : 0;

            let responseText = `*Ваша общая статистика:*\n`;
            responseText += `💰 Общий доход: ${totalIncome.toFixed(2)} UAH\n`;
            responseText += `⏰ Всего часов: ${totalHours.toFixed(2)}\n`;
            responseText += `📊 Средняя ставка: ${averageRate.toFixed(2)} UAH/час`;

            await sendMessage(chatId, responseText);
            return res.status(200).send('OK');
        }

        // Handle /graph command
        if (text.startsWith('/graph')) {
            const parts = text.split(' ');
            let graphType = 'salary'; // Default to salary
            let period = 'all'; // Default to all time

            if (parts.length >= 2) {
                if (['salary', 'hourlyrate'].includes(parts[1].toLowerCase())) {
                    graphType = parts[1].toLowerCase();
                } else {
                    period = parts[1].toLowerCase();
                }
            }
            if (parts.length >= 3) {
                period = parts[2].toLowerCase();
            }

            const entries = await getUserEntries(userId);
            if (entries.length === 0) {
                await sendMessage(chatId, 'У вас пока нет записей о зарплате для построения графика.');
                return res.status(200).send('OK');
            }

            let filteredEntries = [...entries];
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            switch (period) {
                case 'year':
                    filteredEntries = filteredEntries.filter(entry => {
                        const [year] = entry.month.split('-');
                        return parseInt(year) === currentYear;
                    });
                    break;
                case '6months':
                    filteredEntries = filteredEntries.filter(entry => {
                        const [year, month] = entry.month.split('-').map(Number);
                        let monthsAgo = (currentYear - year) * 12 + (currentMonth - month);
                        return monthsAgo >= 0 && monthsAgo < 6;
                    });
                    break;
                case '3months':
                    filteredEntries = filteredEntries.filter(entry => {
                        const [year, month] = entry.month.split('-').map(Number);
                        let monthsAgo = (currentYear - year) * 12 + (currentMonth - month);
                        return monthsAgo >= 0 && monthsAgo < 3;
                    });
                    break;
                // 'all' is default, no filtering needed
            }

            if (filteredEntries.length === 0) {
                await sendMessage(chatId, `Нет данных для выбранного периода (${period}).`);
                return res.status(200).send('OK');
            }

            const allMonths = [...new Set(filteredEntries.map(entry => entry.month))].sort();
            const labels = allMonths.map(month => {
                const [year, monthNum] = month.split('-');
                const date = new Date(year, monthNum - 1);
                return date.toLocaleDateString('en-EN', { month: 'short', year: 'numeric' });
            });

            let chartData;
            let title;
            let yAxisLabel;
            let borderColor;
            let backgroundColor;

            if (graphType === 'salary') {
                chartData = allMonths.map(month => {
                    const monthEntries = filteredEntries.filter(entry => entry.month === month);
                    return monthEntries.reduce((sum, entry) => sum + entry.salary, 0);
                });
                title = 'Monthly Income';
                yAxisLabel = 'Total Salary (UAH)';
                borderColor = '#4CAF50';
                backgroundColor = 'rgba(76, 175, 80, 0.2)';
            } else { // hourlyrate
                chartData = allMonths.map(month => {
                    const monthEntries = filteredEntries.filter(entry => entry.month === month);
                    const totalSalary = monthEntries.reduce((sum, entry) => sum + entry.salary, 0);
                    const totalHours = monthEntries.reduce((sum, entry) => sum + entry.hours, 0);
                    return totalHours > 0 ? totalSalary / totalHours : 0;
                });
                title = 'Average Hourly Rate';
                yAxisLabel = 'Hourly Rate (UAH/hour)';
                borderColor = '#2196F3';
                backgroundColor = 'rgba(33, 150, 243, 0.2)';
            }

            const chartUrl = generateQuickChartUrl(labels, chartData, 'line', title, yAxisLabel, borderColor, backgroundColor);
            await sendMessage(chatId, `Вот ваш график (${title} за ${period}):\n${chartUrl}`);
            // Optionally, send as photo if Telegram allows direct URL for QuickChart
            // await sendPhoto(chatId, chartUrl, `Вот ваш график (${title} за ${period})`);
            return res.status(200).send('OK');
        }

        // Default response for unknown commands
        await sendMessage(chatId, 'Неизвестная команда. Используйте /start для начала.');
        res.status(200).send('OK');

    } else if (req.method === 'GET') {
        // For Vercel, you might want to set the webhook here on GET request
        // This is a simplified example. In production, you'd set it once.
        const webhookUrl = `${vercelUrl}/api/telegram-webhook`;
        const setWebhookUrl = `${TELEGRAM_API}/setWebhook?url=${webhookUrl}`;

        try {
            const response = await fetch(setWebhookUrl);
            const data = await response.json();
            if (data.ok) {
                res.status(200).send(`Webhook set to ${webhookUrl}: ${data.description}`);
            } else {
                res.status(500).send(`Failed to set webhook: ${data.description}`);
            }
        } catch (error) {
            console.error('Error setting webhook:', error);
            res.status(500).send(`Error setting webhook: ${error.message}`);
        }
    } else {
        res.status(405).send('Method Not Allowed');
    }
};
