/**
 * 横断面设计 v3.0 — 主控制器
 */
(function() {
  'use strict';

  // ===== DOM 引用 =====
  const $ = id => document.getElementById(id);
  const canvas = $('main-canvas');
  const container = $('canvas-container');
  const loading = $('loading-overlay');

  // ===== 状态 =====
  let model = null;
  let renderer = null;
  let selectedIdx = -1;
  let prevSelectedIdx = -1;
  let isDragging = false;
  let isPanning = false;
  let dragStart = null;
  let panStart = null;
  let panRAF = null;
  let currentGrade = 2;

  // ===== 初始化 =====
  function init() {
    try {
      renderer = new CrossSectionRenderer(canvas);
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      
      // 生成默认断面
      onGenerate();
      
      // 事件绑定
      bindToolbarEvents();
      bindCanvasEvents();
      bindBottomToolbar();
    } catch(e) {
      console.error('初始化失败:', e);
      loading.style.display = 'none';
    }
  }

  function resizeCanvas() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = w;
    canvas.height = h;
    if (model) requestAnimationFrame(draw);
  }

  let drawPending = false;
  // ===== 绘制 =====
  async function draw() {
    if (drawPending) return;
    drawPending = true;
    loading.style.display = 'flex';
    try {
      await renderer.draw(model, { scale: renderer.scale, offsetX: renderer.offsetX, offsetY: renderer.offsetY });
      updateInfo();
    } catch(e) {
      console.error('绘制错误:', e);
    }
    loading.style.display = 'none';
    drawPending = false;
  }

  function updateInfo() {
    $('info-total-width').textContent = model.totalWidth.toFixed(2) + 'm';
    $('info-lane-count').textContent = model.totalLaneCount || '--';
    $('info-redline').textContent = (model.redLineWidth || '--') + 'm';
    $('status-zoom').textContent = Math.round(renderer.scale * 100) + '%';
    
    // 更新元素列表
    const list = $('element-list');
    list.innerHTML = model.EleList.map((el, i) => {
      const name = el.EleTypeName || '未知';
      return `<div class="elem-item${i===selectedIdx?' selected':''}" data-idx="${i}">${name} ${el.EleWidth.toFixed(2)}m</div>`;
    }).join('');
    
    // 列表点击
    list.querySelectorAll('.elem-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx);
        selectElement(idx);
      });
    });
    
    // 更新属性面板
    updatePropPanel();
  }

  // ===== 断面生成 =====
  function onGenerate() {
    const grade = parseInt($('sel-grade').value);
    currentGrade = grade;
    model = RoadSectionModel.createFromGrade(grade);
    model.redLineWidth = parseFloat($('input-redline').value) || 40;
    
    selectedIdx = -1;
    $('right-panel').style.display = 'none';
    $('btn-delete').disabled = true;
    fitToScreen();
    draw();
  }

  function fitToScreen() {
    const roadW = isFinite(model.totalWidth) && model.totalWidth > 0 ? model.totalWidth : 40;
    const roadPx = roadW * CFG.SCALE;
    const totalW = roadPx + CFG.SIDE_WIDTH * 2 + CFG.PADDING * 2;
    const totalH = CFG.ROAD_Y + CFG.BASE_EXTRA + CFG.PADDING;

    const cw = container.clientWidth || 800;
    const ch = container.clientHeight || 600;

    const fitScale = Math.min(
      cw / totalW,
      ch / totalH,
      1.5
    ) * 0.85;

    renderer.scale = Math.max(0.2, Math.min(fitScale, 2.0));
    renderer.offsetX = (cw - totalW * renderer.scale) / 2;
    renderer.offsetY = (ch - totalH * renderer.scale) / 2;
  }

  // ===== 元素操作 =====
  function addElement(type, userDefineType) {
    const el = RoadSectionModel.createElement(type, userDefineType);
    if (!el) return;
    
    const insertAt = selectedIdx >= 0 ? selectedIdx + 1 : model.EleList.length;
    model.EleList.splice(insertAt, 0, el);
    model.recalc();
    
    if (selectedIdx >= 0) selectElement(insertAt);
    draw();
  }

  function deleteElement(index) {
    if (index < 0 || index >= model.EleList.length) return;
    model.EleList.splice(index, 1);
    model.recalc();
    selectElement(-1);
    draw();
  }

  function updateElementProp(index, prop, value) {
    if (index < 0 || index >= model.EleList.length) return;
    const el = model.EleList[index];
    
    // 映射简化属性名到真实属性名
    const propMap = {
      width: 'EleWidth',
      height: 'EleHeight',
      surfaceType: 'SurfaceStyleIndex',
      direction: 'Direction',
      arrowDirection: 'ArrowDirection',
      isoType: '_isoBeltType',
      hasBarrier: '_hasBarrier',
      hasTree: '_hasTree',
      userDefineType: '_userDefineType',
      turnCount: null
    };
    
    if (prop === 'turnCount') {
      if (el instanceof VehicleElement) {
        if (el.Direction === 'In') model.RoadInputPara.InLaneNo = Math.max(1, value);
        else model.RoadInputPara.OutLaneNo = Math.max(1, value);
        model.RoadInputPara.LaneNo = model.RoadInputPara.InLaneNo + model.RoadInputPara.OutLaneNo;
      }
    } else if (prop === 'isoType') {
      el._isoBeltType = value;
      el._eleType = value;
      el.InitAttachmentsByWidth();
    } else {
      const realProp = propMap[prop] || prop;
      el[realProp] = value;
    }
    
    model.recalc();
    draw();
  }

  function selectElement(index) {
    prevSelectedIdx = selectedIdx;
    selectedIdx = index;
    $('btn-delete').disabled = index < 0;
    
    if (index >= 0) {
      $('right-panel').style.display = 'block';
    } else {
      $('right-panel').style.display = 'none';
    }
    
    updateInfo();
  }

  function updatePropPanel() {
    if (selectedIdx < 0) return;
    const el = model.EleList[selectedIdx];
    const pc = $('prop-content');
    const typeName = el.EleTypeName || '未知';
    
    let html = `
      <div class="prop-row"><span class="prop-label">类型</span><span style="color:#e0e0e0">${typeName}</span></div>
      <div class="prop-row">
        <span class="prop-label">宽度(m)</span>
        <input class="prop-input prop-input-sm" type="number" value="${el.EleWidth}" step="0.25" min="0.5" 
          onchange="window._updateProp('width', parseFloat(this.value))">
      </div>
      <div class="prop-row">
        <span class="prop-label">高度(m)</span>
        <input class="prop-input prop-input-sm" type="number" value="${el.EleHeight}" step="0.1" min="-15" max="15"
          onchange="window._updateProp('height', parseFloat(this.value))">
      </div>
      <div class="prop-row">
        <span class="prop-label">地表样式</span>
        <select class="prop-select" onchange="window._updateProp('surfaceType', parseInt(this.value))">
          <option value="0" ${(el.SurfaceStyleIndex)===0?'selected':''}>沥青深色</option>
          <option value="1" ${el.SurfaceStyleIndex===1?'selected':''}>沥青红色</option>
          <option value="2" ${el.SurfaceStyleIndex===2?'selected':''}>沥青绿色</option>
          <option value="3" ${el.SurfaceStyleIndex===3?'selected':''}>灰色砖</option>
          <option value="4" ${el.SurfaceStyleIndex===4?'selected':''}>红色砖</option>
          <option value="5" ${el.SurfaceStyleIndex===5?'selected':''}>水泥</option>
          <option value="7" ${el.SurfaceStyleIndex===7?'selected':''}>泥土</option>
          <option value="8" ${el.SurfaceStyleIndex===8?'selected':''}>木纹</option>
        </select>
      </div>
    `;
    
    if (el instanceof VehicleElement) {
      const laneCount = el.Direction === 'In' ? model.RoadInputPara.InLaneNo : model.RoadInputPara.OutLaneNo;
      html += `
        <div class="prop-row">
          <span class="prop-label">车道数</span>
          <input class="prop-input prop-input-sm" type="number" value="${laneCount}" step="1" min="1" max="8"
            onchange="window._updateProp('turnCount', parseInt(this.value))">
        </div>
        <div class="prop-row">
          <span class="prop-label">方向</span>
          <select class="prop-select" onchange="window._updateProp('direction', this.value)">
            <option value="Out" ${el.Direction==='Out'?'selected':''}>出口道</option>
            <option value="In" ${el.Direction==='In'?'selected':''}>进口道</option>
          </select>
        </div>
        <div class="prop-row">
          <span class="prop-label">箭头方向</span>
          <select class="prop-select" onchange="window._updateProp('arrowDirection', this.value)">
            <option value="S" ${el.ArrowDirection==='S'?'selected':''}>直行 S</option>
            <option value="L" ${el.ArrowDirection==='L'?'selected':''}>左转 L</option>
            <option value="R" ${el.ArrowDirection==='R'?'selected':''}>右转 R</option>
            <option value="U" ${el.ArrowDirection==='U'?'selected':''}>掉头 U</option>
            <option value="LS" ${el.ArrowDirection==='LS'?'selected':''}>左直 LS</option>
            <option value="LR" ${el.ArrowDirection==='LR'?'selected':''}>左右 LR</option>
            <option value="SR" ${el.ArrowDirection==='SR'?'selected':''}>直右 SR</option>
          </select>
        </div>
      `;
    }
    
    if (el instanceof IsoBeltElement) {
      html += `
        <div class="prop-row">
          <span class="prop-label">隔离类型</span>
          <select class="prop-select" onchange="window._updateProp('isoType', parseInt(this.value))">
            <option value="11" ${el.IsoBeltType===11?'selected':''}>中央隔离</option>
            <option value="12" ${el.IsoBeltType===12?'selected':''}>同向隔离</option>
            <option value="13" ${el.IsoBeltType===13?'selected':''}>机非隔离</option>
            <option value="14" ${el.IsoBeltType===14?'selected':''}>慢行隔离</option>
            <option value="15" ${el.IsoBeltType===15?'selected':''}>人机隔离</option>
          </select>
        </div>
        <div class="prop-row">
          <span class="prop-label"><input class="prop-check" type="checkbox" ${el.HasBarrier?'checked':''} 
            onchange="window._updateProp('hasBarrier', this.checked)"> 防护栏</span>
        </div>
        <div class="prop-row">
          <span class="prop-label"><input class="prop-check" type="checkbox" ${el.HasTree?'checked':''} 
            onchange="window._updateProp('hasTree', this.checked)"> 乔木</span>
        </div>
      `;
    }
    
    if (el instanceof UserDefineElement) {
      html += `
        <div class="prop-row">
          <span class="prop-label">自定义类型</span>
          <select class="prop-select" onchange="window._updateProp('userDefineType', this.value)">
            <option value="Overpass" ${el.UserDefineType==='Overpass'?'selected':''}>高架</option>
            <option value="Water" ${el.UserDefineType==='Water'?'selected':''}>河流</option>
            <option value="ParkLane" ${el.UserDefineType==='ParkLane'?'selected':''}>停车带</option>
            <option value="URoadface" ${el.UserDefineType==='URoadface'?'selected':''}>自定义路面</option>
          </select>
        </div>
      `;
    }
    
    pc.innerHTML = html;
    
    window._updateProp = (prop, value) => {
      updateElementProp(selectedIdx, prop, value);
    };
    window._changeTurn = (idx, value) => {
      const cel = model.EleList[selectedIdx];
      if (cel && cel.ArrowDirection !== undefined) {
        cel.ArrowDirection = value;
        model.recalc();
        draw();
      }
    };
  }

  // ===== 工具栏事件 =====
  function bindToolbarEvents() {
    $('btn-generate').addEventListener('click', () => {
      model.redLineWidth = parseFloat($('input-redline').value) || 40;
      onGenerate();
    });
    $('btn-recalc').addEventListener('click', () => {
      model.redLineWidth = parseFloat($('input-redline').value) || 40;
      model.recalc();
      draw();
    });
    $('btn-center').addEventListener('click', fitToScreen);
    
    $('sel-grade').addEventListener('change', () => {
      model.redLineWidth = parseFloat($('input-redline').value) || 40;
      onGenerate();
    });
    
    $('sel-style').addEventListener('change', () => {
      const v = parseInt($('sel-style').value);
      renderer.styleId = v;
      draw();
    });
    
    $('input-redline').addEventListener('change', () => {
      model.redLineWidth = parseFloat($('input-redline').value) || 40;
      draw();
    });
    
    // 新建
    $('btn-new').addEventListener('click', () => {
      if (confirm('确定新建断面？当前未保存的内容将丢失。')) {
        model = new RoadSectionModel();
        model.redLineWidth = parseFloat($('input-redline').value) || 40;
        selectElement(-1);
        fitToScreen();
        draw();
      }
    });
    
    // 保存JSON
    $('btn-save').addEventListener('click', () => {
      const json = JSON.stringify(model.toJSON(), null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cross_section.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    
    // 打开JSON
    $('btn-open').addEventListener('click', () => $('file-open').click());
    $('file-open').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          model = RoadSectionModel.fromJSON(data);
          selectElement(-1);
          fitToScreen();
          draw();
        } catch(err) {
          alert('文件解析失败: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
    
    // 导出PNG
    $('btn-export-png').addEventListener('click', async () => {
      // 用更大的分辨率重新渲染
      const oldScale = renderer.scale;
      const oldOffX = renderer.offsetX;
      const oldOffY = renderer.offsetY;
      
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 2400;
      exportCanvas.height = 1600;
      
      const exportRenderer = new CrossSectionRenderer(exportCanvas);
      exportRenderer.styleId = renderer.styleId;
      
      try {
        await exportRenderer.draw(model, { scale: 1.2, offsetX: 100, offsetY: 50 });
        
        exportCanvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'cross_section.png';
          a.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
      } catch(e) {
        console.error('导出失败:', e);
      }
    });
  }

  // ===== 底部工具栏 =====
  function bindBottomToolbar() {
    $('bottom-toolbar').addEventListener('click', (e) => {
      const btn = e.target.closest('.elem-btn');
      if (!btn) return;
      
      const type = btn.dataset.type;
      const ud = btn.dataset.ud;
      
      if (btn.id === 'btn-delete') {
        if (selectedIdx >= 0) deleteElement(selectedIdx);
      } else if (type) {
        addElement(type, ud || null);
      }
    });
  }

  // ===== Canvas 交互 =====
  function bindCanvasEvents() {
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        // 中键或 Ctrl+左键 → 平移
        isPanning = true;
        panStart = { x: e.clientX - renderer.offsetX, y: e.clientY - renderer.offsetY };
        e.preventDefault();
        return;
      }
      
      if (e.button === 0) {
        // 点击检测
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        const hitIdx = renderer.hitTest(mx, my);
        
        if (hitIdx >= 0) {
          selectElement(hitIdx);
          // 允许拖拽调整
          isDragging = false;
          dragStart = { x: e.clientX, y: e.clientY, idx: hitIdx };
        } else {
          selectElement(-1);
          // 空白区域 → 准备平移
          isPanning = true;
          panStart = { x: e.clientX - renderer.offsetX, y: e.clientY - renderer.offsetY };
        }
      }
    });
    
    window.addEventListener('mousemove', (e) => {
      if (isPanning) {
        renderer.offsetX = e.clientX - panStart.x;
        renderer.offsetY = e.clientY - panStart.y;
        if (!panRAF) {
          panRAF = requestAnimationFrame(() => {
            draw();
            panRAF = null;
          });
        }
        return;
      }
      
      if (dragStart) {
        const dx = e.clientX - dragStart.x;
        if (Math.abs(dx) > 3) {
          isDragging = true;
        }
      }
      
      // 悬停检测
      if (!isDragging && !isPanning) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hitIdx = renderer.hitTest(mx, my);
        canvas.classList.toggle('pointing', hitIdx >= 0 && hitIdx !== selectedIdx);
      }
    });
    
    window.addEventListener('mouseup', () => {
      isPanning = false;
      isDragging = false;
      dragStart = null;
    });
    
    // 滚轮缩放
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      const zoomFactor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const newScale = Math.max(0.15, Math.min(renderer.scale * zoomFactor, 3.0));
      
      // 以鼠标位置为中心缩放
      const actualZoom = newScale / renderer.scale;
      renderer.offsetX = mx - (mx - renderer.offsetX) * actualZoom;
      renderer.offsetY = my - (my - renderer.offsetY) * actualZoom;
      renderer.scale = newScale;
      
      draw();
    }, { passive: false });
    
    // 键盘删除
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIdx >= 0 && document.activeElement === document.body) {
          deleteElement(selectedIdx);
        }
      }
      if (e.key === 'Escape') {
        selectElement(-1);
      }
    });
  }

  // ===== 启动 =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
