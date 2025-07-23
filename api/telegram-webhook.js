const { createClient } = require('@supabase/supabase-js');

// Замените на ваш токен бота Telegram и URL/ключ Supabase
// В продакшене на Vercel эти значения должны быть установлены как Environment Variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Функция для отправки сообщения в Telegram
async function sendMessage(chatId, text, parseMode = 'Markdown', replyMarkup = null) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const body = {
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
    };
    if (replyMarkup) {
        body.reply_markup = replyMarkup;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Failed to send message:', data);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Функция для отправки фотографии в Telegram
async function sendPhoto(chatId, photoUrl, caption = '') {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                photo: photoUrl,
                caption: caption,
            }),
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Failed to send photo:', data);
        }
    } catch (error) {
        console.error('Error sending photo:', error);
    }
}

// Главная функция-обработчик для Vercel Serverless Function
module.exports = async (req, res) => {
    if (req.method === 'POST') {
        const { message, callback_query } = req.body;

        let chatId;
        let text;
        let userId;
        let data; // For callback_query data

        if (message) {
            chatId = message.chat.id;
            text = message.text;
            userId = message.from.id;
            console.log(`Received message from ${chatId}: ${text}`);
        } else if (callback_query) {
            chatId = callback_query.message.chat.id;
            text = callback_query.message.text; // The text of the message the button was attached to
            userId = callback_query.from.id;
            data = callback_query.data; // The data sent with the button
            console.log(`Received callback query from ${chatId}: ${data}`);
            // Acknowledge the callback query to remove the loading state from the button
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callback_query.id }),
            });
        } else {
            return res.status(200).send('No message or callback query received');
        }

        // Helper function to create main menu keyboard
        const createMainMenuKeyboard = (isLoggedIn) => {
            const buttons = [];
            if (isLoggedIn) {
                buttons.push([{ text: 'Мои работы', callback_data: 'jobs' }]);
                buttons.push([{ text: 'Добавить зарплату', callback_data: 'add_salary_prompt' }]);
                buttons.push([{ text: 'Статистика', callback_data: 'stats' }]);
                buttons.push([{ text: 'График дохода', callback_data: 'graph_salary' }]);
                buttons.push([{ text: 'График почасовой ставки', callback_data: 'graph_hourly' }]);
                buttons.push([{ text: 'Выйти', callback_data: 'logout' }]);
            } else {
                buttons.push([{ text: 'Авторизоваться', callback_data: 'login_prompt' }]);
            }
            return {
                inline_keyboard: buttons
            };
        };

        // Check if user is linked to Supabase
        let { data: telegramUser, error: telegramUserError } = await supabase
            .from('telegram_users')
            .select('user_id')
            .eq('telegram_chat_id', chatId)
            .single();

        if (telegramUserError && telegramUserError.code !== 'PGRST116') {
            console.error('Error fetching telegram user:', telegramUserError);
            await sendMessage(chatId, 'Произошла ошибка при проверке вашего аккаунта. Пожалуйста, попробуйте позже.');
            return res.status(200).send('Error fetching telegram user');
        }

        const isLoggedIn = !!telegramUser;
        let action = data || (text ? text.split(' ')[0] : ''); // Use callback_query data or message text command

        // Handle /start command specifically for initial setup
        if (action === '/start') {
            await sendMessage(chatId, 'Привет! Я бот для отслеживания зарплаты. Выберите действие:', 'Markdown', createMainMenuKeyboard(isLoggedIn));
            return res.status(200).send('OK');
        }

        // Handle login command (still text-based for credentials)
        if (action.startsWith('/login')) {
            const args = action.split(' ').slice(1);
            const email = args[0];
            const password = args[1];

            if (!email || !password) {
                await sendMessage(chatId, 'Пожалуйста, укажите email и пароль в формате: `/login <email> <пароль>`');
                return res.status(200).send('Missing login credentials');
            }

            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });

                if (error) {
                    console.error('Supabase login error:', error);
                    await sendMessage(chatId, `Ошибка авторизации: ${error.message}. Проверьте правильность email и пароля.`);
                } else if (data.user) {
                    const { data: existingLink, error: linkError } = await supabase
                        .from('telegram_users')
                        .select('*')
                        .eq('user_id', data.user.id)
                        .single();

                    if (linkError && linkError.code !== 'PGRST116') {
                        console.error('Error checking existing link:', linkError);
                        await sendMessage(chatId, 'Произошла ошибка при проверке существующей связи.');
                        return res.status(200).send('Error checking existing link');
                    }

                    if (existingLink) {
                        if (existingLink.telegram_chat_id !== chatId) {
                            const { error: updateError } = await supabase
                                .from('telegram_users')
                                .update({ telegram_chat_id: chatId })
                                .eq('user_id', data.user.id);
                            if (updateError) {
                                console.error('Error updating chat ID:', updateError);
                                await sendMessage(chatId, 'Произошла ошибка при обновлении вашего Telegram ID.');
                            } else {
                                await sendMessage(chatId, `Вы успешно авторизованы как ${data.user.email}! Ваш Telegram ID обновлен.`, 'Markdown', createMainMenuKeyboard(true));
                            }
                        } else {
                            await sendMessage(chatId, `Вы уже авторизованы как ${data.user.email}!`, 'Markdown', createMainMenuKeyboard(true));
                        }
                    } else {
                        const { error: insertError } = await supabase
                            .from('telegram_users')
                            .insert([{ user_id: data.user.id, telegram_chat_id: chatId }]);
                        if (insertError) {
                            console.error('Error inserting new link:', insertError);
                            await sendMessage(chatId, 'Произошла ошибка при связывании вашего аккаунта.');
                        } else {
                            await sendMessage(chatId, `Вы успешно авторизованы как ${data.user.email}! Теперь вы можете использовать команды бота.`, 'Markdown', createMainMenuKeyboard(true));
                        }
                    }
                }
            } catch (e) {
                console.error('Unexpected login error:', e);
                await sendMessage(chatId, 'Произошла непредвиденная ошибка при авторизации.');
            }
            return res.status(200).send('OK');
        }

        // If not logged in and not a login command, prompt for login
        if (!isLoggedIn) {
            await sendMessage(chatId, 'Вы не авторизованы. Пожалуйста, используйте команду `/login <ваш_email> <ваш_пароль>` для входа или нажмите кнопку "Авторизоваться".', 'Markdown', createMainMenuKeyboard(false));
            return res.status(200).send('Not authorized');
        }

        // User is logged in, handle actions
        const userSupabaseId = telegramUser.user_id;

        switch (action) {
            case 'login_prompt':
                await sendMessage(chatId, 'Пожалуйста, введите ваш email и пароль в формате: `/login <email> <пароль>`');
                break;

            case 'logout':
                const { error: deleteError } = await supabase
                    .from('telegram_users')
                    .delete()
                    .eq('user_id', userSupabaseId);

                if (deleteError) {
                    console.error('Error logging out:', deleteError);
                    await sendMessage(chatId, 'Произошла ошибка при выходе из аккаунта. Пожалуйста, попробуйте позже.');
                } else {
                    await sendMessage(chatId, 'Вы успешно вышли из аккаунта. Чтобы снова использовать бота, авторизуйтесь с помощью `/login`.', 'Markdown', createMainMenuKeyboard(false));
                }
                break;

            case 'jobs':
                const { data: jobs, error: jobsError } = await supabase
                    .from('jobs')
                    .select('name, base_rate, base_hours')
                    .eq('user_id', userSupabaseId);

                if (jobsError) {
                    console.error('Error fetching jobs:', jobsError);
                    await sendMessage(chatId, 'Произошла ошибка при получении списка работ.');
                } else if (jobs.length === 0) {
                    await sendMessage(chatId, 'У вас пока нет добавленных работ. Добавьте их на сайте.', 'Markdown', createMainMenuKeyboard(true));
                } else {
                    let jobsList = 'Ваши работы:\n\n';
                    jobs.forEach(job => {
                        const hourlyRate = job.base_hours > 0 ? (job.base_rate / job.base_hours).toFixed(2) : 'N/A';
                        jobsList += `*${job.name}*\nБазовая ставка: ${job.base_rate} UAH за ${job.base_hours} часов (${hourlyRate} UAH/час)\n\n`;
                    });
                    await sendMessage(chatId, jobsList, 'Markdown', createMainMenuKeyboard(true));
                }
                break;

            case 'add_salary_prompt':
                await sendMessage(chatId, 'Пожалуйста, введите данные о зарплате в формате: `/add_salary <название_работы> <месяц_ГГГГ-ММ> <зарплата> <часы>`');
                break;

            case 'stats':
                const { data: entries, error: entriesError } = await supabase
                    .from('entries')
                    .select('salary, hours, month, job_id')
                    .eq('user_id', userSupabaseId)
                    .order('month', { ascending: false });

                if (entriesError) {
                    console.error('Error fetching entries for stats:', entriesError);
                    await sendMessage(chatId, 'Произошла ошибка при получении данных для статистики.');
                    break;
                }

                if (entries.length === 0) {
                    await sendMessage(chatId, 'У вас пока нет записей о зарплате для статистики.', 'Markdown', createMainMenuKeyboard(true));
                    break;
                }

                let totalIncome = 0;
                let totalHours = 0;
                const monthlyData = {};

                entries.forEach(entry => {
                    totalIncome += entry.salary;
                    totalHours += entry.hours;
                    if (!monthlyData[entry.month]) {
                        monthlyData[entry.month] = { salary: 0, hours: 0 };
                    }
                    monthlyData[entry.month].salary += entry.salary;
                    monthlyData[entry.month].hours += entry.hours;
                });

                const averageRate = totalHours > 0 ? (totalIncome / totalHours).toFixed(2) : '0.00';

                let statsMessage = `*Общая статистика:*\n`;
                statsMessage += `Общий доход: ${totalIncome.toFixed(2)} UAH\n`;
                statsMessage += `Всего часов: ${totalHours.toFixed(2)}\n`;
                statsMessage += `Средняя почасовая ставка: ${averageRate} UAH/час\n\n`;

                const sortedMonths = Object.keys(monthlyData).sort().reverse();
                if (sortedMonths.length >= 2) {
                    const currentMonth = sortedMonths[0];
                    const prevMonth = sortedMonths[1];

                    const currentMonthData = monthlyData[currentMonth];
                    const prevMonthData = monthlyData[prevMonth];

                    const salaryDiff = currentMonthData.salary - prevMonthData.salary;
                    const hoursDiff = currentMonthData.hours - prevMonthData.hours;

                    const currentRate = currentMonthData.hours > 0 ? currentMonthData.salary / currentMonthData.hours : 0;
                    const prevRate = prevMonthData.hours > 0 ? prevMonthData.salary / prevMonthData.hours : 0;
                    const rateDiff = currentRate - prevRate;

                    statsMessage += `*Сравнение с ${new Date(prevMonth).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}:*\n`;
                    statsMessage += `Изменение дохода: ${salaryDiff >= 0 ? '+' : ''}${salaryDiff.toFixed(2)} UAH\n`;
                    statsMessage += `Изменение часов: ${hoursDiff >= 0 ? '+' : ''}${hoursDiff.toFixed(2)} часов\n`;
                    statsMessage += `Изменение почасовой ставки: ${rateDiff >= 0 ? '+' : ''}${rateDiff.toFixed(2)} UAH/час\n`;
                } else {
                    statsMessage += `Недостаточно данных для сравнения с предыдущим месяцем.\n`;
                }

                await sendMessage(chatId, statsMessage, 'Markdown', createMainMenuKeyboard(true));
                break;

            case 'graph_salary':
            case 'graph_hourly':
                const graphType = action === 'graph_hourly' ? 'hourlyRate' : 'salary';

                const { data: graphEntries, error: graphEntriesError } = await supabase
                    .from('entries')
                    .select('salary, hours, month, job_id')
                    .eq('user_id', userSupabaseId)
                    .order('month', { ascending: true });

                if (graphEntriesError) {
                    console.error('Error fetching entries for graph:', graphEntriesError);
                    await sendMessage(chatId, 'Произошла ошибка при получении данных для графика.');
                    break;
                }

                if (graphEntries.length === 0) {
                    await sendMessage(chatId, 'У вас пока нет записей о зарплате для построения графика.', 'Markdown', createMainMenuKeyboard(true));
                    break;
                }

                const allMonths = [...new Set(graphEntries.map(entry => entry.month))].sort();
                const labels = allMonths.map(month => {
                    const [year, monthNum] = month.split('-');
                    const date = new Date(year, monthNum - 1);
                    return date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
                });

                let chartData = [];
                let yAxisTitle = '';
                let datasetLabel = '';

                if (graphType === 'salary') {
                    chartData = allMonths.map(month => {
                        const monthEntries = graphEntries.filter(entry => entry.month === month);
                        return monthEntries.reduce((sum, entry) => sum + entry.salary, 0);
                    });
                    yAxisTitle = 'Доход (UAH)';
                    datasetLabel = 'Месячный доход';
                } else {
                    chartData = allMonths.map(month => {
                        const monthEntries = graphEntries.filter(entry => entry.month === month);
                        const totalSalary = monthEntries.reduce((sum, entry) => sum + entry.salary, 0);
                        const totalHours = monthEntries.reduce((sum, entry) => sum + entry.hours, 0);
                        return totalHours > 0 ? totalSalary / totalHours : 0;
                    });
                    yAxisTitle = 'Почасовая ставка (UAH/час)';
                    datasetLabel = 'Средняя почасовая ставка';
                }

                const chartConfig = {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: datasetLabel,
                            data: chartData,
                            borderColor: 'rgb(75, 192, 192)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            fill: false,
                            tension: 0.1
                        }]
                    },
                    options: {
                        title: {
                            display: true,
                            text: datasetLabel
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: 'Месяц'
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: yAxisTitle
                                },
                                beginAtZero: true
                            }
                        }
                    }
                };

                const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
                const quickChartUrl = `https://quickchart.io/chart?c=${encodedConfig}&width=720&height=480&devicePixelRatio=2`;

                await sendPhoto(chatId, quickChartUrl, `График: ${datasetLabel}`);
                await sendMessage(chatId, 'Выберите следующее действие:', 'Markdown', createMainMenuKeyboard(true));
                break;

            // Handle /add_salary command (still text-based for credentials)
            case '/add_salary':
                const addSalaryArgs = text.split(' ').slice(1);
                if (addSalaryArgs.length < 4) {
                    await sendMessage(chatId, 'Неверный формат. Используйте: `/add_salary <название_работы> <месяц_ГГГГ-ММ> <зарплата> <часы>`');
                    break;
                }
                const jobName = addSalaryArgs[0];
                const monthYear = addSalaryArgs[1];
                const salary = parseFloat(addSalaryArgs[2]);
                const hours = parseFloat(addSalaryArgs[3]);

                if (isNaN(salary) || isNaN(hours) || salary < 0 || hours < 0) {
                    await sendMessage(chatId, 'Зарплата и часы должны быть положительными числами.');
                    break;
                }

                const { data: jobData, error: jobError } = await supabase
                    .from('jobs')
                    .select('id')
                    .eq('user_id', userSupabaseId)
                    .eq('name', jobName)
                    .single();

                if (jobError || !jobData) {
                    await sendMessage(chatId, `Работа с названием "${jobName}" не найдена. Проверьте название или добавьте работу на сайте.`);
                    break;
                }

                const jobId = jobData.id;

                const { data: existingEntry, error: entryError } = await supabase
                    .from('entries')
                    .select('id')
                    .eq('job_id', jobId)
                    .eq('month', monthYear)
                    .eq('user_id', userSupabaseId)
                    .single();

                if (entryError && entryError.code !== 'PGRST116') {
                    console.error('Error checking existing entry:', entryError);
                    await sendMessage(chatId, 'Произошла ошибка при проверке существующей записи.');
                    break;
                }

                if (existingEntry) {
                    const { error: updateEntryError } = await supabase
                        .from('entries')
                        .update({ salary, hours })
                        .eq('id', existingEntry.id);
                    if (updateEntryError) {
                        console.error('Error updating entry:', updateEntryError);
                        await sendMessage(chatId, 'Произошла ошибка при обновлении записи.');
                    } else {
                        await sendMessage(chatId, `Запись о зарплате за ${monthYear} для работы "${jobName}" успешно обновлена.`, 'Markdown', createMainMenuKeyboard(true));
                    }
                } else {
                    const { error: insertEntryError } = await supabase
                        .from('entries')
                        .insert([{ job_id: jobId, month: monthYear, salary, hours, user_id: userSupabaseId }]);
                    if (insertEntryError) {
                        console.error('Error inserting entry:', insertEntryError);
                        await sendMessage(chatId, 'Произошла ошибка при добавлении записи.');
                    } else {
                        await sendMessage(chatId, `Запись о зарплате за ${monthYear} для работы "${jobName}" успешно добавлена.`, 'Markdown', createMainMenuKeyboard(true));
                    }
                }
                break;

            default:
                await sendMessage(chatId, 'Неизвестная команда или действие. Выберите действие:', 'Markdown', createMainMenuKeyboard(isLoggedIn));
                break;
        }

        res.status(200).send('OK');
    } else {
        res.status(405).send('Method Not Allowed');
    }
};
