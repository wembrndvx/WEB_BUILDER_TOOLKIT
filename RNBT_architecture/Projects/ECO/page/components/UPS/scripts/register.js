/**
 * UPS - 3D Popup Component
 *
 * UPS(무정전전원장치) 컴포넌트
 * - 실시간 3상 전력/배터리/상태 표시 (metricLatest API)
 * - 자산 속성 정보 (assetDetailUnified API)
 * - 전력 히스토리 차트 (추후)
 */

const { bind3DEvents, fetchData } = Wkit;
const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;

const BASE_URL = 'http://10.23.128.125:4004';

// ======================
// TEMPLATE HELPER
// ======================
function extractTemplate(htmlCode, templateId) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlCode, 'text/html');
  const template = doc.querySelector(`template#${templateId}`);
  return template?.innerHTML || '';
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ======================
// METRIC CONFIG (metricConfig.json 인라인)
// ======================
const METRIC_CONFIG = {
  'UPS.INPUT_V_1': { label: '입력전압 R', valueType: 'NUMBER', unit: 'V', scale: 0.1 },
  'UPS.INPUT_V_2': { label: '입력전압 S', valueType: 'NUMBER', unit: 'V', scale: 0.1 },
  'UPS.INPUT_V_3': { label: '입력전압 T', valueType: 'NUMBER', unit: 'V', scale: 0.1 },
  'UPS.INPUT_F_1': { label: '입력주파수 R', valueType: 'NUMBER', unit: 'Hz', scale: 0.1 },
  'UPS.INPUT_F_2': { label: '입력주파수 S', valueType: 'NUMBER', unit: 'Hz', scale: 0.1 },
  'UPS.INPUT_F_3': { label: '입력주파수 T', valueType: 'NUMBER', unit: 'Hz', scale: 0.1 },
  'UPS.INPUT_A_1': { label: '입력전류 R', valueType: 'NUMBER', unit: 'A', scale: 0.1 },
  'UPS.INPUT_A_2': { label: '입력전류 S', valueType: 'NUMBER', unit: 'A', scale: 0.1 },
  'UPS.INPUT_A_3': { label: '입력전류 T', valueType: 'NUMBER', unit: 'A', scale: 0.1 },
  'UPS.OUTPUT_V_1': { label: '출력전압 R', valueType: 'NUMBER', unit: 'V', scale: 0.1 },
  'UPS.OUTPUT_V_2': { label: '출력전압 S', valueType: 'NUMBER', unit: 'V', scale: 0.1 },
  'UPS.OUTPUT_V_3': { label: '출력전압 T', valueType: 'NUMBER', unit: 'V', scale: 0.1 },
  'UPS.OUTPUT_F_1': { label: '출력주파수 R', valueType: 'NUMBER', unit: 'Hz', scale: 0.1 },
  'UPS.OUTPUT_F_2': { label: '출력주파수 S', valueType: 'NUMBER', unit: 'Hz', scale: 0.1 },
  'UPS.OUTPUT_F_3': { label: '출력주파수 T', valueType: 'NUMBER', unit: 'Hz', scale: 0.1 },
  'UPS.OUTPUT_A_1': { label: '출력전류 R', valueType: 'NUMBER', unit: 'A', scale: 0.1 },
  'UPS.OUTPUT_A_2': { label: '출력전류 S', valueType: 'NUMBER', unit: 'A', scale: 0.1 },
  'UPS.OUTPUT_A_3': { label: '출력전류 T', valueType: 'NUMBER', unit: 'A', scale: 0.1 },
  'UPS.BATT_V': { label: '배터리전압', valueType: 'NUMBER', unit: 'V', scale: 0.1 },
  'UPS.BATT_A': { label: '배터리전류', valueType: 'NUMBER', unit: 'A', scale: 0.1 },
  'UPS.INPUT_BAD_STATE': { label: '입력전력이상', valueType: 'BOOL', unit: '', scale: 1.0 },
  'UPS.BATT_CHARGING': { label: '배터리충전중', valueType: 'BOOL', unit: '', scale: 1.0 },
  'UPS.OUTPUT_ON_BATTERY': { label: '배터리출력중', valueType: 'BOOL', unit: '', scale: 1.0 },
  'UPS.INVERTER_OFF': { label: '인버터정지', valueType: 'BOOL', unit: '', scale: 1.0 },
  'UPS.ON_BYPASS': { label: '바이패스운전', valueType: 'BOOL', unit: '', scale: 1.0 },
  'UPS.BATT_FAULT': { label: '배터리Fault', valueType: 'BOOL', unit: '', scale: 1.0 },
  'UPS.OUTPUT_OVERLOAD': { label: '출력과부하', valueType: 'BOOL', unit: '', scale: 1.0 },
};

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. 데이터 정의 (동적 assetKey 지원)
  // ======================
  this._defaultAssetKey = this.setter?.assetInfo?.assetKey || this.id;

  // 데이터셋 정의: 2개 API 병렬 호출
  this.datasetInfo = [
    { datasetName: 'assetDetailUnified', render: ['renderAssetInfo', 'renderProperties'] },
    { datasetName: 'metricLatest', render: ['renderMetrics'] },
    // { datasetName: 'upsHistory', render: ['renderChart'] },   // 차트 (추후 활성화)
  ];

  // ======================
  // 2. 변환 함수 바인딩
  // ======================
  this.statusTypeToLabel = statusTypeToLabel.bind(this);
  this.statusTypeToDataAttr = statusTypeToDataAttr.bind(this);
  this.formatDate = formatDate.bind(this);
  this.formatTimestamp = formatTimestamp.bind(this);

  // ======================
  // 3. Data Config
  // ======================
  this.baseInfoConfig = [
    { key: 'name', selector: '.ups-name' },
    { key: 'locationLabel', selector: '.ups-zone' },
    { key: 'statusType', selector: '.ups-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.ups-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
  ];

  // 컨테이너 selector
  this.metricsContainerSelector = '.metrics-container';
  this.propertiesContainerSelector = '.properties-container';
  this.timestampSelector = '.section-timestamp';

  // Metric Config 참조
  this.metricConfig = METRIC_CONFIG;

  // Section Titles
  this.sectionTitles = {
    '.metrics-section .section-title': '실시간 측정값',
    '.properties-section .section-title': '속성 정보',
    '.chart-section .section-title': '히스토리',
  };

  // chartConfig: 차트 렌더링 설정
  this.chartConfig = {
    xKey: 'timestamps',
    styleMap: {
      load: { label: '부하율', unit: '%', color: '#3b82f6', smooth: true, areaStyle: true },
      battery: { label: '배터리', unit: '%', color: '#22c55e', smooth: true },
    },
    optionBuilder: getMultiLineChartOption,
  };

  // ======================
  // 4. 렌더링 함수 바인딩
  // ======================
  this.renderAssetInfo = renderAssetInfo.bind(this);
  this.renderProperties = renderProperties.bind(this);
  this.renderMetrics = renderMetrics.bind(this);
  this.renderChart = renderChart.bind(this, this.chartConfig);
  this.renderError = renderError.bind(this);

  // ======================
  // 5. Refresh Config
  // ======================
  this.refreshInterval = 5000;
  this._refreshIntervalId = null;

  // ======================
  // 6. Public Methods
  // ======================
  this.showDetail = showDetail.bind(this);
  this.hideDetail = hideDetail.bind(this);
  this.refreshMetrics = refreshMetrics.bind(this);
  this.stopRefresh = stopRefresh.bind(this);

  // ======================
  // 7. 이벤트 발행
  // ======================
  this.customEvents = {
    click: '@assetClicked',
  };

  bind3DEvents(this, this.customEvents);

  // ======================
  // 8. Template Config
  // ======================
  this.templateConfig = {
    popup: 'popup-ups',
  };

  // ======================
  // 9. Popup (template 기반)
  // ======================
  this.popupCreatedConfig = {
    chartSelector: '.chart-container',
    events: {
      click: {
        '.close-btn': () => this.hideDetail(),
      },
    },
  };

  const { htmlCode, cssCode } = this.properties.publishCode || {};
  this.getPopupHTML = () => extractTemplate(htmlCode || '', this.templateConfig.popup);
  this.getPopupStyles = () => cssCode || '';
  this.onPopupCreated = onPopupCreated.bind(this, this.popupCreatedConfig);

  applyShadowPopupMixin(this, {
    getHTML: this.getPopupHTML,
    getStyles: this.getPopupStyles,
    onCreated: this.onPopupCreated,
  });

  applyEChartsMixin(this);

  console.log('[UPS] Registered:', this._defaultAssetKey);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail() {
  this.showPopup();
  fx.go(
    this.datasetInfo,
    fx.each(({ datasetName, render }) =>
      fx.go(
        fetchData(this.page, datasetName, { baseUrl: BASE_URL, assetKey: this._defaultAssetKey, locale: 'ko' }),
        (response) => {
          if (!response || !response.response) {
            this.renderError('데이터를 불러올 수 없습니다.');
            return;
          }
          const data = response.response.data;
          if (data === null || data === undefined) {
            this.renderError('자산 정보가 존재하지 않습니다.');
            return;
          }
          fx.each((fn) => this[fn](response), render);
        }
      )
    )
  ).catch((e) => {
    console.error('[UPS]', e);
    this.renderError('데이터 로드 중 오류가 발생했습니다.');
  });

  // 5초 주기로 메트릭 갱신 시작
  this.stopRefresh();
  this._refreshIntervalId = setInterval(() => this.refreshMetrics(), this.refreshInterval);
  console.log('[UPS] Metric refresh started (5s interval)');
}

function hideDetail() {
  this.stopRefresh();
  this.hidePopup();
}

function refreshMetrics() {
  fx.go(
    fetchData(this.page, 'metricLatest', { baseUrl: BASE_URL, assetKey: this._defaultAssetKey }),
    (response) => {
      if (!response || !response.response) return;
      const data = response.response.data;
      if (data === null || data === undefined) return;
      this.renderMetrics(response);
    }
  ).catch((e) => {
    console.warn('[UPS] Metric refresh failed:', e);
  });
}

function stopRefresh() {
  if (this._refreshIntervalId) {
    clearInterval(this._refreshIntervalId);
    this._refreshIntervalId = null;
    console.log('[UPS] Metric refresh stopped');
  }
}

// ======================
// RENDER FUNCTIONS
// ======================

function renderAssetInfo({ response }) {
  const { data } = response;
  if (!data || !data.asset) {
    renderError.call(this, '자산 데이터가 없습니다.');
    return;
  }

  const asset = data.asset;

  fx.go(
    this.baseInfoConfig,
    fx.each(({ key, selector, dataAttr, transform }) => {
      const el = this.popupQuery(selector);
      if (!el) return;
      let value = asset[key];
      if (transform) value = transform(value);
      if (dataAttr) {
        el.dataset[dataAttr] = value;
      } else {
        el.textContent = value;
      }
    })
  );
}

function renderMetrics({ response }) {
  const { data } = response;
  const container = this.popupQuery(this.metricsContainerSelector);
  const timestampEl = this.popupQuery(this.timestampSelector);

  if (!container) return;

  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div class="empty-state">측정 데이터가 없습니다</div>';
    return;
  }

  if (timestampEl && data[0]?.eventedAt) {
    timestampEl.textContent = this.formatTimestamp(data[0].eventedAt);
  }

  container.innerHTML = data
    .map((metric) => {
      const config = this.metricConfig[metric.metricCode];
      if (!config) return '';

      if (config.valueType === 'BOOL') {
        const isOn = metric.valueBool;
        return `
          <div class="metric-card metric-bool ${isOn ? 'bool-on' : 'bool-off'}">
            <div class="metric-label">${config.label}</div>
            <div class="metric-value-bool">${isOn ? 'ON' : 'OFF'}</div>
          </div>
        `;
      }

      const value = metric.valueNumber;
      const displayValue = config.scale ? (value * config.scale).toFixed(1) : value;
      return `
        <div class="metric-card">
          <div class="metric-label">${config.label}</div>
          <div class="metric-value">${displayValue}<span class="metric-unit">${config.unit}</span></div>
        </div>
      `;
    })
    .join('');
}

function renderProperties({ response }) {
  const { data } = response;
  const container = this.popupQuery(this.propertiesContainerSelector);

  if (!container) return;

  if (!data?.properties || data.properties.length === 0) {
    container.innerHTML = '<div class="empty-state">속성 정보가 없습니다</div>';
    return;
  }

  const sortedProperties = [...data.properties].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  container.innerHTML = sortedProperties
    .map(({ label, value, helpText }) => {
      return `
        <div class="property-card" title="${helpText || ''}">
          <div class="property-label">${label}</div>
          <div class="property-value">${value ?? '-'}</div>
        </div>
      `;
    })
    .join('');
}

function renderError(message) {
  const nameEl = this.popupQuery('.ups-name');
  const zoneEl = this.popupQuery('.ups-zone');
  const statusEl = this.popupQuery('.ups-status');

  if (nameEl) nameEl.textContent = '데이터 없음';
  if (zoneEl) zoneEl.textContent = message;
  if (statusEl) {
    statusEl.textContent = 'Error';
    statusEl.dataset.status = 'critical';
  }

  const metricsContainer = this.popupQuery(this.metricsContainerSelector);
  if (metricsContainer) {
    metricsContainer.innerHTML = `<div class="error-state">${message}</div>`;
  }

  console.warn('[UPS] renderError:', message);
}

function renderChart(config, { response }) {
  const { data } = response;
  if (!data) {
    console.warn('[UPS] renderChart: data is null');
    return;
  }
  if (!data[config.xKey]) {
    console.warn('[UPS] renderChart: chart data is incomplete');
    return;
  }
  const { optionBuilder, ...chartConfig } = config;
  const option = optionBuilder(chartConfig, data);
  this.updateChart('.chart-container', option);
}

// ======================
// TRANSFORM FUNCTIONS
// ======================

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

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatTimestamp(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

// ======================
// CHART OPTION BUILDER
// ======================

function getMultiLineChartOption(config, data) {
  const { xKey, styleMap } = config;

  const seriesData = Object.entries(styleMap).map(([key, style]) => ({
    key,
    name: style.label,
    unit: style.unit,
    color: style.color,
    smooth: style.smooth,
    areaStyle: style.areaStyle,
  }));

  return {
    grid: { left: 45, right: 16, top: 30, bottom: 24 },
    legend: {
      data: seriesData.map((s) => s.name),
      top: 0,
      textStyle: { color: '#8892a0', fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1a1f2e',
      borderColor: '#2a3142',
      textStyle: { color: '#e0e6ed', fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: data[xKey],
      axisLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLine: { show: false },
      axisLabel: { color: '#888', fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#333' } },
    },
    series: seriesData.map(({ key, name, color, smooth, areaStyle }) => ({
      name,
      type: 'line',
      data: data[key],
      smooth,
      symbol: 'none',
      lineStyle: { color, width: 2 },
      areaStyle: areaStyle
        ? {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: hexToRgba(color, 0.3) },
                { offset: 1, color: hexToRgba(color, 0) },
              ],
            },
          }
        : null,
    })),
  };
}

// ======================
// POPUP LIFECYCLE
// ======================

function onPopupCreated({ chartSelector, events }) {
  applySectionTitles.call(this);
  chartSelector && this.createChart(chartSelector);
  events && this.bindPopupEvents(events);
}

function applySectionTitles() {
  if (!this.sectionTitles) return;
  Object.entries(this.sectionTitles).forEach(([selector, title]) => {
    const el = this.popupQuery(selector);
    if (el) el.textContent = title;
  });
}
