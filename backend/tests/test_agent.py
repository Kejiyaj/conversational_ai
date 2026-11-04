import httpx
import pytest

from app import agent


@pytest.fixture
def mock_agent(monkeypatch):
    """Route agent.call_agent's httpx.Client through a MockTransport; records the Client kwargs."""
    real_client = httpx.Client
    seen = {}

    def install(handler):
        def factory(**kwargs):
            seen.update(kwargs)
            return real_client(transport=httpx.MockTransport(handler), **kwargs)

        monkeypatch.setattr(agent.httpx, "Client", factory)
        return seen

    return install


def test_success_sends_prompt_and_session_with_10s_timeout(mock_agent):
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={"reply": "Hi!", "intent": "greeting"})

    seen = mock_agent(handler)
    result = agent.call_agent("http://agent/invocations", "s1", "hello")

    assert (result.reply, result.intent) == ("Hi!", "greeting")
    assert seen["timeout"] == 10
    assert requests[0].read() == b'{"prompt":"hello","session_id":"s1"}'


@pytest.mark.parametrize(
    "handler",
    [
        lambda r: httpx.Response(500),
        lambda r: httpx.Response(200, content=b"not json"),
        lambda r: httpx.Response(200, json={"intent": "x"}),
        lambda r: httpx.Response(200, json={"reply": "ok", "intent": 5}),
        lambda r: httpx.Response(200, json=["reply"]),
    ],
    ids=["http-500", "not-json", "missing-reply", "bad-intent", "not-object"],
)
def test_bad_responses_raise_agent_error(mock_agent, handler):
    mock_agent(handler)
    with pytest.raises(agent.AgentError):
        agent.call_agent("http://agent/invocations", "s1", "hello")


def test_timeout_raises_agent_error(mock_agent):
    def handler(request):
        raise httpx.ReadTimeout("timed out", request=request)

    mock_agent(handler)
    with pytest.raises(agent.AgentError, match="ReadTimeout"):
        agent.call_agent("http://agent/invocations", "s1", "hello")
