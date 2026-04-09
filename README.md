# SQL Toolkit

A web app that helps you work with SQL queries using the Claude API. Available at [sql.lesterdominguez.com](https://sql.lesterdominguez.com).

## Features

**Explain SQL** — Paste a query and get a plain-English explanation, optimization suggestions, and a rewritten version streamed in real time.

**Write SQL** — Describe what data you want in plain English (with an optional table schema) and get a ready-to-use SQL query generated for you.

## Local development

### Prerequisites

- Node.js 18+
- A Vercel account with the CLI installed (`npm install -g vercel`)
- An Anthropic API key

### Setup

```bash
npm install
```

Create a `.env` file:

```bash
ANTHROPIC_API_KEY=your-key-here
```

### Run locally

```bash
vercel dev
```

The app will be available at `http://localhost:3000`. This runs both the frontend and the API functions locally.

## Deployment

```bash
vercel --prod
```

**Required before deploying:**
- Vercel CLI installed and authenticated (`vercel login`)
- `ANTHROPIC_API_KEY` set in Vercel environment variables (`vercel env add ANTHROPIC_API_KEY`)

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Anthropic SDK (`claude-opus-4-6`)
- Vercel (hosting + serverless Edge functions)
- Server-Sent Events for streaming
