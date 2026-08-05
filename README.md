# Oopz

A global feed + chat app with live AI translation and an AI safety check on every post and message.

## 1. Install

npm install

## 2. Add your Anthropic API key

Get a key from console.anthropic.com, then copy .env.example to a new file named .env and paste your key in place of "your-key-here". This key is only ever read on the server (api/claude.js) — it's never sent to the browser.

## 3. Run it locally

Install the Vercel CLI with: npm install -g vercel

Then run: vercel dev

This opens the app at http://localhost:3000 with translation and safety checks working. (npm run dev also works for pure frontend iteration, but /api/claude calls will fail since Vite alone doesn't run serverless functions.)

## 4. Deploy it for real

Run: vercel

Then run: vercel --prod

In the Vercel dashboard, go to your project, then Settings, then Environment Variables, and add ANTHROPIC_API_KEY there too (.env only works locally). Redeploy after adding it.

You'll get a public URL like oopz.vercel.app that anyone can open — no download required on their end.

## What still runs on temporary storage

Posts and chats currently save through window.storage, which only exists inside a Claude artifact — outside of it those calls quietly no-op, so the app runs fine but nothing persists between visits yet. That's the next step: swapping in a real database like Supabase or Firebase.
