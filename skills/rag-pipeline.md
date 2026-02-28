# RAG Pipeline

A production-ready Retrieval-Augmented Generation pipeline with chunking, embedding, vector search, and grounded generation.

## Overview

RAG grounds an LLM's response in a private document corpus. The pipeline has two phases:

- **Ingest**: chunk → embed → store in a vector database
- **Query**: embed query → retrieve top-k chunks → generate with context

## Ingest Pipeline

```python
import hashlib
from openai import OpenAI
import chromadb

client    = OpenAI()
chroma    = chromadb.PersistentClient(path="./chroma_db")
collection = chroma.get_or_create_collection("knowledge_base")

EMBED_MODEL  = "text-embedding-3-small"
CHUNK_SIZE   = 512   # tokens (approximate via chars)
CHUNK_OVERLAP = 64

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping character windows."""
    chunks = []
    start  = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start += size - overlap
    return chunks

def embed(texts: list[str]) -> list[list[float]]:
    response = client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [item.embedding for item in response.data]

def ingest_document(doc_id: str, text: str, metadata: dict = None) -> int:
    """Chunk, embed, and store a document. Returns number of chunks stored."""
    chunks     = chunk_text(text)
    embeddings = embed(chunks)
    ids        = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metas      = [{**(metadata or {}), "chunk_index": i, "doc_id": doc_id}
                  for i in range(len(chunks))]

    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metas,
    )
    return len(chunks)
```

## Query Pipeline

```python
RETRIEVE_TOP_K = 5
GENERATE_MODEL = "gpt-4o"

def retrieve(query: str, top_k: int = RETRIEVE_TOP_K) -> list[dict]:
    """Embed the query and return top-k chunks with metadata."""
    query_embedding = embed([query])[0]
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )
    return [
        {"text": doc, "metadata": meta, "distance": dist}
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )
    ]

def generate(query: str, context_chunks: list[dict]) -> str:
    """Generate a grounded answer from retrieved context."""
    context_text = "\n\n---\n\n".join(
        f"[Source: {c['metadata'].get('doc_id', 'unknown')}]\n{c['text']}"
        for c in context_chunks
    )

    system_prompt = (
        "You are a helpful assistant. Answer the user's question using ONLY the "
        "provided context. If the context does not contain enough information, "
        "say so explicitly. Do not hallucinate.\n\n"
        f"CONTEXT:\n{context_text}"
    )

    response = client.chat.completions.create(
        model=GENERATE_MODEL,
        messages=[
            {"role": "system",  "content": system_prompt},
            {"role": "user",    "content": query},
        ],
    )
    return response.choices[0].message.content

def rag(query: str) -> str:
    """Full RAG query: retrieve → generate."""
    chunks = retrieve(query)
    return generate(query, chunks)
```

## Usage

```python
# Ingest once
with open("my_document.txt") as f:
    ingest_document(doc_id="my_doc", text=f.read(), metadata={"source": "my_document.txt"})

# Query at runtime
answer = rag("What does the document say about deployment strategies?")
print(answer)
```

## Key Configuration Choices

| Parameter       | Default              | Guidance                                             |
|-----------------|----------------------|------------------------------------------------------|
| `CHUNK_SIZE`    | 512 chars            | Larger = more context per chunk; smaller = higher precision |
| `CHUNK_OVERLAP` | 64 chars             | Prevents context loss at boundaries                  |
| `RETRIEVE_TOP_K`| 5                    | Increase for broad topics; decrease for precision    |
| `EMBED_MODEL`   | text-embedding-3-small | Balance cost vs. quality; `-large` for critical use |

## Notes

- Always upsert (not insert) to support document re-ingestion without duplicates.
- Store `doc_id` and `chunk_index` in metadata to enable citation tracing.
- Add a relevance threshold on `distance` to avoid injecting low-quality chunks into context.
