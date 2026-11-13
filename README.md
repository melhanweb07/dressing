# Aavya Studio

A responsive fashion storefront built with React, TypeScript, Vite, Tailwind CSS, Framer Motion, React Router, Zustand, Axios, React Hook Form, and Zod.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and set `VITE_API_URL` to your Express API URL. Set the optional `VITE_GPAY_NUMBER` and `VITE_WHATSAPP_NUMBER` to the store's configured contact details.
4. Start the development server with `npm run dev`.
5. Create a production build with `npm run build`, then preview it with `npm run preview`.

The development environment uses the clearly separated sample catalogue in `src/data/products.ts` and stores demo orders in browser local storage. Production builds load products and orders from the configured API; they do not fall back to sample products or pretend that an order was submitted when the API is unavailable.

## Backend API

The independently deployable Express + TypeScript + Supabase backend, schema migration, authenticated admin API, transactional order and inventory logic, upload service, tests, and Postman examples are in [`backend/`](backend/README.md). Set the frontend's `VITE_API_URL` to that service's `/api` URL. The backend recalculates prices and delivery, and order payment remains `Pending` until an admin manually verifies the GPay transfer.

## Deploy to Vercel

1. Push the project to a Git provider and import it into Vercel.
2. Keep the framework preset as **Vite**. The build command is `npm run build` and the output directory is `dist`.
3. Add `VITE_API_URL`, `VITE_GPAY_NUMBER`, and `VITE_WHATSAPP_NUMBER` in the Vercel project environment settings. The API must allow requests from the deployed storefront origin.
4. Deploy. `vercel.json` rewrites client-side routes to the Vite entry point.

Only public configuration belongs in `VITE_*` variables. Never put API secrets or private payment credentials in the client environment.
