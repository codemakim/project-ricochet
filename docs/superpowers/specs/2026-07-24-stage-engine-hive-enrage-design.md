# 데이터 기반 스테이지 엔진과 하이브 분노 단계 설계

## 목표

이번 작업은 두 문제를 함께 해결한다.

1. 하이브 보스가 작고 폭발 빌드에 파츠를 너무 빨리 잃으며, 영구 노출 후 공격이 약해지는 문제
2. 스테이지를 추가할 때마다 진행 코드와 대형 생성 코드를 수정해야 하는 문제

새 구조에서는 스테이지 쫄 구성을 타입 안전한 데이터로 추가할 수 있어야 한다. 보스는 고유 몸체와 상태를 유지하되 공용 공격 패턴을 파라미터로 조합한다.

## 범위

### 포함

- 하이브 보스 가로·세로 크기 약 2배 확대
- 보스 폭발 보조 피해 감쇠
- 하이브 영구 노출 분노 단계 강화
- 파라미터 기반 공용 공격 패턴 모듈
- `EnemyCatalog`, `FormationProfile`, `StageDefinition`, `BossRegistry`
- 기존 두 스테이지의 데이터 이관
- 마지막 보상 후 런 완료
- 타입 설정 검증과 결정적 생성 테스트
- 병렬 worktree 기반 구현

### 제외

- 외부 JSON 로딩
- 실제 신규 전장 배경과 전장별 규칙
- 신규 일반 적 구현
- 세 번째 보스 구현
- 소환, 레이저, 회전탄처럼 현재 보스가 사용하지 않는 공격 패턴
- 범용 보스 DSL

## 현재 구조의 한계

현재 일부 수치는 `GAME_TUNING`에 있지만 완전한 스테이지 데이터는 아니다.

- 적 수, 생성 간격, active cap, 특수 적 수와 보스 일정은 데이터다.
- 위협 단계가 정확히 4개라는 가정은 타입과 코드에 고정돼 있다.
- 구간별 위협 단계 전환은 `threatPhaseForSection()` 분기문에 있다.
- 대형 스타일 bag, 8열 좌표, 간격과 스타일 비율은 `formationRules.ts`에 고정돼 있다.
- 모든 구간이 하나의 phase 설정을 공유한다.
- 마지막 하이브 보상 뒤에는 보스 없는 무한 phase 3가 이어진다.

따라서 새 스테이지는 데이터 추가만으로 만들 수 없다.

## 스테이지 데이터 모델

설정은 TypeScript 객체로 둔다. 외부 편집기나 모딩이 필요해질 때 같은 구조를 JSON schema로 옮긴다.

### EnemyCatalog

일반 적의 행동 구현과 출연 조건을 연결한다.

```ts
interface EnemyCatalogEntry {
  kind: EnemyKind;
  minStage: number;
  battlefields: readonly BattlefieldId[] | 'any';
  tags: readonly EnemyTag[];
  baseWeight: number;
  maxPerFormation?: number;
}
```

- `minStage`: 최초 출연 스테이지
- `battlefields`: 출연 가능한 전장
- `tags`: `common`, `ranged`, `durable`, `swarm` 같은 풀 필터
- `baseWeight`: 별도 override가 없을 때의 선택 가중치
- `maxPerFormation`: 한 대형에 과도하게 겹치면 안 되는 적의 상한

첫 구현에서는 기존 `basic`, `armored`, `shooter`, `splitter`, `fragment`만 등록한다. `fragment`는 직접 대형에 배치하지 않고 splitter가 생성하므로 출현 풀에서 제외한다.

### FormationProfile

기존 절차형 대형 생성기를 재사용하며 스타일 조합만 데이터로 옮긴다.

```ts
interface FormationProfile {
  id: FormationProfileId;
  styleWeights: Partial<Record<FormationStyle, number>>;
  allowedTags: readonly EnemyTag[];
  excludedKinds?: readonly EnemyKind[];
  weightOverrides?: Partial<Record<EnemyKind, number>>;
}
```

수제 좌표 웨이브는 지원하지 않는다. 기존 `cluster`, `pockets`, `bands`, `scatter`, `grid` 생성 규칙을 사용한다.

### StageDefinition

스테이지는 하나의 쫄 구간과 하나의 필수 보스를 소유한다.

```ts
interface StageDefinition {
  id: StageId;
  battlefield: BattlefieldId;
  stageNumber: number;
  openingFormation: FormationSpec;
  difficulty: {
    hpMultiplier: number;
    descentSpeedMultiplier?: number;
  };
  phases: readonly StagePhaseDefinition[];
  boss: StageBossDefinition;
}

interface StagePhaseDefinition {
  startsAtMs: number;
  profile: FormationProfileId;
  count: { minimum: number; maximum: number };
  spawnIntervalMs: number;
  activeCap: number;
  allowedTags?: readonly EnemyTag[];
  excludedKinds?: readonly EnemyKind[];
  weightOverrides?: Partial<Record<EnemyKind, number>>;
  maxPerFormationOverrides?: Partial<Record<EnemyKind, number>>;
}

interface StageBossDefinition {
  id: BossId;
  minimumMs: number;
  scoreTarget: number;
  hardMaximumMs: number;
  warningMs: number;
}
```

쫄 phase 전환은 경과 시간 기반이다. 보스 등장은 기존처럼 최소 시간과 처치 점수 조건을 함께 사용하고 강제 등장 시간을 가진다.

프로필과 phase가 같은 필터를 가지면 더 좁은 조건을 사용한다. 태그와 제외 목록은 합쳐서 적용하고, phase의 가중치와 종류별 상한 override는 catalog와 profile 값을 덮어쓴다. 이 규칙으로 특정 스테이지에서 같은 적을 더 자주 또는 더 적게 등장시킬 수 있다.

하강 속도는 특별 취급한다.

- 미지정 기본값은 `1`
- 스테이지 번호에 따른 자동 증가는 없다.
- 난도는 우선 적 수, HP, active cap, 특수 적 비율과 패턴으로 올린다.
- 하강 속도 증가는 플레이테스트 후 명시적으로만 적용한다.

### BossRegistry

스테이지 데이터는 보스 구현을 직접 import하지 않고 ID를 참조한다.

```ts
type BossFactory = (context: BossContext) => BossEncounter;

const BOSS_REGISTRY: Record<BossId, BossFactory> = {
  sentinel: createSentinelBoss,
  hive: createHiveBoss,
};
```

기존 보스를 재사용하는 새 스테이지는 데이터만 추가한다. 신규 보스는 전용 몸체·상태 구현과 registry 등록이 필요하다.

## 스테이지 실행 흐름

```text
현재 stageNumber와 battlefield
→ EnemyCatalog에서 출연 가능 적 필터
→ StagePhaseDefinition의 태그와 제외 조건 적용
→ 가중치와 종류별 상한으로 적 구성 선택
→ FormationProfile 스타일 가중치 선택
→ 기존 절차형 좌표 생성기에 배치
→ population cap 확인 후 생성
```

run seed와 spawn sequence를 기존처럼 사용해 동일 seed에서 동일 결과를 보장한다.

`EncounterDirector`는 전역 phase table 대신 현재 `StageDefinition`을 받는다. 보스 보상 완료 시 다음 스테이지로 이동한다. 다음 스테이지가 없으면 무한 전투로 넘어가지 않고 `runComplete` 전환을 반환한다.

### 기존 콘텐츠 이관

- `default-1`: 기존 초반 phase와 센티널
- `default-2`: 기존 후반 phase와 하이브
- 실제 battlefield는 `default` 하나
- 두 스테이지의 하강 속도 배율은 `1`
- 하이브 보상 선택 뒤 런 완료

## 공용 공격 패턴

보스 전체를 데이터 DSL로 만들지 않는다. 공격 생성과 예약만 작은 타입 union으로 공용화한다.

```ts
type AttackPattern =
  | FanPattern
  | AimedShotPattern
  | AimedBurstPattern
  | FallingBarragePattern;
```

### FanPattern

```ts
interface FanPattern {
  type: 'fan';
  bulletCount: number;
  arcDegrees: number;
  intervalMs: number;
  warningMs: number;
  speed: number;
  damage: number;
  angleOffsetPerVolley: number;
}
```

### AimedShotPattern과 AimedBurstPattern

단발과 다발 조준탄을 지원한다. 조준 위치는 경고 생성 시 고정한다.

```ts
interface AimedBurstPattern {
  type: 'aimedBurst';
  bulletCount: number;
  spreadDegrees: number;
  intervalMs: number;
  warningMs: number;
  speed: number;
  damage: number;
}
```

### FallingBarragePattern

수직 낙하 지원사격을 지원한다. 낙하 시작 위치는 보스 몸체와 독립적일 수 있다.

공용 모듈은 다음만 담당한다.

- gameplay elapsed time 기반 예약
- 경고 생성과 고정 조준
- 탄환 생성
- 전역 적대 탄환 상한
- pause 정지
- 경고·탄환 cleanup
- 파라미터 검증

보스 전용 코드는 몸체, 파츠, 이동, phase 전환, 패턴 활성 조건과 고유 기믹을 소유한다.

첫 이관 대상은 현재 존재하는 단일 조준탄, 다발 조준탄, 확산탄, 수직 낙하탄이다. 소환, 레이저, 회전탄은 해당 보스를 실제로 만들 때 추가한다.

## 하이브 보스 재조정

### 크기와 체력

보스의 가로·세로 크기를 현재의 약 2배로 한다.

- 코어 시각 크기: `56 → 112`
- 코어 hitbox: `48 → 96`
- 사격 모듈: `34x28 → 68x56`
- 반사벽: `18x96 → 36x192`
- 코어 HP: `72 → 120`
- 사격 모듈 HP: `12 → 20`
- 반사벽 HP: `14 → 24`

파츠 위치와 반사벽 이동 범위는 새 크기에 맞춰 재배치한다. 모든 몸체는 `450x800` 안에 있어야 하며 코어, 다른 파츠, 벽 경로가 겹치지 않아야 한다. 두 반사벽 사이에는 플레이어가 읽을 수 있는 통로를 유지한다.

이 크기를 이후 보스의 기본 화면 점유율 기준으로 사용한다.

### 폭발의 보스 피해

폭발의 직접 대상은 정상 피해를 받는다. 보스의 다른 파츠에는 다음 규칙을 적용한다.

- 가장 가까운 보조 파츠 최대 1개
- 보조 피해 배율 기본 `0.5`
- 중앙 설정에서 배율과 대상 수 조정 가능

크기 확대와 간격 조정으로 낮은 폭발 rank가 모든 파츠를 동시에 덮지 않게 한다. 높은 폭발 rank와 좋은 위치 선정은 여전히 보조 파츠 피해를 줄 수 있다.

### 영구 노출 분노 단계

모든 모듈 파괴 시 HP를 회복하거나 새 HP bar를 만들지 않는다. 코어는 남은 HP를 유지하고 영구 노출된다.

분노 단계의 목표 지속 시간은 약 `20~30초`지만 최소 시간을 강제하지 않는다. 강한 빌드는 더 빨리 끝낼 수 있다.

기본 공격 설정:

- 시작 시 색상, 진동, 경고를 위한 enrage 훅
- `9발` 확산탄
- 확산탄 간격 `2800ms`
- 매 발사마다 각도를 반 칸씩 엇갈림
- 중간 `3발` 조준탄
- 조준탄 간격 `1600ms`
- 전역 적대 탄환 상한 유지

발수, 각도, 간격, 탄속, 피해는 모두 중앙 설정에 둔다. 플레이테스트 후 숫자만 조정할 수 있어야 한다.

## 런 종료

모든 스테이지는 보스로 끝난다. 마지막 설정 스테이지의 보스를 처치하고 보상을 선택하면 `runComplete`가 된다.

런 완료 시:

- 적과 적대 탄환 제거
- 예약 경고와 지연 효과 제거
- 임시 구슬 제거
- 전투 시간 정지
- 획득 build와 보상 요약 표시 가능
- 재시작 또는 메인 흐름으로 이동

이번 범위에서는 최소 런 완료 overlay와 재시작만 구현한다.

## 검증과 오류 처리

설정은 게임 시작 시 검증한다.

- stage, profile, boss ID 중복 금지
- 모든 스테이지에 boss 필수
- stage number는 양의 정수이며 중복 금지
- 첫 phase는 `0ms`
- phase 시간은 엄격한 오름차순
- formation count 범위와 interval은 양수
- active cap은 해당 대형의 최악 population을 수용
- 현재 battlefield와 stage에서 출연 가능한 적 풀이 비어 있지 않음
- formation profile과 boss ID가 registry에 존재
- HP와 배율은 유한한 양수
- 하강 속도 미지정 시 `1`
- 공격 패턴 발수, 간격, 경고, 탄속, 피해와 각도는 유효
- 보스 geometry는 화면 경계, body overlap, reflector corridor를 만족

잘못된 설정은 fallback하지 않고 설명적인 오류로 즉시 실패한다.

## 테스트

### Unit

- 동일 seed에서 동일 적 종류와 좌표
- 다른 seed에서 다른 대형
- `minStage`와 battlefield 출연 제한
- 태그, 제외 목록, weight override, 종류별 상한
- 임의 phase 수와 정확한 시간 경계
- 보스 최소 시간, 점수와 강제 등장
- 마지막 보상 뒤 `runComplete`
- 각 공격 패턴의 발수, 각도, 간격, 고정 조준과 hostile cap
- pause 중 stage와 공격 pattern clock 정지
- 하이브 확대 geometry
- 폭발 보조 파츠 최대 1개와 `0.5` 피해
- 영구 노출 확산탄·조준탄 cadence

### Browser E2E

- 스테이지 1에서 센티널 보상 후 스테이지 2 진입
- 하이브 보상 후 런 완료
- phase별 적 풀이 실제 출연 조건을 준수
- 보스 경고와 전투 중 일반 증원 정지
- 하이브 확대 후 모바일 회피 공간
- 낮은 폭발 rank가 하이브 파츠를 즉시 전부 제거하지 않음
- 영구 노출 후 확산탄과 조준탄이 함께 발생
- hostile cap과 defeat/restart cleanup

## 병렬 구현 전략

공유 worktree에서 여러 에이전트가 동시에 수정하지 않는다. 각 작업은 별도 worktree와 브랜치를 사용한다.

### Wave 1

- A: `StageDefinition`, `EnemyCatalog`, validator
- B: 공용 공격 패턴 모듈
- C: 하이브 2배 geometry와 폭발 보조 피해 규칙

### Wave 2

- D: `EncounterDirector` 데이터 이관과 run complete
- E: 하이브 분노 단계와 공용 패턴 연결
- F: 모듈 간 통합 실패 테스트와 E2E 준비

### Wave 3

- 통합 담당이 세 브랜치를 합치고 충돌 해결
- 서브시스템 코드 리뷰를 병렬 실행
- Critical과 Important 수정
- 전체 unit, browser E2E, production build
- 메인 에이전트가 실제 브라우저 플레이 검증

이전처럼 작은 작업마다 구현자와 리뷰어를 순차 대기하지 않는다. 의존성이 있는 통합 작업만 wave 사이에서 순차 실행한다.
