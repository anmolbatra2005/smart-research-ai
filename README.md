# DocMind – RAG Question & Test System

- **LLM**: Groq API (free tier, Llama 3.3 70B) — get key at https://console.groq.com
- **Embeddings**: sentence-transformers running locally on CPU (no API needed)
- **Vector DB**: ChromaDB (local, free)
- **Frontend**: React


- Groq free tier = 14,400 requests/day, no credit card needed
- Embeddings run on your own machine (~90MB model, one-time download)

---

## Prerequisites
- Python 3.10+
- Node.js 18+
- A **free Groq API key** from https://console.groq.com (just sign up, no card)

---

## Setup

### 1. Backend

```bash
cd rag-system/backend

python -m venv venv

# Activate:
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Set your FREE Groq API key:
# Windows:
set GROQ_API_KEY=gsk_xxxxxxxxxxxx
# Mac/Linux:
export GROQ_API_KEY=gsk_xxxxxxxxxxxx

uvicorn main:app --reload --port 8000
```

> First run will download the embedding model (~90MB). After that it's instant.

### 2. Frontend (new terminal)

```bash
cd rag-system/frontend
npm install
npm start
```

Open http://localhost:3000

---

## Get Your Free Groq Key
1. Go to https://console.groq.com
2. Sign up (free, no credit card)
3. Click "API Keys" → "Create API Key"
4. Copy and use as GROQ_API_KEY

---




## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload PDF/DOCX/TXT |
| GET | `/documents` | List documents |
| DELETE | `/documents/{id}` | Delete document |
| POST | `/ask` | RAG Q&A |
| POST | `/generate-test` | Generate MCQ test |
| POST | `/evaluate` | Evaluate answers |
