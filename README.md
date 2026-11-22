# LegalSearch: Indian legal research portal

Live: **[legal-search-case-files.vercel.app](https://legal-search-case-files.vercel.app)**

Next.js front end for researching Indian case law. It talks to a set of Python services deployed on Hugging Face
Spaces (built in [legalRAG](https://github.com/arav7781/legalRAG)).

## Pages

| Route | What it does |
| --- | --- |
| `/` | Case search across sources, document view, court and legal-news feeds, with links out to Indian Kanoon |
| `/chatbot` | Upload or link a judgment PDF and ask questions about it |
| `/consultation` | Multi-turn legal consultation with saved sessions (create, reload history, delete) |
| `/voicebot` | Voice assistant over WebRTC with LiveKit (token fetched from the backend) |

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui (Radix) · LiveKit · react-hook-form + zod ·
Recharts · deployed on Vercel

## Run locally

```bash
pnpm install
pnpm dev     # http://localhost:3000
```

The API base URLs are set at the top of each page; point them at your own backend if you run the services locally.
