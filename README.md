# Salary Tracker

A simple web application for tracking salary and work hours without authentication requirements.

## Features

- **No Authentication Required**: The app works immediately without any login or signup
- **Salary Tracking**: Add and manage salary entries with job details
- **Analytics**: View statistics and charts of your income over time
- **Multiple Jobs**: Track salary for different jobs simultaneously
- **Telegram Bot**: Manage your salary data through a Telegram bot
- **Responsive Design**: Works on desktop and mobile devices

## Setup

1. **Clone the repository**
2. **Configure Supabase**:
   - Create a Supabase project
   - Update `config.js` with your Supabase URL and anon key
   - Create the following tables in your Supabase database:

### Database Schema

**jobs table:**
```sql
CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  base_rate DECIMAL(10,2) NOT NULL,
  base_hours DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**entries table:**
```sql
CREATE TABLE entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  salary DECIMAL(10,2) NOT NULL,
  hours DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

3. **Configure Telegram Bot** (optional):
   - Create a Telegram bot via @BotFather
   - Set the webhook URL to your deployed API endpoint
   - Add environment variables: `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## Usage

### Web Application
1. Open `index.html` in your browser
2. Add jobs through the "Job Settings" button
3. Add salary entries using the form
4. View analytics and charts

### Telegram Bot Commands
- `/start` - Show main menu
- `/add_salary <job_name> <YYYY-MM> <salary> <hours>` - Add salary entry
- Use inline buttons for navigation

## Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Other Platforms
The application can be deployed to any static hosting service since it's a client-side application.

## Security Note

Since this application doesn't use authentication, all data is shared across all users. For production use with multiple users, consider implementing proper authentication and row-level security policies in Supabase.

## License

MIT License
