import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { CombatScene } from '../src/game/scenes/CombatScene';
import { BOSS_GEOMETRY } from '../src/game/bosses/bossGeometry';

async function state(page: Page) {
  return page.evaluate(() => ((window as unknown as { __RICHOCHET_GAME__: Phaser.Game })
    .__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene).getDebugSnapshot());
}

async function openRoom(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/assets/combat/') && !response.ok()) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: '전투 테스트실', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전투 테스트실' })).toBeVisible();
  return errors;
}

test('sandbox configures fusion cores, pause, invulnerability, hitboxes and repeat @desktop', async ({ page }, testInfo) => {
  const errors = await openRoom(page);
  const saved = await page.evaluate(() => localStorage.getItem('project-ricochet.meta'));
  await page.getByRole('combobox', { name: '구슬 종류', exact: true }).selectOption('photon-orbit');
  await page.getByLabel('구슬 레벨', { exact: true }).fill('9');
  await page.getByLabel('구슬 개수', { exact: true }).fill('6');
  await page.getByLabel('적·보스 HP 배율').fill('10');
  await page.getByRole('button', { name: '테스트 시작' }).click();
  await expect.poll(async () => (await state(page)).orbs.length).toBe(6);
  expect((await state(page)).orbs.every(({ coreType, level }) => coreType === 'photon-orbit' && level === 9)).toBe(true);
  expect((await state(page)).enemies).toHaveLength(1);
  await page.evaluate(() => ((window as unknown as { __RICHOCHET_GAME__: Phaser.Game })
    .__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene).debugDamage?.(2));
  expect((await state(page)).health.current).toBe(10);
  await page.getByLabel('무적', { exact: true }).uncheck();
  await page.evaluate(() => ((window as unknown as { __RICHOCHET_GAME__: Phaser.Game })
    .__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene).debugDamage?.(1));
  expect((await state(page)).health.current).toBe(9);
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width * 0.3, canvas.y + canvas.height * 0.2);
  await expect.poll(async () => (await state(page)).orbs.some(({ state }) => state === 'active')).toBe(true);
  const placement = await page.evaluate(() => {
    const scene = (window as unknown as { __RICHOCHET_GAME__: Phaser.Game })
      .__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene;
    const orb = scene.getDebugSnapshot().orbs.find(({ state }) => state === 'active')!;
    const sprite = scene.children.list.find((child) => (child as unknown as { orbId: number }).orbId === orb.id) as Phaser.Physics.Arcade.Sprite;
    sprite.setRotation(1.1);
    scene.debugPlaceOrb!(orb.id, { x: 100, y: 400 });
    return { x: sprite.body!.center.x, y: sprite.body!.center.y };
  });
  expect(placement.x).toBeCloseTo(100);
  expect(placement.y).toBeCloseTo(400);
  await page.getByLabel('판정 표시', { exact: true }).check();
  await page.getByRole('button', { name: '정지', exact: true }).click();
  const paused = await state(page);
  await page.waitForTimeout(200); // Verify the stopped clock and physics over real elapsed time.
  const after = await state(page);
  expect(after.gameplayElapsedMs).toBe(paused.gameplayElapsedMs);
  expect(after.orbs.map(({ position }) => position)).toEqual(paused.orbs.map(({ position }) => position));
  expect(await page.evaluate(() => ((window as unknown as { __RICHOCHET_GAME__: Phaser.Game })
    .__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene).physics.world.drawDebug)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('sandbox-controls.png') });
  await page.getByRole('button', { name: '같은 조건 재시작' }).click();
  await expect.poll(async () => (await state(page)).health.current).toBe(10);
  expect((await state(page)).orbs.every(({ coreType, level }) => coreType === 'photon-orbit' && level === 9)).toBe(true);
  await page.getByRole('button', { name: '나가기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '리코셰 전투 시험판' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('project-ricochet.meta'))).toBe(saved);
  expect(errors).toEqual([]);
});

test('sandbox density remains isolated from automatic encounter progression @desktop', async ({ page }) => {
  const errors = await openRoom(page);
  await page.getByRole('combobox', { name: '상황', exact: true }).selectOption('dense');
  await expect(page.getByRole('combobox', { name: '단일 적 종류', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '테스트 시작' }).click();
  await expect.poll(async () => (await state(page)).enemies.length).toBe(8);
  await page.evaluate(() => ((window as unknown as { __RICHOCHET_GAME__: Phaser.Game })
    .__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene).debugAdvanceEncounter?.(120000));
  expect((await state(page)).enemies).toHaveLength(8);
  expect((await state(page)).boss.active).toBe(false);
  expect(errors).toEqual([]);
});

test('sandbox Sentinel completes through real hits and restarts cleanly @desktop', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors = await openRoom(page);
  await page.getByRole('combobox', { name: '상황', exact: true }).selectOption('sentinel');
  await page.getByLabel('구슬 개수', { exact: true }).fill('6');
  await page.getByLabel('구슬 레벨', { exact: true }).fill('5');
  await page.getByRole('button', { name: '테스트 시작' }).click();
  await expect.poll(async () => (await state(page)).boss.active).toBe(true);
  expect((await state(page)).enemies).toHaveLength(0);
  expect(await page.evaluate(() => {
    const scene = (window as unknown as { __RICHOCHET_GAME__: Phaser.Game })
      .__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene;
    return Object.fromEntries(['body', 'left-weakpoint', 'right-weakpoint'].map((part) => {
      const sprite = scene.children.list.find((child) => (child as Phaser.Physics.Arcade.Sprite)
        .texture?.key === `actor-sentinel-${part}-default`) as Phaser.Physics.Arcade.Sprite;
      return [part, [sprite.body!.width, sprite.body!.height]];
    }));
  })).toEqual({ body: [252, 144], 'left-weakpoint': [56, 120], 'right-weakpoint': [56, 120] });
  await page.screenshot({ path: testInfo.outputPath('sandbox-sentinel-pc.png') });
  const started = Date.now();
  let coreChecked = false;
  while (Date.now() - started < 75000 && !(await page.getByRole('button', { name: '격파 완료' }).isVisible())) {
    const boss = (await state(page)).boss;
    if (boss.phase === 'core' && !coreChecked) {
      await expect.poll(() => page.evaluate(() => {
        const scene = (window as unknown as { __RICHOCHET_GAME__: Phaser.Game })
          .__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene;
        const core = scene.children.list.find((child) => (child as Phaser.Physics.Arcade.Sprite)
          .texture?.key === 'actor-sentinel-core-default') as Phaser.Physics.Arcade.Sprite | undefined;
        return core?.body ? [core.body.width, core.body.height] : null;
      })).toEqual([56, 56]);
      coreChecked = true;
      await page.screenshot({ path: testInfo.outputPath('sandbox-sentinel-core-pc.png') });
    }
    const offset = boss.parts!.leftWeakpoint! > 0 ? -BOSS_GEOMETRY.weakpointOffsetX
      : boss.parts!.rightWeakpoint! > 0 ? BOSS_GEOMETRY.weakpointOffsetX : 0;
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(canvas.x + (boss.position!.x + offset) / 450 * canvas.width,
      canvas.y + boss.position!.y / 800 * canvas.height);
    await page.waitForTimeout(100); // Sample moving boss targets during real physics.
  }
  await expect(page.getByRole('button', { name: '격파 완료' })).toBeVisible();
  expect(coreChecked).toBe(true);
  expect((await state(page)).levelUpVisible).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('sandbox-sentinel-complete.png') });
  await page.getByRole('button', { name: '같은 조건 재시작' }).click();
  await expect.poll(async () => (await state(page)).boss.phase).toBe('twoWeakpoints');
  expect((await state(page)).boss.parts).toMatchObject({ leftWeakpoint: 12, rightWeakpoint: 12, core: 30 });
  expect(errors).toEqual([]);
});

for (const enemy of ['armored', 'shooter'] as const) {
  test(`sandbox preserves ${enemy} PC art hitboxes @desktop`, async ({ page }, testInfo) => {
    const errors = await openRoom(page);
    await page.getByRole('combobox', { name: '단일 적 종류', exact: true }).selectOption(enemy);
    await page.getByRole('button', { name: '테스트 시작' }).click();
    await expect.poll(async () => (await state(page)).enemies[0]?.kind).toBe(enemy);
    const geometry = await page.evaluate((kind) => {
      const scene = (window as unknown as { __RICHOCHET_GAME__: Phaser.Game })
        .__RICHOCHET_GAME__.scene.getScene('combat') as CombatScene;
      const sprite = scene.children.list.find((child) => (child as Phaser.Physics.Arcade.Sprite)
        .texture?.key === `actor-enemy-${kind}-default`) as Phaser.Physics.Arcade.Sprite;
      return [sprite.body!.width, sprite.body!.height];
    }, enemy);
    expect(geometry).toEqual(enemy === 'armored' ? [140, 120] : [70, 60]);
    await page.screenshot({ path: testInfo.outputPath(`sandbox-${enemy}-pc.png`) });
    expect(errors).toEqual([]);
  });
}
