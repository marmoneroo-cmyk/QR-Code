"""
generate_3d.py — turn each cocktail's hero image into a real 3D model (GLB)
using a FREE Hugging Face Space via the reference Python gradio_client.

One consistent mesh → every angle is the same drink, and the app lets you
drag to ANY angle (see <Cocktail3D>). Beats 24 independent text-to-image frames
(each a fresh hallucination) and a fake sprite spin.

Default Space: stabilityai/stable-fast-3d (clean, textured GLB in one call).
Fallbacks wired: TencentARC/InstantMesh, Wuvin/Unique3D, stabilityai/TripoSR.

Free: no key required (public Space queue). Can be slow; re-run a slug if it fails.

Usage (from project root):
    py scripts/generate_3d.py citrus-lime-sour            # test one
    py scripts/generate_3d.py                              # all *-hero.png
    HF_SPACE=Wuvin/Unique3D py scripts/generate_3d.py x    # try a fallback Space

Env (optional):
    HF_SPACE   override Space (default stabilityai/stable-fast-3d)
    HF_TOKEN   free HF token (only if a Space needs auth)
"""
import sys
import os
import glob
import shutil
import traceback
from gradio_client import Client, handle_file


def _load_env_local() -> None:
    """Load KEY=VALUE pairs from .env.local without overriding real env vars.
    Keeps the HF token out of chat and out of git (.env.local is gitignored)."""
    path = os.path.join(os.getcwd(), ".env.local")
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_env_local()

# Default to InstantMesh: it responds cleanly with a quota message (pipeline
# works; just needs a token) and is NOT a gated model (SF3D needs a license
# acceptance). Override with HF_SPACE=... to try a different Space.
SPACE = os.environ.get("HF_SPACE", "TencentARC/InstantMesh")
HF_TOKEN = os.environ.get("HF_TOKEN") or None
PUB = os.path.join("public", "cocktail")
OUT = os.path.join(PUB, "3d")
SUFFIX = "-hero.png"


def _first_glb(result):
    """Pull a GLB/OBJ filepath out of a predict() result (str | tuple | list)."""
    if isinstance(result, (list, tuple)):
        # Prefer an entry that looks like a model file.
        for item in result:
            if isinstance(item, str) and item.lower().endswith((".glb", ".obj", ".gltf")):
                return item
        # Otherwise the conventional GLB slot, else the first entry.
        return result[1] if len(result) > 1 else result[0]
    return result


# --- Space recipes: (client, hero_path) -> local GLB/OBJ path -----------------

def recipe_stable_fast_3d(client, hero):
    # /run_button(input_image, foreground_ratio, remesh_option, vertex_count, texture_size)
    #   -> (preview_background_removal, 3d_model GLB)
    res = client.predict(handle_file(hero), 0.85, "None", -1, 1024, api_name="/run_button")
    return res[1] if isinstance(res, (list, tuple)) and len(res) > 1 else _first_glb(res)


def recipe_instantmesh(client, hero):
    # /preprocess -> processed ; /generate_mvs -> multiviews (server state) ; /make3d -> (obj, glb)
    processed = client.predict(handle_file(hero), True, api_name="/preprocess")
    client.predict(handle_file(processed), 75, 42, api_name="/generate_mvs")
    res = client.predict(api_name="/make3d")
    return res[1] if isinstance(res, (list, tuple)) and len(res) > 1 else _first_glb(res)


def recipe_unique3d(client, hero):
    # /generate3dv2(preview_img, input_processing, seed, render_video, do_refine, expansion_weight, init_type)
    #   -> (mesh_model GLB, preview video)
    res = client.predict(handle_file(hero), True, -1, False, True, 0.1, "std", api_name="/generate3dv2")
    return _first_glb(res)


def recipe_hunyuan(client, hero):
    # /generation_all(caption, image, mv_front, mv_back, mv_left, mv_right,
    #   steps, guidance_scale, seed, octree_resolution, check_box_rembg,
    #   num_chunks, randomize_seed) -> (white_mesh_glb, textured_glb, html, stats, seed)
    res = client.predict(
        None,                 # caption
        handle_file(hero),    # image
        None, None, None, None,  # multi-view inputs (unused)
        30,                   # steps
        5.0,                  # guidance_scale
        1234,                 # seed
        256,                  # octree_resolution
        True,                 # check_box_rembg
        20000,                # num_chunks (denser mesh)
        True,                 # randomize_seed
        api_name="/generation_all",
    )
    # Prefer the SECOND model file (textured) when present.
    glbs = [x for x in (res if isinstance(res, (list, tuple)) else [res])
            if isinstance(x, str) and x.lower().endswith((".glb", ".obj", ".gltf"))]
    if len(glbs) >= 2:
        return glbs[1]
    return glbs[0] if glbs else _first_glb(res)


def recipe_triposr(client, hero):
    processed = client.predict(handle_file(hero), True, 0.85, api_name="/preprocess")
    res = client.predict(handle_file(processed), 256, api_name="/generate")
    return res[1] if isinstance(res, (list, tuple)) and len(res) > 1 else _first_glb(res)


RECIPES = {
    "stabilityai/stable-fast-3d": recipe_stable_fast_3d,
    "TencentARC/InstantMesh": recipe_instantmesh,
    "tencent/Hunyuan3D-2": recipe_hunyuan,
    "Wuvin/Unique3D": recipe_unique3d,
    "stabilityai/TripoSR": recipe_triposr,
}


def slugs_from_args():
    args = sys.argv[1:]
    if args:
        return args
    return [
        os.path.basename(p)[: -len(SUFFIX)]
        for p in glob.glob(os.path.join(PUB, "*" + SUFFIX))
        if "-hero." in os.path.basename(p)
    ]


def main():
    os.makedirs(OUT, exist_ok=True)
    slugs = slugs_from_args()
    if not slugs:
        print("No slugs / hero images found.")
        return

    recipe = RECIPES.get(SPACE)
    if recipe is None:
        print(f"No recipe for Space '{SPACE}'. Known: {', '.join(RECIPES)}")
        return

    print(f"Connecting to {SPACE} ...")
    if HF_TOKEN:
        try:
            client = Client(SPACE, hf_token=HF_TOKEN)
        except TypeError:
            client = Client(SPACE, token=HF_TOKEN)
    else:
        client = Client(SPACE)
    print(f"Connected. Generating {len(slugs)} model(s).\n")

    for slug in slugs:
        hero = os.path.join(PUB, f"{slug}{SUFFIX}")
        if not os.path.exists(hero):
            print(f"[{slug}] hero not found: {hero}")
            continue
        try:
            print(f"[{slug}] generating mesh ...")
            glb = recipe(client, hero)
            if not glb or not os.path.exists(glb):
                print(f"[{slug}] no model file returned: {glb!r}\n")
                continue
            ext = os.path.splitext(glb)[1].lower() or ".glb"
            out = os.path.join(OUT, f"{slug}{ext}")
            shutil.copyfile(glb, out)
            size_mb = os.path.getsize(out) / 1024 / 1024
            print(f"[{slug}] saved {os.path.basename(out)} ({size_mb:.2f} MB)\n")
        except Exception as e:  # noqa: BLE001
            print(f"[{slug}] failed: {e!r}")
            traceback.print_exc()
            print()

    print("Done. Review the model in the app before generating the rest.")


if __name__ == "__main__":
    main()
