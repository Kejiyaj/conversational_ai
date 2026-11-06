"""Token checks (spec 008, contracts/auth-api.md test points 1-11, 20, 25)."""

import logging
import time

import jwt
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import main, models
from app.main import app
from tests.conftest import AUDIENCE, ISSUER, bearer

CHAT = {"session_id": "s1", "message": "hi"}
DETAIL = {"detail": "missing or invalid bearer token"}


@pytest.fixture
def agent_spy(monkeypatch):
    """Set AGENT_URL and fail the test if the agent is called."""
    monkeypatch.setenv("AGENT_URL", "http://agent.invalid/invocations")
    calls = []

    def spy(*args, **kwargs):
        calls.append(args)
        raise AssertionError("agent must not be called")

    monkeypatch.setattr(main, "call_agent", spy)
    return calls


def counts(engine):
    with Session(engine) as db:
        return tuple(
            db.scalar(select(func.count()).select_from(m))
            for m in (models.Session, models.Message, models.Feedback)
        )


def all_routes(routes):
    for route in routes:
        inner = getattr(route, "original_router", None)  # routers added with include_router
        if inner is not None:
            yield from all_routes(inner.routes)
        else:
            yield route


def protected_routes():
    for route in all_routes(app.routes):
        path = getattr(route, "path", "")
        if path.startswith("/api/") and path != "/api/health":
            for method in route.methods - {"HEAD", "OPTIONS"}:
                yield method, path.replace("{session_id}", "s1").replace("{message_id}", "1")


def test_every_protected_route_requires_a_token(raw_client):
    routes = list(protected_routes())
    assert len(routes) >= 4  # chat, history, sessions, feedback
    for method, path in routes:
        r = raw_client.request(method, path)
        assert r.status_code == 401, (method, path)
        assert r.json() == DETAIL
        assert r.headers["www-authenticate"] == "Bearer"


def test_no_header_is_refused_and_has_no_side_effects(raw_client, engine, agent_spy):
    r = raw_client.post("/api/chat", json=CHAT)
    assert r.status_code == 401
    assert r.json() == DETAIL
    assert r.headers["www-authenticate"] == "Bearer"
    assert counts(engine) == (0, 0, 0)
    assert agent_spy == []


@pytest.mark.parametrize("header", ["Basic abc", "Bearer", "Bearer ", "Bearer a b", "abc", "Bearer  x"])
def test_malformed_authorization_header_is_401(raw_client, header):
    r = raw_client.get("/api/sessions", headers={"Authorization": header})
    assert r.status_code == 401
    assert r.json() == DETAIL


@pytest.mark.parametrize("scheme", ["Bearer", "bearer", "BEARER"])
def test_scheme_is_case_insensitive(raw_client, make_token, scheme):
    r = raw_client.get("/api/sessions", headers={"Authorization": f"{scheme} {make_token()}"})
    assert r.status_code == 200


def test_token_in_query_is_ignored(raw_client, make_token):
    assert raw_client.get(f"/api/sessions?access_token={make_token()}").status_code == 401


def test_not_a_jwt_is_401(raw_client):
    r = raw_client.get("/api/sessions", headers=bearer("abc"))
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == 'Bearer error="invalid_token"'
    assert r.json() == DETAIL


def test_unknown_signing_key_is_401(raw_client, make_token, wrong_key):
    assert raw_client.get("/api/sessions", headers=bearer(make_token(key=wrong_key))).status_code == 401


def test_unknown_kid_is_401(raw_client, make_token):
    token = make_token(headers={"kid": "nobody"})
    assert raw_client.get("/api/sessions", headers=bearer(token)).status_code == 401


def test_unsigned_token_is_401(raw_client, unsigned_token):
    assert raw_client.get("/api/sessions", headers=bearer(unsigned_token)).status_code == 401


def test_shared_secret_token_is_401(raw_client):
    now = int(time.time())
    claims = {"iss": ISSUER, "aud": AUDIENCE, "exp": now + 300, "sub": "alice"}
    token = jwt.encode(claims, "x" * 32, algorithm="HS256", headers={"kid": "test-key"})
    assert raw_client.get("/api/sessions", headers=bearer(token)).status_code == 401


def test_expiry_has_60_second_tolerance(raw_client, make_token):
    now = int(time.time())
    expired_long = make_token(exp=now - 61)
    expired_short = make_token(exp=now - 30)
    assert raw_client.get("/api/sessions", headers=bearer(expired_long)).status_code == 401
    assert raw_client.get("/api/sessions", headers=bearer(expired_short)).status_code == 200


def test_missing_exp_is_401(raw_client, make_token):
    assert raw_client.get("/api/sessions", headers=bearer(make_token(exp=None))).status_code == 401


def test_not_yet_valid_is_401(raw_client, make_token):
    now = int(time.time())
    assert raw_client.get("/api/sessions", headers=bearer(make_token(nbf=now + 61))).status_code == 401
    assert raw_client.get("/api/sessions", headers=bearer(make_token(nbf=now + 30))).status_code == 200


@pytest.mark.parametrize("claims", [{"iss": "https://other.example"}, {"iss": None}])
def test_wrong_or_missing_issuer_is_401(raw_client, make_token, claims):
    assert raw_client.get("/api/sessions", headers=bearer(make_token(**claims))).status_code == 401


@pytest.mark.parametrize("claims", [{"aud": "other-api"}, {"aud": None}])
def test_wrong_or_missing_audience_is_401(raw_client, make_token, claims):
    assert raw_client.get("/api/sessions", headers=bearer(make_token(**claims))).status_code == 401


def test_audience_list_containing_ours_is_accepted(raw_client, make_token):
    token = make_token(aud=["other", AUDIENCE])
    assert raw_client.get("/api/sessions", headers=bearer(token)).status_code == 200


@pytest.mark.parametrize("sub", [None, ""])
def test_missing_or_empty_subject_is_401(raw_client, make_token, sub):
    token = make_token(sub=sub)
    if sub is None:
        token = make_token(sub=None)
    assert raw_client.get("/api/sessions", headers=bearer(token)).status_code == 401


def test_refusals_do_not_call_agent_or_store(raw_client, engine, agent_spy, make_token, wrong_key):
    r = raw_client.post("/api/chat", json=CHAT, headers=bearer(make_token(key=wrong_key)))
    assert r.status_code == 401
    assert counts(engine) == (0, 0, 0)
    assert agent_spy == []


def test_health_ignores_the_token(raw_client, make_token):
    assert raw_client.get("/api/health").json() == {"status": "ok"}
    assert raw_client.get("/api/health", headers=bearer("garbage")).status_code == 200
    expired = make_token(exp=int(time.time()) - 3600)
    assert raw_client.get("/api/health", headers=bearer(expired)).status_code == 200


def test_refusals_are_logged_without_the_token(raw_client, make_token, caplog):
    bad = make_token(aud="other-api")
    with caplog.at_level(logging.WARNING, logger="app.auth"):
        raw_client.get("/api/sessions", headers=bearer(bad))
        raw_client.get("/api/sessions")
    messages = [r.getMessage() for r in caplog.records if r.name == "app.auth"]
    assert len(messages) == 2
    assert any("Audience" in m for m in messages)
    assert any("missing" in m for m in messages)
    assert all(bad not in m and bad.split(".")[1] not in m for m in messages)


# --- identity provider availability and configuration (points 21-24, SC-005) -------------------


def test_503_when_keys_were_never_fetched(raw_client, keys, make_token):
    keys.fail = True
    r = raw_client.get("/api/sessions", headers=bearer(make_token()))
    assert r.status_code == 503
    assert r.json() == {"detail": "sign-in service unavailable, try again later"}


def test_known_keys_keep_working_when_the_key_address_goes_down(raw_client, keys, make_token):
    assert raw_client.get("/api/sessions", headers=bearer(make_token())).status_code == 200
    keys.jwk_set_cache.lifespan = 0.0001  # the cache expires...
    time.sleep(0.01)
    keys.fail = True  # ...and the address is down
    assert raw_client.get("/api/sessions", headers=bearer(make_token())).status_code == 200
    assert keys.fetches >= 2


def test_new_key_is_accepted_without_restart(raw_client, keys, make_token, wrong_key):
    from tests.conftest import jwk_for

    token = make_token(key=wrong_key, headers={"kid": "rotated"})
    assert raw_client.get("/api/sessions", headers=bearer(token)).status_code == 401
    keys.keys.append(jwk_for(wrong_key, "rotated"))  # the provider publishes the new key
    assert raw_client.get("/api/sessions", headers=bearer(token)).status_code == 200


def test_switching_provider_is_configuration_only(raw_client, verifier, make_token):
    from app.auth import Settings

    token = make_token()
    assert raw_client.get("/api/sessions", headers=bearer(token)).status_code == 200
    verifier.settings = Settings("https://okta.test/oauth2/x", "api://other", verifier.settings.jwks_url)
    assert raw_client.get("/api/sessions", headers=bearer(token)).status_code == 401
    matching = make_token(iss="https://okta.test/oauth2/x", aud="api://other")
    assert raw_client.get("/api/sessions", headers=bearer(matching)).status_code == 200


def test_load_settings_names_every_missing_or_blank_setting(monkeypatch):
    from app.auth import load_settings

    monkeypatch.setenv("OIDC_ISSUER", "https://idp.test")
    monkeypatch.setenv("OIDC_AUDIENCE", "   ")
    monkeypatch.delenv("OIDC_JWKS_URL", raising=False)
    with pytest.raises(RuntimeError) as err:
        load_settings()
    assert "OIDC_AUDIENCE" in str(err.value)
    assert "OIDC_JWKS_URL" in str(err.value)
    assert "OIDC_ISSUER" not in str(err.value)


def test_backend_refuses_to_start_without_a_setting(monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setenv("OIDC_ISSUER", "https://idp.test")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://idp.test/jwks")
    monkeypatch.delenv("OIDC_AUDIENCE", raising=False)
    with pytest.raises(RuntimeError, match="OIDC_AUDIENCE"):
        with TestClient(app):
            pass


def test_backend_starts_with_all_settings(monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setenv("OIDC_ISSUER", "https://idp.test")
    monkeypatch.setenv("OIDC_AUDIENCE", "convai-api")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://idp.test/jwks")
    with TestClient(app) as c:
        assert c.get("/api/health").status_code == 200
