#!/usr/bin/env python3
"""Probe a decision model on tactical snake scenarios with known-correct moves.

Uses only the standard library:

  python3 scripts/probe_decision_models.py tev1:0.8b
  python3 scripts/probe_decision_models.py tev1:0.8b --base-url http://localhost:11435

Numbers shift per round so no two requests repeat exactly (repeated requests
hit a server cache and report 5-10x lower latency).
"""
import argparse
import json
import time
import urllib.request

INSTRUCTIONS = (
    "You steer a snake one cell per step. Walls, your body, and the rival's body kill you. "
    "Your tail tip moves away unless you eat this step. Eat food to grow and score. "
    "Reply with the direction to head."
)


def scenario_base(j):
    d = j % 3
    return {
        "tick": 50 + j,
        "width": 24,
        "height": 24,
        "heading": "right",
        "length": 4,
        "score": 2,
        "food": {"x": 8 + d, "y": 5},
        "rival": {"head": {"x": 18, "y": 18}, "length": 4, "score": 1},
    }


def scenarios(j):
    d = j % 3
    scenarios = []
    # Open field, food to the right.
    s = scenario_base(j)
    s["options"] = {
        "up": {"wallDist": 5, "selfDist": 9, "rivalDist": 9, "foodDist": 8 + d, "eatsFood": False, "openArea": 200},
        "right": {"wallDist": 15, "selfDist": 9, "rivalDist": 9, "foodDist": 2 + d, "eatsFood": False, "openArea": 200},
        "down": {"wallDist": 18, "selfDist": 9, "rivalDist": 9, "foodDist": 8 + d, "eatsFood": False, "openArea": 200},
    }
    scenarios.append(("open-field", s, "right"))
    # Wall directly ahead; food is up.
    s = scenario_base(j)
    s["food"] = {"x": 22, "y": 2}
    s["options"] = {
        "up": {"wallDist": 5, "selfDist": 9, "rivalDist": 9, "foodDist": 3, "eatsFood": False, "openArea": 200},
        "right": {"wallDist": 0, "selfDist": 9, "rivalDist": 9, "foodDist": 5, "eatsFood": False, "openArea": 0},
        "down": {"wallDist": 18, "selfDist": 9, "rivalDist": 9, "foodDist": 9, "eatsFood": False, "openArea": 200},
    }
    scenarios.append(("wall-ahead", s, "up"))
    # Pocket to the right (1 cell), open field left.
    s = scenario_base(j)
    s["heading"] = "up"
    s["food"] = {"x": 2, "y": 5}
    s["options"] = {
        "left": {"wallDist": 5, "selfDist": 9, "rivalDist": 9, "foodDist": 3, "eatsFood": False, "openArea": 190},
        "up": {"wallDist": 5, "selfDist": 9, "rivalDist": 9, "foodDist": 7, "eatsFood": False, "openArea": 180},
        "right": {"wallDist": 4, "selfDist": 9, "rivalDist": 9, "foodDist": 9, "eatsFood": False, "openArea": 1},
    }
    scenarios.append(("trap-right", s, "left"))
    # Rival body immediately right; food is up.
    s = scenario_base(j)
    s["food"] = {"x": 5, "y": 2}
    s["options"] = {
        "up": {"wallDist": 5, "selfDist": 9, "rivalDist": 9, "foodDist": 3, "eatsFood": False, "openArea": 200},
        "right": {"wallDist": 15, "selfDist": 9, "rivalDist": 0, "foodDist": 5, "eatsFood": False, "openArea": 150},
        "down": {"wallDist": 18, "selfDist": 9, "rivalDist": 9, "foodDist": 7, "eatsFood": False, "openArea": 200},
    }
    scenarios.append(("rival-right", s, "up"))
    return scenarios


def ask(base_url, model, st, timeout):
    body = json.dumps({
        "model": model,
        "keep_alive": -1,
        "state": st,
        "questions": {"move": {"type": "choice", "instructions": INSTRUCTIONS,
                               "criteria": {k: None for k in st["options"]}}},
    }).encode()
    req = urllib.request.Request(base_url.rstrip("/") + "/v1/systemone", data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            out = json.loads(res.read())
    except Exception as e:  # noqa: BLE001 - report and continue
        return None, 0, 0, f"error: {e}"
    ms = (time.monotonic() - t0) * 1000
    try:
        move = out["answers"]["move"]
        return move["choice"], ms, out.get("usage", {}).get("input_tokens", 0), ""
    except KeyError:
        return None, ms, 0, f"bad schema: {json.dumps(out)[:200]}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model")
    ap.add_argument("--base-url", default="http://localhost:11434")
    ap.add_argument("--rounds", type=int, default=2)
    ap.add_argument("--timeout", type=int, default=60)
    a = ap.parse_args()

    asked = correct = 0
    lat, tokens = [], []
    for r in range(a.rounds):
        for name, st, expected in scenarios(r):
            choice, ms, tok, err = ask(a.base_url, a.model, st, a.timeout)
            asked += 1
            if err:
                mark = f"FAIL {err}"
            else:
                lat.append(ms)
                tokens.append(tok)
                mark = "ok" if choice == expected else f"WRONG (chose {choice}, want {expected})"
                correct += choice == expected
            print(f"[{name} r{r}] {mark} ({ms:.0f} ms)")
    lat.sort()
    p50 = lat[len(lat) // 2] if lat else 0
    print(json.dumps({"model": a.model, "accuracy": correct / max(1, asked),
                      "correct": correct, "asked": asked,
                      "latency_p50_ms": round(p50),
                      "input_tokens_p50": sorted(tokens)[len(tokens) // 2] if tokens else 0}))


if __name__ == "__main__":
    main()
