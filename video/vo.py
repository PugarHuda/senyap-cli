# Narration, one line per scene, synthesized with edge-tts (a synthetic voice, disclosed in the submission).
#   python vo.py  -> public/vo/<scene>.mp3 and public/vo/durations.json
import asyncio, json, subprocess, os
import edge_tts

VOICE = 'en-US-BrianNeural'
LINES = {
  'hook':    "My coding agent said this was done. The screen agrees. Saved. Let's look underneath.",
  'lift':    "Underneath, the save returned a five hundred, and the page called a staging server. The user never sees any of it.",
  'plain':   "So I asked Kane CLI, TestMu's browser agent, to check that the note was really saved. It passed. Result code one hundred.",
  'check':   "But Kane had recorded everything. The five hundred and the console error were sitting in its evidence pack. Nothing read them. Run Senyap on that same pack, and Kane's own verdict command fails it. A false green.",
  'title':   "This is Senyap. Indonesian for silent. It catches the bugs that fail silently, and keeps your coding agent working until they're fixed.",
  'init':    "One command wires Senyap in as Claude Code's stop hook, and installs Kane's own agent skill.",
  'task':    "Then I gave Claude Code an unrelated task: add a note counter. It finished, and even noticed two things that looked off. It left them alone, and said done.",
  'block':   "The stop hook had Kane drive the real flow. Saving a note with an apostrophe returns a five hundred. Kane confirms a product bug, code seven forty, with the root cause and a link to the run. The stop is blocked.",
  'kane':    "This is Kane's own record of that run, step by step, in Test Manager.",
  'fix':     "Claude fixed the query, stopped claiming success when a save fails, and removed the staging call.",
  'clean':   "It stops again. Kane drives the flow, reloads the page, and the evidence is clean. Now it may stop.",
  'how':     "Under the hood, every verdict is Kane's. Kane drives the flow. Senyap reads the network and console log from Kane's evidence pack, and seals a pack of its own, with a silent failure metric catalog. Kane's evidence verdict enforces the policy. Only when the evidence shows a failure does Kane run its DevTools checks, to confirm the bug and explain it.",
  'limits':  "Two of Kane's limits became the design. Verdict policies can't read logs, so Senyap became an evidence producer. And Kane's analyzers time out proving that nothing failed on a clean page, so they only run when something did.",
  'try':     "Try it yourself on the hosted demo. The buggy app comes back as a silent failure. The fixed one comes back clean.",
  'bench':   "Then QuietBench: eight real bugs from open source apps, each run before and after its actual fix. Plain Kane caught five. Senyap caught six, including two that plain Kane passed. On the fixed builds, four came back clean, three inconclusive, and one false alarm, which taught Senyap a new noise rule. Every miss is published.",
  'ci':      "It ships as a GitHub Action too. On every push, the buggy demo must fail, and the fixed one must pass.",
  'outro':   "Senyap. N P X senyap init. Built on Kane CLI.",
}

async def main():
    os.makedirs('public/vo', exist_ok=True)
    durations = {}
    for k, text in LINES.items():
        if not text:
            continue
        path = f'public/vo/{k}.mp3'
        await edge_tts.Communicate(text, VOICE, rate='+4%').save(path)
        out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout
        durations[k] = round(float(out.strip()), 3)
    json.dump(durations, open('public/vo/durations.json', 'w'), indent=1)
    print(durations, 'total', round(sum(durations.values()), 1))

asyncio.run(main())
