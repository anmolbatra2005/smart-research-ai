import os
import uuid
import json
import re
from pathlib import Path

from groq import Groq
import chromadb
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

import pdfplumber
import docx

app = FastAPI(title="RAG System API (Free Stack)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Groq client — free tier, get key at https://console.groq.com (no card needed)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
CHAT_MODEL = "llama-3.3-70b-versatile"

# Local CPU embeddings — totally free, downloads ~90MB on first run
print("Loading embedding model (first run downloads ~90MB)...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
print("Embedding model ready.")

CHROMA_DIR = Path("./chroma_db")
CHROMA_DIR.mkdir(exist_ok=True)
chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))

UPLOADS_DIR = Path("./uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

documents: dict[str, dict] = {}

# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_text(file_path: Path, content_type: str) -> str:
    ext = file_path.suffix.lower()
    if ext == ".pdf" or "pdf" in content_type:
        pages = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    pages.append(t)
        return "\n".join(pages)
    elif ext == ".docx" or "wordprocessing" in content_type:
        doc = docx.Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    else:
        return file_path.read_text(errors="replace")


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i: i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return [c for c in chunks if c.strip()]


def embed(texts: list[str]) -> list[list[float]]:
    return embedder.encode(texts, show_progress_bar=False).tolist()


def get_or_create_collection(doc_id: str):
    return chroma_client.get_or_create_collection(
        name=f"doc_{doc_id}",
        metadata={"hnsw:space": "cosine"},
    )


def chat(system: str, user: str, max_tokens: int = 1024) -> str:
    resp = groq_client.chat.completions.create(
        model=CHAT_MODEL,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return resp.choices[0].message.content

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": CHAT_MODEL}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    allowed_ext = {".pdf", ".txt", ".docx"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(400, "Unsupported file. Use PDF, TXT, or DOCX.")

    doc_id = str(uuid.uuid4())[:8]
    save_path = UPLOADS_DIR / f"{doc_id}_{file.filename}"
    content = await file.read()
    save_path.write_bytes(content)

    text = extract_text(save_path, file.content_type or "")
    if not text.strip():
        raise HTTPException(422, "Could not extract text from document.")

    chunks = chunk_text(text)
    embeddings = embed(chunks)

    col = get_or_create_collection(doc_id)
    col.add(
        ids=[f"{doc_id}_chunk_{i}" for i in range(len(chunks))],
        embeddings=embeddings,
        documents=chunks,
        metadatas=[{"chunk_index": i} for i in range(len(chunks))],
    )

    documents[doc_id] = {
        "name": file.filename,
        "chunks": len(chunks),
        "collection": f"doc_{doc_id}",
        "preview": text[:300],
    }
    return {"doc_id": doc_id, "name": file.filename, "chunks": len(chunks)}


@app.get("/documents")
def list_documents():
    return {"documents": [{"doc_id": k, **v} for k, v in documents.items()]}


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(404, "Document not found")
    try:
        chroma_client.delete_collection(f"doc_{doc_id}")
    except Exception:
        pass
    del documents[doc_id]
    return {"message": "Deleted"}


class QuestionRequest(BaseModel):
    doc_id: str
    question: str
    top_k: int = 5

class TestRequest(BaseModel):
    doc_id: str
    num_questions: int = 5

class EvaluateRequest(BaseModel):
    doc_id: str
    questions: list[str]
    answers: list[str]
    correct_answers: list[str]


@app.post("/ask")
def ask_question(req: QuestionRequest):
    if req.doc_id not in documents:
        raise HTTPException(404, "Document not found")

    q_emb = embed([req.question])[0]
    col = get_or_create_collection(req.doc_id)
    results = col.query(query_embeddings=[q_emb], n_results=min(req.top_k, col.count()))

    context_chunks = results["documents"][0] if results["documents"] else []
    context = "\n\n---\n\n".join(context_chunks)

    system = (
        "You are a precise document assistant. Answer questions strictly based on "
        "the provided context. If the answer is not in the context, say so clearly."
    )
    answer = chat(system, f"Context:\n\n{context}\n\n---\n\nQuestion: {req.question}")
    return {"answer": answer, "sources": context_chunks[:3], "doc_name": documents[req.doc_id]["name"]}


@app.post("/generate-test")
def generate_test(req: TestRequest):
    if req.doc_id not in documents:
        raise HTTPException(404, "Document not found")

    col = get_or_create_collection(req.doc_id)
    all_chunks = col.get(include=["documents"])["documents"] or []

    step = max(1, len(all_chunks) // 10)
    context = "\n\n".join(all_chunks[::step][:10])[:5000]

    system = "You are a rigorous educator. Return ONLY valid JSON — no markdown fences, no preamble."
    user_msg = f"""Create exactly {req.num_questions} multiple-choice questions from the document below.

Return a JSON array ONLY:
[
  {{
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "A) ...",
    "explanation": "..."
  }}
]

Document:
{context}"""

    raw = chat(system, user_msg, max_tokens=2048).strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if match:
        raw = match.group(0)

    try:
        questions = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(500, f"Failed to parse test JSON. Raw: {raw[:300]}")

    return {"questions": questions, "doc_name": documents[req.doc_id]["name"]}


@app.post("/evaluate")
def evaluate_answers(req: EvaluateRequest):
    if req.doc_id not in documents:
        raise HTTPException(404, "Document not found")

    pairs = []
    score = 0
    for q, user_ans, correct in zip(req.questions, req.answers, req.correct_answers):
        is_correct = user_ans.strip().lower() == correct.strip().lower()
        if is_correct:
            score += 1
        pairs.append({"question": q, "user_answer": user_ans, "correct_answer": correct, "is_correct": is_correct})

    pct = round(score / len(pairs) * 100) if pairs else 0

    system = "You are an encouraging tutor. Be warm, specific, and constructive."
    user_msg = (
        f'Student scored {score}/{len(pairs)} ({pct}%) on "{documents[req.doc_id]["name"]}".\n\n'
        f"Results:\n{json.dumps(pairs, indent=2)}\n\n"
        "Give 3-4 sentences of feedback: highlight what they did well and what to review."
    )

    return {
        "score": score,
        "total": len(pairs),
        "percentage": pct,
        "results": pairs,
        "feedback": chat(system, user_msg, max_tokens=512),
    }
