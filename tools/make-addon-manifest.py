"""Манифест дополнения: python3 tools/make-addon-manifest.py <id> "<Название>" "<описание>" [socket] - пишет addons/<id>/module.json"""
import json, sys, glob, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
core = json.load(open(os.path.join(root, "module.json"), encoding="utf-8"))
aid, title, desc = sys.argv[1], sys.argv[2], sys.argv[3]
socket = len(sys.argv) > 4 and sys.argv[4] == "socket"
d = os.path.join(root, "addons", aid)
mid = f"wfrp4e-paperdoll-{aid}"
base = "https://github.com/rain2rock/wfrp4e-paperdoll/releases/latest/download"
m = {
    "id": mid,
    "title": title,
    "description": desc,
    "version": core["version"],
    "authors": core["authors"],
    "url": core["url"],
    "manifest": f"{base}/{mid}.json",
    "download": f"{base}/{mid}.zip",
    "bugs": core["bugs"],
    "compatibility": core["compatibility"],
    "relationships": {
        "systems": core["relationships"]["systems"],
        "requires": [{"id": core["id"], "type": "module", "manifest": core["manifest"], "compatibility": {"minimum": core["version"]}}],
    },
    "esmodules": sorted(os.path.relpath(p, d) for p in glob.glob(os.path.join(d, "scripts", "*.js"))),
    "styles": sorted(os.path.relpath(p, d) for p in glob.glob(os.path.join(d, "styles", "*.css"))),
    "languages": [{"lang": l, "name": n, "path": f"lang/{l}.json"} for l, n in (("ru", "Русский"), ("en", "English")) if os.path.exists(os.path.join(d, "lang", f"{l}.json"))],
}
if socket:
    m["socket"] = True
json.dump(m, open(os.path.join(d, "module.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(os.path.join(d, "module.json"), "a").write("\n")
print("ok", mid)
