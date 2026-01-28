# PopupMixin API Reference

Shadow DOM 기반 팝업 시스템. 차트(ECharts), 테이블(Tabulator) 통합 지원.

---

## 개요

```
┌─────────────────────────────────────────────────────────────┐
│  PopupMixin 구성                                             │
│                                                              │
│  applyShadowPopupMixin ─── 기본 팝업 (필수)                   │
│           │                                                  │
│           ├── applyEChartsMixin ─── 차트 기능 (선택)          │
│           │                                                  │
│           └── applyTabulatorMixin ─── 테이블 기능 (선택)      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**호출 순서:** applyShadowPopupMixin → applyEChartsMixin/applyTabulatorMixin

---

## applyShadowPopupMixin

기본 Shadow DOM 팝업 기능.

### 적용

```javascript
const { applyShadowPopupMixin } = PopupMixin;

applyShadowPopupMixin(this, {
    getHTML: () => `
        <div class="popup-container">
            <h2>팝업 제목</h2>
            <div class="content"></div>
        </div>
    `,
    getStyles: () => `
        .popup-container {
            position: fixed;
            background: white;
            padding: 20px;
        }
    `,
    onCreated: (shadowRoot) => {
        console.log('팝업 생성 완료');
    }
});
```

### 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `getHTML` | `() => string` | 팝업 HTML 반환 함수 |
| `getStyles` | `() => string` | 팝업 CSS 반환 함수 |
| `onCreated` | `(shadowRoot) => void` | 생성 완료 콜백 (선택) |

---

### 추가되는 메서드

#### createPopup()

Shadow DOM 팝업 생성.

```javascript
/**
 * @returns {ShadowRoot} - 생성된 Shadow Root
 */
const shadowRoot = this.createPopup();
```

**동작:**
1. 호스트 `<div>` 생성 (`popup-${instance.id}`)
2. Shadow DOM 연결 (`mode: 'open'`)
3. 스타일 + HTML 삽입
4. `instance.page.appendElement`에 추가
5. `onCreated` 콜백 호출

---

#### showPopup()

팝업 표시.

```javascript
this.showPopup();
// host.style.display = 'block'
```

**팝업이 없으면 자동 생성.**

---

#### hidePopup()

팝업 숨김.

```javascript
this.hidePopup();
// host.style.display = 'none'
```

---

#### popupQuery(selector)

Shadow DOM 내부 요소 선택.

```javascript
/**
 * @param {string} selector - CSS 선택자
 * @returns {Element|null}
 */
const title = this.popupQuery('.popup-title');
```

---

#### popupQueryAll(selector)

Shadow DOM 내부 요소 모두 선택.

```javascript
/**
 * @param {string} selector - CSS 선택자
 * @returns {NodeList}
 */
const buttons = this.popupQueryAll('.btn');
```

---

#### bindPopupEvents(events)

이벤트 델리게이션 바인딩.

```javascript
/**
 * @param {Object} events - { eventType: { selector: handler } }
 */
this.bindPopupEvents({
    click: {
        '.close-btn': (e) => this.hidePopup(),
        '.save-btn': (e) => this.saveData()
    },
    change: {
        'select': (e) => this.handleSelect(e)
    }
});
```

---

#### destroyPopup()

팝업 및 리소스 정리.

```javascript
this.destroyPopup();
```

**정리 대상:**
- 바인딩된 이벤트 리스너
- DOM 요소 제거
- (EChartsMixin 사용 시) 차트 dispose
- (TabulatorMixin 사용 시) 테이블 destroy

---

### 내부 상태

```javascript
instance._popup = {
    host: HTMLDivElement,      // Shadow DOM 호스트
    shadowRoot: ShadowRoot,    // Shadow Root
    eventCleanups: Function[]  // 이벤트 정리 함수 배열
};
```

---

## applyEChartsMixin

ECharts 차트 관리 (applyShadowPopupMixin 이후 호출).

### 적용

```javascript
const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;

applyShadowPopupMixin(this, { ... });
applyEChartsMixin(this);
```

---

### 추가되는 메서드

#### createChart(selector)

ECharts 인스턴스 생성.

```javascript
/**
 * @param {string} selector - 차트 컨테이너 선택자
 * @returns {ECharts|null}
 */
const chart = this.createChart('.chart-container');
chart.setOption({ ... });
```

**자동 기능:**
- ResizeObserver로 컨테이너 크기 변경 시 자동 resize

---

#### getChart(selector)

차트 인스턴스 조회.

```javascript
const chart = this.getChart('.chart-container');
```

---

#### updateChart(selector, option)

차트 옵션 업데이트.

```javascript
/**
 * @param {string} selector - 차트 컨테이너 선택자
 * @param {Object} option - ECharts 옵션
 */
this.updateChart('.chart-container', {
    series: [{ data: newData }]
});
```

---

### 내부 상태

```javascript
instance._popup.charts = Map<selector, {
    chart: ECharts,
    resizeObserver: ResizeObserver
}>;
```

---

## applyTabulatorMixin

Tabulator 테이블 관리 (applyShadowPopupMixin 이후 호출).

### 적용

```javascript
const { applyShadowPopupMixin, applyTabulatorMixin } = PopupMixin;

applyShadowPopupMixin(this, { ... });
applyTabulatorMixin(this);
```

---

### 추가되는 메서드

#### createTable(selector, options?)

Tabulator 인스턴스 생성.

```javascript
/**
 * @param {string} selector - 테이블 컨테이너 선택자
 * @param {Object} [options] - Tabulator 옵션
 * @returns {Tabulator|null}
 */
const table = this.createTable('.table-container', {
    columns: [
        { title: 'Name', field: 'name' },
        { title: 'Age', field: 'age' }
    ],
    data: initialData
});
```

**자동 기능:**
- Tabulator CSS 자동 주입 (midnight 테마)
- ResizeObserver로 자동 redraw
- tableBuilt 이벤트로 초기화 완료 감지

**기본 옵션:**
```javascript
{
    layout: 'fitColumns',
    responsiveLayout: 'collapse'
}
```

---

#### getTable(selector)

테이블 인스턴스 조회.

```javascript
const table = this.getTable('.table-container');
```

---

#### isTableReady(selector)

테이블 초기화 완료 여부.

```javascript
if (this.isTableReady('.table-container')) {
    this.updateTable('.table-container', newData);
}
```

---

#### updateTable(selector, data)

테이블 데이터 업데이트.

```javascript
/**
 * @param {string} selector - 테이블 컨테이너 선택자
 * @param {Array} data - 테이블 데이터
 */
this.updateTable('.table-container', [
    { name: 'John', age: 30 },
    { name: 'Jane', age: 25 }
]);
```

---

#### updateTableOptions(selector, options)

테이블 옵션 업데이트.

```javascript
/**
 * @param {string} selector - 테이블 컨테이너 선택자
 * @param {Object} options - 업데이트할 옵션 (columns, data)
 */
this.updateTableOptions('.table-container', {
    columns: newColumns,
    data: newData
});
```

---

### Shadow DOM CSS 주입

Shadow DOM은 외부 스타일시트와 격리됩니다.

**자동 처리:**
- `createTable()` 호출 시 Tabulator CSS 자동 fetch & 주입
- 경로: `client/common/libs/tabulator/tabulator_midnight.min.css`
- 테마: midnight (다크 모드)

---

### 내부 상태

```javascript
instance._popup.tables = Map<selector, {
    table: Tabulator,
    resizeObserver: ResizeObserver,
    state: { initialized: boolean }
}>;
instance._popup.tabulatorCssInjected = boolean;
```

---

## 사용 예시

### 차트 + 테이블 팝업

```javascript
class UPSPopup {
    constructor() {
        const { applyShadowPopupMixin, applyEChartsMixin, applyTabulatorMixin } = PopupMixin;

        applyShadowPopupMixin(this, {
            getHTML: () => `
                <div class="popup">
                    <button class="close-btn">×</button>
                    <div class="chart-container"></div>
                    <div class="table-container"></div>
                </div>
            `,
            getStyles: () => `
                .popup { ... }
                .chart-container { height: 200px; }
                .table-container { height: 300px; }
            `,
            onCreated: () => this.initWidgets()
        });

        applyEChartsMixin(this);
        applyTabulatorMixin(this);
    }

    initWidgets() {
        // 차트 생성
        this.createChart('.chart-container');
        this.updateChart('.chart-container', {
            xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', data: [120, 200, 150] }]
        });

        // 테이블 생성
        this.createTable('.table-container', {
            columns: [
                { title: 'ID', field: 'id' },
                { title: 'Status', field: 'status' }
            ]
        });

        // 이벤트 바인딩
        this.bindPopupEvents({
            click: {
                '.close-btn': () => this.hidePopup()
            }
        });
    }

    updateData(chartData, tableData) {
        this.updateChart('.chart-container', {
            series: [{ data: chartData }]
        });
        this.updateTable('.table-container', tableData);
    }

    destroy() {
        this.destroyPopup();  // 차트, 테이블, 이벤트 모두 정리
    }
}
```

---

## 표시/숨김 커스터마이징

기본 방식:
```javascript
showPopup() → host.style.display = 'block'
hidePopup() → host.style.display = 'none'
```

다른 방식 필요 시 (opacity, transform 등):
```javascript
// 메서드 오버라이드
instance.showPopup = function() {
    if (!instance._popup.host) instance.createPopup();
    instance._popup.host.style.opacity = '1';
    instance._popup.host.style.transform = 'translateY(0)';
};

instance.hidePopup = function() {
    if (instance._popup.host) {
        instance._popup.host.style.opacity = '0';
        instance._popup.host.style.transform = 'translateY(-20px)';
    }
};
```

---

## 관련 문서

- [COMPONENT_MIXIN_API.md](/RNBT_architecture/docs/COMPONENT_MIXIN_API.md) - 컴포넌트 Mixin
- [README.md - 부록 E: PopupMixin 패턴](/RNBT_architecture/README.md#부록-e-popupmixin-패턴)
