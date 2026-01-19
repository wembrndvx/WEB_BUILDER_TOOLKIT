# RNBT Architecture Test Suite

## 개요

RNBT 아키텍처의 핵심 모듈을 테스트하기 위한 Mock 기반 테스트 환경입니다.

## 디렉토리 구조

```
tests/
├── __mocks__/                  # Mock 모듈
│   ├── index.js               # 통합 인덱스
│   ├── Weventbus.mock.js      # EventBus Mock
│   ├── GlobalDataPublisher.mock.js  # Pub-Sub Mock
│   ├── Wkit.mock.js           # 유틸리티 Mock
│   ├── PopupMixin.mock.js     # Popup Mixin Mock
│   └── fx.mock.js             # 함수형 유틸리티 Mock
├── examples/                   # 테스트 예제
│   ├── component-lifecycle.test.js
│   ├── global-data-publisher.test.js
│   └── popup-mixin.test.js
├── run-all-tests.js           # 전체 테스트 실행기
└── README.md
```

## 테스트 실행

```bash
# 전체 테스트 실행
node tests/run-all-tests.js

# 개별 테스트 실행
node tests/examples/component-lifecycle.test.js
node tests/examples/global-data-publisher.test.js
node tests/examples/popup-mixin.test.js
```

## Mock 모듈 사용법

### 기본 사용

```javascript
const {
  Weventbus,
  GlobalDataPublisher,
  Wkit,
  PopupMixin,
  fx,
  initTestEnvironment,
} = require('./__mocks__');

// 매 테스트 전 초기화
initTestEnvironment();
```

### Weventbus Mock

```javascript
// 이벤트 발행/구독
Weventbus.on('myEvent', handler);
Weventbus.emit('myEvent', { data: 'test' });
Weventbus.off('myEvent', handler);

// 테스트 헬퍼
Weventbus.__wasEmitted('myEvent');          // 이벤트 발행 여부
Weventbus.__getEmitHistory();               // 전체 발행 기록
Weventbus.__getListenerCount('myEvent');    // 리스너 수
Weventbus.__reset();                        // 상태 초기화
```

### GlobalDataPublisher Mock

```javascript
// 등록/구독
GlobalDataPublisher.registerMapping({ topic: 'data', datasetInfo: {...} });
GlobalDataPublisher.subscribe('data', component, handler);
GlobalDataPublisher.fetchAndPublish('data', page, params);

// Mock 응답 설정
GlobalDataPublisher.__setMockResponse('data', { data: [...] });

// 테스트 헬퍼
GlobalDataPublisher.__isRegistered('data');           // 등록 여부
GlobalDataPublisher.__isSubscribed('data', comp);     // 구독 여부
GlobalDataPublisher.__getPublishHistory();            // 발행 기록
GlobalDataPublisher.__reset();                        // 상태 초기화
```

### Wkit Mock

```javascript
// 이벤트 바인딩
Wkit.bindEvents(component, customEvents);
Wkit.removeCustomEvents(component, customEvents);
Wkit.bind3DEvents(component, customEvents);

// EventBus 핸들러
Wkit.onEventBusHandlers(handlers);
Wkit.offEventBusHandlers(handlers);

// 테스트 헬퍼
Wkit.__wasBindEventsCalled(component);    // 바인딩 호출 여부
Wkit.__verifyCleanup(component);          // 정리 매칭 검증
Wkit.__setMockFetchResponse('api', data); // Mock 응답 설정
Wkit.__reset();                           // 상태 초기화
```

### PopupMixin Mock

```javascript
// Mixin 적용
PopupMixin.applyShadowPopupMixin(component, {
  getHTML: () => '<div>...</div>',
  getStyles: () => '.popup { ... }',
  onCreated: (shadowRoot) => { ... }
});
PopupMixin.applyEChartsMixin(component);
PopupMixin.applyTabulatorMixin(component);

// 팝업 조작
component.showPopup();
component.hidePopup();
component.destroyPopup();

// 테스트 헬퍼
PopupMixin.__getPopupState(component);        // 팝업 상태
PopupMixin.__verifyDestroyChaining(component); // 체이닝 검증
PopupMixin.__getChartHistory();               // 차트 작업 기록
PopupMixin.__reset();                         // 상태 초기화
```

## 테스트 케이스 매핑

이 테스트들은 `/RNBT_architecture/docs/TEST_SCENARIOS.md`의 테스트 케이스를 구현합니다:

| 테스트 파일 | 테스트 케이스 |
|-------------|---------------|
| component-lifecycle.test.js | TC-CL-001, TC-CL-002, TC-CL-003 |
| global-data-publisher.test.js | TC-GDP-001 ~ TC-GDP-004 |
| popup-mixin.test.js | TC-PM-001, TC-PM-007, TC-PM-011, TC-PM-016 |

## Mock 설계 원칙

1. **실제 인터페이스 유지**: Mock은 실제 모듈과 동일한 API 제공
2. **상태 추적**: 모든 호출 기록을 저장하여 검증 가능
3. **테스트 헬퍼**: `__` 접두사로 테스트 전용 메서드 구분
4. **독립성**: 각 테스트는 `initTestEnvironment()`로 격리
5. **의존성 주입**: Factory 함수로 독립 인스턴스 생성 가능

## 의존성

- Node.js (추가 패키지 불필요)
- Jest, Mocha 등 테스트 프레임워크 없이 실행 가능

## 확장 방법

새 테스트 추가:

1. `examples/` 디렉토리에 `*.test.js` 파일 생성
2. `initTestEnvironment()` 호출로 시작
3. `runAllTests()` 함수 export
4. `run-all-tests.js`의 `suites` 배열에 추가
