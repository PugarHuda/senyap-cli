import { Composition } from 'remotion';
import { Senyap, SCENES, FPS, sceneFrames } from './Video';

export const Root = () => (
  <Composition
    id="Senyap"
    component={Senyap}
    durationInFrames={SCENES.reduce((n, s) => n + sceneFrames(s), 0)}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
