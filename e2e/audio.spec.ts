import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { CombatScene } from '../src/game/scenes/CombatScene';

type GameWindow = typeof window & { __RICHOCHET_GAME__: Phaser.Game; audioProbe?: AnalyserNode };

async function state(page: Page) {
  return page.evaluate(() => {
    const game = (window as GameWindow).__RICHOCHET_GAME__;
    return (game?.scene.getScene('combat') as CombatScene | undefined)?.getDebugSnapshot().audio;
  });
}

async function level(page: Page) {
  return page.evaluate(() => {
    const probe = (window as GameWindow).audioProbe!;
    const values = new Float32Array(probe.fftSize);
    probe.getFloatTimeDomainData(values);
    return Math.max(...values.map(Math.abs));
  });
}

test('@desktop @mobile plays combat audio, persists mute and clears it on game destruction', async ({ page }, testInfo) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/assets/combat/audio/')
      && !response.ok() && response.status() !== 304) failures.push(response.url());
  });
  await page.goto('/?campaign=1');
  await page.getByRole('button', { name: '출격', exact: true }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => state(page)).toMatchObject({ available: true });
  const box = (await canvas.boundingBox())!;
  // Real pointer gesture both unlocks browser audio and aims the permanent orb.
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.55);
  await expect.poll(() => state(page)).toMatchObject({ contextState: 'running', musicTracks: 2, muted: false });
  await expect.poll(async () => (await state(page))?.played.launch ?? 0).toBeGreaterThan(0);
  await page.evaluate(() => {
    const game = (window as GameWindow).__RICHOCHET_GAME__;
    const sound = game.sound as Phaser.Sound.WebAudioSoundManager;
    const probe = sound.context.createAnalyser();
    sound.masterVolumeNode.connect(probe);
    (window as GameWindow).audioProbe = probe;
  });
  await expect.poll(() => level(page)).toBeGreaterThan(0.001);
  const mute = page.getByRole('button', { name: '음소거', exact: true });
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => level(page)).toBeLessThan(0.0001);
  if (testInfo.project.name === 'desktop-chromium') {
    await page.keyboard.press('KeyM');
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('KeyM');
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
  }
  await page.reload();
  await page.getByRole('button', { name: '출격', exact: true }).click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await mute.click();
  await expect.poll(() => state(page)).toMatchObject({ muted: false, contextState: 'running', musicTracks: 2 });
  await page.evaluate(() => {
    const game = (window as GameWindow).__RICHOCHET_GAME__;
    const scene = game.scene.getScene('combat') as CombatScene;
    scene.debugSetHealth?.(1);
    scene.debugDamage?.(1);
  });
  await expect(page.getByRole('heading', { name: '런 종료', exact: true })).toBeVisible();
  await expect(mute).toHaveCount(0);
  await page.getByRole('button', { name: '계속', exact: true }).click();
  await page.getByRole('button', { name: '출격', exact: true }).click();
  await expect(mute).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('combat-audio-controls.png') });
  expect(failures).toEqual([]);
});

test('@desktop keeps boss music synchronized through rewards and hidden-tab pause', async ({ page }) => {
  await page.goto('/?campaign=1');
  await page.getByRole('button', { name: '출격', exact: true }).click();
  await expect.poll(() => state(page)).toMatchObject({ available: true });
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => state(page)).toMatchObject({ musicTracks: 2 });
  const transport = (await state(page))!.musicStart;
  await page.evaluate(() => {
    const game = (window as GameWindow).__RICHOCHET_GAME__;
    const scene = game.scene.getScene('combat') as CombatScene;
    for (let i = 0; i < 10; i++) {
      scene.debugRemoveEnemies?.(scene.getDebugSnapshot().enemies.map(({ id }) => id));
      scene.debugAdvanceEncounter?.(350);
    }
  });
  await expect.poll(async () => (await state(page))?.played.warning ?? 0).toBe(1);
  await page.evaluate(() => {
    const scene = (window as GameWindow).__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene;
    scene.debugAdvanceEncounter?.(2000);
  });
  await expect.poll(() => state(page)).toMatchObject({ boss: true, musicTracks: 2, musicStart: transport });
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => state(page)).toMatchObject({ hidden: true, musicTracks: 0, activeVoices: 0 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => state(page)).toMatchObject({ hidden: false, musicTracks: 2, boss: true });
  await page.evaluate(() => {
    const scene = (window as GameWindow).__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene;
    scene.debugDamageBossPart?.('leftWeakpoint', 999);
    scene.debugDamageBossPart?.('rightWeakpoint', 999);
  });
  await expect.poll(async () => (await state(page))?.played.core ?? 0).toBe(1);
  await page.evaluate(() => {
    const scene = (window as GameWindow).__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene;
    scene.debugDamageBossPart?.('core', 999);
  });
  await expect.poll(() => state(page)).toMatchObject({ boss: false, paused: true, musicTracks: 2 });
  expect((await state(page))?.played.bossDefeat).toBe(1);
});
