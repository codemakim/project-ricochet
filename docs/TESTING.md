# 테스트 운영 기준

자동 테스트의 목적은 회귀를 빨리 찾는 것이다. 재미, 밸런스, 연출 품질은 자동 E2E 통과만으로 판정하지 않는다.

## 실행 단계

현재 AGENTS.md 기준(2026-10-15): 개발 중 focused 검사, 최종 통합 시 필요한 범위만 넓힌다.

1. 진단 중에는 실패 사례만 재현한다. 전체 E2E를 반복하지 않는다.
2. 개발 중 변경한 계약의 focused 검사만 실행한다. 최종 통합에서 `pnpm build`와 필요한 대표 브라우저 경로를 확인한다.
3. 같은 계약을 중복 검사하지 않는다. 아래 명령은 필요할 때 고르는 목록이며 전부 실행하는 체크리스트가 아니다.
4. 실제 실패가 있으면 수정 후 실패한 검사만 다시 실행한다. 통과한 검사는 반복하지 않는다.

목표 시간은 focused 수초, smoke 20초 이내, 전체 E2E 60초 이내다.

## 작성 원칙

- 게임 시간 진행은 임의 `waitForTimeout`보다 개발용 시간 전진 훅과 상태 조건을 사용한다.
- `expect.poll`은 비동기 DOM·렌더 결과처럼 실제로 기다려야 하는 경계에만 쓴다.
- 실패 진단용 trace는 첫 재시도가 아니라 최초 실패에 남긴다.
- `page.screenshot`은 증거 수집이다. 시각 회귀 검증은 승인된 `toHaveScreenshot` 기준 이미지나 명시적 수동 검토를 사용한다.
- 고정 seed와 개발 훅은 재현성을 위해 쓰되, 실제 플레이 경로를 우회하는 검증으로 대체하지 않는다.
- 같은 계약을 unit과 E2E에서 중복 검증하지 않는다. 계산·상태 전이는 unit, 브라우저 통합 경계만 E2E가 맡는다.

## 수동 플레이테스트

현재 시험판 대표 경로: `pnpm exec playwright test e2e/combat-trial.spec.ts --project=desktop-chromium --workers=1`.
실제 입력으로 출격·성장·회수·전투 결과·재도전을 한 번 관찰한다. 피해/체력/XP/시간을 조작하지 않는다.
자동 조종의 정상 패배도 결과로 기록한다. 승리한 경우 코어 단계를 확인하며, 확정 보스 격파·재시작은 아래 테스트실이 맡는다.
320px 화면 캡처는 같은 출격 도중 한 번 수행하며 모바일 터치 조작 테스트를 대신하지 않는다.
기존 메타 E2E는 개발용 `?campaign=1` 경로 사용.

HUD·VFX 변경: `pnpm test:e2e -- e2e/combat.spec.ts --grep 'keeps the combat HUD|hostile bullets readable' --workers=1`.
HUD와 캔버스가 겹치지 않는지, 세 보스·320px 축소·재시작에서도 중앙 정렬과 450:800 비율을
유지하는지 확인한다. HP·XP 반영, 경고 문구, reduced-motion, 44px 음소거 영역과 적 탄 depth도 검사한다.
스크린샷에서 실제 보스 실루엣·탄 대비·VFX 겹침을 직접 확인한다.

VFX 원화 교체: `pnpm exec vitest run src/game/visuals/combatVfxProfiles.test.ts src/game/visuals/CombatVfxPlayer.test.ts`, `bash scripts/combat_art_assets.test.sh`, `bash scripts/verify_gbc_combat_art.sh --animation-scope vfx`.
원화 36종의 격자·시트 프레임 수·소스와 배포 파일 일치 및 런타임 프레임 설정을 검사한다.
실제 화면: `pnpm exec playwright test e2e/combat.spec.ts --grep 'final seventeen authored VFX|hostile bullets readable' --workers=1`.
마지막 17종의 재생·정리와 데스크톱·모바일 캡처, 밀집 화면의 적 탄 가독성을 확인한다.
이 검사는 제작 시트의 재생 검증이며 실제 구슬 발동 경로의 연결을 대신하지 않는다.

실제 구슬→VFX 연결: `pnpm exec playwright test e2e/combat.spec.ts --grep 'connects (corrosion|split|explosion) art to real orb hits' --workers=1`.
발동 난수만 고정하고 실제 발사·충돌·피해·렌더를 사용한다. 데스크톱·모바일에서 독 장판·분열 자탄·폭발을 캡처하고,
독 장판의 부착 위치·프레임 진행·숨긴 탭 정지·만료, 자탄 원화와 기존 충돌 크기를 확인한다.
융합 장판: `pnpm exec playwright test e2e/combat.spec.ts --project=desktop-chromium --grep 'grows authored nano|six-way cluster|persistent meltdown' --workers=1`.
실제 발동 후 텍스처를 확인하고 클러스터 장판의 선택창 정지와 패배 시 독·클러스터 장판 제거를 검사한다.
방향성 효과: `pnpm exec playwright test e2e/combat.spec.ts --project=desktop-chromium --grep 'fuses a selected orb pair|six-way cluster|connects mirror circuit|replays stored wall' --workers=1`.
광자 직격·반사 잔상, 거울 연결선, 벡터 칼날, 실제 이동하는 클러스터 탄체의 텍스처·위치·길이를 확인한다.

보스 전환: `pnpm exec playwright test e2e/combat.spec.ts --grep 'presents boss warning|holds hidden boss defeat' --workers=1`.
경고 진행률·코어 노출·격파 후 보상 지연을 데스크톱·모바일에서 캡처한다. 숨긴 탭의 격파 정지,
동시 레벨업의 우선 처리, 선택창에서 제작 VFX와 순간 선의 제거도 확인한다.
focused unit 실행은 `pnpm exec vitest run <test-file...>`을 사용한다.
`pnpm test -- <test-file...>`은 현재 환경에서 파일 필터가 적용되지 않아 전체 테스트를 실행한다.

오디오 변경: `pnpm exec vitest run src/game/audio/CombatAudio.test.ts src/game/assets/combatAssetManifest.test.ts`
후 `pnpm test:e2e -- e2e/audio.spec.ts --workers=1`로 데스크톱·모바일 브라우저의
출력 신호, 첫 입력 해제, 음소거 저장, 보스 전환, 탭 복귀와 종료·재출격을 확인한다.
`assets-source/combat/audio/combat-preview.wav`와 실제 전체 런을 들어 음색·피로도를 별도로 판단한다.

아트, VFX, 조작감, 전투 압력, 파워 커브를 바꾼 묶음은 실제 브라우저에서 별도 확인한다. 자동 E2E의 녹색 결과는 “동작한다”는 증거이며 “재미있다”거나 “보기 좋다”는 증거가 아니다.

## 다음 정리 작업

- 긴 `combat.spec.ts`의 중복 시나리오와 임의 대기부터 점진적으로 제거
- 반복 확인 가치가 큰 화면 5~8개만 시각 기준 이미지로 고정

완료: 핵심 E2E 10개에 `@smoke` 태그와 `pnpm test:e2e:smoke`를 추가했고,
Playwright trace는 최초 실행 실패 시 보존하도록 설정했다.

## PC 아트 첫 적용 검증

`pnpm exec playwright test e2e/pc-art.spec.ts --project desktop-chromium --workers 1`
은 일반 시험판의 폭발·분열·부식 출격을 각각 실행한다. 에셋 로딩,
플레이어 40px 원·기본 적 70×60px 판정, 배경 표시를 검사하고 실제 비행 중
`pc-trial-*.png`를 저장한다. 그림의 완성도는 캡처를 직접 검토한다.

원화 변환 및 출력 크기·알파 검사는 `rtk bash scripts/build_pc_combat_art.sh`.
원화와 결과물은 이전 픽셀 파이프라인과 별도 경로를 사용한다.

융합9종: `rtk pnpm exec playwright test e2e/combat.spec.ts --project desktop-chromium --workers 1 --grep 'renders (photon-orbit|resonant-swarm|nano-proliferator|mass-collapse|reactor-orb|cluster-bombardment|mirror-circuit|meltdown-core|vector-blade) orb animation identity'`.
각 종류의 실제 비행과 현재 선언된 에너지층 움직임을 확인한다. 42px 종류 구분은
`output/playwright/pc-fusion-orbs-board.png` 비교판과 실제 비행 캡처를 직접 검토한다.
비교판은 본체/빛 합성 검수용이며 적·탄·VFX가 겹치는 전투 가독성 검수를 대신하지 않는다.

## 개발 전투 테스트실

개발 서버 출격 화면 → **전투 테스트실**. 적 1체(기본·장갑·사수·분열), 밀집 편대,
SENTINEL을 바로 실행한다. 구슬 15종·1~6개·기본 최대5/융합 최대9레벨, HP 배율·시드를 지정한다.
무적·정지/계속·판정 표시·같은 조건 재시작·조건 수정 제공. 자동 증원과 성장 선택을 멈추며 메타 저장을 바꾸지 않는다.
일반 적은 고정 위치에서 비교한다. 시드와 초기 조건을 반복하며 입력까지 재생하는 리플레이는 아니다.
production 빌드에는 진입 메뉴와 개발 훅이 없다.

`rtk pnpm exec playwright test e2e/combat-sandbox.spec.ts --project desktop-chromium --workers 1`
설정·무적·물리/시간 정지·판정 표시·저장 보존, PC 장갑/사수/SENTINEL 판정 크기,
실제 구슬에 의한 보스 격파와 같은 조건 재시작을 확인한다.

개발용 순간 배치 뒤에는 Arcade body도 동기화한다. 충돌 테스트는 적 내부나 월드 바깥에서
시작하지 않는다. 합산 반경 바깥에서 일정 방향으로 진입시켜 벽 충돌과 후속 조각 타격을 분리한다.
분열 조각의 가장자리 제한 계산은 `splitterRules.test.ts`에서 확인한다.
분열 적 PC 아트: `rtk pnpm exec playwright test e2e/combat-sandbox.spec.ts e2e/combat.spec.ts --project desktop-chromium --workers 1 --grep 'sandbox preserves splitter|splitter reserves population|animates combat art without changing collision bodies'`.
테스트실은 실제 발사로 분열 전후를 캡처하고 좌우 정렬을 확인한다. 캠페인 경로는
조각70×60 판정·개체 수·XP 보상을 확인한다.
부식 만료는 첫 시각 객체가 아니라 원래 `fieldId`로 확인한다. 구슬 15종은 각각 별도 테스트로 실행한다.

Hive/Siege PC 아트: `rtk pnpm exec playwright test e2e/combat.spec.ts --project desktop-chromium --workers 1 --grep 'keeps PC Hive and Siege art|hive cycles shield|hive permanent exposure|hive reflector changes'`.
Hive5개 파츠의 표시/판정 치수와 광폭화 맥동, Siege 본체/약점과 장갑 파괴 후 활성 코어의56×56 판정을 검사한다.
보스 실루엣·기존 반사/주기/광폭화 공격도 확인한다. 장갑 피해에는0.45 배율이 적용되므로 코어 노출 검사는 방어부와 양쪽 약점을 모두 파괴한다.
기존4173 서버가 사용 중이면 임시 설정의 포트만4183으로 바꾸고 검사 후 제거한다. 동작 캡처는 `output/playwright/pc-bosses-verified/`, 최종 크롭 후 캡처는 `output/playwright/pc-bosses-final/`.

직격·적 파괴·폭발 PC 효과: `rtk pnpm exec playwright test e2e/combat.spec.ts --project desktop-chromium --workers 1 --grep 'connects explosion art to real orb hits|renders player feedback and break VFX|renders the second authored VFX batch|animates combat art without changing collision bodies'`.
실제 폭발 구슬 타격과 효과 재생·프레임·충돌 크기 유지를 확인한다. 파괴와 직격의 별도 효과 화면은 직접 효과를 재생한 캡처이며 실제 처치 장면을 대신하지 않는다.
