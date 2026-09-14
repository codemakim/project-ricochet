# 테스트 운영 기준

자동 테스트의 목적은 회귀를 빨리 찾는 것이다. 재미, 밸런스, 연출 품질은 자동 E2E 통과만으로 판정하지 않는다.

## 실행 단계

1. 작업 중에는 변경한 모듈의 focused unit test만 실행한다.
2. 씬·UI 경계를 바꿨을 때만 관련 E2E 1~3개를 `--grep`으로 실행한다.
3. 핵심 출격·전투·보상 흐름은 짧은 smoke 묶음으로 확인한다.
4. 병합 직전에 전체 unit, production build, 전체 E2E를 각각 한 번 실행한다.
5. 실패 분석 중에는 전체 E2E를 반복하지 않는다. `--last-failed`, `--grep`, `--workers=1`로 재현하고 수정 완료 뒤 전체 E2E를 한 번만 다시 실행한다.

목표 시간은 focused 수초, smoke 20초 이내, 전체 E2E 60초 이내다.

## 작성 원칙

- 게임 시간 진행은 임의 `waitForTimeout`보다 개발용 시간 전진 훅과 상태 조건을 사용한다.
- `expect.poll`은 비동기 DOM·렌더 결과처럼 실제로 기다려야 하는 경계에만 쓴다.
- 실패 진단용 trace는 첫 재시도가 아니라 최초 실패에 남긴다.
- `page.screenshot`은 증거 수집이다. 시각 회귀 검증은 승인된 `toHaveScreenshot` 기준 이미지나 명시적 수동 검토를 사용한다.
- 고정 seed와 개발 훅은 재현성을 위해 쓰되, 실제 플레이 경로를 우회하는 검증으로 대체하지 않는다.
- 같은 계약을 unit과 E2E에서 중복 검증하지 않는다. 계산·상태 전이는 unit, 브라우저 통합 경계만 E2E가 맡는다.

## 수동 플레이테스트

HUD·VFX 변경: `pnpm test:e2e -- e2e/combat.spec.ts --grep 'keeps the combat HUD|hostile bullets readable' --workers=1`.
HUD와 캔버스가 겹치지 않는지, 세 보스·320px 축소·재시작에서도 중앙 정렬과 450:800 비율을
유지하는지 확인한다. HP·XP 반영, 경고 문구, reduced-motion, 44px 음소거 영역과 적 탄 depth도 검사한다.
스크린샷에서 실제 보스 실루엣·탄 대비·임시 VFX를 직접 확인한다.

오디오 변경: `pnpm test -- src/game/audio/CombatAudio.test.ts src/game/assets/combatAssetManifest.test.ts`
후 `pnpm test:e2e -- e2e/audio.spec.ts --workers=1`로 데스크톱·모바일 브라우저의
출력 신호, 첫 입력 해제, 음소거 저장, 보스 전환, 탭 복귀와 종료·재출격을 확인한다.
`assets-source/combat/audio/combat-preview.wav`와 실제 전체 런을 들어 음색·피로도를 별도로 판단한다.

아트, VFX, 조작감, 전투 압력, 파워 커브를 바꾼 묶음은 실제 브라우저에서 별도 확인한다. 자동 E2E의 녹색 결과는 “동작한다”는 증거이며 “재미있다”거나 “보기 좋다”는 증거가 아니다.

## 다음 정리 작업

- 긴 `combat.spec.ts`의 중복 시나리오와 임의 대기부터 점진적으로 제거
- 반복 확인 가치가 큰 화면 5~8개만 시각 기준 이미지로 고정

완료: 핵심 E2E 10개에 `@smoke` 태그와 `pnpm test:e2e:smoke`를 추가했고,
Playwright trace는 최초 실행 실패 시 보존하도록 설정했다.
