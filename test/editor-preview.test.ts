import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { RotateComponent } from '../plugin/mrpp/components/RotateComponent.ts';
import { getAnimationPreviewTimeline } from '../three.js/editor/js/AnimationPreviewPolicy.js';

test('very short animation previews stay completed instead of repeatedly resetting', () => {
  const timeline = getAnimationPreviewTimeline(0.02, 0);

  assert.equal(timeline.isShort, true);
  assert.equal(timeline.value, 0.02);
  assert.equal(timeline.disabled, true);
  assert.equal(timeline.playable, true);
});

test('regular animation previews continue to show their current playback time', () => {
  const timeline = getAnimationPreviewTimeline(2, 0.75);

  assert.equal(timeline.isShort, false);
  assert.equal(timeline.value, 0.75);
  assert.equal(timeline.disabled, false);
});

test('positive Y self-rotation preview follows the client clockwise direction', () => {
  const previousPerformance = globalThis.performance;
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let nextFrame: FrameRequestCallback | undefined;

  globalThis.performance = { now: () => 0 } as Performance;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;

  try {
    const object = new THREE.Object3D();
    const editor = {
      signals: {
        objectChanged: { dispatch() {} },
        componentChanged: { dispatch() {} },
      },
    };
    const component = {
      type: 'Rotate',
      parameters: { speed: { x: 0, y: 15, z: 0 } },
    };

    new RotateComponent(editor as any, object, component as any).startPreview();
    assert.ok(nextFrame, 'preview should schedule an animation frame');
    nextFrame(1000);

    assert.ok(Math.abs(object.rotation.y - THREE.MathUtils.degToRad(-15)) < 1e-9);
  } finally {
    globalThis.performance = previousPerformance;
    globalThis.requestAnimationFrame = previousRequestAnimationFrame;
    globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
  }
});
