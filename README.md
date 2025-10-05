# WhatsApp Business Platform

A Node.js application that handles WhatsApp Business API webhooks for automated messaging.

## Features

- Webhook verification for WhatsApp Business API
- Automated message handling
- Simple conversation flow (asks for name, responds with greeting)
- Easy deployment to Render

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your WhatsApp Business API credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `WHATSAPP_ACCESS_TOKEN`: Your WhatsApp Business API access token
- `WHATSAPP_PHONE_NUMBER_ID`: Your WhatsApp Business phone number ID
- `WHATSAPP_VERIFY_TOKEN`: A custom verification token for webhook security

### 2. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or start production server
npm start
```

### 3. Deployment to Render

1. Push your code to GitHub
2. Connect your GitHub repository to Render
3. Set environment variables in Render dashboard
4. Deploy your application

### 4. Configure WhatsApp Webhook

1. Go to your Meta Developer Console
2. Navigate to your WhatsApp Business app
3. Set webhook URL to: `https://your-render-app.onrender.com/webhook`
4. Set verify token to match your `WHATSAPP_VERIFY_TOKEN`
5. Subscribe to `messages` field

## API Endpoints

- `GET /webhook` - Webhook verification
- `POST /webhook` - Receive WhatsApp messages
- `GET /health` - Health check endpoint

## Message Flow

1. User sends any message to your WhatsApp Business number
2. Bot responds: "Hello! What's your name?"
3. User replies with their name
4. Bot responds: "Hello, [name]! Nice to meet you. How can I help you today?"
5. Bot continues conversation with user

## Security Notes

- Keep your access tokens secure
- Use environment variables for all sensitive data
- Verify webhook requests using the verify token
- Consider implementing rate limiting for production use

## Troubleshooting

- Check Render logs for error messages
- Verify webhook URL is accessible
- Ensure all environment variables are set correctly
- Test webhook verification endpoint manually
