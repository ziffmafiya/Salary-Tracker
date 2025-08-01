// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');

    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    const resetForm = document.getElementById('reset-password-form');
    const errorText = errorMessage.querySelector('.error-text');

    // Проверяем наличие токена и email
    if (!token || !email) {
        showError('Неверная ссылка для сброса пароля. Пожалуйста, запросите новую ссылку.');
        return;
    }

    // Показываем загрузку
    loadingMessage.style.display = 'block';

    try {
        // Проверяем токен в базе данных
        const { data: tokenData, error: tokenError } = await supabaseClient
            .from('password_reset_tokens')
            .select('*')
            .eq('token', token)
            .eq('email', email)
            .single();

        if (tokenError || !tokenData) {
            showError('Недействительный токен для сброса пароля. Возможно, ссылка истекла или уже была использована.');
            return;
        }

        // Проверяем, не истек ли токен
        if (new Date(tokenData.expires_at) < new Date()) {
            showError('Ссылка для сброса пароля истекла. Пожалуйста, запросите новую ссылку.');
            return;
        }

        // Проверяем, не был ли токен уже использован
        if (tokenData.used_at) {
            showError('Эта ссылка для сброса пароля уже была использована. Пожалуйста, запросите новую ссылку.');
            return;
        }

        // Токен валиден, показываем форму
        loadingMessage.style.display = 'none';
        resetForm.style.display = 'block';

        // Обработчик отправки формы
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            // Проверяем совпадение паролей
            if (newPassword !== confirmPassword) {
                showError('Пароли не совпадают. Пожалуйста, убедитесь, что вы ввели одинаковые пароли.');
                return;
            }

            // Проверяем длину пароля
            if (newPassword.length < 6) {
                showError('Пароль должен содержать минимум 6 символов.');
                return;
            }

            // Показываем загрузку
            const submitBtn = resetForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Изменение пароля...';
            submitBtn.disabled = true;

            try {
                // Обновляем пароль через Supabase
                const { error: updateError } = await supabaseClient.auth.updateUser({
                    password: newPassword
                });

                if (updateError) {
                    throw updateError;
                }

                // Отмечаем токен как использованный
                await supabaseClient
                    .from('password_reset_tokens')
                    .update({ used_at: new Date().toISOString() })
                    .eq('token', token);

                // Показываем успешное сообщение
                resetForm.style.display = 'none';
                successMessage.style.display = 'block';

            } catch (error) {
                console.error('Error updating password:', error);
                showError(`Ошибка при изменении пароля: ${error.message}`);
                
                // Восстанавливаем кнопку
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });

    } catch (error) {
        console.error('Error validating token:', error);
        showError('Произошла ошибка при проверке токена. Пожалуйста, попробуйте позже.');
    }
});

// Функция для показа ошибки
function showError(message) {
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const errorText = errorMessage.querySelector('.error-text');

    loadingMessage.style.display = 'none';
    errorText.textContent = message;
    errorMessage.style.display = 'block';
}

// Функция для показа успеха
function showSuccess(message) {
    const loadingMessage = document.getElementById('loading-message');
    const successMessage = document.getElementById('success-message');

    loadingMessage.style.display = 'none';
    successMessage.style.display = 'block';
} 