"""
Minimal Browser Use agent.

Run:
    ./.venv/bin/python example_agent.py "Go to news.ycombinator.com and list the top 3 story titles"

Needs ANTHROPIC_API_KEY in browser-automation/.env (see .env.example).
"""

import asyncio
import sys

from dotenv import load_dotenv

from browser_use import Agent
from browser_use.llm import ChatAnthropic

load_dotenv()

DEFAULT_TASK = "Go to https://example.com and tell me the page heading."


async def main() -> None:
    task = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TASK

    agent = Agent(
        task=task,
        llm=ChatAnthropic(model="claude-sonnet-5"),
        # headless=True,  # set via browser_profile if you want no visible window
    )

    history = await agent.run(max_steps=25)
    print("\n=== RESULT ===")
    print(history.final_result())


if __name__ == "__main__":
    asyncio.run(main())
