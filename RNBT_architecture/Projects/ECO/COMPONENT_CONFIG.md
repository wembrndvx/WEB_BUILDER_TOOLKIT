# ECO 컴포넌트 Config 명세

## 개요

ECO 프로젝트의 3D 팝업 컴포넌트들은 설정(Config)을 통해 API 응답과 UI를 매핑합니다. 이 문서는 **하드코딩으로 오인할 수 있는 config**에 대해 설명합니다.

---

## Config 구조 (공통)

```
┌─────────────────────────────────────────────────────────────────┐
│  Component Config                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  datasetInfo          API 호출 ↔ 렌더링 함수 매핑               │
│  baseInfoConfig       헤더 영역 (asset 객체 → UI selector)      │
│  fieldsContainerSelector  동적 필드 컨테이너                    │
│  chartConfig          차트 렌더링 설정                          │
│  tableConfig          테이블 설정 (PDU 전용)                    │
│  templateConfig       팝업 템플릿 ID                            │
│  popupCreatedConfig   팝업 생성 후 초기화 설정                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 컴포넌트별 Config 비교

| Config | UPS | PDU | CRAC | TempHumiditySensor |
|--------|-----|-----|------|-------------------|
| **baseInfoConfig selector** | `.ups-*` | `.pdu-*` | `.crac-*` | `.sensor-*` |
| **fieldsContainerSelector** | `.fields-container` | `.summary-bar` | `.fields-container` | `.fields-container` |
| **카드 클래스** | `.value-card` | `.summary-item` | `.value-card` | `.value-card` |
| **tableConfig** | - | ✅ 회로 테이블 | - | - |
| **탭 UI** | - | ✅ circuits/power | - | - |
| **chartConfig Y축** | 단일 | 이중 | 이중 | 이중 |
| **Mixin** | Shadow+ECharts | Shadow+ECharts+Tabulator | Shadow+ECharts | Shadow+ECharts |

---

## 1. baseInfoConfig

**역할**: API의 `asset` 객체 필드를 헤더 UI에 매핑

### 컴포넌트별 설정

```javascript
// UPS
this.baseInfoConfig = [
    { key: 'name', selector: '.ups-name' },
    { key: 'locationLabel', selector: '.ups-zone' },
    { key: 'statusType', selector: '.ups-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.ups-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
];

// PDU
this.baseInfoConfig = [
    { key: 'name', selector: '.pdu-name' },
    { key: 'locationLabel', selector: '.pdu-zone' },
    { key: 'statusType', selector: '.pdu-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.pdu-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
];

// CRAC
this.baseInfoConfig = [
    { key: 'name', selector: '.crac-name' },
    { key: 'locationLabel', selector: '.crac-zone' },
    { key: 'statusType', selector: '.crac-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.crac-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
];

// TempHumiditySensor
this.baseInfoConfig = [
    { key: 'name', selector: '.sensor-name' },
    { key: 'locationLabel', selector: '.sensor-zone' },
    { key: 'statusType', selector: '.sensor-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.sensor-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
];
```

### 왜 하드코딩인가?

```
┌─────────────────────────────────────────────────────────────────┐
│  하드코딩의 원인: UI Selector (HTML 템플릿 종속)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  component.html (팝업 HTML 구조)                                │
│  ┌─────────────────────────────────────────────┐               │
│  │  <div class="ups-name">...</div>            │ ← 고정        │
│  │  <div class="ups-zone">...</div>            │ ← 고정        │
│  │  <div class="ups-status">...</div>          │ ← 고정        │
│  └─────────────────────────────────────────────┘               │
│                    ↑                                            │
│                    │                                            │
│  baseInfoConfig    │                                            │
│  ┌─────────────────┴───────────────────────────┐               │
│  │  selector: '.ups-name'   ←── HTML에 종속     │               │
│  │  selector: '.ups-zone'   ←── HTML에 종속     │               │
│  │  selector: '.ups-status' ←── HTML에 종속     │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 항목 | 하드코딩 여부 | 이유 |
|------|--------------|------|
| `key` | O | API 표준 필드 (변경 빈도 낮음) |
| `selector` | **O (핵심)** | HTML 템플릿의 class명에 종속 |
| `transform` | O | 값 변환 로직은 컴포넌트별 고정 |

**핵심**: `selector`가 HTML 구조에 종속되어 있어 하드코딩이 불가피합니다.
HTML 템플릿의 class명이 바뀌면 이 config도 함께 수정해야 합니다.

---

## 2. fieldsContainerSelector

**역할**: 동적 프로퍼티가 렌더링될 컨테이너 지정

| 컴포넌트 | selector | 카드 클래스 |
|----------|----------|------------|
| UPS | `.fields-container` | `.value-card` |
| **PDU** | **`.summary-bar`** | **`.summary-item`** |
| CRAC | `.fields-container` | `.value-card` |
| TempHumiditySensor | `.fields-container` | `.value-card` |

**PDU만 다른 이유**: PDU는 Summary Bar 스타일의 수평 레이아웃 사용

```html
<!-- UPS/CRAC/TempHumiditySensor: .fields-container + .value-card -->
<div class="fields-container">
    <div class="value-card" title="정격 전력">
        <div class="value-label">정격 전력</div>
        <div class="value-data">75</div>
    </div>
</div>

<!-- PDU: .summary-bar + .summary-item -->
<div class="summary-bar">
    <div class="summary-item" title="총 전력">
        <span class="summary-label">총 전력</span>
        <span class="summary-value">24.5kW</span>
    </div>
</div>
```

---

## 3. chartConfig

**역할**: ECharts 차트 렌더링 설정

### 컴포넌트별 styleMap

`styleMap`은 시리즈별 **메타데이터(label, unit) + 스타일(color, smooth 등)**을 모두 포함합니다.

```javascript
// UPS - 단일 Y축 (%)
this.chartConfig = {
    xKey: 'timestamps',
    styleMap: {
        load: { label: '부하율', unit: '%', color: '#3b82f6', smooth: true, areaStyle: true },
        battery: { label: '배터리', unit: '%', color: '#22c55e', smooth: true },
    },
    optionBuilder: getMultiLineChartOption,
};

// PDU - 이중 Y축 (kW / A)
this.chartConfig = {
    xKey: 'timestamps',
    styleMap: {
        power: { label: '전력', unit: 'kW', color: '#3b82f6', smooth: true, areaStyle: true, yAxisIndex: 0 },
        current: { label: '전류', unit: 'A', color: '#f59e0b', smooth: true, yAxisIndex: 1 },
    },
    optionBuilder: getDualAxisChartOption,
};

// CRAC - 이중 Y축 (°C / %)
this.chartConfig = {
    xKey: 'timestamps',
    styleMap: {
        supplyTemp: { label: '공급 온도', unit: '°C', color: '#3b82f6', yAxisIndex: 0 },
        returnTemp: { label: '환기 온도', unit: '°C', color: '#ef4444', yAxisIndex: 0 },
        humidity: { label: '습도', unit: '%', color: '#22c55e', yAxisIndex: 1 },
    },
    optionBuilder: getDualAxisChartOption,
};

// TempHumiditySensor - 이중 Y축 (°C / %)
this.chartConfig = {
    xKey: 'timestamps',
    styleMap: {
        temperature: { label: '온도', unit: '°C', color: '#3b82f6', yAxisIndex: 0 },
        humidity: { label: '습도', unit: '%', color: '#22c55e', yAxisIndex: 1 },
    },
    optionBuilder: getDualAxisChartOption,
};
```

### styleMap 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `label` | string | O | UI에 표시할 시리즈 이름 |
| `unit` | string | O | 단위 (Y축 라벨, 툴팁에 사용) |
| `color` | string | O | 시리즈 색상 |
| `smooth` | boolean | X | 라인 스무딩 |
| `areaStyle` | boolean | X | 영역 채우기 |
| `yAxisIndex` | number | X | Y축 인덱스 (이중 Y축 시 사용, 기본값: 0) |

### styleMap 비교표

| 컴포넌트 | keys | Y축 | 특징 |
|----------|------|-----|------|
| UPS | `load`, `battery` | 단일 (%) | 부하율, 배터리 |
| PDU | `power`, `current` | 이중 (kW/A) | 전력, 전류 |
| CRAC | `supplyTemp`, `returnTemp`, `humidity` | 이중 (°C/%) | 온도 2개 + 습도 |
| TempHumiditySensor | `temperature`, `humidity` | 이중 (°C/%) | 온도, 습도 |

### 왜 하드코딩인가?

| 항목 | 하드코딩 여부 | 이유 |
|------|--------------|------|
| `xKey` | O | API 응답 구조에 종속 (X축 데이터 키) |
| `styleMap` keys | O | API 응답의 필드명에 종속 (시리즈 데이터 키) |
| `label`, `unit` | O | UI 표시 텍스트 (다국어 시 별도 처리 필요) |
| `color` | O | UI 디자인 결정 사항 |
| `yAxisIndex` | O | 차트 축 구성에 종속 |

---

## 4. tableConfig (PDU 전용)

**역할**: Tabulator 회로 테이블 설정

```javascript
this.tableConfig = {
    selector: '.table-container',
    columns: [
        { title: 'ID', field: 'id', widthGrow: 0.5, hozAlign: 'right' },
        { title: 'Name', field: 'name', widthGrow: 2 },
        { title: 'Current', field: 'current', widthGrow: 1, hozAlign: 'right',
          formatter: (cell) => `${cell.getValue()}A` },
        { title: 'Power', field: 'power', widthGrow: 1, hozAlign: 'right',
          formatter: (cell) => `${cell.getValue()}kW` },
        { title: 'Status', field: 'status', widthGrow: 1, formatter: /* ... */ },
        { title: 'Breaker', field: 'breaker', widthGrow: 0.8, formatter: /* ... */ },
    ],
    optionBuilder: getTableOption,
};
```

### 왜 하드코딩인가?

| 항목 | 하드코딩 여부 | 이유 |
|------|--------------|------|
| `columns` | O | API 응답 필드 + UI 표현에 종속 |
| `title` | O | 테이블 헤더 텍스트 |
| `field` | O | API 응답의 필드명 |
| `formatter` | O | 단위 추가, 색상 등 UI 표현 |

---

## 5. 변환 함수 (공통)

모든 컴포넌트에서 동일하게 사용:

```javascript
// API statusType → UI 라벨
function statusTypeToLabel(statusType) {
    const labels = {
        ACTIVE: 'Normal',
        WARNING: 'Warning',
        CRITICAL: 'Critical',
        INACTIVE: 'Inactive',
        MAINTENANCE: 'Maintenance',
    };
    return labels[statusType] || statusType;
}

// API statusType → CSS data attribute
function statusTypeToDataAttr(statusType) {
    const map = {
        ACTIVE: 'normal',
        WARNING: 'warning',
        CRITICAL: 'critical',
        INACTIVE: 'inactive',
        MAINTENANCE: 'maintenance',
    };
    return map[statusType] || 'normal';
}
```

---

## Config vs API 역할 분리

```
┌─────────────────────────────────────────────────────────────────┐
│  API 응답                     Config                   UI       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  asset.name ─────────────── baseInfoConfig ──────── .xxx-name   │
│  asset.locationLabel ─────── baseInfoConfig ──────── .xxx-zone  │
│  asset.statusType ────────── baseInfoConfig ──────── .xxx-status│
│                                                                 │
│  properties[] ───────────── (동적 렌더링) ──────── fieldsContainer│
│                                                                 │
│  history data ──────────── chartConfig ──────────── .chart-container │
│  circuits data ─────────── tableConfig ──────────── .table-container │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 참고

- [API_SPEC.md](./API_SPEC.md) - API 명세
- 각 컴포넌트 codeflow.md - 코드 실행 흐름

---

*최종 업데이트: 2026-01-27*
