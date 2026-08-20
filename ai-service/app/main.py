import os
import psycopg2
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

load_dotenv()

app = FastAPI(title="DispatchAI AI Service")

embeddings_model = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-001",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    output_dimensionality=768,
)

chat_model = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.3,
)


def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


class AskRequest(BaseModel):
    question: str


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/ask")
def ask_question(request: AskRequest):
    # --- Step 1: Retrieval — embed the question, find similar knowledge ---
    question_embedding = embeddings_model.embed_query(request.question)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT content, category, 1 - (embedding <=> %s::vector) AS similarity
        FROM knowledge_base
        ORDER BY embedding <=> %s::vector
        LIMIT 3
        """,
        (question_embedding, question_embedding)
    )
    results = cur.fetchall()
    cur.close()
    conn.close()

    retrieved_context = "\n".join([f"- {row[0]}" for row in results])

    # --- Step 2: Generation — ask the LLM using retrieved context ---
    prompt = f"""You are a helpful customer support assistant for DispatchAI, a delivery service.
Answer the customer's question using ONLY the context below. If the context doesn't contain
a relevant answer, say you don't have that information and suggest contacting support.

Context:
{retrieved_context}

Customer question: {request.question}

Answer concisely and in a friendly tone."""

    response = chat_model.invoke(prompt)

# extract plain text, handling both simple string and structured list responses
    if isinstance(response.content, str):
        answer_text = response.content
    else:
        answer_text = "".join(
            block.get("text", "") for block in response.content if isinstance(block, dict)
        )

    return {
        "answer": answer_text,
        "sources": [{"content": row[0], "category": row[1], "similarity": round(row[2], 3)} for row in results],
    }