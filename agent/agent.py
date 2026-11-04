"""AgentCore entrypoint. Replace the stub with a real model call + intent classification."""
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()


@app.entrypoint
def invoke(payload):
    prompt = payload.get("prompt", "")
    # TODO: call the model (Bedrock) and classify intent
    return {"reply": f"(agent stub) {prompt}", "intent": None}


if __name__ == "__main__":
    app.run()
