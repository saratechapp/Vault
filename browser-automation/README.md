# browser-automation

LLM-driven browser automation with [Browser Use](https://github.com/browser-use/browser-use).
Self-contained Python toolchain — **not wired into the React/Node app** and not part of any build.

## What's installed

- Python venv at `browser-automation/.venv` (Python 3.14)
- `browser-use` 0.13.8 — the `Agent` library + the `browser-use` CLI (browser-harness 0.1.9)
- Chromium binaries: reused from the existing `~/Library/Caches/ms-playwright` cache

## Setup (already done once; repeat on a fresh clone)

```bash
cd browser-automation
python3.14 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env          # then add ANTHROPIC_API_KEY
```

## Use — as a script

```bash
./.venv/bin/python example_agent.py "Search GitHub for the browser-use repo and report its star count"
```

## Use — as a CLI against a running Chrome (CDP)

```bash
./.venv/bin/browser-use --doctor          # check daemon + browser state
./.venv/bin/browser-use <<'PY'
new_tab("https://example.com")
print(page_info())
PY
```

## Notes

- Every step calls the LLM, so runs cost tokens and are slower than a scripted tool.
- For deterministic regression tests of the Wallet app itself, a scripted runner
  (Playwright) is the better fit — this folder is for exploratory "do this task" automation.
- `.venv/` and `.env` are gitignored.
