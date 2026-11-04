import os

import httpx
from fastapi import FastAPI
from pydantic import BaseModel

AGENT_URL = os.getenv("AGENT_URL")  # e.g. http://localhost:8080/invocations

app = FastAPI(title="Conversational AI backend")


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    intent: str | None = None


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not AGENT_URL:
        return ChatResponse(session_id=req.session_id, reply=f"(mock) You said: {req.message}")

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(AGENT_URL, json={"prompt": req.message, "session_id": req.session_id})
        r.raise_for_status()
        data = r.json()
    return ChatResponse(session_id=req.session_id, reply=data["reply"], intent=data.get("intent"))
