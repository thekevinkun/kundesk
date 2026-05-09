# Kundesk

## 1. What is Kundesk

**Kundesk** is an AI-powered customer service SaaS platform built specifically for Indonesian SMEs (warung, klinik, salon, properti, retail, etc.).

### The Core Problem

Indonesian SMEs are drowning in repetitive WhatsApp and website messages from customers asking the same questions — menu, harga, jam buka, ketersediaan, cara order. They can't afford enterprise CS solutions, and nothing is built for the Indonesian context.

### The Solution

Business owners sign up, upload their business documents (menu PDF, FAQ, price list), and Kundesk generates an AI chatbot that answers their customers 24/7 — automatically, accurately, and in Bahasa Indonesia — based only on their own documents.

### How It Works (User Flow)

1. Business owner signs up → Clerk creates their Organization (tenant)
2. They upload documents to their dashboard → files go to AWS S3 → background processing parses, chunks, and embeds them into pgvector
3. They configure their chatbot (name, tone, language, accent color)
4. They receive multiple delivery channels — QR code, shareable link, embed widget, and (Pro) WhatsApp integration
5. Their customers interact via whichever channel the business shares → RAG pipeline retrieves relevant chunks → OpenAI streams the answer

### Important Product Reality

The web widget alone is insufficient for the Indonesian SME market. Most Indonesian SMEs do not have websites. Customers contact businesses via WhatsApp — not by visiting a website. This shapes the delivery channel strategy. See Section 12 for the full channel breakdown.

### Target Market

Indonesian SMEs — warung makan, klinik, salon, properti, toko online, travel agent. Businesses with 1–50 employees who receive repetitive customer questions daily.

### Business Model

Subscription SaaS, billed monthly in Rupiah via Midtrans.

|Plan|Price|Messages/month|Documents|Chatbots|
|---|---|---|---|---|
|Free|Rp 0|100|3|1|
|Starter|Rp 149.000|1.000|20|1|
|Pro|Rp 399.000|10.000|Unlimited|3|
