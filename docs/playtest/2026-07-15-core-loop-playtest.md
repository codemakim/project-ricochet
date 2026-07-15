# 2026-07-15 코어 루프 플레이테스트

## 비정형 적 대형 자동 검증

- 초기 적 20마리와 재시작 후 새 run seed/초기 배치 확인
- 같은 런의 연속 보충 대형이 서로 다른 ID, style, 좌표를 사용하는지 확인
- 위협 단계 0 보충 대형이 매번 9~11마리이고 좌표가 중복되지 않는지 확인
- focused Playwright: `npm run test:e2e -- --project=desktop-chromium --grep "varies procedural enemy formations"` — **PASS**, 1/1
- 전체 단위 테스트: `npm test` — **PASS**, 22 files, 143/143 tests
- 전체 Playwright: `npm run test:e2e` — **PASS**, 18/18 tests (desktop 16, Pixel 7 emulation 2)
- production build: `npm run build` — **PASS**, TypeScript 및 Vite build 성공, 30 modules transformed
- diff hygiene: `git diff --check` — **PASS**

## 사용자 플레이 확인 대상

- [ ] 시작과 보충 대형에서 붙은 적 무리와 큰 빈 공간이 함께 보인다.
- [ ] 낮은 빈도의 `grid` 대형이 익숙한 반복 패턴처럼 느껴지지 않는다.
- [ ] 늘어난 적 밀도에서도 적, 구슬, 탄환을 구분할 수 있고 성능 저하가 없다.
- [ ] 여러 번 재시작하고 한 런을 오래 진행해도 명백히 같은 배치가 반복되지 않는다.

자동 검증은 좌표와 생성 메타데이터만 확인한다. 가독성, 체감 반복성, 실제 기기 성능은 사용자 플레이 전까지 미검증이다.
