# CODING_STYLE.md - 함수형 코딩 지침

Skills에서 생성하는 코드의 공통 코딩 스타일 가이드입니다.

---

## 핵심 원칙

> **"오버엔지니어링하지 않는 선에서 간결한 코드"**

- 함수 조합이 명령형보다 명확할 때 → 함수형
- 함수 조합이 오히려 복잡해질 때 → 명령형 허용
- 판단 기준은 **코드 길이가 아니라 의도의 명확성**

---

## 안티패턴: 함수형을 쓰는 척하는 명령형

```javascript
// ❌ Bad: fx.each 안에 명령형 코드 덩어리
fx.go(
    config,
    fx.each(({ key, label, icon, format }) => {
        const stat = data[key];
        if (!stat) return;

        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.stat-card');
        const iconEl = clone.querySelector('.stat-icon');
        const labelEl = clone.querySelector('.stat-label');
        const valueEl = clone.querySelector('.stat-value');
        const changeEl = clone.querySelector('.stat-change');

        card.dataset.statKey = key;
        iconEl.textContent = icon;
        labelEl.textContent = label;
        valueEl.textContent = format(stat.value, stat.unit);

        const changeValue = stat.change;
        const isPositive = changeValue >= 0;
        changeEl.textContent = `${isPositive ? '+' : ''}${changeValue}%`;
        changeEl.classList.add(isPositive ? 'positive' : 'negative');

        container.appendChild(clone);
    })
);
```

**문제점:**
- `fx.go`, `fx.each`는 그냥 `forEach`의 래퍼일 뿐
- 내부 로직은 전혀 함수형이 아님 (변수 나열, 순차적 DOM 조작)
- 함수형의 이점(조합성, 테스트 용이성)을 전혀 못 살림

---

## 권장 패턴: 파이프라인 + 분리된 함수

```javascript
// ✅ Good: 각 단계가 "무엇을 하는가"를 선언적으로 표현
fx.go(
    config,
    fx.map(cfg => ({ cfg, stat: data[cfg.key] })),
    fx.filter(({ stat }) => stat),
    fx.map(({ cfg, stat }) => createStatCard(template, cfg, stat)),
    fx.each(card => container.appendChild(card))
);

// 순수 함수로 분리
function createStatCard(template, { key, label, icon, format }, stat) {
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.stat-card');

    card.dataset.statKey = key;
    clone.querySelector('.stat-icon').textContent = icon;
    clone.querySelector('.stat-label').textContent = label;
    clone.querySelector('.stat-value').textContent = format(stat.value, stat.unit);

    const changeEl = clone.querySelector('.stat-change');
    const isPositive = stat.change >= 0;
    changeEl.textContent = `${isPositive ? '+' : ''}${stat.change}%`;
    changeEl.classList.add(isPositive ? 'positive' : 'negative');

    return clone;
}
```

**장점:**
- 파이프라인: config → 데이터 매칭 → 필터링 → DOM 생성 → 삽입
- 각 단계의 의도가 명확
- `createStatCard`는 독립적으로 테스트 가능

---

## 함수형 vs 명령형 판단 기준

### 함수형이 적합한 경우

| 상황 | 이유 |
|------|------|
| 데이터 변환 (filter, map, reduce) | 의도가 명확하게 드러남 |
| 여러 단계의 처리가 필요할 때 | 파이프라인으로 흐름 표현 |
| 동일한 패턴이 반복될 때 | 함수 조합으로 재사용 |

```javascript
// 데이터 변환: 함수형
const activeItems = fx.go(
    data.items,
    fx.filter(item => item.status === 'active'),
    fx.map(item => ({ ...item, label: formatLabel(item) })),
    fx.take(10)
);
```

### 명령형이 적합한 경우

| 상황 | 이유 |
|------|------|
| DOM 직접 조작 | 본질적으로 부수효과 |
| 단순한 2-3줄 로직 | 함수 분리가 과한 추상화 |
| 조건 분기가 복잡할 때 | 가독성 우선 |

```javascript
// DOM 조작: 명령형 허용
function applyTheme(element, theme) {
    element.dataset.theme = theme;
    element.classList.toggle('dark', theme === 'dark');
}
```

---

## 핵심 규칙

### 1. 콜백 안의 로직이 복잡하면 함수로 분리

**분리 기준 (줄 수가 아닌 의도 기반)**:
- 콜백 안에서 **여러 단계의 작업**이 수행될 때
- 같은 로직이 **재사용**될 때
- 로직이 **독립적으로 테스트**가 필요할 때

**분리하지 않아도 되는 경우**:
- 한 가지 일을 순차적으로 수행하는 경우 (줄 수와 무관)
- 해당 위치에서만 사용되고 맥락이 명확한 경우

```javascript
// ✅ 분리 O: 여러 단계 작업 + 재사용 가능
fx.each(processItem, items)

function processItem(item) {
    // 데이터 변환 + DOM 생성 + 이벤트 바인딩 등 여러 단계
}

// ✅ 분리 X: 한 가지 일을 순차적으로 (7줄이어도 OK)
fx.each(item => {
    const el = template.content.cloneNode(true);
    el.querySelector('.name').textContent = item.name;
    el.querySelector('.value').textContent = item.value;
    el.querySelector('.status').textContent = item.status;
    el.querySelector('.date').textContent = formatDate(item.date);
    el.dataset.id = item.id;
    container.appendChild(el);
}, items)
```

### 2. 변환 단계는 파이프라인으로 표현

```javascript
// ❌ 중간 변수 나열
const filtered = items.filter(isValid);
const mapped = filtered.map(transform);
const result = mapped.slice(0, 10);

// ✅ 파이프라인
const result = fx.go(
    items,
    fx.filter(isValid),
    fx.map(transform),
    fx.take(10)
);
```

### 3. 부수효과는 파이프라인 끝에서만

```javascript
// ✅ 부수효과(each, appendChild)는 마지막에
fx.go(
    config,
    fx.filter(...),    // 순수
    fx.map(...),       // 순수
    fx.each(render)    // 부수효과 (마지막)
);
```

### 4. DOM 조작 함수는 요소를 반환

```javascript
// ✅ 생성 후 반환 → 삽입은 호출자가
function createCard(data) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = data.title;
    return el;  // 반환
}

// 호출자가 삽입
fx.go(
    items,
    fx.map(createCard),
    fx.each(card => container.appendChild(card))
);
```

---

## 실전 패턴 카탈로그

### 패턴 1: 리스트 렌더링

```javascript
function renderList(config, { response }) {
    const { data } = response;
    if (!data?.items) return;

    const container = this.appendElement.querySelector(config.selectors.list);
    const template = this.appendElement.querySelector(config.selectors.template);
    if (!container || !template) return;

    // 기존 아이템 제거
    container.querySelectorAll('.list-item').forEach(el => el.remove());

    // 파이프라인: 데이터 → DOM 요소 → 삽입
    fx.go(
        data.items,
        fx.map((item, i) => createListItem(template, config, item, i)),
        fx.each(el => container.appendChild(el))
    );
}

function createListItem(template, config, item, index) {
    const clone = template.content.cloneNode(true);
    const el = clone.querySelector('.list-item');

    el.dataset.index = index;
    el.querySelector(config.selectors.name).textContent = item.name;
    el.querySelector(config.selectors.value).textContent = item.value;

    return clone;
}
```

### 패턴 2: 필드 렌더링 (Config 기반)

```javascript
function renderFields(config, { response }) {
    const { data } = response;
    if (!data) return;

    fx.go(
        config.fields,
        fx.each(({ key, selector, suffix, format }) => {
            const el = this.appendElement.querySelector(selector);
            if (!el) return;

            const value = data[key];
            el.textContent = format ? format(value) :
                             suffix ? `${value}${suffix}` : value;
        })
    );
}
```

### 패턴 3: 조건부 클래스 적용

```javascript
// 단순한 경우: 명령형 OK
function applyStatus(element, status) {
    element.classList.remove('active', 'inactive', 'error');
    element.classList.add(status);
}

// 여러 요소에 적용: 함수형
fx.go(
    items,
    fx.each(item => applyStatus(item.element, item.status))
);
```

### 패턴 4: 집계 계산

```javascript
const summary = {
    total: fx.go(items, fx.map(i => i.value), fx.reduce((a, b) => a + b, 0)),
    count: items.length,
    active: fx.go(items, fx.filter(i => i.active), arr => arr.length)
};
```

### 패턴 5: 중첩 데이터 처리

```javascript
// 카테고리별 아이템 렌더링
fx.go(
    data.categories,
    fx.each(category => {
        const section = createSection(category);

        fx.go(
            category.items,
            fx.filter(item => item.visible),
            fx.map(item => createItem(item)),
            fx.each(item => section.appendChild(item))
        );

        container.appendChild(section);
    })
);
```

---

## 언제 명령형을 선택할까

### 단순 DOM 업데이트

```javascript
// ✅ 명령형 OK (3줄 이하)
function updateValue(selector, value) {
    const el = this.appendElement.querySelector(selector);
    if (el) el.textContent = value;
}
```

### 복잡한 조건 분기

```javascript
// ✅ 명령형 OK (조건이 복잡할 때)
function handleResponse(response) {
    if (!response.success) {
        showError(response.error);
        return;
    }

    if (response.data.items.length === 0) {
        showEmpty();
        return;
    }

    renderItems(response.data.items);
}
```

### 이벤트 핸들러

```javascript
// ✅ 명령형 OK (이벤트 핸들러는 본질적으로 부수효과)
function handleClick(event) {
    const item = event.target.closest('.item');
    if (!item) return;

    const id = item.dataset.id;
    this.selectedId = id;
    updateSelection(id);
}
```

---

## 체크리스트

코드 작성 시 다음을 확인:

```
□ 콜백 안에서 여러 단계의 작업을 하는가? → 함수로 분리
□ 같은 로직이 재사용되는가? → 함수로 분리
□ 중간 변수가 3개 이상인가? → 파이프라인으로 변환
□ 데이터 변환인가? → fx.map, fx.filter, fx.reduce 사용
□ DOM 생성인가? → 요소를 반환하는 순수 함수로 분리
□ 부수효과인가? → 파이프라인 마지막에 배치
□ 한 가지 일을 순차적으로 하는가? → 인라인 OK (줄 수 무관)
```

---

## CSS 원칙 (RNBT 런타임 호환)

### px 단위 사용 원칙

**모든 크기 수치는 px 단위로 유지합니다.**

```css
/* ✅ px 단위 사용 (런타임 호환 보장) */
.component {
    width: 320px;
    height: 180px;
    padding: 16px;
    font-size: 14px;
    gap: 12px;
}

/* ❌ rem/em 사용 금지 */
.component {
    padding: 1rem;      /* 런타임 html font-size에 따라 달라짐 */
    font-size: 0.875em; /* 부모 font-size에 따라 달라짐 */
}
```

**이유:**
- `rem`은 `<html>` 요소의 font-size 기준 (브라우저 기본 16px)
- `em`은 해당 요소의 font-size 기준 (상속됨)
- RNBT 런타임 환경에서 html/body font-size가 다를 수 있음
- px 단위는 환경에 관계없이 일관된 크기 보장
- Figma 디자인 수치와 1:1 매칭 가능

**예외:**
- line-height는 단위 없는 숫자 사용 가능 (예: `line-height: 1.5`)

---

### 레이아웃: Flexbox 우선 (Grid/absolute 지양)

**모든 레이아웃은 Flexbox를 우선 사용합니다. Grid와 absolute는 지양합니다.**

```css
/* ✅ Flexbox 레이아웃 (권장) */
.container {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.row {
    display: flex;
    gap: 12px;
}

.item {
    flex: 1;
}

/* ❌ Grid 레이아웃 (지양) */
.container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-areas: "header header header";
}

/* ❌ absolute 레이아웃 (지양) */
.container {
    position: absolute;
    inset: 0;
}
```

**이유:**
- Grid는 옵션이 복잡하여 적용 난이도가 높음
- absolute는 레이아웃 흐름을 벗어나 유지보수가 어려움
- Flexbox는 직관적이고 예측 가능한 레이아웃 제공

**Flexbox 핵심 패턴:**
```css
/* 수직 레이아웃 */
.vertical { display: flex; flex-direction: column; }

/* 수평 레이아웃 */
.horizontal { display: flex; flex-direction: row; }

/* 균등 분배 */
.equal-items > * { flex: 1; }

/* 고정 + 가변 */
.fixed-header { flex-shrink: 0; }
.flexible-content { flex: 1; min-height: 0; }
```

**absolute 허용 케이스**:
- 팝업 오버레이 (`.popup-overlay`)
- 배경 레이어 (`z-index: 0`으로 분리)
- 닫기 버튼 위치
- 아이콘 내부 장식 요소

---

## fx.js 라이브러리

fx.js는 `/RNBT_architecture/Utils/fx.js`에 위치합니다.

**주요 함수:**
- `fx.go` - 파이프라인 실행
- `fx.pipe` - 파이프라인 함수 생성
- `fx.map` - 변환
- `fx.filter` - 필터링
- `fx.reduce` - 축약
- `fx.each` - 순회 (부수효과)
- `fx.find` - 검색
- `fx.take` - N개 추출
