from __future__ import annotations

import asyncio

from fastapi import FastAPI, Response
from playwright.async_api import Browser, BrowserContext, Page, async_playwright

app = FastAPI(title="Nest Sandbox")

_lock = asyncio.Lock()
_pw = None
_browser: Browser | None = None
_ctx: BrowserContext | None = None
_page: Page | None = None
_current_url = "about:blank"


async def _ensure() -> Page:
    global _pw, _browser, _ctx, _page
    async with _lock:
        if _page is None:
            _pw = await async_playwright().start()
            import os
            exe = os.environ.get("CHROMIUM_PATH", "/repl/tools/bin/chromium")
            _browser = await _pw.chromium.launch(
                executable_path=exe, args=["--no-sandbox", "--disable-dev-shm-usage"]
            )
            _ctx = await _browser.new_context(viewport={"width": 1280, "height": 800})
            _page = await _ctx.new_page()
            await _page.goto("https://example.com")
        return _page


@app.get("/api/screen")
async def screen():
    page = await _ensure()
    async with _lock:
        png = await page.screenshot(type="png")
    return Response(png, media_type="image/png")


@app.post("/api/navigate")
async def navigate(body: dict):
    global _current_url
    page = await _ensure()
    url = body.get("url", "about:blank")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        await page.goto(url, timeout=20000)
        _current_url = url
    except Exception as e:
        return {"error": str(e), "url": _current_url}
    return {"url": _current_url, "title": await page.title()}


@app.get("/api/state")
def state():
    return {"url": _current_url}
