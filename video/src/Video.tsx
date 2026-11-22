// The Senyap demo film. Every line of terminal output, transcript and benchmark comes from
// src/data.json, which prepare.mjs builds from real runs; clips are captures of the live pages.
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadSans } from '@remotion/google-fonts/SchibstedGrotesk';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import data from './data.json';

const { fontFamily: SANS } = loadSans();
const { fontFamily: MONO } = loadMono();
export const FPS = 30;
const PAD = 1.4; // seconds of air after each line of narration

const C = { paper: '#eef1f4', card: '#ffffff', ink: '#1d2733', muted: '#5f6b7a', rule: '#cfd6de', under: '#24324a', underInk: '#dbe3ee', dim: '#8d9bb0', ok: '#2e7d4f', okLight: '#7fd1a0', fail: '#c8362f', failLight: '#ff8a82' };

type Scene = { key: string; min?: number };
const dur = data.durations as Record<string, number>;
const bench = (data.bench ?? null) as null | Array<Record<string, any>>;
export const SCENES: Scene[] = [
  { key: 'hook', min: 7 }, { key: 'lift', min: 8 }, { key: 'plain' }, { key: 'check' }, { key: 'title' },
  { key: 'init' }, { key: 'task' }, { key: 'block' }, { key: 'kane', min: 9 }, { key: 'fix' }, { key: 'clean' },
  { key: 'how' }, { key: 'limits' }, { key: 'try' },
  ...(bench && dur.bench ? [{ key: 'bench' }] : []),
  { key: 'ci', min: 7 }, { key: 'outro', min: 6 },
];
export const sceneFrames = (s: Scene) => Math.round(Math.max((dur[s.key] ?? 0) + PAD, s.min ?? 0) * FPS);

const fadeIn = (f: number, at = 0, len = 12) => interpolate(f, [at, at + len], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const Page: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = C.paper }) => (
  <AbsoluteFill style={{ background: bg, fontFamily: SANS, color: C.ink, padding: '90px 120px', justifyContent: 'center' }}>{children}</AbsoluteFill>
);

const Caption: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  return <div style={{ position: 'absolute', left: 120, bottom: 54, fontSize: 30, color: C.muted, opacity: fadeIn(f, 6) }}>{text}</div>;
};

const Clip: React.FC<{ name: string; caption: string }> = ({ name, caption }) => (
  <Page>
    <div style={{ position: 'absolute', left: 120, top: 60, width: 1680, height: 1050 * 0.83, borderRadius: 14, overflow: 'hidden', boxShadow: '0 30px 70px -30px rgba(29,39,51,.55)', border: `1px solid ${C.rule}` }}>
      <OffthreadVideo src={staticFile(`clips/${name}.webm`)} style={{ width: '100%' }} muted />
    </div>
    <Caption text={caption} />
  </Page>
);

/** Lines appear one by one, like a terminal printing a real run. */
const Terminal: React.FC<{ title: string; blocks: { cmd: string; lines: string[] }[] }> = ({ title, blocks }) => {
  const f = useCurrentFrame();
  let t = 8;
  return (
    <Page>
      <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 36, opacity: fadeIn(f) }}>{title}</div>
      <div style={{ background: C.ink, borderRadius: 14, padding: '40px 46px', fontFamily: MONO, fontSize: 27, lineHeight: 1.6, color: '#e7edf5' }}>
        {blocks.map((b, i) => {
          const cmdAt = t; t += 18;
          const items = b.lines.map((line) => { const at = t; t += 10; return { line, at }; });
          t += 16;
          return (
            <div key={i} style={{ marginBottom: 26 }}>
              <div style={{ opacity: fadeIn(f, cmdAt), color: C.dim }}>$ <span style={{ color: '#e7edf5' }}>{b.cmd}</span></div>
              {items.map(({ line, at }, j) => (
                <div key={j} style={{ opacity: fadeIn(f, at), whiteSpace: 'pre-wrap', color: /✖|fail|740|FALSE GREEN/.test(line) ? C.failLight : /✔|clean|passed|100/.test(line) ? C.okLight : '#e7edf5' }}>{line}</div>
              ))}
            </div>
          );
        })}
      </div>
    </Page>
  );
};

const Bubble: React.FC<{ who: string; text: string; tone?: 'fail' | 'ok'; at?: number }> = ({ who, text, tone, at = 0 }) => {
  const f = useCurrentFrame();
  const color = tone === 'fail' ? C.fail : tone === 'ok' ? C.ok : C.ink;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 30, padding: '26px 0', borderBottom: `1px solid ${C.rule}`, opacity: fadeIn(f, at), transform: `translateY(${interpolate(fadeIn(f, at), [0, 1], [14, 0])}px)` }}>
      <div style={{ fontSize: 28, color: C.muted }}>{who}</div>
      <div style={{ fontSize: 31, lineHeight: 1.45, color, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
};

// Excerpts of the real transcript (src/data.json), trimmed for the screen, not reworded.
const firstPara = (t: string) => t.split('\n\n')[0];
const bulletsAfter = (t: string, marker: RegExp) => t.split('\n').filter((l) => marker.test(l)).map((l) => l.replace(/\*\*/g, '').replace(/^- /, '• ')).join('\n');

const Title: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 200 } });
  return (
    <Page>
      <div style={{ fontSize: 150, fontWeight: 900, letterSpacing: -4, opacity: s }}>senyap</div>
      <div style={{ fontSize: 40, color: C.muted, marginTop: 10, opacity: fadeIn(f, 20) }}>Indonesian for "silent"</div>
      <div style={{ fontSize: 52, fontWeight: 700, marginTop: 70, maxWidth: 1400, lineHeight: 1.2, opacity: fadeIn(f, 50) }}>Catch the bugs that fail silently, and keep your coding agent working until they're fixed.</div>
    </Page>
  );
};

const Flow: React.FC = () => {
  const f = useCurrentFrame();
  const steps = [
    ['Kane drives the flow', 'kane-cli run --agent --bug-detection continue, in a real Chrome, with a reload'],
    ["Senyap reads Kane's evidence pack", 'logs/*-network.har and logs/*-console.ndjson'],
    ['Senyap seals a pack of its own', 'metric catalog: silent.http_5xx, silent.console_errors, silent.env_leaks, false_green_tests'],
    ['Kane enforces the policy', 'kane-cli evidence verdict --policy senyap.policy.yaml'],
    ['Only on a failure: Kane confirms it', 'DevTools checks → result code 740 + root cause'],
    ['Clean flows are locked', '*_test.md, testmd run --no-adaptive-heal, gated on metrics.heal.healed_tests'],
  ];
  const per = Math.floor((dur.how * FPS) / steps.length);
  return (
    <Page>
      <div style={{ fontSize: 44, fontWeight: 700, marginBottom: 30 }}>Every verdict is Kane's</div>
      {steps.map(([h, d], i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', padding: '18px 0', borderBottom: `1px solid ${C.rule}`, opacity: interpolate(f, [i * per, i * per + 10], [0.25, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: C.muted }}>{i + 1}</div>
          <div><div style={{ fontSize: 34, fontWeight: 700 }}>{h}</div><div style={{ fontFamily: MONO, fontSize: 24, color: C.muted, marginTop: 6 }}>{d}</div></div>
        </div>
      ))}
    </Page>
  );
};

const Limits: React.FC = () => {
  const f = useCurrentFrame();
  const half = Math.floor((dur.limits * FPS) / 2);
  const card = (at: number, limit: string, design: string) => (
    <div style={{ background: C.card, borderRadius: 14, padding: 44, opacity: fadeIn(f, at), boxShadow: `0 1px 0 ${C.rule}` }}>
      <div style={{ fontSize: 28, color: C.fail, marginBottom: 16 }}>Kane's limit</div>
      <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.25 }}>{limit}</div>
      <div style={{ fontSize: 28, color: C.ok, margin: '34px 0 16px' }}>What Senyap does</div>
      <div style={{ fontSize: 32, lineHeight: 1.35 }}>{design}</div>
    </div>
  );
  return (
    <Page>
      <div style={{ fontSize: 44, fontWeight: 700, marginBottom: 40 }}>Two limits became the design</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        {card(10, "Verdict policies can't read console or network logs", 'Becomes an evidence producer with its own metric catalog, so Kane\'s verdict gates on them')}
        {card(half, 'DevTools analyzers time out proving nothing failed on a clean page (code 750)', 'Observe first and judge the pack; run the analyzers only to confirm a failure')}
      </div>
    </Page>
  );
};

const Bench: React.FC = () => {
  const f = useCurrentFrame();
  const rows = bench ?? [];
  const tag = (s?: string) => (s === 'clean' ? { t: 'clean', c: C.ok } : s === 'silent_failure' || s === 'failed' ? { t: s.replace('_', ' '), c: C.fail } : s === 'passed' ? { t: 'passed', c: C.ok } : { t: s ?? '–', c: C.muted });
  return (
    <Page>
      <div style={{ fontSize: 44, fontWeight: 700, marginBottom: 26 }}>QuietBench: real bugs from open-source apps</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', fontSize: 26, color: C.muted, paddingBottom: 12, borderBottom: `1px solid ${C.rule}` }}>
        <div>Bug</div><div>Plain Kane, buggy</div><div>Senyap, buggy</div><div>Senyap, fixed</div>
      </div>
      {rows.map((r, i) => {
        const a = tag(r.A?.status), b = tag(r.B?.status), c = tag(r.C?.status);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', fontSize: 30, padding: '14px 0', borderBottom: `1px solid ${C.rule}`, opacity: fadeIn(f, 8 + i * 8) }}>
            <div>{r.bug}</div><div style={{ color: a.c }}>{a.t}</div><div style={{ color: b.c, fontWeight: 700 }}>{b.t}</div><div style={{ color: c.c }}>{c.t}</div>
          </div>
        );
      })}
    </Page>
  );
};

const Outro: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Page bg={C.ink}>
      <div style={{ color: '#f3f6fa' }}>
        <div style={{ fontSize: 120, fontWeight: 900, letterSpacing: -3, opacity: fadeIn(f) }}>senyap</div>
        <div style={{ fontFamily: MONO, fontSize: 44, marginTop: 30, opacity: fadeIn(f, 14) }}>npx senyap init --agent claude</div>
        <div style={{ fontSize: 32, color: C.dim, marginTop: 50, opacity: fadeIn(f, 28) }}>github.com/PugarHuda/senyap-cli · senyap-cli.vercel.app · built on Kane CLI</div>
        <div style={{ fontSize: 22, color: C.dim, marginTop: 70, opacity: fadeIn(f, 40) }}>Narration is a synthetic voice (edge-tts). All runs, transcripts and links shown are real.</div>
      </div>
    </Page>
  );
};

const BODY: Record<string, () => React.ReactNode> = {
  hook: () => <Clip name="save" caption="The hosted demo app. The user types a note and clicks Save." />,
  lift: () => <Clip name="lift" caption="senyap-cli.vercel.app: the same moment, with the screen lifted off Kane's network and console record." />,
  plain: () => <Terminal title="A plain Kane run" blocks={[data.plain]} />,
  check: () => <Terminal title="Senyap on that run's evidence pack" blocks={[data.check]} />,
  title: () => <Title />,
  init: () => <Terminal title="In the app's repo" blocks={[data.init]} />,
  task: () => (
    <Page>
      <div style={{ fontSize: 30, color: C.muted, marginBottom: 10 }}>Task: "Add a small counter above the notes list that shows how many notes there are."</div>
      <Bubble who="Claude Code" text={firstPara(data.claudeDone)} at={6} />
      <Bubble who="Claude Code" text={bulletsAfter(data.claudeDone, /^- /)} at={Math.round(dur.task * FPS * 0.45)} />
    </Page>
  ),
  block: () => (
    <Page>
      <div style={{ fontSize: 44, fontWeight: 700, marginBottom: 14 }}>Claude Code tried to stop. Senyap blocked it.</div>
      <div style={{ fontSize: 28, color: C.muted, marginBottom: 10 }}>From the brief Claude Code received, word for word:</div>
      <Bubble who="Senyap (Stop hook)" tone="fail" at={4} text={data.brief.split('\n').filter((l) => /result_code|evidence:|Kane summary/.test(l)).join('\n').replace(/ \/ evidence:/g, '\nevidence:').split('\n').filter((l) => !/Kane summary/.test(l)).slice(0, 5).map((l) => l.replace(/^- /, '').replace(/`/g, '')).join('\n')} />
    </Page>
  ),
  kane: () => <Clip name="kane" caption="Kane's own record of the blocking run, in TestMu AI Test Manager." />,
  fix: () => (
    <Page>
      <Bubble who="Claude Code" text={bulletsAfter(data.fixMsg, /^- \*\*/).split('\n').slice(0, 3).join('\n')} at={6} />
    </Page>
  ),
  clean: () => (
    <Page>
      <Bubble who="Senyap (Stop hook)" tone="ok" text={data.finalMsg} at={10} />
      <Bubble who="Kane" tone="ok" text="result code 100 · no findings in the evidence pack" at={40} />
    </Page>
  ),
  how: () => <Flow />,
  limits: () => <Limits />,
  try: () => <Terminal title="Try it on the hosted demo" blocks={[
    { cmd: 'npx senyap hunt --url https://senyap-demo.vercel.app/ --flow "…"', lines: data.tryBuggy.slice(1) },
    { cmd: 'npx senyap hunt --url https://senyap-demo.vercel.app/fixed/ --flow "…"', lines: data.tryFixed.slice(1) },
  ]} />,
  bench: () => <Bench />,
  ci: () => <Clip name="ci" caption="The GitHub Action on the hosted demo: buggy job fails as expected, fixed job passes." />,
  outro: () => <Outro />,
};

export const Senyap: React.FC = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {SCENES.map((s) => {
        const len = sceneFrames(s);
        const seq = (
          <Sequence key={s.key} from={from} durationInFrames={len}>
            {BODY[s.key]()}
            {dur[s.key] ? <Sequence from={6}><Audio src={staticFile(`vo/${s.key}.mp3`)} /></Sequence> : null}
          </Sequence>
        );
        from += len;
        return seq;
      })}
    </AbsoluteFill>
  );
};
