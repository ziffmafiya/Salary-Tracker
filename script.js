class SalaryTracker {
    constructor() {
        this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        this.currentJobId = null;
        this.currentPeriod = 'all';
        this.currentChartView = 'overall';
        this.jobs = [];
        this.entries = [];
        this.analyticsSettings = {
            period: 'all',
            customStartDate: null,
            customEndDate: null,
            includedJobs: [] // Will store job IDs to include in analytics
        };
        this.monthlyIncomeSettings = {
            period: 'all',
            chartType: 'salary'
        };

        this.chart = null;
        this.init();
    }

    // Load data from Supabase
    async loadData() {
        const { data: jobs, error: jobsError } = await this.supabase.from('jobs').select('*');
        if (jobsError) {
            console.error('Error loading jobs:', jobsError);
        } else {
            // Map base_rate to baseRate and base_hours to baseHours for consistency
            this.jobs = jobs.map(job => ({
                ...job,
                baseRate: job.base_rate,
                baseHours: job.base_hours
            }));
        }

        const { data: entries, error: entriesError } = await this.supabase.from('entries').select('*');
        if (entriesError) {
            console.error('Error loading entries:', entriesError);
        } else {
            // Map job_id to jobId for consistency with existing code
            this.entries = entries.map(entry => ({
                ...entry,
                jobId: entry.job_id // Create jobId property from job_id
            }));
        }

        // For simplicity, we'll keep analytics settings in localStorage for now
        const storedAnalyticsSettings = localStorage.getItem('salaryTrackerAnalyticsSettings');
        if (storedAnalyticsSettings) {
            this.analyticsSettings = JSON.parse(storedAnalyticsSettings);
        }
    }

    // Setup tooltips
    setupTooltips() {
        const tooltip = document.getElementById('tooltip');

        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('.tooltip-trigger');
            if (target && target.hasAttribute('data-tooltip')) {
                const tooltipText = target.getAttribute('data-tooltip');
                tooltip.textContent = tooltipText;
                tooltip.classList.add('show');
                tooltip.style.display = 'block';

                // Position tooltip after a small delay to ensure proper sizing
                setTimeout(() => {
                    const rect = target.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();

                    // Center horizontally relative to target
                    let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);

                    // Position above the target
                    let top = rect.top + window.scrollY - tooltipRect.height - 10;

                    // Ensure tooltip doesn't go off screen
                    if (left < 10) left = 10;
                    if (left + tooltipRect.width > window.innerWidth - 10) {
                        left = window.innerWidth - tooltipRect.width - 10;
                    }
                    if (top < 10) {
                        top = rect.bottom + window.scrollY + 10; // Show below if no space above
                    }

                    tooltip.style.left = `${left}px`;
                    tooltip.style.top = `${top}px`;
                }, 10);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('.tooltip-trigger');
            if (!target || !e.relatedTarget || !target.contains(e.relatedTarget)) {
                tooltip.classList.remove('show');
                setTimeout(() => {
                    if (!tooltip.classList.contains('show')) {
                        tooltip.style.display = 'none';
                    }
                }, 300);
            }
        });
    }

    async init() {
        await this.loadData(); // Загружает работы и настройки аналитики из localStorage
        await this.migrateOldData(); // Миграция данных, если необходимо

        // Убедитесь, что analyticsSettings.includedJobs всегда содержит все текущие идентификаторы работ при загрузке страницы.
        // Это переопределяет любой ранее сохраненный поднабор работ для настройки 'includedJobs',
        // выполняя запрос пользователя о том, чтобы все работы всегда были выбраны по умолчанию.
        if (this.jobs.length > 0) {
            this.analyticsSettings.includedJobs = this.jobs.map(job => job.id);
        } else {
            this.analyticsSettings.includedJobs = []; // Если нет работ, то нет включенных работ
        }

        this.setupEventListeners();
        this.setupThemeToggle();
        this.populateJobSelects();
        this.populateChartViewSelect();
        this.setupChart();

        this.updateSalaryHistory(); // Вызывается после инициализации analyticsSettings.includedJobs
        this.updateGeneralAnalytics();
        this.updateBaseRatesInfo();

        // Set current job to first job if available
        if (this.jobs.length > 0) {
            this.currentJobId = this.jobs[0].id;
            this.updateStatistics();
        }
    }

    // This function is no longer needed as we won't be creating default jobs.
    // Users will add their own jobs.
    // setupDefaultJobs() { ... }
    // Setup theme toggle functionality
    setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const body = document.body;

        // Load saved theme preference
        const savedTheme = localStorage.getItem('salaryTrackerTheme') || 'dark';

        // Apply saved theme
        if (savedTheme === 'light') {
            body.setAttribute('data-theme', 'light');
            themeToggle.checked = true;
        } else {
            body.removeAttribute('data-theme');
            themeToggle.checked = false;
        }

        // Theme toggle event listener
        themeToggle.addEventListener('change', () => {
            if (themeToggle.checked) {
                // Switch to light theme
                body.setAttribute('data-theme', 'light');
                localStorage.setItem('salaryTrackerTheme', 'light');
            } else {
                // Switch to dark theme
                body.removeAttribute('data-theme');
                localStorage.setItem('salaryTrackerTheme', 'dark');
            }

            // Update chart colors if chart exists
            if (this.chart) {
                this.updateChartTheme();
            }
        });
    }

    // Update chart theme colors
    updateChartTheme() {
        const isDarkTheme = !document.body.hasAttribute('data-theme') || document.body.getAttribute('data-theme') === 'dark';

        if (this.chart) {
            // Update chart options for theme
            this.chart.options.plugins.legend.labels.color = isDarkTheme ? '#F3F0F5' : '#0D0A0B';
            this.chart.options.scales.x.ticks.color = isDarkTheme ? '#F3F0F5' : '#0D0A0B';
            this.chart.options.scales.y.ticks.color = isDarkTheme ? '#F3F0F5' : '#0D0A0B';
            this.chart.options.scales.x.grid.color = isDarkTheme ? '#272025' : '#f0ecf2';
            this.chart.options.scales.y.grid.color = isDarkTheme ? '#272025' : '#f0ecf2';

            // Update chart background
            Chart.defaults.color = isDarkTheme ? '#F3F0F5' : '#0D0A0B';
            Chart.defaults.borderColor = isDarkTheme ? '#272025' : '#f0ecf2';

            // Update chart
            this.chart.update();
        }
    }
    setupEventListeners() {

        // Analytics Settings Modal
        const analyticsSettingsBtn = document.getElementById('analyticsSettingsBtn');
        const analyticsSettingsModal = document.getElementById('analyticsSettingsModal');

        analyticsSettingsBtn.addEventListener('click', () => {
            console.log('Analytics Settings Button clicked!'); // Add console log
            this.populateAnalyticsSettingsModal();
            analyticsSettingsModal.style.display = 'block';
        });

        // Close analytics settings modal
        analyticsSettingsModal.querySelector('.close-modal').addEventListener('click', () => {
            analyticsSettingsModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === analyticsSettingsModal) {
                analyticsSettingsModal.style.display = 'none';
            }
        });

        // Custom date range toggle
        document.getElementById('analyticsPeriodSelect').addEventListener('change', (e) => {
            const customDateRange = document.getElementById('customDateRange');
            customDateRange.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });

        // Apply analytics settings
        document.getElementById('applyAnalyticsSettings').addEventListener('click', () => {
            this.applyAnalyticsSettings();
            // Removed: analyticsSettingsModal.style.display = 'none'; to prevent closing the modal
        });

        // Reset analytics settings
        document.getElementById('resetAnalyticsSettings').addEventListener('click', () => {
            this.resetAnalyticsSettings();
        });

        // Select/Deselect all jobs
        document.getElementById('selectAllJobs').addEventListener('click', () => {
            this.selectAllJobs(true);
        });

        document.getElementById('deselectAllJobs').addEventListener('click', () => {
            this.selectAllJobs(false);
        });

        // Job selection for viewing data
        document.getElementById('viewJobSelect').addEventListener('change', (e) => {
            this.currentJobId = e.target.value;
            this.updateStatistics();
        });

        // Form submission for adding salary entry
        document.getElementById('salaryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addSalaryEntry();
        });

        // Monthly Income Settings Modal
        const monthlyIncomeSettingsBtn = document.getElementById('monthlyIncomeSettingsBtn');
        const monthlyIncomeSettingsModal = document.getElementById('monthlyIncomeSettingsModal');
        const chartViewSelect = monthlyIncomeSettingsModal.querySelector('#chartViewSelect');

        monthlyIncomeSettingsBtn.addEventListener('click', () => {
            this.populateChartViewSelect(); // Populate select when modal opens
            monthlyIncomeSettingsModal.style.display = 'block';
        });

        monthlyIncomeSettingsModal.querySelector('.close-modal').addEventListener('click', () => {
            monthlyIncomeSettingsModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === monthlyIncomeSettingsModal) {
                monthlyIncomeSettingsModal.style.display = 'none';
            }
        });

        document.getElementById('applyMonthlyIncomeSettings').addEventListener('click', () => {
            this.applyMonthlyIncomeSettings();
            // monthlyIncomeSettingsModal.style.display = 'none'; // Removed to keep modal open
        });

        document.getElementById('resetMonthlyIncomeSettings').addEventListener('click', () => {
            this.resetMonthlyIncomeSettings();
        });

        // Chart view selection inside modal
        chartViewSelect.addEventListener('change', (e) => {
            this.currentChartView = e.target.value;
            this.updateChart();
        });

        // Clear all data button
        document.getElementById('clearAllData').addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete all salary data? This action cannot be undone.')) {
                const { error } = await this.supabase.from('entries').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
                if (error) {
                    console.error('Error clearing entries:', error);
                } else {
                    this.entries = [];
                    this.updateSalaryHistory();
                    this.updateGeneralAnalytics();
                    this.updateChart();
                    this.updateStatistics();
                }
            }
        });

        // Job settings modal
        const jobSettingsBtn = document.getElementById('jobSettingsBtn');
        const jobSettingsModal = document.getElementById('jobSettingsModal');
        const editJobModal = document.getElementById('editJobModal');
        const closeButtons = document.querySelectorAll('.close-modal');

        jobSettingsBtn.addEventListener('click', () => {
            this.populateJobsList();
            jobSettingsModal.style.display = 'block';
        });

        // Close job settings modal
        jobSettingsModal.querySelector('.close-modal').addEventListener('click', () => {
            jobSettingsModal.style.display = 'none';
        });

        // Close edit job modal
        editJobModal.querySelector('.close-modal').addEventListener('click', () => {
            editJobModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === jobSettingsModal) {
                jobSettingsModal.style.display = 'none';
            }
            if (e.target === editJobModal) {
                editJobModal.style.display = 'none';
            }
        });

        // Add new job form
        document.getElementById('addJobForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNewJob();
        });

        // Edit job form
        document.getElementById('editJobForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveJobEdit();
        });

        // Edit entry modal
        const editEntryModal = document.getElementById('editEntryModal');

        // Close edit entry modal
        editEntryModal.querySelector('.close-modal').addEventListener('click', () => {
            editEntryModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === editEntryModal) {
                editEntryModal.style.display = 'none';
            }
        });

        // Edit entry form
        document.getElementById('editEntryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEntryEdit();
        });

        // Export data button
        document.getElementById('exportDataBtn').addEventListener('click', () => {
            this.exportData();
        });
    }

    populateJobSelects() {
        const jobSelect = document.getElementById('jobSelect');
        const viewJobSelect = document.getElementById('viewJobSelect');

        // Clear existing options
        jobSelect.innerHTML = '';
        viewJobSelect.innerHTML = '';

        // Add options for each job
        this.jobs.forEach(job => {
            const option1 = document.createElement('option');
            option1.value = job.id;
            option1.textContent = job.name;

            const option2 = document.createElement('option');
            option2.value = job.id;
            option2.textContent = job.name;

            jobSelect.appendChild(option1);
            viewJobSelect.appendChild(option2);
        });

        // Set current job in view select
        if (this.currentJobId) {
            viewJobSelect.value = this.currentJobId;
        }
    }

    populateChartViewSelect() {
        const chartViewSelect = document.getElementById('chartViewSelect');
        chartViewSelect.innerHTML = ''; // Clear existing options

        // Add "Overall" option
        const overallOption = document.createElement('option');
        overallOption.value = 'overall';
        overallOption.textContent = 'Overall';
        chartViewSelect.appendChild(overallOption);

        // Add options for each job
        this.jobs.forEach(job => {
            const option = document.createElement('option');
            option.value = job.id;
            option.textContent = job.name;
            chartViewSelect.appendChild(option);
        });

        // Set the current selected value
        chartViewSelect.value = this.currentChartView;
    }

    populateJobsList() {
        const jobsList = document.getElementById('jobsList');
        jobsList.innerHTML = '';

        this.jobs.forEach(job => {
            const jobItem = document.createElement('div');
            jobItem.className = 'job-item';

            const jobInfo = document.createElement('div');
            jobInfo.className = 'job-info';

            const jobName = document.createElement('div');
            jobName.className = 'job-name';
            jobName.textContent = job.name;

            const jobBaseRate = document.createElement('div');
            jobBaseRate.className = 'job-base-rate';
            jobBaseRate.textContent = `Base: ${job.baseRate} UAH for ${job.baseHours} hours (${(job.baseRate / job.baseHours).toFixed(2)} UAH/hour)`;

            jobInfo.appendChild(jobName);
            jobInfo.appendChild(jobBaseRate);

            const jobActions = document.createElement('div');
            jobActions.className = 'job-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-job-btn';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => this.openEditJobModal(job));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-job-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => this.deleteJob(job.id));

            jobActions.appendChild(editBtn);
            jobActions.appendChild(deleteBtn);

            jobItem.appendChild(jobInfo);
            jobItem.appendChild(jobActions);

            jobsList.appendChild(jobItem);
        });
    }

    openEditJobModal(job) {
        document.getElementById('editJobId').value = job.id;
        document.getElementById('editJobName').value = job.name;
        document.getElementById('editJobBaseRate').value = job.baseRate;
        document.getElementById('editJobBaseHours').value = job.baseHours;

        document.getElementById('editJobModal').style.display = 'block';
    }

    async saveJobEdit() {
        const jobId = document.getElementById('editJobId').value;
        const jobName = document.getElementById('editJobName').value;
        const baseRate = parseFloat(document.getElementById('editJobBaseRate').value);
        const baseHours = parseFloat(document.getElementById('editJobBaseHours').value);

        const { data, error } = await this.supabase
            .from('jobs')
            .update({ name: jobName, base_rate: baseRate, base_hours: baseHours })
            .eq('id', jobId)
            .select();

        if (error) {
            console.error('Error updating job:', error);
        } else {
            const jobIndex = this.jobs.findIndex(job => job.id === jobId);
            if (jobIndex !== -1) {
                this.jobs[jobIndex] = data[0];
            }
            this.populateJobSelects();
            this.populateChartViewSelect();
            this.populateJobsList();
            this.updateStatistics();
            this.updateSalaryHistory();
            this.updateBaseRatesInfo();
            document.getElementById('editJobModal').style.display = 'none';
        }
    }

    async addNewJob() {
        const jobName = document.getElementById('newJobName').value;
        const baseRate = parseFloat(document.getElementById('newJobBaseRate').value);
        const baseHours = parseFloat(document.getElementById('newJobBaseHours').value);

        const { data, error } = await this.supabase
            .from('jobs')
            .insert([{ name: jobName, base_rate: baseRate, base_hours: baseHours }])
            .select();

        if (error) {
            console.error('Error adding new job:', error);
        } else {
            this.jobs.push(data[0]);
            document.getElementById('newJobName').value = '';
            document.getElementById('newJobBaseRate').value = '10395';
            document.getElementById('newJobBaseHours').value = '192';
            this.populateJobSelects();
            this.populateChartViewSelect();
            this.populateJobsList();
            this.updateBaseRatesInfo();
            if (this.jobs.length === 1) {
                this.currentJobId = data[0].id;
                this.updateStatistics();
            }
        }
    }

    async deleteJob(jobId) {
        const hasEntries = this.entries.some(entry => entry.jobId === jobId);
        if (hasEntries) {
            if (!confirm(`This job has salary entries. Deleting it will also delete all associated entries. Continue?`)) {
                return;
            }
            const { error: entriesError } = await this.supabase.from('entries').delete().eq('job_id', jobId);
            if (entriesError) {
                console.error('Error deleting associated entries:', entriesError);
                return;
            }
        } else if (!confirm('Are you sure you want to delete this job?')) {
            return;
        }

        const { error } = await this.supabase.from('jobs').delete().eq('id', jobId);

        if (error) {
            console.error('Error deleting job:', error);
        } else {
            this.entries = this.entries.filter(entry => entry.jobId !== jobId);
            this.jobs = this.jobs.filter(job => job.id !== jobId);

            if (this.currentJobId === jobId && this.jobs.length > 0) {
                this.currentJobId = this.jobs[0].id;
            } else if (this.jobs.length === 0) {
                this.currentJobId = null;
            }

            if (this.currentChartView === jobId) {
                this.currentChartView = 'overall';
                this.populateChartViewSelect();
            }

            this.populateJobSelects();
            this.populateChartViewSelect();
            this.populateJobsList();
            this.updateSalaryHistory();
            this.updateGeneralAnalytics();
            this.updateChart();
            this.updateStatistics();
            this.updateBaseRatesInfo();
        }
    }

    async addSalaryEntry() {
        const jobId = document.getElementById('jobSelect').value;
        const monthYearInput = document.getElementById('monthYearInput').value;
        const salary = parseFloat(document.getElementById('salary').value);
        const hours = parseFloat(document.getElementById('hours').value);

        const existingEntry = this.entries.find(entry =>
            entry.job_id === jobId && entry.month === monthYearInput
        );

        if (existingEntry) {
            if (confirm(`An entry for this job and month already exists. Do you want to update it?`)) {
                const { data, error } = await this.supabase
                    .from('entries')
                    .update({ salary, hours })
                    .eq('id', existingEntry.id)
                    .select();
                if (error) {
                    console.error('Error updating entry:', error);
                } else {
                    const index = this.entries.findIndex(e => e.id === existingEntry.id);
                    this.entries[index] = { ...data[0], jobId: data[0].job_id }; // Add jobId
                }
            } else {
                return;
            }
        } else {
            const { data, error } = await this.supabase
                .from('entries')
                .insert([{ job_id: jobId, month: monthYearInput, salary, hours }])
                .select();
            if (error) {
                console.error('Error adding entry:', error);
            } else {
                this.entries.push({ ...data[0], jobId: data[0].job_id }); // Add jobId
                this.currentJobId = jobId;
                document.getElementById('viewJobSelect').value = jobId;
                this.updateSalaryHistory();
                this.updateGeneralAnalytics();
                this.updateChart();
                this.updateStatistics();
                document.getElementById('salary').value = '';
                this.setDefaultMonthYear();
            }
        }
    }

    setDefaultMonthYear() {
        const monthYearInput = document.getElementById('monthYearInput');

        // Get all months for the current job
        const jobEntries = this.entries.filter(entry => entry.jobId === this.currentJobId);
        const months = jobEntries.map(entry => entry.month).sort();

        if (months.length > 0) {
            const lastMonth = months[months.length - 1];
            const [year, month] = lastMonth.split('-');
            let nextMonth = parseInt(month) + 1;
            let nextYear = parseInt(year);

            if (nextMonth > 12) {
                nextMonth = 1;
                nextYear++;
            }

            const nextMonthValue = `${nextYear}-${nextMonth.toString().padStart(2, '0')}`;
            monthYearInput.value = nextMonthValue; // Set the value of the month input
        } else {
            // If no entries, set to current month/year
            const today = new Date();
            const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
            const currentYear = today.getFullYear();
            monthYearInput.value = `${currentYear}-${currentMonth}`;
        }
    }

    getCurrentJobEntry() {
        if (!this.currentJobId) return null;

        // Get form data if available
        const monthYearInput = document.getElementById('monthYearInput').value;
        const salary = parseFloat(document.getElementById('salary').value) || 0;
        const hours = parseFloat(document.getElementById('hours').value) || 0;
        const jobId = document.getElementById('jobSelect').value;

        if (monthYearInput && salary && hours && jobId === this.currentJobId) {
            return { month: monthYearInput, salary, hours, jobId };
        }

        // If no current entry in form, get the latest entry for the current job
        const jobEntries = this.entries.filter(entry => entry.jobId === this.currentJobId);
        if (jobEntries.length === 0) return null;

        // Sort by month (newest first)
        jobEntries.sort((a, b) => b.month.localeCompare(a.month));
        return jobEntries[0];
    }

    updateStatistics() {
        const currentEntry = this.getCurrentJobEntry();
        const currentJob = this.jobs.find(job => job.id === this.currentJobId);
        const statsTitle = document.querySelector('.statistics-section h3');

        if (!currentEntry || !currentJob) {
            statsTitle.textContent = 'Current Entry';
            document.getElementById('currentSalary').textContent = '-';
            document.getElementById('currentHours').textContent = '-';
            document.getElementById('currentHourlyRate').textContent = '-';
            document.getElementById('currentDifference').textContent = '-';
            return;
        }

        // Update title with month of last entry
        const [year, month] = currentEntry.month.split('-');
        const entryDate = new Date(year, month - 1);
        const formattedMonth = entryDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        statsTitle.textContent = `Last Entry (${formattedMonth})`;

        const { salary, hours } = currentEntry;
        const hourlyRate = hours > 0 ? salary / hours : 0; // Avoid division by zero
        // Ensure baseRate and baseHours are numbers and not zero to avoid NaN/Infinity
        const baseHourlyRate = (currentJob.baseRate && currentJob.baseHours && currentJob.baseHours !== 0) ? (currentJob.baseRate / currentJob.baseHours) : 0;
        const baseSalaryForHours = baseHourlyRate * hours;
        const difference = salary - baseSalaryForHours;

        // Update Salary
        const salaryElement = document.getElementById('currentSalary');
        salaryElement.textContent = `${salary.toFixed(2)} UAH`;
        salaryElement.className = 'tooltip-trigger';
        salaryElement.setAttribute('data-tooltip', `Base salary proportional to hours worked: ${baseSalaryForHours.toFixed(2)} UAH`);

        // Update Hours
        document.getElementById('currentHours').textContent = `${hours} hours`;

        // Update Hourly Rate
        const hourlyRateElement = document.getElementById('currentHourlyRate');
        hourlyRateElement.textContent = `${hourlyRate.toFixed(2)} UAH/hour`;
        hourlyRateElement.className = `tooltip-trigger ${hourlyRate > baseHourlyRate ? 'positive' : 'negative'}`;
        hourlyRateElement.setAttribute('data-tooltip', `Base hourly rate for this job: ${baseHourlyRate.toFixed(2)} UAH/hour`);

        // Update Difference
        const differenceElement = document.getElementById('currentDifference');
        differenceElement.textContent = `${difference >= 0 ? '+' : ''}${difference.toFixed(2)} UAH`;
        differenceElement.className = `tooltip-trigger ${difference >= 0 ? 'positive' : 'negative'}`;
        differenceElement.setAttribute('data-tooltip', `Base salary proportional to hours worked this month: ${baseSalaryForHours.toFixed(2)} UAH`);
    }

    updateSalaryHistory() {
        const tableBody = document.querySelector('#salaryHistoryTable tbody');
        tableBody.innerHTML = '';

        // Get filtered entries based on analytics settings
        const filteredEntries = this.getFilteredEntriesForAnalytics(this.analyticsSettings.period);

        // Sort entries by month (newest first)
        filteredEntries.sort((a, b) => b.month.localeCompare(a.month));

        // Group entries by job for calculating percentage changes
        const entriesByJob = {};
        filteredEntries.forEach(entry => {
            if (!entriesByJob[entry.jobId]) {
                entriesByJob[entry.jobId] = [];
            }
            entriesByJob[entry.jobId].push(entry);
        });

        // Sort entries within each job by month (oldest first) for percentage calculation
        Object.keys(entriesByJob).forEach(jobId => {
            entriesByJob[jobId].sort((a, b) => a.month.localeCompare(b.month));
        });

        filteredEntries.forEach(entry => {
            const job = this.jobs.find(j => j.id === entry.jobId);
            if (!job) return;

            const row = document.createElement('tr');

            // Format month for display
            const [year, month] = entry.month.split('-');
            const date = new Date(year, month - 1);
            const formattedMonth = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            // Calculate hourly rate and differences
            const hourlyRate = entry.salary / entry.hours;
            // Ensure baseRate and baseHours are numbers and not zero to avoid NaN/Infinity
            const baseHourlyRate = (job.baseRate && job.baseHours && job.baseHours !== 0) ? (job.baseRate / job.baseHours) : 0;
            const baseSalaryForHours = baseHourlyRate * entry.hours;
            const salaryDiff = entry.salary - baseSalaryForHours;
            const rateDiff = hourlyRate - baseHourlyRate;

            // Find previous entry for the same job to calculate percentage change
            const jobEntries = entriesByJob[entry.jobId];
            const entryIndex = jobEntries.findIndex(e => e.id === entry.id);
            const prevEntry = entryIndex > 0 ? jobEntries[entryIndex - 1] : null;

            // Calculate percentage changes if previous entry exists
            let salaryPercentChange = null;
            let hourlyRatePercentChange = null;

            if (prevEntry) {
                const prevSalary = prevEntry.salary;
                const prevHourlyRate = prevEntry.salary / prevEntry.hours;

                salaryPercentChange = ((entry.salary - prevSalary) / prevSalary) * 100;
                hourlyRatePercentChange = ((hourlyRate - prevHourlyRate) / prevHourlyRate) * 100;
            }

            // Create cells
            const monthCell = document.createElement('td');
            monthCell.textContent = formattedMonth;

            const jobCell = document.createElement('td');
            jobCell.textContent = job.name;

            const salaryCell = document.createElement('td');
            salaryCell.classList.add('salary-cell-content');
            const salaryValueSpan = document.createElement('span');
            salaryValueSpan.textContent = `${entry.salary.toFixed(2)} UAH`;
            salaryCell.appendChild(salaryValueSpan);

            // Add percentage change indicator for salary
            if (salaryPercentChange !== null) {
                const percentSpan = document.createElement('span');
                percentSpan.className = salaryPercentChange >= 0 ? 'percent-change positive' : 'percent-change negative';

                // Create SVG arrow
                const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svgIcon.classList.add('arrow-icon');
                svgIcon.setAttribute('width', '12');
                svgIcon.setAttribute('height', '12');

                const useElement = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                useElement.setAttribute('href',
                    salaryPercentChange >= 0 ? '#arrow-up' : '#arrow-down');

                svgIcon.appendChild(useElement);
                percentSpan.appendChild(svgIcon);

                // Add percentage text
                const percentText = document.createTextNode(` ${salaryPercentChange >= 0 ? '+' : ''}${salaryPercentChange.toFixed(1)}%`);
                percentSpan.appendChild(percentText);

                salaryCell.appendChild(percentSpan);
            }

            const hoursCell = document.createElement('td');
            hoursCell.textContent = entry.hours;

            const hourlyRateCell = document.createElement('td');
            hourlyRateCell.innerHTML = `${hourlyRate.toFixed(2)} UAH/h`;

            const salaryDiffCell = document.createElement('td');
            salaryDiffCell.textContent = `${salaryDiff >= 0 ? '+' : ''}${salaryDiff.toFixed(2)}`;
            salaryDiffCell.className = salaryDiff >= 0 ? 'positive' : 'negative';

            const rateDiffCell = document.createElement('td');
            rateDiffCell.textContent = `${rateDiff >= 0 ? '+' : ''}${rateDiff.toFixed(2)} UAH/h`;
            rateDiffCell.className = rateDiff >= 0 ? 'positive' : 'negative';

            const actionCell = document.createElement('td');

            // Create edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => this.openEditEntryModal(entry));
            actionCell.appendChild(editBtn);

            // Create delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => this.deleteEntry(entry.id));
            actionCell.appendChild(deleteBtn);

            // Append cells to row
            row.appendChild(monthCell);
            row.appendChild(jobCell);
            row.appendChild(salaryCell);
            row.appendChild(hoursCell);
            row.appendChild(hourlyRateCell);
            row.appendChild(salaryDiffCell);
            row.appendChild(rateDiffCell);
            row.appendChild(actionCell);

            // Append row to table
            tableBody.appendChild(row);
        });
    }

    openEditEntryModal(entry) {
        // Populate the edit entry form with current values
        document.getElementById('editEntryId').value = entry.id;

        const editEntryJobSpan = document.getElementById('editEntryJob');
        const editEntryJobHidden = document.getElementById('editEntryJobHidden');
        const job = this.jobs.find(j => j.id === entry.jobId);
        if (job) {
            editEntryJobSpan.textContent = job.name;
            editEntryJobHidden.value = job.id; // Store the job ID in the hidden input
        }

        // Set the combined month/year value
        document.getElementById('editEntryMonthYear').value = entry.month;

        document.getElementById('editEntrySalary').value = entry.salary;
        document.getElementById('editEntryHours').value = entry.hours;

        // Show the modal
        document.getElementById('editEntryModal').style.display = 'block';
    }

    async saveEntryEdit() {
        const entryId = document.getElementById('editEntryId').value;
        const jobId = document.getElementById('editEntryJobHidden').value;
        const monthYear = document.getElementById('editEntryMonthYear').value;
        const salary = parseFloat(document.getElementById('editEntrySalary').value);
        const hours = parseFloat(document.getElementById('editEntryHours').value);

        const { data, error } = await this.supabase
            .from('entries')
            .update({ month: monthYear, salary, hours })
            .eq('id', entryId)
            .select();

        if (error) {
            console.error('Error updating entry:', error);
        } else {
            const index = this.entries.findIndex(e => e.id === entryId);
            this.entries[index] = { ...data[0], jobId: data[0].job_id }; // Add jobId
            this.updateSalaryHistory();
            this.updateGeneralAnalytics();
            this.updateChart();
            this.updateStatistics();
            document.getElementById('editEntryModal').style.display = 'none';
        }
    }

    async deleteEntry(entryId) {
        if (confirm('Are you sure you want to delete this entry?')) {
            const { error } = await this.supabase.from('entries').delete().eq('id', entryId);
            if (error) {
                console.error('Error deleting entry:', error);
            } else {
                this.entries = this.entries.filter(entry => entry.id !== entryId);
                this.updateSalaryHistory();
                this.updateGeneralAnalytics();
                this.updateChart();
                this.updateStatistics();
            }
        }
    }

    updateGeneralAnalytics() {
        // Use the analytics settings filter instead of the chart period filter
        const filteredEntries = this.getFilteredEntriesForAnalytics(this.analyticsSettings.period);

        // Calculate total income and hours
        let totalIncome = 0;
        let totalHours = 0;

        filteredEntries.forEach(entry => {
            totalIncome += entry.salary;
            totalHours += entry.hours;
        });

        // Calculate average hourly rate
        const averageRate = totalHours > 0 ? totalIncome / totalHours : 0;

        // Update the UI
        document.getElementById('totalIncome').textContent = `${totalIncome.toFixed(2)} UAH`;
        document.getElementById('totalHours').textContent = `${totalHours.toFixed(2)}`;
        document.getElementById('averageRate').textContent = `${averageRate.toFixed(2)} UAH/hour`;

        // Update the gear animation to indicate custom settings are applied
        const gearAnimation = document.getElementById('gearAnimation');
        const hasCustomSettings = this.analyticsSettings.includedJobs.length < this.jobs.length ||
            this.analyticsSettings.period !== 'all';

        if (hasCustomSettings) {
            gearAnimation.classList.add('active-settings');

            // Add tooltip to show current settings
            gearAnimation.setAttribute('data-tooltip', this.getAnalyticsSummary());
        } else {
            gearAnimation.classList.remove('active-settings');
            gearAnimation.removeAttribute('data-tooltip');
        }
    }

    // Helper to get a summary of current analytics settings for tooltip
    getAnalyticsSummary() {
        let summary = 'Current Analytics Settings:\n';
        summary += `Period: ${this.analyticsSettings.period}\n`;

        if (this.analyticsSettings.period === 'custom') {
            summary += `  Start Date: ${this.analyticsSettings.customStartDate || 'N/A'}\n`;
            summary += `  End Date: ${this.analyticsSettings.customEndDate || 'N/A'}\n`;
        }

        if (this.analyticsSettings.includedJobs.length === this.jobs.length) {
            summary += 'Jobs: All Jobs Included\n';
        } else if (this.analyticsSettings.includedJobs.length === 0) {
            summary += 'Jobs: No Jobs Included\n';
        } else {
            const includedJobNames = this.analyticsSettings.includedJobs
                .map(jobId => this.jobs.find(job => job.id === jobId)?.name)
                .filter(name => name)
                .join(', ');
            summary += `Jobs: ${includedJobNames}\n`;
        }
        return summary;
    }

    updateBaseRatesInfo() {
        const container = document.getElementById('baseRatesContainer');
        container.innerHTML = '';

        this.jobs.forEach(job => {
            const baseHourlyRate = job.baseRate / job.baseHours;

            const baseRateItem = document.createElement('div');
            baseRateItem.className = 'base-rate-item';
            baseRateItem.textContent = `${job.name}: ${job.baseRate} UAH for ${job.baseHours} hours | ${baseHourlyRate.toFixed(2)} UAH/hour`;

            container.appendChild(baseRateItem);
        });
    }

    getFilteredEntries() {
        if (this.currentPeriod === 'all') {
            return [...this.entries];
        }

        const now = new Date();
        let cutoffDate;

        switch (this.currentPeriod) {
            case 'year':
                cutoffDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
                break;
            case '6months':
                cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                break;
            case '3months':
                cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                break;
            default:
                return [...this.entries];
        }

        return this.entries.filter(entry => {
            const [year, month] = entry.month.split('-');
            const entryDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            return entryDate >= cutoffDate;
        });
    }

    setupChart() {
        const ctx = document.getElementById('salaryChart').getContext('2d');

        // Set up Chart.js with dark theme
        Chart.defaults.color = '#e0e0e0';
        Chart.defaults.borderColor = '#34495e';

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Monthly Income',
                    data: [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'transparent',
                    tension: 0.4,
                    fill: false,
                    pointRadius: 5, // Slightly smaller points
                    pointHoverRadius: 7, // Slightly smaller hover radius
                    pointBackgroundColor: '#4CAF50'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Month',

                        },
                        grid: {
                            color: '#2c3e50'
                        },
                        ticks: {
                            autoSkip: true,
                            maxRotation: 45,
                            minRotation: 0,
                            padding: 10 // Add padding to x-axis labels
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount (UAH)',
                            color: '#0D0A0B',
                        },
                        grid: {
                            color: '#2c3e50'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#0D0A0B',
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: '#34495e',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#2c3e50',
                        borderWidth: 1
                    }
                }
            }
        });

        this.updateChart();
    }

    updateChart() {
        let filteredEntries = this.getFilteredEntriesForAnalytics(this.monthlyIncomeSettings.period);
        const chartType = this.monthlyIncomeSettings.chartType;

        // Further filter by selected chart view if it's not 'overall'
        if (this.currentChartView !== 'overall') {
            filteredEntries = filteredEntries.filter(entry => entry.jobId === this.currentChartView);
        }

        // Get all months from filtered entries
        const allMonths = [...new Set(filteredEntries.map(entry => entry.month))].sort();

        // Format month labels
        const labels = allMonths.map(month => {
            const [year, monthNum] = month.split('-');
            const date = new Date(year, monthNum - 1);
            return date.toLocaleDateString('en-EN', { month: 'long', year: 'numeric' });
        });

        this.chart.data.labels = labels;
        this.chart.data.datasets = []; // Clear existing datasets

        // Define a set of colors for different job lines
        const colors = [
            '#4CAF50', // Green
            '#2196F3', // Blue
            '#FFC107', // Amber
            '#F44336', // Red
            '#9C27B0', // Purple
            '#00BCD4', // Cyan
            '#FF9800', // Orange
            '#607D8B'  // Blue Grey
        ];

        // Combined view for all included jobs
        let chartData;
        let yAxisTitle;
        let datasetLabel;

        if (chartType === 'salary') {
            chartData = allMonths.map(month => {
                const monthEntries = filteredEntries.filter(entry => entry.month === month);
                return monthEntries.reduce((sum, entry) => sum + entry.salary, 0);
            });
            yAxisTitle = 'Total Salary (UAH)';
            datasetLabel = 'Monthly Income';
        } else {
            chartData = allMonths.map(month => {
                const monthEntries = filteredEntries.filter(entry => entry.month === month);
                const totalSalary = monthEntries.reduce((sum, entry) => sum + entry.salary, 0);
                const totalHours = monthEntries.reduce((sum, entry) => sum + entry.hours, 0);
                return totalHours > 0 ? totalSalary / totalHours : 0;
            });
            yAxisTitle = 'Average Hourly Rate (UAH/hour)';
            datasetLabel = 'Hourly Rate';
        }

        this.chart.data.datasets.push({
            label: datasetLabel,
            data: chartData,
            borderColor: colors[0], // Use the first color for overall
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: colors[0]
        });

        // Add base salary line if chart type is 'salary'
        if (chartType === 'salary') {
            const baseSalaryData = allMonths.map(month => {
                const monthEntries = filteredEntries.filter(entry => entry.month === month);
                return monthEntries.reduce((sum, entry) => {
                    const job = this.jobs.find(j => j.id === entry.jobId);
                    if (job) {
                        const baseHourlyRate = job.baseRate / job.baseHours;
                        return sum + (baseHourlyRate * entry.hours);
                    }
                    return sum;
                }, 0);
            });

            this.chart.data.datasets.push({
                label: 'Base Salary (Proportional)',
                data: baseSalaryData,
                borderColor: '#7e8495', // A neutral color
                backgroundColor: 'transparent',
                borderDash: [5, 5], // Dotted line
                tension: 0.4,
                fill: false,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#0D0A0B'
            });
        } else if (chartType === 'hourlyRate') {
            const baseHourlyRateData = allMonths.map(month => {
                const monthEntries = filteredEntries.filter(entry => entry.month === month);
                if (monthEntries.length === 0) return 0;

                // Calculate weighted average of base hourly rate
                const totalHours = monthEntries.reduce((sum, entry) => sum + entry.hours, 0);
                if (totalHours === 0) return 0;

                const weightedBaseRate = monthEntries.reduce((sum, entry) => {
                    const job = this.jobs.find(j => j.id === entry.jobId);
                    if (job) {
                        const baseHourlyRate = job.baseRate / job.baseHours;
                        return sum + (baseHourlyRate * entry.hours);
                    }
                    return sum;
                }, 0);

                return weightedBaseRate / totalHours;
            });

            this.chart.data.datasets.push({
                label: 'Base Hourly Rate',
                data: baseHourlyRateData,
                borderColor: '#0D0A0B',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.4,
                fill: false,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#0D0A0B'
            });
        }

        this.chart.options.scales.y.title.text = yAxisTitle;

        this.chart.update();
    }

    async migrateOldData() {
        const oldJobs = localStorage.getItem('salaryTrackerJobs');
        const oldEntries = localStorage.getItem('salaryTrackerEntries');

        if ((oldJobs || oldEntries) && this.jobs.length === 0 && this.entries.length === 0) {
            if (!confirm('Old local data found. Do you want to migrate it to Supabase? This is a one-time operation.')) {
                localStorage.removeItem('salaryTrackerJobs');
                localStorage.removeItem('salaryTrackerEntries');
                return;
            }

            try {
                if (oldJobs) {
                    const jobsToMigrate = JSON.parse(oldJobs).map(job => ({
                        name: job.name,
                        base_rate: job.baseRate,
                        base_hours: job.baseHours
                    }));
                    const { data: newJobs, error: jobsError } = await this.supabase.from('jobs').insert(jobsToMigrate).select();
                    if (jobsError) throw jobsError;
                    this.jobs = newJobs;
                }

                if (oldEntries) {
                    const entriesToMigrate = JSON.parse(oldEntries).map(entry => {
                        const oldJob = JSON.parse(oldJobs).find(j => j.id === entry.jobId);
                        const newJob = this.jobs.find(j => j.name === oldJob.name);
                        return {
                            job_id: newJob.id,
                            month: entry.month,
                            salary: entry.salary,
                            hours: entry.hours
                        };
                    });
                    const { error: entriesError } = await this.supabase.from('entries').insert(entriesToMigrate);
                    if (entriesError) throw entriesError;
                }

                alert('Data migrated successfully!');
                localStorage.removeItem('salaryTrackerJobs');
                localStorage.removeItem('salaryTrackerEntries');
                await this.loadData(); // Reload data from Supabase
            } catch (error) {
                console.error('Error migrating data:', error);
                alert(`Error migrating data: ${error.message}`);
            }
        }
    }
    // Populate Analytics Settings Modal
    populateAnalyticsSettingsModal() {
        // Set period select to current value
        document.getElementById('analyticsPeriodSelect').value = this.analyticsSettings.period;

        // Show/hide custom date range based on period
        const customDateRange = document.getElementById('customDateRange');
        customDateRange.style.display = this.analyticsSettings.period === 'custom' ? 'block' : 'none';

        // Set custom date values if they exist
        if (this.analyticsSettings.customStartDate) {
            document.getElementById('customStartDate').value = this.analyticsSettings.customStartDate;
        }
        if (this.analyticsSettings.customEndDate) {
            document.getElementById('customEndDate').value = this.analyticsSettings.customEndDate;
        }

        // Populate job checkboxes
        this.populateJobCheckboxes();
    }

    // Populate job checkboxes in analytics settings
    populateJobCheckboxes() {
        const jobsContainer = document.getElementById('analyticsJobsContainer');
        jobsContainer.innerHTML = '';

        // If no jobs are explicitly included, include all by default
        const includedJobs = this.analyticsSettings.includedJobs.length > 0
            ? this.analyticsSettings.includedJobs
            : this.jobs.map(job => job.id);

        // Sort jobs alphabetically for better organization
        const sortedJobs = [...this.jobs].sort((a, b) => a.name.localeCompare(b.name));

        sortedJobs.forEach(job => {
            const jobLabel = document.createElement('label');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = job.id;
            checkbox.checked = includedJobs.includes(job.id);
            checkbox.id = `job-checkbox-${job.id}`;

            const labelText = document.createTextNode(job.name);

            jobLabel.appendChild(checkbox);
            jobLabel.appendChild(labelText);

            jobsContainer.appendChild(jobLabel);
        });
    }

    // Select or deselect all jobs
    selectAllJobs(selectAll) {
        const checkboxes = document.querySelectorAll('#analyticsJobsContainer input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll;
        });
    }

    // Reset analytics settings to default
    resetAnalyticsSettings() {
        // Reset to default values
        this.analyticsSettings = {
            period: 'all',
            customStartDate: null,
            customEndDate: null,
            includedJobs: this.jobs.map(job => job.id) // Include all jobs
        };

        // Update the modal UI
        this.populateAnalyticsSettingsModal();

        // Update analytics immediately
        this.updateGeneralAnalytics();
        this.updateChart(); // Also update the chart
        this.updateSalaryHistory(); // Also update the salary history
    }

    // Apply Analytics Settings
    applyAnalyticsSettings() {
        // Get period
        const periodSelect = document.getElementById('analyticsPeriodSelect');
        this.analyticsSettings.period = periodSelect.value;

        // Get custom date range if applicable
        if (this.analyticsSettings.period === 'custom') {
            this.analyticsSettings.customStartDate = document.getElementById('customStartDate').value;
            this.analyticsSettings.customEndDate = document.getElementById('customEndDate').value;
        } else {
            this.analyticsSettings.customStartDate = null;
            this.analyticsSettings.customEndDate = null;
        }

        // Get included jobs
        this.analyticsSettings.includedJobs = [];
        const jobCheckboxes = document.querySelectorAll('#analyticsJobsContainer input[type="checkbox"]:checked');
        jobCheckboxes.forEach(checkbox => {
            this.analyticsSettings.includedJobs.push(checkbox.value);
        });

        // Update analytics with new settings
        this.updateGeneralAnalytics();
        this.updateChart(); // Also update the chart
    }

    applyMonthlyIncomeSettings() {
        this.monthlyIncomeSettings.period = document.getElementById('periodSelect').value;
        this.monthlyIncomeSettings.chartType = document.querySelector('input[name="chartType"]:checked').value;
        this.currentChartView = document.getElementById('chartViewSelect').value;
        this.updateChart();
    }

    // Get filtered entries based on analytics settings
    getFilteredEntriesForAnalytics(period = this.analyticsSettings.period) {
        let filteredEntries = [...this.entries];

        // Filter by job if specific jobs are included
        if (this.analyticsSettings.includedJobs.length > 0) {
            filteredEntries = filteredEntries.filter(entry =>
                this.analyticsSettings.includedJobs.includes(entry.jobId)
            );
        }

        // Filter by period
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        switch (period) {
            case 'year':
                // Filter to current year
                filteredEntries = filteredEntries.filter(entry => {
                    const [year] = entry.month.split('-');
                    return parseInt(year) === currentYear;
                });
                break;

            case '6months':
                // Filter to last 6 months
                filteredEntries = filteredEntries.filter(entry => {
                    const [year, month] = entry.month.split('-').map(Number);
                    let monthsAgo = (currentYear - year) * 12 + (currentMonth - month);
                    return monthsAgo >= 0 && monthsAgo < 6;
                });
                break;

            case '3months':
                // Filter to last 3 months
                filteredEntries = filteredEntries.filter(entry => {
                    const [year, month] = entry.month.split('-').map(Number);
                    let monthsAgo = (currentYear - year) * 12 + (currentMonth - month);
                    return monthsAgo >= 0 && monthsAgo < 3;
                });
                break;

            case 'custom':
                // Filter to custom date range
                if (this.analyticsSettings.customStartDate && this.analyticsSettings.customEndDate) {
                    filteredEntries = filteredEntries.filter(entry => {
                        return entry.month >= this.analyticsSettings.customStartDate &&
                            entry.month <= this.analyticsSettings.customEndDate;
                    });
                }
                break;

            // case 'all': - no filtering needed
        }

        return filteredEntries;
    }

    resetMonthlyIncomeSettings() {
        this.monthlyIncomeSettings = {
            period: 'all',
            chartType: 'salary'
        };
        // Update the modal UI to reflect default settings
        document.getElementById('periodSelect').value = this.monthlyIncomeSettings.period;
        document.querySelector(`input[name="chartType"][value="${this.monthlyIncomeSettings.chartType}"]`).checked = true;

        // Update chart view select to 'Overall'
        this.currentChartView = 'overall';
        this.populateChartViewSelect(); // This will set the selected value

        this.updateChart();
    }

    // Export data to JSON format
    exportData() {
        if (this.entries.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }

        // Get user information from first job or use defaults
        const firstJob = this.jobs.length > 0 ? this.jobs[0] : null;
        const userName = firstJob ? firstJob.name : '';

        // Create income sources from jobs
        const incomeSources = this.jobs.map(job => ({
            id: job.id,
            label: job.name
        }));

        // Sort entries by date
        const sortedEntries = [...this.entries].sort((a, b) => a.month.localeCompare(b.month));

        // Group entries by month to create records with multiple income sources
        const entriesByMonth = {};
        sortedEntries.forEach(entry => {
            if (!entriesByMonth[entry.month]) {
                entriesByMonth[entry.month] = [];
            }
            entriesByMonth[entry.month].push(entry);
        });

        // Convert grouped entries to export format
        const records = Object.keys(entriesByMonth).sort().map(month => {
            const [year, monthNum] = month.split('-');
            const startDate = `${year}-${monthNum}-01`;
            const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]; // Last day of month

            const monthEntries = entriesByMonth[month];

            // Create incomes array for this month
            const incomes = monthEntries.map(entry => {
                const job = this.jobs.find(j => j.id === entry.jobId);

                // Split salary into base salary and potential bonus
                // If salary is significantly higher than base rate, treat excess as bonus
                let salaryGross = entry.salary;
                let bonuses = 0;

                if (job && job.baseRate && job.baseHours) {
                    const expectedSalary = (job.baseRate / job.baseHours) * entry.hours;
                    const threshold = expectedSalary * 1.1; // 10% threshold for bonus detection

                    if (entry.salary > threshold) {
                        bonuses = Math.round(entry.salary - expectedSalary);
                        salaryGross = Math.round(expectedSalary);
                    }
                }

                return {
                    source_id: entry.jobId,
                    salary_gross: salaryGross,
                    bonuses: bonuses,
                    other_income: 0,
                    hours_worked: entry.hours
                };
            });

            // Create notes with hours information
            const notesArray = monthEntries.map(entry => {
                const job = this.jobs.find(j => j.id === entry.jobId);
                return job ? `${job.name}: ${entry.hours}ч` : `${entry.hours}ч`;
            });
            const notes = notesArray.length > 1 ? notesArray.join(', ') : '';

            return {
                period_start: startDate,
                period_end: endDate,
                incomes: incomes,
                notes: notes
            };
        });

        // Calculate summary data
        const periodStart = records.length > 0 ? records[0].period_start : null;
        const periodEnd = records.length > 0 ? records[records.length - 1].period_end : null;

        // Create export object with new format
        const exportData = {
            person: {
                id: null,
                name: userName,
                role: firstJob ? firstJob.name : '',
                country: 'Ukraine'
            },
            currency: 'UAH',
            period_granularity: 'monthly',
            income_sources: incomeSources,
            records: records,
            export_summary: {
                records_count: records.length,
                period_covered_start: periodStart,
                period_covered_end: periodEnd,
                exported_at: new Date().toISOString().replace('Z', '+03:00')
            },
            metadata: {
                generated_by: 'Salary Tracker v1.3',
                version: '1.0',
                notes: `Экспорт данных о зарплате с ${incomeSources.length} источник${incomeSources.length === 1 ? 'ом' : incomeSources.length < 5 ? 'ами' : 'ами'} дохода: ${incomeSources.map(s => s.label).join(', ')}`
            }
        };

        // Create prompt text
        const promptText = `Я присылаю JSON с данными по доходам за весь доступный период. В файле есть несколько источников дохода, перечисленных в поле income_sources, и в каждом месяце records[].incomes указаны суммы по source_id.

Важно: в данных нет налогов и нет расходов — считай net_income = salary_gross + bonuses + other_income для каждого источника и периода.

Проанализируй весь период и выдай подробный отчёт на русском со следующими разделами:

1) Краткое резюме (2–4 предложения): общий average monthly net income и распределение между источниками (какой источник доминирует).

2) KPI за весь период:
- total_gross_income (всех источников)
- total_net_income (тот же, так как налогов нет)
- breakdown per source: total_by_source и share_of_total (в %)
- average_monthly_net_income (всего) и per_source averages
- volatility per source (stddev)
- share_of_bonuses overall и per source

3) Тренды:
- income_trend overall: массив period(YYYY-MM) → total_net_income
- income_trend per source: для каждого source_id массив period → net_income
- определение тренда (рост/падение/стабильно) для каждого источника и в целом
- выделение notable months (спайки/падения) и вероятные причины

4) Корреляция между источниками (корр коэффициент): есть ли связь (например когда private падает, state растёт)

5) Forecast: простая линейная проекция total и per source на 3 следующих периода (указать допущения)

6) Рекомендации (6–12 пунктов), привязанные к источникам: как стабилизировать частный доход, как оптимально распределять бонусы, идеи для диверсификации или сохранения бонусов

7) Data quality: перечисли пропущенные/неоднородные записи (например отсутствует запись для source_id в месяце) и предложи дополнительные поля (pay_date, income_type, contract_type)

8) В конце — CSV-подобные таблицы с KPI и массивы для графиков:
- total_income_trend (period,value)
- per_source_trends: {source_id: [{period,value}, ...], ...}

Вставь JSON ниже:

`;

        // Create and download file
        const jsonString = promptText + JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `salary_export_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Данные экспортированы:', exportData);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new SalaryTracker();
    app.setupTooltips(); // Initialize tooltips
});
