"""
QA exploratory agent for the Wallet app (17-phase audit, browser-use pass).

Usage:
    ./.venv/bin/python qa_agent.py <run-name> "<task>"

Writes:
    runs/<run-name>/result.md      final agent report
    runs/<run-name>/steps.json     full step history (actions + extracted content)
    runs/<run-name>/*.png          screenshots the agent captured

Needs ANTHROPIC_API_KEY in browser-automation/.env.
"""

import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from browser_use import Agent, BrowserProfile
from browser_use.llm import ChatAnthropic

load_dotenv()

BASE_URL = "http://localhost:5173"


async def main() -> None:
    if len(sys.argv) < 3:
        print("usage: qa_agent.py <run-name> \"<task>\"")
        raise SystemExit(2)

    run_name = sys.argv[1]
    task = sys.argv[2]
    max_steps = int(sys.argv[3]) if len(sys.argv) > 3 else 40

    out_dir = Path(__file__).parent / "runs" / run_name
    out_dir.mkdir(parents=True, exist_ok=True)

    profile = BrowserProfile(
        headless=True,
        window_size={"width": 1440, "height": 900},
    )

    agent = Agent(
        task=(
            f"The app under test is at {BASE_URL}. Start there.\n\n{task}\n\n"
            "Be concrete: report exact URLs, button labels, and what you saw. "
            "Note any broken links, dead ends, confusing steps, console-visible "
            "errors, layout problems, or missing feedback. Do not invent findings."
        ),
        llm=ChatAnthropic(model="claude-sonnet-5"),
        browser_profile=profile,
    )

    history = await agent.run(max_steps=max_steps)

    (out_dir / "result.md").write_text(history.final_result() or "(no final result)")

    steps = []
    try:
        for i, h in enumerate(history.history):
            steps.append(
                {
                    "step": i,
                    "url": getattr(getattr(h, "state", None), "url", None),
                    "actions": [str(a) for a in (getattr(h, "model_output", None).action if getattr(h, "model_output", None) else [])],
                    "extracted": [str(r.extracted_content) for r in (getattr(h, "result", []) or []) if getattr(r, "extracted_content", None)],
                }
            )
    except Exception as e:  # noqa: BLE001
        steps.append({"error": f"could not serialize history: {e}"})
    (out_dir / "steps.json").write_text(json.dumps(steps, indent=2, default=str))

    print("\n=== RESULT ===")
    print(history.final_result())
    print(f"\nartifacts in: {out_dir}")


if __name__ == "__main__":
    asyncio.run(main())
