import * as THREE from 'three';
import { aimForScreenPoint, frameCentreNdc } from './focusFrame';

const canvas = { left: 0, top: 0, width: 400, height: 800 };

describe('frameCentreNdc', () => {
  it('finds the middle of the visible part of the map', () => {
    const ndc = frameCentreNdc(canvas, { left: 0, top: 100, width: 400, height: 200 });
    expect(ndc?.x).toBeCloseTo(0);
    expect(ndc?.y).toBeCloseTo(0.5);
  });

  it('counts from the canvas, wherever it sits on the page', () => {
    const ndc = frameCentreNdc({ ...canvas, top: 100 }, { left: 0, top: 500, width: 400, height: 200 });
    expect(ndc?.y).toBeCloseTo(-0.25);
  });

  it('gives up without a usable frame, so the view stays centred', () => {
    expect(frameCentreNdc(canvas, null)).toBeNull();
    expect(frameCentreNdc(canvas, { left: 0, top: 0, width: 400, height: 40 })).toBeNull();
    expect(frameCentreNdc({ ...canvas, width: 0 }, { left: 0, top: 0, width: 400, height: 200 })).toBeNull();
  });
});

describe('aimForScreenPoint', () => {
  const camera = new THREE.PerspectiveCamera(40, 400 / 800, 0.1, 1000);
  const place = new THREE.Vector3(12, 0, -7);

  /** Where `place` lands on screen once the camera aims at `aim`. */
  function screenPosition(aim: THREE.Vector3, offset: THREE.Vector3): THREE.Vector3 {
    const shot = camera.clone();
    shot.position.copy(aim).add(offset);
    shot.lookAt(aim);
    shot.updateMatrixWorld(true);
    return place.clone().project(shot);
  }

  it.each([
    ['tilted (3D)', new THREE.Vector3(0, 13, 10.4)],
    ['straight down (2D)', new THREE.Vector3(0, 16, 0.01)],
  ])('puts the place where it was asked, %s', (_, offset) => {
    const ndc = new THREE.Vector2(0, 0.45);
    const landed = screenPosition(aimForScreenPoint(camera, place, offset, ndc), offset);
    expect(landed.x).toBeCloseTo(ndc.x, 2);
    expect(landed.y).toBeCloseTo(ndc.y, 2);
  });

  it('stays on the ground, and aims at the place itself for the middle of the screen', () => {
    const offset = new THREE.Vector3(0, 13, 10.4);
    const aim = aimForScreenPoint(camera, place, offset, new THREE.Vector2(0, 0));
    expect(aim.x).toBeCloseTo(place.x);
    expect(aim.y).toBeCloseTo(0);
    expect(aim.z).toBeCloseTo(place.z);
  });
});
