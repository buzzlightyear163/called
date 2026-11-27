"""Screenshots of the CALLED site with sample API data (the sandbox can't reach Solana).
Usage: python3 scripts/shoot.py <base_url> <out_dir> [route:name:w:h[:night][:full]] ..."""
import json, sys, time, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from playwright.sync_api import sync_playwright
from sample_api import respond

base, out = sys.argv[1], pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
shots = sys.argv[3:]
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
    for spec in shots:
        parts = spec.split(":")
        route, name, w, h = parts[0], parts[1], int(parts[2]), int(parts[3])
        flags = set(parts[4:])
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w < 600 else 1, reduced_motion="reduce")
        page = ctx.new_page()
        page.on("pageerror", lambda e, n=name: errors.append(f"{n}: {e}"))
        page.on("console", lambda m, n=name: errors.append(f"{n} console: {m.text}") if m.type == "error" and "Failed to load resource" not in m.text else None)
        def handler(route_, req):
            body = respond(req.url, req.method, req.post_data)
            if body is None:
                return route_.fulfill(status=404, content_type="application/json", body=json.dumps({"error": "not in sample"}))
            route_.fulfill(status=200, content_type="application/json", body=json.dumps(body))
        page.route("**/api/**", handler)
        page.route("**dexscreener.com/**", lambda r, q: r.fulfill(status=200, content_type="text/html", body="<html><body style='background:#ddd'></body></html>"))
        page.goto(base + route, wait_until="networkidle")
        if "night" in flags:
            page.evaluate("document.documentElement.classList.add('theme-night')")
        page.wait_for_timeout(3500 if "slow" in flags else 900)
        ow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        if ow > 1:
            errors.append(f"{name}: horizontal overflow {ow}px")
        page.screenshot(path=str(out / f"{name}.png"), full_page="full" in flags)
        ctx.close()
    b.close()
print("\n".join(errors) if errors else "no page errors")
