"""Probe candidate free image->3D Spaces: connect + list endpoints.
Prints a tiny PASS/FAIL summary so we can pick one that works TODAY.
    py scripts/hf_probe.py
"""
import threading
from gradio_client import Client

CANDIDATES = [
    "TencentARC/InstantMesh",
    "JeffreyXiang/TRELLIS",
    "tencent/Hunyuan3D-2",
    "stabilityai/stable-fast-3d",
    "Wuvin/Unique3D",
    "ashawkey/LGM",
]


def probe(space: str) -> None:
    result = {"ok": False, "msg": "", "eps": []}

    def work() -> None:
        try:
            c = Client(space, verbose=False)
            api = c.view_api(return_format="dict")
            named = (api or {}).get("named_endpoints", {}) or {}
            result["eps"] = list(named.keys())
            result["ok"] = True
        except Exception as e:  # noqa: BLE001
            result["msg"] = f"{type(e).__name__}: {str(e)[:90]}"

    t = threading.Thread(target=work, daemon=True)
    t.start()
    t.join(75)
    if t.is_alive():
        print(f"TIMEOUT  {space}")
    elif result["ok"]:
        eps = ", ".join(result["eps"])[:200]
        print(f"PASS     {space}  ::  {eps}")
    else:
        print(f"FAIL     {space}  ::  {result['msg']}")


for s in CANDIDATES:
    probe(s)
