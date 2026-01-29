/*
 * PDU - 3D Popup Component (Tabbed UI)
 *
 * PDU(분전반) 컴포넌트
 * - 실시간 전력계측 표시 (metricLatest API, DIST.* 메트릭)
 * - 자산 속성 정보 (assetDetailUnified API)
 * - 회로 테이블 + 전력 히스토리 차트 (추후)
 */

const { bind3DEvents, fetchData } = Wkit;
const { applyShadowPopupMixin, applyEChartsMixin, applyTabulatorMixin } = PopupMixin;

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
// METRIC CONFIG (metricConfig.json 인라인 - DIST.*)
// ======================
const METRIC_CONFIG = {
  'DIST.V_LN_AVG': { label: '평균선간전압L-N', valueType: 'NUMBER', unit: 'V', scale: 1.0 },
  'DIST.V_LL_AVG': { label: '평균상간전압L-L', valueType: 'NUMBER', unit: 'V', scale: 1.0 },
  'DIST.V_FUND_AVG': { label: '기본파전압평균', valueType: 'NUMBER', unit: 'V', scale: 1.0 },
  'DIST.FREQUENCY_HZ': { label: '주파수', valueType: 'NUMBER', unit: 'Hz', scale: 1.0 },
  'DIST.TEMP_C': { label: '온도', valueType: 'NUMBER', unit: '°C', scale: 1.0 },
  'DIST.CURRENT_AVG_A': { label: '평균전류', valueType: 'NUMBER', unit: 'A', scale: 1.0 },
  'DIST.CURRENT_FUND_AVG_A': { label: '기본파전류평균', valueType: 'NUMBER', unit: 'A', scale: 1.0 },
  'DIST.ACTIVE_POWER_TOTAL_KW': { label: '유효전력합', valueType: 'NUMBER', unit: 'kW', scale: 1.0 },
  'DIST.REACTIVE_POWER_TOTAL_KVAR': { label: '무효전력합', valueType: 'NUMBER', unit: 'kVAR', scale: 1.0 },
  'DIST.APPARENT_POWER_TOTAL_KVA': { label: '피상전력합', valueType: 'NUMBER', unit: 'kVA', scale: 1.0 },
  'DIST.ACTIVE_ENERGY_RECEIVED_KWH': { label: '수전유효전력량', valueType: 'NUMBER', unit: 'kWh', scale: 1.0 },
  'DIST.ACTIVE_ENERGY_DELIVERED_KWH': { label: '송전유효전력량', valueType: 'NUMBER', unit: 'kWh', scale: 1.0 },
  'DIST.ACTIVE_ENERGY_SUM_KWH': { label: '유효전력량합', valueType: 'NUMBER', unit: 'kWh', scale: 1.0 },
  'DIST.REACTIVE_ENERGY_RECEIVED_KVARH': { label: '수전무효전력량', valueType: 'NUMBER', unit: 'kVARh', scale: 1.0 },
  'DIST.REACTIVE_ENERGY_DELIVERED_KVARH': { label: '송전무효전력량', valueType: 'NUMBER', unit: 'kVARh', scale: 1.0 },
  'DIST.REACTIVE_ENERGY_SUM_KVARH': { label: '무효전력량합', valueType: 'NUMBER', unit: 'kVARh', scale: 1.0 },
  'DIST.APPARENT_ENERGY_KVAH': { label: '피상전력량', valueType: 'NUMBER', unit: 'kVAh', scale: 1.0 },
  'DIST.POWER_FACTOR_TOTAL': { label: '역률합', valueType: 'NUMBER', unit: '', scale: 1.0 },
};

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. 데이터 정의 (동적 assetKey 지원)
  // ======================
  this._defaultAssetKey = this.setter?.assetInfo?.assetKey || this.id;

  // 데이터셋 정의
  this.datasetInfo = [
    { datasetName: 'assetDetailUnified', render: ['renderAssetInfo', 'renderProperties'] },
    { datasetName: 'metricLatest', render: ['renderMetrics'] },
    // { datasetName: 'pduCircuits', render: ['renderCircuitTable'] },
    // { datasetName: 'pduHistory', render: ['renderPowerChart'] },
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
    { key: 'name', selector: '.pdu-name' },
    { key: 'locationLabel', selector: '.pdu-zone' },
    { key: 'statusType', selector: '.pdu-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.pdu-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
  ];

  // 컨테이너 selector
  this.propertiesContainerSelector = '.properties-container';
  this.metricsContainerSelector = '.metrics-container';
  this.timestampSelector = '.section-timestamp';

  // Metric Config 참조
  this.metricConfig = METRIC_CONFIG;

  // Section Titles
  this.sectionTitles = {
    '.metrics-section .section-title': '실시간 전력계측',
    '.properties-section .section-title': '속성 정보',
  };

  // ======================
  // 4. Table Config
  // ======================
  this.tableConfig = {
    selector: '.table-container',
    columns: [
      { title: 'ID', field: 'id', widthGrow: 0.5, hozAlign: 'right' },
      { title: 'Name', field: 'name', widthGrow: 2 },
      { title: 'Current', field: 'current', widthGrow: 1, hozAlign: 'right', formatter: (cell) => `${cell.getValue()}A` },
      { title: 'Power', field: 'power', widthGrow: 1, hozAlign: 'right', formatter: (cell) => `${cell.getValue()}kW` },
      {
        title: 'Status', field: 'status', widthGrow: 1,
        formatter: (cell) => {
          const value = cell.getValue();
          const colors = { active: '#22c55e', inactive: '#8892a0' };
          return `<span style="color: ${colors[value] || '#8892a0'}">${value}</span>`;
        },
      },
      {
        title: 'Breaker', field: 'breaker', widthGrow: 0.8,
        formatter: (cell) => {
          const value = cell.getValue();
          const color = value === 'on' ? '#22c55e' : '#ef4444';
          return `<span style="color: ${color}">${value.toUpperCase()}</span>`;
        },
      },
    ],
    optionBuilder: getTableOption,
  };

  // ======================
  // 5. Chart Config
  // ======================
  this.chartConfig = {
    xKey: 'timestamps',
    styleMap: {
      power: { label: '전력', unit: 'kW', color: '#3b82f6', smooth: true, areaStyle: true, yAxisIndex: 0 },
      current: { label: '전류', unit: 'A', color: '#f59e0b', smooth: true, yAxisIndex: 1 },
    },
    optionBuilder: getDualAxisChartOption,
  };

  // ======================
  // 6. 렌더링 함수 바인딩
  // ======================
  this.renderAssetInfo = renderAssetInfo.bind(this);
  this.renderProperties = renderProperties.bind(this);
  this.renderMetrics = renderMetrics.bind(this);
  this.renderCircuitTable = renderCircuitTable.bind(this, this.tableConfig);
  this.renderPowerChart = renderPowerChart.bind(this, this.chartConfig);
  this.renderError = renderError.bind(this);

  // ======================
  // 7. Refresh Config
  // ======================
  this.refreshInterval = 5000;
  this._refreshIntervalId = null;

  // ======================
  // 8. Public Methods
  // ======================
  this.showDetail = showDetail.bind(this);
  this.hideDetail = hideDetail.bind(this);
  this.refreshMetrics = refreshMetrics.bind(this);
  this.stopRefresh = stopRefresh.bind(this);
  this._switchTab = switchTab.bind(this);

  // ======================
  // 9. 이벤트 발행
  // ======================
  this.customEvents = {
    click: '@assetClicked',
  };

  bind3DEvents(this, this.customEvents);

  // ======================
  // 10. Template Config
  // ======================
  this.templateConfig = {
    popup: 'popup-pdu',
  };

  this.popupCreatedConfig = {
    chartSelector: '.chart-container',
    tableSelector: '.table-container',
    events: {
      click: {
        '.close-btn': () => this.hideDetail(),
        '.tab-btn': (e) => this._switchTab(e.target.dataset.tab),
      },
    },
  };

  // ======================
  // 11. Popup Setup
  // ======================
  const { htmlCode, cssCode } = this.properties.publishCode || {};

  this.getPopupHTML = () => extractTemplate(htmlCode || '', this.templateConfig.popup);
  this.getPopupStyles = () => cssCode || '';
  this.onPopupCreated = onPopupCreated.bind(this, this.popupCreatedConfig, this.tableConfig);

  applyShadowPopupMixin(this, {
    getHTML: this.getPopupHTML,
    getStyles: this.getPopupStyles,
    onCreated: this.onPopupCreated,
  });

  applyEChartsMixin(this);
  applyTabulatorMixin(this);

  console.log('[PDU] Registered:', this._defaultAssetKey);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail() {
  this.showPopup();
  this._switchTab('circuits');

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
    console.error('[PDU]', e);
    this.renderError('데이터 로드 중 오류가 발생했습니다.');
  });

  // 5초 주기로 메트릭 갱신 시작
  this.stopRefresh();
  this._refreshIntervalId = setInterval(() => this.refreshMetrics(), this.refreshInterval);
  console.log('[PDU] Metric refresh started (5s interval)');
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
    console.warn('[PDU] Metric refresh failed:', e);
  });
}

function stopRefresh() {
  if (this._refreshIntervalId) {
    clearInterval(this._refreshIntervalId);
    this._refreshIntervalId = null;
    console.log('[PDU] Metric refresh stopped');
  }
}

function switchTab(tabName) {
  const buttons = this.popupQueryAll('.tab-btn');
  const panels = this.popupQueryAll('.tab-panel');

  fx.go(buttons, fx.each((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName)));
  fx.go(panels, fx.each((panel) => panel.classList.toggle('active', panel.dataset.panel === tabName)));

  if (tabName === 'power') {
    const chart = this.getChart('.chart-container');
    if (chart) setTimeout(() => chart.resize(), 10);
  } else if (tabName === 'circuits') {
    if (this.isTableReady('.table-container')) {
      const table = this.getTable('.table-container');
      setTimeout(() => table.redraw(true), 10);
    }
  }
}

// ======================
// POPUP CREATED
// ======================

function onPopupCreated(popupConfig, tableConfig) {
  applySectionTitles.call(this);
  const { chartSelector, tableSelector, events } = popupConfig;
  if (chartSelector) this.createChart(chartSelector);
  if (tableSelector) {
    const tableOptions = tableConfig.optionBuilder(tableConfig.columns);
    this.createTable(tableSelector, tableOptions);
  }
  if (events) this.bindPopupEvents(events);
}

function applySectionTitles() {
  if (!this.sectionTitles) return;
  Object.entries(this.sectionTitles).forEach(([selector, title]) => {
    const el = this.popupQuery(selector);
    if (el) el.textContent = title;
  });
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
      return `<div class="property-card" title="${helpText || ''}">
        <div class="property-label">${label}</div>
        <div class="property-value">${value ?? '-'}</div>
      </div>`;
    })
    .join('');
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

      const value = metric.valueNumber;
      const displayValue = config.scale && config.scale !== 1.0 ? (value * config.scale).toFixed(1) : value;
      return `
        <div class="metric-card">
          <div class="metric-label">${config.label}</div>
          <div class="metric-value">${displayValue}<span class="metric-unit">${config.unit}</span></div>
        </div>
      `;
    })
    .join('');
}

function renderError(message) {
  const nameEl = this.popupQuery('.pdu-name');
  const zoneEl = this.popupQuery('.pdu-zone');
  const statusEl = this.popupQuery('.pdu-status');

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

  console.warn('[PDU] renderError:', message);
}

function renderCircuitTable(config, { response }) {
  const { data } = response;
  if (!data) {
    console.warn('[PDU] renderCircuitTable: data is null');
    return;
  }
  const circuits = data.circuits || data;
  this.updateTable(config.selector, circuits);
}

function renderPowerChart(config, { response }) {
  const { data } = response;
  if (!data) {
    console.warn('[PDU] renderPowerChart: data is null');
    return;
  }
  if (!data[config.xKey]) {
    console.warn('[PDU] renderPowerChart: chart data is incomplete');
    return;
  }
  const option = config.optionBuilder(config, data);
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
// TABLE OPTION BUILDER
// ======================

function getTableOption(columns) {
  return {
    layout: 'fitColumns',
    responsiveLayout: 'collapse',
    placeholder: 'No circuits found',
    initialSort: [{ column: 'power', dir: 'desc' }],
    columns,
  };
}

// ======================
// CHART OPTION BUILDER
// ======================

function getDualAxisChartOption(config, data) {
  const { xKey, styleMap } = config;

  const seriesData = Object.entries(styleMap).map(([key, style]) => ({
    key,
    name: style.label,
    unit: style.unit,
    color: style.color,
    smooth: style.smooth,
    areaStyle: style.areaStyle,
    yAxisIndex: style.yAxisIndex,
  }));

  const yAxisUnits = [...new Set(seriesData.map((s) => s.unit))];
  const yAxes = yAxisUnits.map((unit, idx) => ({
    type: 'value',
    name: unit,
    position: idx === 0 ? 'left' : 'right',
    axisLine: { show: true, lineStyle: { color: seriesData.find((s) => s.unit === unit)?.color || '#888' } },
    axisLabel: { color: '#888', fontSize: 10 },
    splitLine: idx === 0 ? { lineStyle: { color: '#333' } } : { show: false },
  }));

  return {
    grid: { left: 50, right: 50, top: 35, bottom: 24 },
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
    yAxis: yAxes,
    series: seriesData.map(({ key, name, color, smooth, areaStyle, yAxisIndex = 0 }) => ({
      name,
      type: 'line',
      yAxisIndex,
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
