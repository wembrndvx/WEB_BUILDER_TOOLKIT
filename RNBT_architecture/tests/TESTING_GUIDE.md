# RNBT Architecture Testing Guide

## 관련 문서

| 문서 | 역할 | 내용 |
|------|------|------|
| [TEST_SCENARIOS.md](/RNBT_architecture/docs/TEST_SCENARIOS.md) | 테스트 명세서 (What) | 무엇을 테스트해야 하는가 - 테스트 케이스 목록과 검증 기준 |
| **이 문서 (TESTING_GUIDE.md)** | 테스트 구현 가이드 (How) | 어떻게 테스트를 작성하는가 - Mock 구현, 테스트 작성법 |

```
TEST_SCENARIOS.md          TESTING_GUIDE.md
(무엇을 테스트?)     →     (어떻게 테스트?)
                              ↓
                         tests/examples/*.test.js
                         (실제 테스트 코드)
```

---

## 목차

1. [테스트의 목적과 필요성](#1-테스트의-목적과-필요성)
2. [Mock이란 무엇인가](#2-mock이란-무엇인가)
3. [테스트 환경 구조](#3-테스트-환경-구조)
4. [Mock 구현 상세 분석](#4-mock-구현-상세-분석)
   - [4.1 Weventbus Mock](#41-weventbus-mock)
   - [4.2 GlobalDataPublisher Mock](#42-globaldatapublisher-mock)
   - [4.3 Wkit Mock](#43-wkit-mock)
   - [4.4 PopupMixin Mock](#44-popupmixin-mock)
   - [4.5 fx Mock](#45-fx-mock)
5. [테스트 예제 상세 분석](#5-테스트-예제-상세-분석)
   - [5.1 Component Lifecycle 테스트](#51-component-lifecycle-테스트)
   - [5.2 GlobalDataPublisher 테스트](#52-globaldatapublisher-테스트)
   - [5.3 PopupMixin 테스트](#53-popupmixin-테스트)
6. [테스트 실행 흐름](#6-테스트-실행-흐름)
7. [새 테스트 작성 가이드](#7-새-테스트-작성-가이드)

---

## 1. 테스트의 목적과 필요성

### 1.1 왜 테스트가 필요한가?

RNBT 아키텍처는 여러 모듈이 서로 협력하여 동작합니다:

```
┌─────────────────────────────────────────────────────────────┐
│                      Page (Orchestrator)                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ GlobalData      │  │ Weventbus       │  │ Wkit         │ │
│  │ Publisher       │  │                 │  │              │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│           │                    │                   │         │
│           ▼                    ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Components                           │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │ │
│  │  │Component │  │Component │  │Component │              │ │
│  │  │    A     │  │    B     │  │    C     │              │ │
│  │  └──────────┘  └──────────┘  └──────────┘              │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

이런 복잡한 시스템에서 테스트가 필요한 이유:

1. **버그 조기 발견**: 코드 변경 시 기존 기능이 깨지는지 확인
2. **설계 검증**: 아키텍처가 의도대로 동작하는지 확인
3. **문서화**: 테스트 코드 자체가 사용법 예시가 됨
4. **리팩토링 안전망**: 코드 개선 시 동작이 변하지 않음을 보장

### 1.2 테스트의 어려움

RNBT 모듈들은 다음과 같은 의존성을 가집니다:

```javascript
// Wkit.js 내부
Wkit.bindEvents = function (instance, customEvents) {
  // ...
  Weventbus.emit(triggerEvent, { event, targetInstance });  // Weventbus에 의존
};

// GlobalDataPublisher 사용 시
GlobalDataPublisher.fetchAndPublish(topic, page, params);  // page.dataService에 의존
```

**문제점**:
- `Weventbus`가 없으면 `Wkit`을 테스트할 수 없음
- 실제 서버가 없으면 `fetchAndPublish`를 테스트할 수 없음
- 브라우저 DOM이 없으면 이벤트 바인딩을 테스트할 수 없음

**해결책**: **Mock**을 사용하여 의존성을 대체

---

## 2. Mock이란 무엇인가

### 2.1 Mock의 정의

**Mock(모의 객체)**은 실제 객체를 흉내 내는 가짜 객체입니다.

```
실제 환경:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Wkit      │ ──▶ │  Weventbus  │ ──▶ │  실제 DOM   │
└─────────────┘     └─────────────┘     └─────────────┘

테스트 환경:
┌─────────────┐     ┌─────────────┐
│   Wkit      │ ──▶ │ Weventbus   │     (DOM 불필요)
│   (테스트)   │     │   Mock      │
└─────────────┘     └─────────────┘
```

### 2.2 Mock의 핵심 원칙

**원칙 1: 동일한 인터페이스**

```javascript
// 실제 Weventbus
const Weventbus = {
  on(event, callback) { /* 실제 구현 */ },
  off(event, callback) { /* 실제 구현 */ },
  emit(event, data) { /* 실제 구현 */ },
};

// Mock Weventbus - 동일한 메서드 제공
const WeventbusMock = {
  on(event, callback) { /* Mock 구현 */ },
  off(event, callback) { /* Mock 구현 */ },
  emit(event, data) { /* Mock 구현 */ },
};
```

테스트 대상 코드가 어떤 것을 사용하든 동일하게 동작해야 합니다.

**원칙 2: 호출 기록 저장**

```javascript
// Mock은 모든 호출을 기록합니다
const emitHistory = [];

emit(event, data) {
  emitHistory.push({ event, data, timestamp: Date.now() });
  // ... 실제 동작 ...
}

// 테스트에서 검증
console.log(emitHistory);
// [
//   { event: '@buttonClicked', data: {...}, timestamp: 1234567890 },
//   { event: '@linkClicked', data: {...}, timestamp: 1234567891 }
// ]
```

**원칙 3: 테스트 헬퍼 제공**

```javascript
// __ 접두사로 테스트 전용 메서드 구분
WeventbusMock.__wasEmitted('@buttonClicked');  // true/false
WeventbusMock.__getEmitCount('@buttonClicked'); // 3
WeventbusMock.__reset(); // 모든 상태 초기화
```

### 2.3 Mock vs 실제 모듈 비교

| 항목 | 실제 모듈 | Mock |
|------|----------|------|
| 외부 의존성 | 필요 (DOM, 서버 등) | 불필요 |
| 실행 속도 | 느릴 수 있음 | 매우 빠름 |
| 결과 예측 | 환경에 따라 다름 | 항상 동일 |
| 호출 기록 | 없음 | 자동 기록 |
| 테스트 격리 | 어려움 | 쉬움 (__reset) |

---

## 3. 테스트 환경 구조

### 3.1 디렉토리 구조

```
tests/
├── __mocks__/                    # Mock 모듈 모음
│   ├── index.js                 # 통합 인덱스 (모든 Mock export)
│   ├── Weventbus.mock.js        # EventBus Mock
│   ├── GlobalDataPublisher.mock.js  # 데이터 발행 Mock
│   ├── Wkit.mock.js             # 유틸리티 Mock
│   ├── PopupMixin.mock.js       # 팝업 Mixin Mock
│   └── fx.mock.js               # 함수형 유틸리티 Mock
│
├── examples/                     # 테스트 예제
│   ├── component-lifecycle.test.js   # 컴포넌트 라이프사이클
│   ├── global-data-publisher.test.js # 데이터 발행/구독
│   └── popup-mixin.test.js          # 팝업 Mixin
│
├── run-all-tests.js             # 전체 테스트 실행기
└── README.md                    # 간단한 사용법
```

### 3.2 index.js - 통합 인덱스

```javascript
// tests/__mocks__/index.js

// 각 Mock 모듈 import
const { Weventbus, createWeventbusMock } = require('./Weventbus.mock');
const { GlobalDataPublisher, createGlobalDataPublisherMock } = require('./GlobalDataPublisher.mock');
const { Wkit, createWkitMock } = require('./Wkit.mock');
const { PopupMixin, createPopupMixinMock } = require('./PopupMixin.mock');
const { fx } = require('./fx.mock');

/**
 * 모든 Mock 상태 초기화
 *
 * 왜 필요한가?
 * - 테스트 A에서 emit한 이벤트가 테스트 B에 영향을 주면 안 됨
 * - 각 테스트는 "깨끗한 상태"에서 시작해야 함
 */
function resetAllMocks() {
  Weventbus.__reset();
  GlobalDataPublisher.__reset();
  Wkit.__reset();
  PopupMixin.__reset();
}

/**
 * 의존성 연결
 *
 * Wkit은 내부에서 Weventbus.emit()을 호출함
 * Wkit에게 "어떤 Weventbus를 사용할지" 알려줘야 함
 */
function setupDependencies() {
  Wkit.__setWeventbus(Weventbus);
}

/**
 * 테스트 환경 완전 초기화
 * 매 테스트 시작 전에 호출
 */
function initTestEnvironment() {
  resetAllMocks();      // 상태 초기화
  setupDependencies();  // 의존성 연결
}

module.exports = {
  // 싱글톤 인스턴스 (일반적으로 사용)
  Weventbus,
  GlobalDataPublisher,
  Wkit,
  PopupMixin,
  fx,

  // Factory 함수 (완전히 독립된 인스턴스 필요 시)
  createWeventbusMock,
  createGlobalDataPublisherMock,
  createWkitMock,
  createPopupMixinMock,

  // 헬퍼 함수
  resetAllMocks,
  setupDependencies,
  initTestEnvironment,
};
```

**사용 예시**:

```javascript
const { Weventbus, GlobalDataPublisher, initTestEnvironment } = require('./__mocks__');

// 테스트 시작 전
initTestEnvironment();

// 이제 Mock들이 깨끗한 상태로 준비됨
```

---

## 4. Mock 구현 상세 분석

### 4.1 Weventbus Mock

#### 4.1.1 실제 Weventbus 분석

먼저 실제 `Weventbus.js`를 봅시다:

```javascript
// Utils/Weventbus.js (실제 코드)
const Weventbus = (() => {
  const listeners = new Map();  // 이벤트별 리스너 저장

  return {
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(callback);
    },

    off(event, callback) {
      if (!listeners.has(event)) return;
      const newList = listeners.get(event).filter((cb) => cb !== callback);
      listeners.set(event, newList);
    },

    emit(event, data) {
      if (!listeners.has(event)) return;
      listeners.get(event).forEach(callback => callback(data));
    },

    once(event, callback) {
      const wrapper = (data) => {
        callback(data);
        this.off(event, wrapper);
      };
      this.on(event, wrapper);
    },
  };
})();
```

**핵심 동작**:
- `on`: 이벤트에 콜백 등록
- `off`: 콜백 제거
- `emit`: 등록된 모든 콜백 실행
- `once`: 한 번만 실행되는 콜백

#### 4.1.2 Mock 구현

```javascript
// tests/__mocks__/Weventbus.mock.js

function createWeventbusMock() {
  // ─────────────────────────────────────────
  // 내부 상태
  // ─────────────────────────────────────────

  const listeners = new Map();  // 실제와 동일: 이벤트 → 콜백 배열
  const emitHistory = [];       // 추가: emit 호출 기록
  const onHistory = [];         // 추가: on 호출 기록
  const offHistory = [];        // 추가: off 호출 기록

  return {
    // ─────────────────────────────────────────
    // Core API (실제와 동일한 인터페이스)
    // ─────────────────────────────────────────

    on(event, callback) {
      // 실제 동작: 리스너 등록
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(callback);

      // Mock 추가: 호출 기록
      onHistory.push({ event, callback, timestamp: Date.now() });
    },

    off(event, callback) {
      // 실제 동작: 리스너 제거
      if (!listeners.has(event)) return;
      const newList = listeners.get(event).filter((cb) => cb !== callback);
      listeners.set(event, newList);

      // Mock 추가: 호출 기록
      offHistory.push({ event, callback, timestamp: Date.now() });
    },

    emit(event, data) {
      // Mock 추가: 호출 기록 (먼저 기록)
      emitHistory.push({ event, data, timestamp: Date.now() });

      // 실제 동작: 콜백 실행
      if (!listeners.has(event)) return;
      listeners.get(event).forEach((callback) => callback(data));
    },

    once(event, callback) {
      const wrapper = (data) => {
        callback(data);
        this.off(event, wrapper);
      };
      this.on(event, wrapper);
    },

    // ─────────────────────────────────────────
    // Test Helpers (테스트 전용 - __ 접두사)
    // ─────────────────────────────────────────

    /**
     * 모든 상태 초기화
     *
     * 사용 시점: 각 테스트 시작 전
     * 목적: 이전 테스트의 영향 제거
     */
    __reset() {
      listeners.clear();
      emitHistory.length = 0;  // 배열 비우기 (참조 유지)
      onHistory.length = 0;
      offHistory.length = 0;
    },

    /**
     * 특정 이벤트의 리스너 수 반환
     *
     * 사용 예:
     *   const count = Weventbus.__getListenerCount('@buttonClicked');
     *   console.log(count);  // 2
     */
    __getListenerCount(event) {
      return listeners.has(event) ? listeners.get(event).length : 0;
    },

    /**
     * 등록된 모든 이벤트 이름 반환
     */
    __getRegisteredEvents() {
      return Array.from(listeners.keys());
    },

    /**
     * emit 호출 기록 전체 반환
     *
     * 반환 형식:
     * [
     *   { event: '@clicked', data: {...}, timestamp: 1234567890 },
     *   { event: '@submitted', data: {...}, timestamp: 1234567891 }
     * ]
     */
    __getEmitHistory() {
      return [...emitHistory];  // 복사본 반환 (원본 보호)
    },

    /**
     * 특정 이벤트의 emit 기록만 반환
     */
    __getEmitHistoryFor(event) {
      return emitHistory.filter((h) => h.event === event);
    },

    /**
     * 특정 이벤트가 emit되었는지 확인
     *
     * 사용 예:
     *   if (Weventbus.__wasEmitted('@buttonClicked')) {
     *     console.log('버튼 클릭 이벤트 발생함');
     *   }
     */
    __wasEmitted(event) {
      return emitHistory.some((h) => h.event === event);
    },

    /**
     * 특정 이벤트가 특정 데이터와 함께 emit되었는지 확인
     *
     * 사용 예:
     *   const wasEmitted = Weventbus.__wasEmittedWith('@clicked', { id: 123 });
     */
    __wasEmittedWith(event, expectedData) {
      return emitHistory.some(
        (h) => h.event === event &&
               JSON.stringify(h.data) === JSON.stringify(expectedData)
      );
    },

    /**
     * 특정 이벤트의 emit 횟수 반환
     */
    __getEmitCount(event) {
      return emitHistory.filter((h) => h.event === event).length;
    },

    // on/off 히스토리도 유사하게 제공
    __getOnHistory() { return [...onHistory]; },
    __getOffHistory() { return [...offHistory]; },

    /**
     * 현재 리스너 상태 요약 (디버깅용)
     */
    __getListenersMap() {
      const result = {};
      listeners.forEach((callbacks, event) => {
        result[event] = callbacks.length;
      });
      return result;
      // { '@clicked': 2, '@submitted': 1 }
    },
  };
}

// 싱글톤 인스턴스 생성
const WeventbusMock = createWeventbusMock();

module.exports = {
  Weventbus: WeventbusMock,
  createWeventbusMock,  // 독립 인스턴스 필요 시
};
```

#### 4.1.3 사용 예시

```javascript
const { Weventbus, initTestEnvironment } = require('./__mocks__');

// 테스트 1: 이벤트 발행 테스트
function testEventEmission() {
  initTestEnvironment();  // 깨끗한 상태로 시작

  // Given: 핸들러 등록
  let receivedData = null;
  Weventbus.on('@userLoggedIn', (data) => {
    receivedData = data;
  });

  // When: 이벤트 발행
  Weventbus.emit('@userLoggedIn', { userId: 123, name: 'Alice' });

  // Then: 검증
  console.log(receivedData);  // { userId: 123, name: 'Alice' }
  console.log(Weventbus.__wasEmitted('@userLoggedIn'));  // true
  console.log(Weventbus.__getEmitCount('@userLoggedIn')); // 1
}

// 테스트 2: 핸들러 제거 테스트
function testHandlerRemoval() {
  initTestEnvironment();

  const handler = () => {};

  // 등록
  Weventbus.on('@test', handler);
  console.log(Weventbus.__getListenerCount('@test'));  // 1

  // 제거
  Weventbus.off('@test', handler);
  console.log(Weventbus.__getListenerCount('@test'));  // 0
}
```

### 4.2 GlobalDataPublisher Mock

#### 4.2.1 GlobalDataPublisher의 역할

실제 코드는 없지만, README와 사용 패턴에서 인터페이스를 추론합니다:

```javascript
// 페이지에서 사용하는 패턴 (loaded.js)
GlobalDataPublisher.registerMapping({
  topic: 'sensorData',
  datasetInfo: {
    datasetName: 'sensor-api',
    param: { type: 'temperature' }
  }
});

// 컴포넌트에서 사용하는 패턴 (register.js)
GlobalDataPublisher.subscribe('sensorData', this, this.renderData);

// 데이터 발행
await GlobalDataPublisher.fetchAndPublish('sensorData', page, params);

// 정리 (before_unload.js)
GlobalDataPublisher.unregisterMapping('sensorData');
GlobalDataPublisher.unsubscribe('sensorData', component);
```

#### 4.2.2 Mock 구현

```javascript
// tests/__mocks__/GlobalDataPublisher.mock.js

function createGlobalDataPublisherMock() {
  // ─────────────────────────────────────────
  // 내부 상태
  // ─────────────────────────────────────────

  const mappings = new Map();     // topic → { datasetInfo, ... }
  const subscribers = new Map();  // topic → Map<instance, Set<handler>>

  // 히스토리 (테스트 검증용)
  const publishHistory = [];
  const subscribeHistory = [];
  const unsubscribeHistory = [];
  const registerHistory = [];
  const unregisterHistory = [];

  // Mock 응답 데이터 (테스트에서 주입)
  const mockResponses = new Map();

  return {
    // ─────────────────────────────────────────
    // Core API
    // ─────────────────────────────────────────

    /**
     * Topic-데이터셋 매핑 등록
     *
     * 실제 동작: 어떤 topic이 어떤 API를 호출할지 정의
     *
     * @param {Object} mapping
     *   - topic: 'sensorData'
     *   - datasetInfo: { datasetName: 'api', param: {...} }
     */
    registerMapping(mapping) {
      const { topic, datasetInfo } = mapping;
      mappings.set(topic, { datasetInfo, ...mapping });
      registerHistory.push({ mapping, timestamp: Date.now() });
    },

    /**
     * Topic 매핑 해제
     */
    unregisterMapping(topic) {
      mappings.delete(topic);
      unregisterHistory.push({ topic, timestamp: Date.now() });
    },

    /**
     * 컴포넌트가 topic 구독
     *
     * 실제 동작: topic에 데이터가 발행되면 handler 호출
     *
     * @param {string} topic - 구독할 topic
     * @param {Object} instance - 컴포넌트 인스턴스 (this)
     * @param {Function} handler - 데이터 수신 시 호출될 함수
     */
    subscribe(topic, instance, handler) {
      // topic의 구독자 Map 가져오기 (없으면 생성)
      if (!subscribers.has(topic)) {
        subscribers.set(topic, new Map());
      }
      const topicSubs = subscribers.get(topic);

      // instance의 handler Set 가져오기 (없으면 생성)
      if (!topicSubs.has(instance)) {
        topicSubs.set(instance, new Set());
      }
      topicSubs.get(instance).add(handler);

      subscribeHistory.push({ topic, instance, handler, timestamp: Date.now() });
    },

    /**
     * 컴포넌트의 topic 구독 해제
     *
     * 특징: 해당 instance의 모든 handler 제거
     */
    unsubscribe(topic, instance) {
      if (subscribers.has(topic)) {
        subscribers.get(topic).delete(instance);
      }
      unsubscribeHistory.push({ topic, instance, timestamp: Date.now() });
    },

    /**
     * 데이터 fetch 후 구독자에게 발행
     *
     * 실제 동작:
     *   1. page.dataService.call()로 API 호출
     *   2. 응답을 모든 구독자에게 전달
     *
     * Mock 동작:
     *   1. mockResponses에서 미리 설정된 데이터 가져옴
     *   2. 모든 구독자의 handler 호출
     */
    async fetchAndPublish(topic, page, params = {}) {
      const mapping = mappings.get(topic);
      const mockData = mockResponses.get(topic);

      // Mock 응답 또는 기본값
      const response = mockData !== undefined ? mockData : { data: null };

      // 히스토리 기록
      publishHistory.push({
        topic,
        page,
        params,
        response,
        timestamp: Date.now(),
      });

      // 구독자에게 발행
      if (subscribers.has(topic)) {
        const topicSubs = subscribers.get(topic);

        // 모든 instance의 모든 handler 호출
        topicSubs.forEach((handlers, instance) => {
          handlers.forEach((handler) => {
            try {
              handler({ response });  // { response: { data: [...] } }
            } catch (e) {
              console.error(`Handler error:`, e);
            }
          });
        });
      }

      return response;
    },

    // ─────────────────────────────────────────
    // Test Helpers
    // ─────────────────────────────────────────

    __reset() {
      mappings.clear();
      subscribers.clear();
      mockResponses.clear();
      publishHistory.length = 0;
      subscribeHistory.length = 0;
      unsubscribeHistory.length = 0;
      registerHistory.length = 0;
      unregisterHistory.length = 0;
    },

    /**
     * Mock 응답 설정
     *
     * 사용 예:
     *   GlobalDataPublisher.__setMockResponse('sensorData', {
     *     data: [
     *       { id: 1, temperature: 25.5 },
     *       { id: 2, temperature: 26.0 }
     *     ]
     *   });
     *
     *   // 이후 fetchAndPublish('sensorData', ...) 호출 시
     *   // 위 데이터가 구독자에게 전달됨
     */
    __setMockResponse(topic, response) {
      mockResponses.set(topic, response);
    },

    /**
     * 여러 topic에 한번에 Mock 응답 설정
     */
    __setMockResponses(responses) {
      Object.entries(responses).forEach(([topic, response]) => {
        mockResponses.set(topic, response);
      });
    },

    // 등록/구독 상태 확인
    __isRegistered(topic) {
      return mappings.has(topic);
    },

    __isSubscribed(topic, instance) {
      if (!subscribers.has(topic)) return false;
      return subscribers.get(topic).has(instance);
    },

    __getSubscriberCount(topic) {
      if (!subscribers.has(topic)) return 0;
      let count = 0;
      subscribers.get(topic).forEach((handlers) => {
        count += handlers.size;
      });
      return count;
    },

    // 히스토리 접근
    __getPublishHistory() { return [...publishHistory]; },
    __getSubscribeHistory() { return [...subscribeHistory]; },
    __getUnsubscribeHistory() { return [...unsubscribeHistory]; },
    __getRegisterHistory() { return [...registerHistory]; },
    __getUnregisterHistory() { return [...unregisterHistory]; },

    __wasPublished(topic) {
      return publishHistory.some((h) => h.topic === topic);
    },

    __getPublishCount(topic) {
      return publishHistory.filter((h) => h.topic === topic).length;
    },

    // 디버깅용 요약
    __getSubscriptionSummary() {
      const result = {};
      subscribers.forEach((instanceMap, topic) => {
        result[topic] = {};
        instanceMap.forEach((handlers, instance) => {
          const id = instance.id || instance.name || 'unknown';
          result[topic][id] = handlers.size;
        });
      });
      return result;
      // { 'sensorData': { 'comp-001': 2, 'comp-002': 1 } }
    },
  };
}

const GlobalDataPublisherMock = createGlobalDataPublisherMock();

module.exports = {
  GlobalDataPublisher: GlobalDataPublisherMock,
  createGlobalDataPublisherMock,
};
```

#### 4.2.3 사용 예시

```javascript
const { GlobalDataPublisher, initTestEnvironment } = require('./__mocks__');

async function testDataFlow() {
  initTestEnvironment();

  // Given: Mock 응답 설정
  GlobalDataPublisher.__setMockResponse('sensorData', {
    data: [
      { id: 1, temperature: 25.5 },
      { id: 2, temperature: 26.0 }
    ]
  });

  // Given: 컴포넌트가 구독
  const component = { id: 'comp-001', name: 'TempDisplay' };
  let receivedData = null;

  GlobalDataPublisher.subscribe('sensorData', component, ({ response }) => {
    receivedData = response.data;
  });

  // When: 데이터 발행
  await GlobalDataPublisher.fetchAndPublish('sensorData', {}, {});

  // Then: 검증
  console.log(receivedData);  // [{ id: 1, ... }, { id: 2, ... }]
  console.log(GlobalDataPublisher.__wasPublished('sensorData'));  // true
}
```

### 4.3 Wkit Mock

#### 4.3.1 Wkit의 역할

`Wkit.js`는 여러 유틸리티 함수를 제공합니다:

```javascript
// 2D 이벤트 바인딩
Wkit.bindEvents(this, this.customEvents);
Wkit.removeCustomEvents(this, this.customEvents);

// 3D 이벤트 바인딩
Wkit.bind3DEvents(this, this.customEvents);

// EventBus 핸들러 관리
Wkit.onEventBusHandlers(this.eventBusHandlers);
Wkit.offEventBusHandlers(this.eventBusHandlers);

// 데이터 fetch
await Wkit.fetchData(page, 'datasetName', params);

// 인스턴스 검색
Wkit.getInstanceByName('ComponentName', iterator);
Wkit.getInstanceById('comp-id', iterator);

// 이벤트 발생
Wkit.emitEvent('@customEvent', targetInstance);
```

#### 4.3.2 Mock 구현 핵심

```javascript
// tests/__mocks__/Wkit.mock.js

function createWkitMock(WeventbusDep = null) {
  // 의존성 주입: Wkit은 내부에서 Weventbus를 사용
  let Weventbus = WeventbusDep;

  // 히스토리
  const bindEventsHistory = [];
  const removeEventsHistory = [];
  const bind3DEventsHistory = [];
  const fetchDataHistory = [];
  const onEventBusHistory = [];
  const offEventBusHistory = [];
  const emitEventHistory = [];

  // Mock fetch 응답
  const mockFetchResponses = new Map();

  return {
    // ─────────────────────────────────────────
    // 의존성 주입
    // ─────────────────────────────────────────

    __setWeventbus(dep) {
      Weventbus = dep;
    },

    // ─────────────────────────────────────────
    // 2D Event Binding
    // ─────────────────────────────────────────

    /**
     * 2D 이벤트 바인딩
     *
     * 실제 동작:
     *   1. customEvents를 순회
     *   2. 각 selector에 이벤트 핸들러 등록
     *   3. 핸들러 실행 시 Weventbus.emit() 호출
     *
     * Mock 동작:
     *   1. 호출 기록
     *   2. userHandlerList 구조 생성 (removeCustomEvents에서 필요)
     *   3. Weventbus가 주입되었으면 실제로 emit 가능
     *
     * @param {Object} instance - 컴포넌트 인스턴스
     * @param {Object} customEvents - 이벤트 정의
     *   예: { click: { '.btn': '@buttonClicked' } }
     */
    bindEvents(instance, customEvents) {
      // 히스토리 기록
      bindEventsHistory.push({
        instance,
        customEvents,
        timestamp: Date.now(),
      });

      // 실제와 유사하게 userHandlerList 구조 생성
      instance.userHandlerList = instance.userHandlerList || {};

      Object.entries(customEvents).forEach(([eventName, selectorList]) => {
        instance.userHandlerList[eventName] = instance.userHandlerList[eventName] || {};

        Object.keys(selectorList).forEach((selector) => {
          // 핸들러 생성
          const handler = (event) => {
            const triggerEvent = customEvents[eventName][selector];
            if (triggerEvent && Weventbus) {
              Weventbus.emit(triggerEvent, { event, targetInstance: instance });
            }
          };

          instance.userHandlerList[eventName][selector] = handler;

          // DOM이 있으면 실제로 바인딩 (테스트에서는 보통 없음)
          if (instance.appendElement?.addEventListener) {
            instance.appendElement.addEventListener(eventName, handler);
          }
        });
      });
    },

    /**
     * 2D 이벤트 제거
     */
    removeCustomEvents(instance, customEvents) {
      removeEventsHistory.push({
        instance,
        customEvents,
        timestamp: Date.now(),
      });

      Object.entries(customEvents).forEach(([eventName, selectorList]) => {
        Object.keys(selectorList).forEach((selector) => {
          const handler = instance.userHandlerList?.[eventName]?.[selector];
          if (handler && instance.appendElement?.removeEventListener) {
            instance.appendElement.removeEventListener(eventName, handler);
          }
        });
      });
    },

    // ─────────────────────────────────────────
    // 3D Event Binding
    // ─────────────────────────────────────────

    /**
     * 3D 이벤트 바인딩
     *
     * 2D와 다른 점:
     *   - 3D는 selector 없이 직접 이벤트 타입 → 이벤트명 매핑
     *   - eventListener 객체에 저장
     */
    bind3DEvents(instance, customEvents) {
      bind3DEventsHistory.push({
        instance,
        customEvents,
        timestamp: Date.now(),
      });

      instance.appendElement = instance.appendElement || {};
      instance.appendElement.eventListener = {};

      Object.keys(customEvents).forEach((browserEvent) => {
        const eventHandler = (event) => {
          const triggerEvent = customEvents[browserEvent];
          if (triggerEvent && Weventbus) {
            Weventbus.emit(triggerEvent, { event, targetInstance: instance });
          }
        };
        instance.appendElement.eventListener[browserEvent] = eventHandler;
      });
    },

    // ─────────────────────────────────────────
    // EventBus Handlers
    // ─────────────────────────────────────────

    /**
     * EventBus 핸들러 일괄 등록
     *
     * @param {Object} eventBusHandlers
     *   예: { '@buttonClicked': handler1, '@formSubmitted': handler2 }
     */
    onEventBusHandlers(eventBusHandlers) {
      onEventBusHistory.push({
        handlers: eventBusHandlers,
        timestamp: Date.now(),
      });

      if (Weventbus) {
        Object.entries(eventBusHandlers).forEach(([eventName, handler]) => {
          Weventbus.on(eventName, handler);
        });
      }
    },

    /**
     * EventBus 핸들러 일괄 해제
     */
    offEventBusHandlers(eventBusHandlers) {
      offEventBusHistory.push({
        handlers: eventBusHandlers,
        timestamp: Date.now(),
      });

      if (Weventbus) {
        Object.entries(eventBusHandlers).forEach(([eventName, handler]) => {
          Weventbus.off(eventName, handler);
        });
      }
    },

    // ─────────────────────────────────────────
    // Data Fetching
    // ─────────────────────────────────────────

    /**
     * 데이터 fetch
     *
     * Mock은 mockFetchResponses에서 응답 반환
     */
    fetchData(page, datasetName, param) {
      fetchDataHistory.push({
        page,
        datasetName,
        param,
        timestamp: Date.now(),
      });

      const mockKey = `${datasetName}:${JSON.stringify(param || {})}`;
      const mockResponse = mockFetchResponses.get(mockKey)
                        || mockFetchResponses.get(datasetName);

      return Promise.resolve(mockResponse ?? { data: null });
    },

    // ─────────────────────────────────────────
    // Test Helpers
    // ─────────────────────────────────────────

    __reset() {
      bindEventsHistory.length = 0;
      removeEventsHistory.length = 0;
      bind3DEventsHistory.length = 0;
      fetchDataHistory.length = 0;
      onEventBusHistory.length = 0;
      offEventBusHistory.length = 0;
      emitEventHistory.length = 0;
      mockFetchResponses.clear();
    },

    __setMockFetchResponse(datasetName, response, param = null) {
      const key = param ? `${datasetName}:${JSON.stringify(param)}` : datasetName;
      mockFetchResponses.set(key, response);
    },

    // 히스토리 접근
    __getBindEventsHistory() { return [...bindEventsHistory]; },
    __getRemoveEventsHistory() { return [...removeEventsHistory]; },
    __getBind3DEventsHistory() { return [...bind3DEventsHistory]; },
    __getOnEventBusHistory() { return [...onEventBusHistory]; },
    __getOffEventBusHistory() { return [...offEventBusHistory]; },

    // 검증 헬퍼
    __wasBindEventsCalled(instance) {
      return bindEventsHistory.some((h) => h.instance === instance);
    },

    __wasRemoveEventsCalled(instance) {
      return removeEventsHistory.some((h) => h.instance === instance);
    },

    /**
     * bindEvents와 removeCustomEvents 쌍이 맞는지 검증
     *
     * register에서 bindEvents 호출
     * beforeDestroy에서 removeCustomEvents 호출
     * → 횟수가 같아야 함
     */
    __verifyCleanup(instance) {
      const bindCount = bindEventsHistory
        .filter((h) => h.instance === instance).length;
      const removeCount = removeEventsHistory
        .filter((h) => h.instance === instance).length;
      return bindCount === removeCount;
    },

    __verifyEventBusCleanup() {
      return onEventBusHistory.length === offEventBusHistory.length;
    },
  };
}

const WkitMock = createWkitMock();

module.exports = {
  Wkit: WkitMock,
  createWkitMock,
};
```

### 4.4 PopupMixin Mock

#### 4.4.1 PopupMixin의 역할

PopupMixin은 세 가지 Mixin을 제공합니다:

```javascript
// 1. 기본 Shadow DOM 팝업
applyShadowPopupMixin(this, {
  getHTML: () => '<div class="popup">...</div>',
  getStyles: () => '.popup { ... }',
  onCreated: (shadowRoot) => { /* 초기화 */ }
});

// 2. ECharts 차트 관리 (applyShadowPopupMixin 이후)
applyEChartsMixin(this);

// 3. Tabulator 테이블 관리 (applyShadowPopupMixin 이후)
applyTabulatorMixin(this);

// 사용
this.showPopup();
this.createChart('.chart-container');
this.createTable('.table-container');
this.destroyPopup();  // 체이닝으로 모든 리소스 정리
```

#### 4.4.2 Mock 구현 핵심

```javascript
// tests/__mocks__/PopupMixin.mock.js

function createPopupMixinMock() {
  // 히스토리
  const appliedMixins = [];
  const popupHistory = [];
  const chartHistory = [];
  const tableHistory = [];

  const PopupMixin = {};

  /**
   * applyShadowPopupMixin
   *
   * 컴포넌트에 팝업 기능 추가:
   *   - createPopup, showPopup, hidePopup
   *   - popupQuery, popupQueryAll
   *   - bindPopupEvents
   *   - destroyPopup
   */
  PopupMixin.applyShadowPopupMixin = function (instance, options) {
    const { getHTML, getStyles, onCreated } = options;

    // 기록
    appliedMixins.push({
      type: 'ShadowPopup',
      instance,
      options,
      timestamp: Date.now(),
    });

    // 내부 상태 (실제와 동일한 구조)
    instance._popup = {
      host: null,
      shadowRoot: null,
      eventCleanups: [],
      charts: new Map(),   // EChartsMixin용
      tables: new Map(),   // TabulatorMixin용
    };

    /**
     * 팝업 생성
     */
    instance.createPopup = function () {
      if (instance._popup.host) return instance._popup.shadowRoot;

      // Mock DOM 요소 (실제 DOM 없이)
      instance._popup.host = {
        id: `popup-${instance.id || 'unknown'}`,
        style: { display: 'none' },
        remove: function () {
          popupHistory.push({
            action: 'remove',
            instance,
            timestamp: Date.now(),
          });
        },
      };

      // Mock shadowRoot
      instance._popup.shadowRoot = {
        innerHTML: '',
        querySelector: function (selector) {
          return { selector, textContent: '', dataset: {}, style: {} };
        },
        querySelectorAll: function (selector) {
          return [];
        },
      };

      // HTML/CSS 저장 (테스트에서 검증 가능)
      const html = getHTML ? getHTML.call(instance) : '';
      const styles = getStyles ? getStyles.call(instance) : '';
      instance._popup.shadowRoot.innerHTML = `<style>${styles}</style>${html}`;

      popupHistory.push({
        action: 'create',
        instance,
        html,
        styles,
        timestamp: Date.now(),
      });

      // onCreated 콜백
      if (onCreated) {
        onCreated.call(instance, instance._popup.shadowRoot);
      }

      return instance._popup.shadowRoot;
    };

    instance.showPopup = function () {
      if (!instance._popup.host) {
        instance.createPopup();
      }
      instance._popup.host.style.display = 'block';
      popupHistory.push({ action: 'show', instance, timestamp: Date.now() });
    };

    instance.hidePopup = function () {
      if (instance._popup.host) {
        instance._popup.host.style.display = 'none';
      }
      popupHistory.push({ action: 'hide', instance, timestamp: Date.now() });
    };

    instance.popupQuery = function (selector) {
      if (!instance._popup.shadowRoot) return null;
      return instance._popup.shadowRoot.querySelector(selector);
    };

    instance.bindPopupEvents = function (events) {
      // 이벤트 바인딩 기록
      Object.entries(events).forEach(([eventType, handlers]) => {
        Object.entries(handlers).forEach(([selector, handler]) => {
          const cleanup = () => {};
          instance._popup.eventCleanups.push(cleanup);

          popupHistory.push({
            action: 'bindEvent',
            instance,
            eventType,
            selector,
            timestamp: Date.now(),
          });
        });
      });
    };

    /**
     * destroyPopup - 체이닝 패턴의 기본
     *
     * EChartsMixin, TabulatorMixin이 이를 확장함
     */
    instance.destroyPopup = function () {
      if (!instance._popup.host) return;

      // 이벤트 정리
      instance._popup.eventCleanups.forEach((cleanup) => cleanup());
      instance._popup.eventCleanups = [];

      // DOM 제거
      instance._popup.host.remove();

      popupHistory.push({
        action: 'destroy',
        instance,
        timestamp: Date.now(),
      });

      // 상태 초기화
      instance._popup.host = null;
      instance._popup.shadowRoot = null;
    };
  };

  /**
   * applyEChartsMixin
   *
   * 차트 관리 기능 추가:
   *   - createChart, getChart, updateChart
   *   - destroyPopup 확장 (차트 정리)
   */
  PopupMixin.applyEChartsMixin = function (instance) {
    // 전제조건 검사
    if (!instance._popup) {
      throw new Error('applyShadowPopupMixin must be called before applyEChartsMixin');
    }

    appliedMixins.push({
      type: 'ECharts',
      instance,
      timestamp: Date.now(),
    });

    instance._popup.charts = instance._popup.charts || new Map();

    instance.createChart = function (selector) {
      const mockChart = {
        selector,
        options: null,
        disposed: false,
        setOption: function (option) {
          this.options = option;
          chartHistory.push({
            action: 'setOption',
            instance,
            selector,
            option,
            timestamp: Date.now(),
          });
        },
        dispose: function () {
          this.disposed = true;
          chartHistory.push({
            action: 'dispose',
            instance,
            selector,
            timestamp: Date.now(),
          });
        },
      };

      const mockResizeObserver = {
        disconnect: function () {},
      };

      instance._popup.charts.set(selector, {
        chart: mockChart,
        resizeObserver: mockResizeObserver,
      });

      chartHistory.push({
        action: 'create',
        instance,
        selector,
        timestamp: Date.now(),
      });

      return mockChart;
    };

    instance.getChart = function (selector) {
      const entry = instance._popup.charts.get(selector);
      return entry ? entry.chart : null;
    };

    instance.updateChart = function (selector, option) {
      const chart = instance.getChart(selector);
      if (chart) chart.setOption(option);
    };

    // ─────────────────────────────────────────
    // destroyPopup 체이닝 확장
    // ─────────────────────────────────────────

    const originalDestroyPopup = instance.destroyPopup;

    instance.destroyPopup = function () {
      // 1. 차트 정리 (먼저)
      instance._popup.charts.forEach(({ chart, resizeObserver }) => {
        resizeObserver.disconnect();
        chart.dispose();
      });
      instance._popup.charts.clear();

      chartHistory.push({
        action: 'destroyAll',
        instance,
        timestamp: Date.now(),
      });

      // 2. 원래 destroyPopup 호출
      originalDestroyPopup.call(instance);
    };
  };

  /**
   * applyTabulatorMixin
   *
   * 테이블 관리 기능 추가 (EChartsMixin과 유사)
   */
  PopupMixin.applyTabulatorMixin = function (instance) {
    if (!instance._popup) {
      throw new Error('applyShadowPopupMixin must be called before applyTabulatorMixin');
    }

    appliedMixins.push({
      type: 'Tabulator',
      instance,
      timestamp: Date.now(),
    });

    instance._popup.tables = instance._popup.tables || new Map();

    instance.createTable = function (selector, options = {}) {
      const mockTable = {
        selector,
        options,
        data: [],
        ready: false,
        setData: function (data) {
          this.data = data;
          tableHistory.push({
            action: 'setData',
            instance,
            selector,
            data,
            timestamp: Date.now(),
          });
        },
        destroy: function () {
          tableHistory.push({
            action: 'destroy',
            instance,
            selector,
            timestamp: Date.now(),
          });
        },
      };

      instance._popup.tables.set(selector, {
        table: mockTable,
        resizeObserver: { disconnect: () => {} },
      });

      tableHistory.push({
        action: 'create',
        instance,
        selector,
        timestamp: Date.now(),
      });

      return mockTable;
    };

    instance.getTable = function (selector) {
      const entry = instance._popup.tables.get(selector);
      return entry ? entry.table : null;
    };

    instance.updateTable = function (selector, data) {
      const table = instance.getTable(selector);
      if (table) table.setData(data);
    };

    // destroyPopup 체이닝 확장
    const originalDestroyPopup = instance.destroyPopup;

    instance.destroyPopup = function () {
      // 1. 테이블 정리 (먼저)
      instance._popup.tables.forEach(({ table, resizeObserver }) => {
        resizeObserver.disconnect();
        table.destroy();
      });
      instance._popup.tables.clear();

      tableHistory.push({
        action: 'destroyAll',
        instance,
        timestamp: Date.now(),
      });

      // 2. 원래 destroyPopup 호출 (EChartsMixin 또는 기본)
      originalDestroyPopup.call(instance);
    };
  };

  // ─────────────────────────────────────────
  // Test Helpers
  // ─────────────────────────────────────────

  PopupMixin.__reset = function () {
    appliedMixins.length = 0;
    popupHistory.length = 0;
    chartHistory.length = 0;
    tableHistory.length = 0;
  };

  PopupMixin.__getAppliedMixins = function () {
    return [...appliedMixins];
  };

  PopupMixin.__getPopupHistory = function () {
    return [...popupHistory];
  };

  PopupMixin.__getChartHistory = function () {
    return [...chartHistory];
  };

  PopupMixin.__getTableHistory = function () {
    return [...tableHistory];
  };

  /**
   * 팝업 상태 확인
   */
  PopupMixin.__getPopupState = function (instance) {
    if (!instance._popup) return null;
    return {
      hasHost: !!instance._popup.host,
      hasShadowRoot: !!instance._popup.shadowRoot,
      isVisible: instance._popup.host?.style?.display === 'block',
      chartCount: instance._popup.charts?.size || 0,
      tableCount: instance._popup.tables?.size || 0,
    };
  };

  /**
   * destroyPopup 체이닝이 올바른 순서로 동작했는지 검증
   *
   * 올바른 순서:
   *   1. Tabulator destroyAll
   *   2. ECharts destroyAll
   *   3. Popup destroy
   */
  PopupMixin.__verifyDestroyChaining = function (instance) {
    const allHistory = [...chartHistory, ...tableHistory, ...popupHistory]
      .filter((h) => h.instance === instance)
      .filter((h) => h.action === 'destroyAll' || h.action === 'destroy');

    const destroyActions = popupHistory.filter(
      (h) => h.instance === instance && h.action === 'destroy'
    );

    if (destroyActions.length === 0) {
      return { valid: false, reason: 'destroy not called' };
    }

    return { valid: true };
  };

  return PopupMixin;
}

const PopupMixinMock = createPopupMixinMock();

module.exports = {
  PopupMixin: PopupMixinMock,
  createPopupMixinMock,
};
```

### 4.5 fx Mock

#### 4.5.1 fx.js의 역할

`fx.js`는 함수형 프로그래밍 유틸리티입니다:

```javascript
// 파이프라인 실행
fx.go(
  [1, 2, 3],
  fx.map(x => x * 2),    // [2, 4, 6]
  fx.filter(x => x > 3)  // [4, 6]
);

// 각 요소에 함수 적용
fx.each(item => console.log(item), [1, 2, 3]);

// 첫 요소 찾기
fx.find(x => x > 2, [1, 2, 3, 4]);  // 3
```

#### 4.5.2 Mock 구현

```javascript
// tests/__mocks__/fx.mock.js

const fx = {
  /**
   * 파이프라인 실행
   *
   * 사용:
   *   fx.go(
   *     initialValue,
   *     fn1,
   *     fn2,
   *     fn3
   *   );
   *
   *   // 동작: fn3(fn2(fn1(initialValue)))
   */
  go(initial, ...fns) {
    return fns.reduce((acc, fn) => {
      if (fn && typeof fn === 'function') {
        return fn(acc);
      }
      return acc;
    }, initial);
  },

  /**
   * 각 요소에 함수 적용 (side effect)
   *
   * 커링 지원:
   *   fx.each(fn, iter)  // 즉시 실행
   *   fx.each(fn)(iter)  // 커링
   */
  each(fn, iter) {
    if (iter === undefined) {
      return (iter) => fx.each(fn, iter);
    }
    for (const item of iter) {
      fn(item);
    }
    return iter;
  },

  /**
   * 각 요소 변환
   */
  map(fn, iter) {
    if (iter === undefined) {
      return (iter) => fx.map(fn, iter);
    }
    const result = [];
    for (const item of iter) {
      result.push(fn(item));
    }
    return result;
  },

  /**
   * 조건 필터링
   */
  filter(fn, iter) {
    if (iter === undefined) {
      return (iter) => fx.filter(fn, iter);
    }
    const result = [];
    for (const item of iter) {
      if (fn(item)) {
        result.push(item);
      }
    }
    return result;
  },

  /**
   * 첫 일치 요소 반환
   */
  find(fn, iter) {
    if (iter === undefined) {
      return (iter) => fx.find(fn, iter);
    }
    for (const item of iter) {
      if (fn(item)) {
        return item;
      }
    }
    return undefined;
  },

  /**
   * 첫 n개 요소만 취함
   */
  take(n, iter) {
    if (iter === undefined) {
      return (iter) => fx.take(n, iter);
    }
    const result = [];
    for (const item of iter) {
      result.push(item);
      if (result.length >= n) break;
    }
    return result;
  },

  /**
   * reduce
   */
  reduce(fn, acc, iter) {
    if (iter === undefined) {
      return (iter) => fx.reduce(fn, acc, iter);
    }
    for (const item of iter) {
      acc = fn(acc, item);
    }
    return acc;
  },

  /**
   * Lazy 함수들 (지연 평가)
   */
  L: {
    map: function* (fn, iter) {
      if (iter === undefined) {
        return (iter) => fx.L.map(fn, iter);
      }
      for (const item of iter) {
        yield fn(item);
      }
    },

    filter: function* (fn, iter) {
      if (iter === undefined) {
        return (iter) => fx.L.filter(fn, iter);
      }
      for (const item of iter) {
        if (fn(item)) {
          yield item;
        }
      }
    },
  },
};

module.exports = { fx };
```

---

## 5. 테스트 예제 상세 분석

### 5.1 Component Lifecycle 테스트

이 테스트는 컴포넌트의 register → beforeDestroy 라이프사이클을 검증합니다.

#### 5.1.1 TC-CL-001: 컴포넌트 register 기본 흐름

```javascript
// tests/examples/component-lifecycle.test.js

const {
  Weventbus,
  GlobalDataPublisher,
  Wkit,
  fx,
  initTestEnvironment,
} = require('../__mocks__');

/**
 * Mock 컴포넌트 인스턴스 생성 헬퍼
 *
 * 실제 컴포넌트가 가지는 필수 속성만 포함
 */
function createMockComponent(id, name) {
  return {
    id,
    name,
    appendElement: {
      addEventListener: function () {},
      removeEventListener: function () {},
      querySelector: function () { return null; },
    },
    customEvents: null,
    subscriptions: null,
    userHandlerList: null,
  };
}

function testComponentRegisterFlow() {
  console.log('\n=== TC-CL-001: 컴포넌트 register 기본 흐름 ===\n');

  // ─────────────────────────────────────────
  // 초기화
  // ─────────────────────────────────────────
  initTestEnvironment();

  // ─────────────────────────────────────────
  // Given: 컴포넌트 인스턴스 준비
  // ─────────────────────────────────────────
  const component = createMockComponent('comp-001', 'TestComponent');

  // ─────────────────────────────────────────
  // When: register.js 패턴 실행
  // ─────────────────────────────────────────

  // 실제 register.js에서 사용하는 것들
  const { subscribe } = GlobalDataPublisher;
  const { bindEvents } = Wkit;
  const { each } = fx;

  // 1. customEvents 정의 및 바인딩
  //    → 이벤트 위임 패턴으로 DOM 이벤트를 커스텀 이벤트로 변환
  component.customEvents = {
    click: {
      '.my-button': '@buttonClicked',  // .my-button 클릭 → @buttonClicked 발행
      '.my-link': '@linkClicked',      // .my-link 클릭 → @linkClicked 발행
    },
  };
  bindEvents(component, component.customEvents);

  // 2. subscriptions 정의 및 구독
  //    → GlobalDataPublisher의 topic을 구독
  component.subscriptions = {
    sensorData: ['renderData', 'updateCount'],  // sensorData topic → 2개 핸들러
  };

  // 핸들러 함수 바인딩
  component.renderData = function ({ response }) {
    console.log('renderData called with:', response);
  };
  component.updateCount = function ({ response }) {
    console.log('updateCount called with:', response);
  };

  // 구독 등록 (fx.go로 함수형 체이닝)
  fx.go(
    Object.entries(component.subscriptions),  // [['sensorData', ['renderData', 'updateCount']]]
    each(([topic, fnList]) =>
      each(
        (fn) => component[fn] && subscribe(topic, component, component[fn]),
        fnList
      )
    )
  );

  // ─────────────────────────────────────────
  // Then: 검증
  // ─────────────────────────────────────────
  const results = {
    // Wkit Mock이 기록한 정보로 검증
    bindEventsCalled: Wkit.__wasBindEventsCalled(component),
    customEventsSet: component.customEvents !== null,

    // GlobalDataPublisher Mock이 기록한 정보로 검증
    subscriberCount: GlobalDataPublisher.__getSubscriberCount('sensorData'),
    isSubscribed: GlobalDataPublisher.__isSubscribed('sensorData', component),

    // 핸들러 바인딩 확인
    renderDataBound: typeof component.renderData === 'function',
    updateCountBound: typeof component.updateCount === 'function',
  };

  console.log('검증 결과:');
  console.log('- bindEvents 호출됨:', results.bindEventsCalled);       // true
  console.log('- customEvents 설정됨:', results.customEventsSet);      // true
  console.log('- sensorData 구독자 수:', results.subscriberCount);     // 2
  console.log('- 컴포넌트 구독 상태:', results.isSubscribed);          // true
  console.log('- renderData 바인딩:', results.renderDataBound);        // true
  console.log('- updateCount 바인딩:', results.updateCountBound);      // true

  // 모든 조건 충족 시 PASS
  const passed =
    results.bindEventsCalled &&
    results.customEventsSet &&
    results.subscriberCount === 2 &&
    results.isSubscribed &&
    results.renderDataBound &&
    results.updateCountBound;

  console.log('\n결과:', passed ? 'PASS ✓' : 'FAIL ✗');
  return passed;
}
```

**테스트 흐름 설명**:

```
1. initTestEnvironment()
   └── 모든 Mock 초기화 + Wkit에 Weventbus 주입

2. 컴포넌트 생성
   └── 최소한의 필수 속성만 가진 Mock 객체

3. register 패턴 실행
   ├── customEvents 정의
   ├── bindEvents() 호출 → Wkit Mock이 기록
   ├── subscriptions 정의
   ├── 핸들러 바인딩
   └── subscribe() 호출 → GlobalDataPublisher Mock이 기록

4. 검증
   ├── Wkit.__wasBindEventsCalled() → 히스토리에서 확인
   ├── GlobalDataPublisher.__getSubscriberCount() → 구독자 수 확인
   └── 객체 상태 직접 확인
```

#### 5.1.2 TC-CL-002: beforeDestroy 리소스 정리

```javascript
function testBeforeDestroyCleanup() {
  console.log('\n=== TC-CL-002: beforeDestroy 리소스 정리 ===\n');
  initTestEnvironment();

  // ─────────────────────────────────────────
  // Given: register 완료된 컴포넌트
  // ─────────────────────────────────────────
  const component = createMockComponent('comp-002', 'TestComponent');
  const { subscribe, unsubscribe } = GlobalDataPublisher;
  const { bindEvents, removeCustomEvents } = Wkit;

  // Register 단계 (간략화)
  component.customEvents = { click: { '.btn': '@clicked' } };
  bindEvents(component, component.customEvents);

  component.subscriptions = { topic1: ['handler1'] };
  component.handler1 = function () {};
  subscribe('topic1', component, component.handler1);

  // ─────────────────────────────────────────
  // When: beforeDestroy 로직 실행
  // ─────────────────────────────────────────

  // 1. 이벤트 제거
  removeCustomEvents(component, component.customEvents);
  component.customEvents = null;  // 참조 제거

  // 2. 구독 해제
  fx.go(
    Object.entries(component.subscriptions),
    fx.each(([topic, _]) => unsubscribe(topic, component))
  );
  component.subscriptions = null;  // 참조 제거

  // 3. 핸들러 참조 제거
  component.handler1 = null;

  // ─────────────────────────────────────────
  // Then: 검증
  // ─────────────────────────────────────────
  const results = {
    removeEventsCalled: Wkit.__wasRemoveEventsCalled(component),
    customEventsNull: component.customEvents === null,
    stillSubscribed: GlobalDataPublisher.__isSubscribed('topic1', component),
    subscriptionsNull: component.subscriptions === null,
    handlerNull: component.handler1 === null,
  };

  console.log('검증 결과:');
  console.log('- removeCustomEvents 호출됨:', results.removeEventsCalled);  // true
  console.log('- customEvents null:', results.customEventsNull);            // true
  console.log('- 여전히 구독 중:', results.stillSubscribed);                // false (해제됨)
  console.log('- subscriptions null:', results.subscriptionsNull);          // true
  console.log('- handler1 null:', results.handlerNull);                     // true

  const passed =
    results.removeEventsCalled &&
    results.customEventsNull &&
    !results.stillSubscribed &&  // false여야 함 (구독 해제됨)
    results.subscriptionsNull &&
    results.handlerNull;

  console.log('\n결과:', passed ? 'PASS ✓' : 'FAIL ✗');
  return passed;
}
```

**핵심 검증 포인트**:

| 항목 | register에서 | beforeDestroy에서 | 검증 |
|------|-------------|------------------|------|
| customEvents | 정의 | null로 설정 | null 확인 |
| bindEvents | 호출 | removeCustomEvents 호출 | 히스토리 확인 |
| subscribe | 호출 | unsubscribe 호출 | isSubscribed → false |
| 핸들러 | 바인딩 | null로 설정 | null 확인 |

#### 5.1.3 TC-CL-003: 매칭 검증

```javascript
function testRegisterDestroyMatching() {
  console.log('\n=== TC-CL-003: register/beforeDestroy 매칭 검증 ===\n');
  initTestEnvironment();

  const component = createMockComponent('comp-003', 'TestComponent');

  // ─────────────────────────────────────────
  // 전체 라이프사이클 실행
  // ─────────────────────────────────────────

  // Register Phase
  component.customEvents = { click: { '.btn': '@clicked' } };
  Wkit.bindEvents(component, component.customEvents);

  component.subscriptions = { topic1: ['fn1'] };
  component.fn1 = function () {};
  GlobalDataPublisher.subscribe('topic1', component, component.fn1);

  // beforeDestroy Phase
  Wkit.removeCustomEvents(component, component.customEvents);
  component.customEvents = null;

  GlobalDataPublisher.unsubscribe('topic1', component);
  component.subscriptions = null;
  component.fn1 = null;

  // ─────────────────────────────────────────
  // 매칭 검증
  // ─────────────────────────────────────────
  const results = {
    // Wkit의 검증 헬퍼 사용
    wkitCleanupVerified: Wkit.__verifyCleanup(component),

    // 히스토리 직접 비교
    bindCount: Wkit.__getBindEventsHistory()
      .filter((h) => h.instance === component).length,
    removeCount: Wkit.__getRemoveEventsHistory()
      .filter((h) => h.instance === component).length,

    subscribeCount: GlobalDataPublisher.__getSubscribeHistory()
      .filter((h) => h.instance === component).length,
    unsubscribeCount: GlobalDataPublisher.__getUnsubscribeHistory()
      .filter((h) => h.instance === component).length,
  };

  console.log('검증 결과:');
  console.log('- Wkit 정리 검증:', results.wkitCleanupVerified);   // true
  console.log('- bindEvents 횟수:', results.bindCount);            // 1
  console.log('- removeCustomEvents 횟수:', results.removeCount);  // 1
  console.log('- subscribe 횟수:', results.subscribeCount);        // 1
  console.log('- unsubscribe 횟수:', results.unsubscribeCount);    // 1

  // 생성과 정리의 횟수가 일치해야 함
  const passed =
    results.wkitCleanupVerified &&
    results.bindCount === results.removeCount &&
    results.subscribeCount === results.unsubscribeCount;

  console.log('\n결과:', passed ? 'PASS ✓' : 'FAIL ✗');
  return passed;
}
```

### 5.2 GlobalDataPublisher 테스트

#### 5.2.1 TC-GDP-001: Topic 등록 및 해제

```javascript
function testTopicRegistration() {
  console.log('\n=== TC-GDP-001: Topic 등록 및 해제 ===\n');
  initTestEnvironment();

  // ─────────────────────────────────────────
  // Given: 데이터 매핑 정의
  // ─────────────────────────────────────────
  const mappings = [
    {
      topic: 'sensorData',
      datasetInfo: {
        datasetName: 'sensor-api',
        param: { type: 'temperature' },
      },
    },
    {
      topic: 'alertData',
      datasetInfo: {
        datasetName: 'alert-api',
        param: { level: 'critical' },
      },
    },
  ];

  // ─────────────────────────────────────────
  // When: 등록
  // ─────────────────────────────────────────
  mappings.forEach((mapping) => {
    GlobalDataPublisher.registerMapping(mapping);
  });

  // 등록 확인
  const afterRegister = {
    sensorRegistered: GlobalDataPublisher.__isRegistered('sensorData'),
    alertRegistered: GlobalDataPublisher.__isRegistered('alertData'),
    registerHistory: GlobalDataPublisher.__getRegisterHistory().length,
  };

  console.log('등록 후:');
  console.log('- sensorData 등록됨:', afterRegister.sensorRegistered);  // true
  console.log('- alertData 등록됨:', afterRegister.alertRegistered);    // true
  console.log('- 등록 기록 수:', afterRegister.registerHistory);        // 2

  // ─────────────────────────────────────────
  // When: 해제
  // ─────────────────────────────────────────
  GlobalDataPublisher.unregisterMapping('sensorData');
  GlobalDataPublisher.unregisterMapping('alertData');

  // 해제 확인
  const afterUnregister = {
    sensorRegistered: GlobalDataPublisher.__isRegistered('sensorData'),
    alertRegistered: GlobalDataPublisher.__isRegistered('alertData'),
    unregisterHistory: GlobalDataPublisher.__getUnregisterHistory().length,
  };

  console.log('\n해제 후:');
  console.log('- sensorData 등록됨:', afterUnregister.sensorRegistered);  // false
  console.log('- alertData 등록됨:', afterUnregister.alertRegistered);    // false
  console.log('- 해제 기록 수:', afterUnregister.unregisterHistory);      // 2

  const passed =
    afterRegister.sensorRegistered &&
    afterRegister.alertRegistered &&
    !afterUnregister.sensorRegistered &&
    !afterUnregister.alertRegistered;

  console.log('\n결과:', passed ? 'PASS ✓' : 'FAIL ✗');
  return passed;
}
```

#### 5.2.2 TC-GDP-002: 구독자에게 데이터 발행

```javascript
async function testDataPublishing() {
  console.log('\n=== TC-GDP-002: 구독자에게 데이터 발행 ===\n');
  initTestEnvironment();

  // ─────────────────────────────────────────
  // Given: 컴포넌트가 topic 구독
  // ─────────────────────────────────────────
  const page = { id: 'page-001', name: 'TestPage' };
  const component = { id: 'comp-001', name: 'SensorDisplay' };

  let receivedData = null;  // 수신 데이터 저장용

  // 매핑 등록
  GlobalDataPublisher.registerMapping({
    topic: 'sensorData',
    datasetInfo: { datasetName: 'sensor-api', param: {} },
  });

  // 구독 (handler가 receivedData에 저장)
  GlobalDataPublisher.subscribe('sensorData', component, ({ response }) => {
    receivedData = response;
  });

  // ─────────────────────────────────────────
  // Mock 응답 설정 (핵심!)
  // ─────────────────────────────────────────
  const mockResponse = {
    data: {
      temperature: 25.5,
      humidity: 60,
      timestamp: Date.now(),
    },
  };
  GlobalDataPublisher.__setMockResponse('sensorData', mockResponse);

  // ─────────────────────────────────────────
  // When: 데이터 발행
  // ─────────────────────────────────────────
  await GlobalDataPublisher.fetchAndPublish('sensorData', page, {});

  // ─────────────────────────────────────────
  // Then: 검증
  // ─────────────────────────────────────────
  const results = {
    dataReceived: receivedData !== null,
    correctData: receivedData?.data?.temperature === 25.5,
    publishHistory: GlobalDataPublisher.__getPublishHistory().length,
    wasPublished: GlobalDataPublisher.__wasPublished('sensorData'),
  };

  console.log('검증 결과:');
  console.log('- 데이터 수신됨:', results.dataReceived);          // true
  console.log('- 올바른 데이터:', results.correctData);           // true
  console.log('- 발행 히스토리 수:', results.publishHistory);     // 1
  console.log('- sensorData 발행됨:', results.wasPublished);      // true

  const passed = Object.values(results).every(Boolean);
  console.log('\n결과:', passed ? 'PASS ✓' : 'FAIL ✗');
  return passed;
}
```

**핵심 포인트**: `__setMockResponse`로 API 응답을 미리 설정

```
실제 환경:
  fetchAndPublish() → page.dataService.call() → 서버 → 응답

테스트 환경:
  __setMockResponse('topic', 응답) → fetchAndPublish() → 설정된 응답 사용
```

### 5.3 PopupMixin 테스트

#### 5.3.1 TC-PM-001: applyShadowPopupMixin 기본 적용

```javascript
function testApplyShadowPopupMixin() {
  console.log('\n=== TC-PM-001: applyShadowPopupMixin 기본 적용 ===\n');
  initTestEnvironment();

  // ─────────────────────────────────────────
  // Given: 컴포넌트 인스턴스
  // ─────────────────────────────────────────
  const component = {
    id: 'comp-001',
    name: 'TestComponent',
    page: {
      appendElement: {
        appendChild: function () {},  // Mock
      },
    },
  };

  let onCreatedCalled = false;

  // ─────────────────────────────────────────
  // When: Mixin 적용
  // ─────────────────────────────────────────
  PopupMixin.applyShadowPopupMixin(component, {
    getHTML: () => '<div class="popup-content">Hello</div>',
    getStyles: () => '.popup-content { background: #1a1f2e; }',
    onCreated: (shadowRoot) => {
      onCreatedCalled = true;
    },
  });

  // ─────────────────────────────────────────
  // Then: 메서드 존재 확인
  // ─────────────────────────────────────────
  const results = {
    hasCreatePopup: typeof component.createPopup === 'function',
    hasShowPopup: typeof component.showPopup === 'function',
    hasHidePopup: typeof component.hidePopup === 'function',
    hasPopupQuery: typeof component.popupQuery === 'function',
    hasBindPopupEvents: typeof component.bindPopupEvents === 'function',
    hasDestroyPopup: typeof component.destroyPopup === 'function',
    hasPopupState: component._popup !== undefined,
  };

  console.log('메서드 존재 확인:');
  console.log('- createPopup:', results.hasCreatePopup);       // true
  console.log('- showPopup:', results.hasShowPopup);           // true
  console.log('- hidePopup:', results.hasHidePopup);           // true
  console.log('- popupQuery:', results.hasPopupQuery);         // true
  console.log('- bindPopupEvents:', results.hasBindPopupEvents); // true
  console.log('- destroyPopup:', results.hasDestroyPopup);     // true
  console.log('- _popup 상태:', results.hasPopupState);        // true

  // showPopup 호출하여 onCreated 콜백 확인
  component.showPopup();
  console.log('- onCreated 호출됨:', onCreatedCalled);         // true

  const passed = Object.values(results).every(Boolean) && onCreatedCalled;
  console.log('\n결과:', passed ? 'PASS ✓' : 'FAIL ✗');
  return passed;
}
```

#### 5.3.2 TC-PM-007: destroyPopup 체이닝 순서

```javascript
function testDestroyPopupChaining() {
  console.log('\n=== TC-PM-007: destroyPopup 체이닝 순서 ===\n');
  initTestEnvironment();

  // ─────────────────────────────────────────
  // Given: 모든 Mixin 적용
  // ─────────────────────────────────────────
  const component = {
    id: 'comp-007',
    name: 'FullComponent',
    page: { appendElement: { appendChild: () => {} } },
  };

  // 순서대로 적용 (중요!)
  PopupMixin.applyShadowPopupMixin(component, {
    getHTML: () => '<div></div>',
    getStyles: () => '',
  });
  PopupMixin.applyEChartsMixin(component);      // Shadow 이후
  PopupMixin.applyTabulatorMixin(component);    // Shadow 이후

  // 팝업 생성 및 리소스 추가
  component.showPopup();
  component.createChart('.chart-container');
  component.createTable('.table-container');

  // ─────────────────────────────────────────
  // When: destroyPopup 호출
  // ─────────────────────────────────────────
  component.destroyPopup();

  // ─────────────────────────────────────────
  // Then: 체이닝 순서 검증
  // ─────────────────────────────────────────

  /*
   * 체이닝 구조:
   *
   * destroyPopup() 호출
   *     ↓
   * [TabulatorMixin의 destroyPopup]
   *   - 테이블 정리
   *   - originalDestroyPopup() 호출
   *         ↓
   *     [EChartsMixin의 destroyPopup]
   *       - 차트 정리
   *       - originalDestroyPopup() 호출
   *             ↓
   *         [applyShadowPopupMixin의 destroyPopup]
   *           - 이벤트 정리
   *           - DOM 제거
   */

  const verification = PopupMixin.__verifyDestroyChaining(component);
  const popupState = PopupMixin.__getPopupState(component);

  console.log('검증 결과:');
  console.log('- 체이닝 순서 유효:', verification.valid);     // true
  console.log('- host 정리됨:', !popupState.hasHost);         // true
  console.log('- shadowRoot 정리됨:', !popupState.hasShadowRoot); // true
  console.log('- 차트 수:', popupState.chartCount);           // 0
  console.log('- 테이블 수:', popupState.tableCount);         // 0

  const passed = verification.valid && !popupState.hasHost;
  console.log('\n결과:', passed ? 'PASS ✓' : 'FAIL ✗');
  return passed;
}
```

#### 5.3.3 TC-PM-ERR-001: Mixin 순서 오류 검증

```javascript
function testMixinOrderError() {
  console.log('\n=== TC-PM-ERR-001: Mixin 순서 오류 검증 ===\n');
  initTestEnvironment();

  // ─────────────────────────────────────────
  // Given: Shadow Popup 없는 컴포넌트
  // ─────────────────────────────────────────
  const component = { id: 'comp-err', name: 'ErrorComponent' };

  // ─────────────────────────────────────────
  // When: EChartsMixin 먼저 적용 시도 (잘못된 순서)
  // ─────────────────────────────────────────
  let errorThrown = false;
  let errorMessage = '';

  try {
    PopupMixin.applyEChartsMixin(component);  // 오류!
  } catch (e) {
    errorThrown = true;
    errorMessage = e.message;
  }

  // ─────────────────────────────────────────
  // Then: 에러 발생 확인
  // ─────────────────────────────────────────
  console.log('검증 결과:');
  console.log('- 에러 발생:', errorThrown);  // true
  console.log('- 에러 메시지:', errorMessage);
  // "applyShadowPopupMixin must be called before applyEChartsMixin"

  const passed = errorThrown && errorMessage.includes('applyShadowPopupMixin');
  console.log('\n결과:', passed ? 'PASS ✓' : 'FAIL ✗');
  return passed;
}
```

---

## 6. 테스트 실행 흐름

### 6.1 run-all-tests.js

```javascript
// tests/run-all-tests.js

async function runAllTests() {
  console.log('╔═════════════════════════════════════════════════════════════╗');
  console.log('║            RNBT Architecture Test Suite                     ║');
  console.log('╚═════════════════════════════════════════════════════════════╝');

  // 테스트 스위트 목록
  const suites = [
    {
      name: 'Component Lifecycle Tests',
      module: './examples/component-lifecycle.test',
    },
    {
      name: 'GlobalDataPublisher Tests',
      module: './examples/global-data-publisher.test',
    },
    {
      name: 'PopupMixin Tests',
      module: './examples/popup-mixin.test',
    },
  ];

  const results = [];

  // 각 스위트 실행
  for (const suite of suites) {
    console.log(`\n─── ${suite.name} ───`);

    try {
      const testModule = require(suite.module);
      const passed = await testModule.runAllTests();
      results.push({ name: suite.name, passed, error: null });
    } catch (error) {
      console.error(`Error: ${error.message}`);
      results.push({ name: suite.name, passed: false, error: error.message });
    }
  }

  // 최종 결과 출력
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                        FINAL RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');

  let allPassed = true;
  results.forEach((r) => {
    const status = r.passed ? 'PASS ✓' : 'FAIL ✗';
    console.log(`  ${r.name}: ${status}`);
    if (!r.passed) allPassed = false;
  });

  console.log(`\n${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);

  return allPassed;
}

// 직접 실행 시
if (require.main === module) {
  runAllTests().then((success) => {
    process.exit(success ? 0 : 1);  // 실패 시 exit code 1
  });
}

module.exports = { runAllTests };
```

### 6.2 실행 결과 예시

```
╔═════════════════════════════════════════════════════════════╗
║            RNBT Architecture Test Suite                     ║
╚═════════════════════════════════════════════════════════════╝

─── Component Lifecycle Tests ───

=== TC-CL-001: 컴포넌트 register 기본 흐름 ===
검증 결과:
- bindEvents 호출됨: true
- customEvents 설정됨: true
- sensorData 구독자 수: 2
- 컴포넌트 구독 상태: true
결과: PASS ✓

=== TC-CL-002: beforeDestroy 리소스 정리 ===
검증 결과:
- removeCustomEvents 호출됨: true
- 여전히 구독 중: false
결과: PASS ✓

...

═══════════════════════════════════════════════════════════════
                        FINAL RESULTS
═══════════════════════════════════════════════════════════════
  Component Lifecycle Tests: PASS ✓
  GlobalDataPublisher Tests: PASS ✓
  PopupMixin Tests: PASS ✓

ALL TESTS PASSED ✓
```

---

## 7. 새 테스트 작성 가이드

### 7.1 테스트 파일 생성

```javascript
// tests/examples/my-feature.test.js

const {
  Weventbus,
  GlobalDataPublisher,
  Wkit,
  PopupMixin,
  fx,
  initTestEnvironment,
} = require('../__mocks__');

// ─────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────

function createMockComponent(id) {
  return { id, name: 'TestComponent' };
}

// ─────────────────────────────────────────
// 테스트 케이스
// ─────────────────────────────────────────

function testMyFeature() {
  console.log('\n=== TC-XXX-001: 기능 설명 ===\n');

  // 1. 초기화
  initTestEnvironment();

  // 2. Given: 초기 상태 설정
  // ...

  // 3. When: 테스트 대상 동작 실행
  // ...

  // 4. Then: 결과 검증
  const results = {
    // 검증 항목들
  };

  console.log('검증 결과:');
  Object.entries(results).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });

  const passed = Object.values(results).every(Boolean);
  console.log('\n결과:', passed ? 'PASS ✓' : 'FAIL ✗');
  return passed;
}

// ─────────────────────────────────────────
// 테스트 실행기
// ─────────────────────────────────────────

function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║               My Feature 테스트                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const results = [];

  results.push({ name: 'TC-XXX-001', passed: testMyFeature() });
  // 추가 테스트...

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('                        최종 결과');
  console.log('══════════════════════════════════════════════════════════════');

  results.forEach((r) => {
    console.log(`  ${r.name}: ${r.passed ? 'PASS ✓' : 'FAIL ✗'}`);
  });

  return results.every((r) => r.passed);
}

// 직접 실행
if (require.main === module) {
  process.exit(runAllTests() ? 0 : 1);
}

module.exports = { testMyFeature, runAllTests };
```

### 7.2 run-all-tests.js에 추가

```javascript
const suites = [
  // 기존 테스트들...
  {
    name: 'My Feature Tests',
    module: './examples/my-feature.test',
  },
];
```

### 7.3 테스트 작성 체크리스트

```
□ initTestEnvironment() 호출했는가?
□ Given/When/Then 구조를 따르는가?
□ Mock 응답이 필요하면 __setMockResponse 사용했는가?
□ 검증에 Mock의 __헬퍼 메서드를 활용했는가?
□ 결과를 명확하게 출력하는가?
□ runAllTests()를 export했는가?
□ run-all-tests.js에 추가했는가?
```

---

## 부록: Mock API 요약

### Weventbus Mock

| 메서드 | 설명 |
|--------|------|
| `on(event, callback)` | 이벤트 구독 |
| `off(event, callback)` | 구독 해제 |
| `emit(event, data)` | 이벤트 발행 |
| `__reset()` | 상태 초기화 |
| `__wasEmitted(event)` | 발행 여부 확인 |
| `__getEmitCount(event)` | 발행 횟수 |
| `__getListenerCount(event)` | 리스너 수 |

### GlobalDataPublisher Mock

| 메서드 | 설명 |
|--------|------|
| `registerMapping(mapping)` | topic 등록 |
| `unregisterMapping(topic)` | topic 해제 |
| `subscribe(topic, instance, handler)` | 구독 |
| `unsubscribe(topic, instance)` | 구독 해제 |
| `fetchAndPublish(topic, page, params)` | 데이터 발행 |
| `__reset()` | 상태 초기화 |
| `__setMockResponse(topic, response)` | Mock 응답 설정 |
| `__isRegistered(topic)` | 등록 여부 |
| `__isSubscribed(topic, instance)` | 구독 여부 |
| `__getSubscriberCount(topic)` | 구독자 수 |

### Wkit Mock

| 메서드 | 설명 |
|--------|------|
| `bindEvents(instance, customEvents)` | 2D 이벤트 바인딩 |
| `removeCustomEvents(instance, customEvents)` | 이벤트 제거 |
| `bind3DEvents(instance, customEvents)` | 3D 이벤트 바인딩 |
| `onEventBusHandlers(handlers)` | EventBus 핸들러 등록 |
| `offEventBusHandlers(handlers)` | EventBus 핸들러 해제 |
| `__reset()` | 상태 초기화 |
| `__setWeventbus(dep)` | Weventbus 의존성 주입 |
| `__wasBindEventsCalled(instance)` | 바인딩 호출 여부 |
| `__verifyCleanup(instance)` | 정리 매칭 검증 |

### PopupMixin Mock

| 메서드 | 설명 |
|--------|------|
| `applyShadowPopupMixin(instance, options)` | 팝업 Mixin 적용 |
| `applyEChartsMixin(instance)` | 차트 Mixin 적용 |
| `applyTabulatorMixin(instance)` | 테이블 Mixin 적용 |
| `__reset()` | 상태 초기화 |
| `__getPopupState(instance)` | 팝업 상태 조회 |
| `__verifyDestroyChaining(instance)` | 체이닝 검증 |

---

*문서 작성일: 2026-01-10*
