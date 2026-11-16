import React from 'react';
import {Composition} from 'remotion';
import {Video, Props, totalFrame, FPS} from './Video';
import contoh from '../naskah/contoh.json';

export const Akar: React.FC = () => (
  <Composition
    id="Motion"
    component={Video}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={totalFrame(contoh as unknown as Props)}
    defaultProps={contoh as unknown as Props}
    calculateMetadata={({props}) => ({durationInFrames: totalFrame(props)})}
  />
);
