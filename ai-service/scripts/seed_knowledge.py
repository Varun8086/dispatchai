import os
import psycopg2
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings

load_dotenv()

embeddings_model = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-001",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    output_dimensionality=768,
)

knowledge_entries = [
    ("How do I track my order?", "faq"),
    ("You can track your order in real-time from the order details screen. Once an agent is assigned, you'll see their live location on the map, updated every few seconds.", "faq"),
    ("What happens if my order is delayed?", "faq"),
    ("Delays can happen due to traffic, weather, or high demand. You'll see an updated ETA in real-time. If a delay is significant, our system may notify you proactively.", "faq"),
    ("How do refunds work?", "faq"),
    ("Refunds are processed back to your original payment method and typically take 5-7 business days to reflect, depending on your bank or payment provider.", "faq"),
    ("Can I cancel my order after it's been placed?", "faq"),
    ("Orders can be cancelled before an agent picks up the package. Once an order is picked up, cancellation is no longer available, but you can contact support for assistance.", "faq"),
    ("What payment methods are supported?", "faq"),
    ("DispatchAI supports Razorpay (cards, UPI, netbanking) and PayPal for international payments.", "faq"),
    ("How is delivery pricing calculated?", "policy"),
    ("Delivery fare is calculated based on a base fare plus a per-kilometer rate, multiplied by a surge factor during high-demand periods. The surge factor is determined by real-time demand forecasting.", "policy"),
    ("What is your service area?", "policy"),
    ("DispatchAI currently operates within a 50km radius for intra-city deliveries. Inter-city delivery is not currently supported.", "policy"),
]

conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
)
cur = conn.cursor()

for content, category in knowledge_entries:
    embedding = embeddings_model.embed_query(content)
    cur.execute(
        "INSERT INTO knowledge_base (content, category, embedding) VALUES (%s, %s, %s)",
        (content, category, embedding)
    )

conn.commit()
cur.close()
conn.close()

print(f"Seeded {len(knowledge_entries)} knowledge base entries")