/**
 * 交叉口设计 - 主应用逻辑
 */

class IntersectionApp {
  constructor() {
    this.cross = null;            // Cross model
    this.renderer = null;         // IntersectionRenderer
    this.currentMode = 'channel'; // channel | lane-func | flow | signal | eval
    this.selectedRoad = -1;
    this.selectedLane = null;     // { roadIndex, laneIndex }

    // 交互状态
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    this._init();
  }

  _init() {
    const canvas = document.getElementById('main-canvas');
    this.renderer = new IntersectionRenderer(canvas);

    this._bindEvents();
    this._newProject(4);
  }

  // ======== 事件绑定 ========
  _bindEvents() {
    const canvas = document.getElementById('main-canvas');
    const container = document.getElementById('canvas-container');

    // 工具栏按钮
    document.getElementById('btn-new').addEventListener('click', () => this._showNewDialog());
    document.getElementById('btn-save').addEventListener('click', () => this._saveProject());
    document.getElementById('btn-open').addEventListener('click', () => this._openProject());
    document.getElementById('btn-export-png').addEventListener('click', () => this._exportPNG());
    document.getElementById('btn-fit').addEventListener('click', () => {
      this.renderer.fitView();
      this._draw();
    });
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.renderer.zoom(1.2);
      this._draw();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.renderer.zoom(0.8);
      this._draw();
    });

    // 交叉口名/类型变更
    document.getElementById('cross-name').addEventListener('change', (e) => {
      if (this.cross) this.cross.crossName = e.target.value;
    });
    document.getElementById('sel-cross-type').addEventListener('change', (e) => {
      if (this.cross) this.cross.crossType = parseInt(e.target.value);
    });
    document.getElementById('sel-draw-type').addEventListener('change', (e) => {
      if (this.cross) {
        this.cross.crossDrawType = parseInt(e.target.value);
        this._draw();
      }
    });

    // 左侧功能按钮
    document.querySelectorAll('.stb-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.stb-btn[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMode = btn.dataset.mode;

        if (this.currentMode === 'lane-func') {
          container.classList.add('lane-select');
        } else {
          container.classList.remove('lane-select');
        }
        this._draw();
      });
    });

    // 颜色选择器
    ['clr-bg', 'clr-sidewalk', 'clr-nonmotor', 'clr-green'].forEach(id => {
      document.getElementById(id).addEventListener('input', (e) => {
        const hex = e.target.value;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const color = { r, g, b };

        if (id === 'clr-bg') this.cross.bgColor = color;
        else if (id === 'clr-sidewalk') this.cross.sidewalkColor = color;
        else if (id === 'clr-nonmotor') this.cross.nonMotorColor = color;
        else if (id === 'clr-green') this.cross.greenColor = color;

        this._draw();
      });
    });

    // 鼠标交互
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      this.renderer.zoom(factor, mx, my);
      this._draw();
    });

    canvas.addEventListener('click', (e) => this._onClick(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 新建对话框
    document.getElementById('btn-modal-cancel').addEventListener('click', () => {
      document.getElementById('modal-new').style.display = 'none';
    });
    document.getElementById('btn-modal-ok').addEventListener('click', () => {
      const count = parseInt(document.getElementById('new-road-count').value);
      const type = parseInt(document.getElementById('new-cross-type').value);
      const drawType = parseInt(document.getElementById('new-draw-type').value);
      const name = document.getElementById('new-cross-name').value.trim();

      document.getElementById('modal-new').style.display = 'none';
      this._newProject(count, name, type, drawType);
    });

    // 键盘
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._hideLaneMenu();
      }
    });
  }

  // ======== 项目操作 ========
  _newProject(roadCount, name, type, drawType) {
    if (roadCount === 3) {
      this.cross = createDefault3Way();
    } else {
      this.cross = createDefault4Way();
    }

    if (name) this.cross.crossName = name;
    if (type) this.cross.crossType = type;
    if (drawType !== undefined) this.cross.crossDrawType = drawType;

    // 更新UI
    document.getElementById('cross-name').value = this.cross.crossName;
    document.getElementById('sel-cross-type').value = this.cross.crossType;
    document.getElementById('sel-draw-type').value = this.cross.crossDrawType;

    this.selectedRoad = -1;
    this.selectedLane = null;
    this._hideLaneMenu();
    this._updateInfoPanel();
    this._draw();
    // 自动适应视图
    setTimeout(() => {
      this.renderer.fitView();
      this._draw();
    }, 100);
  }

  _showNewDialog() {
    document.getElementById('new-cross-name').value = '交叉口设计方案1';
    document.getElementById('modal-new').style.display = 'flex';
  }

  _saveProject() {
    const data = JSON.stringify(this.cross, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.cross.crossName || 'cross') + '.crs.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  _openProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.crs';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          this.cross = Object.assign(new Cross(), data);
          // 恢复方法
          this.cross.roadLinkList = this.cross.roadLinkList.map(r => {
            const road = Object.assign(new Road(), r);
            road.entranceLaneList = road.entranceLaneList.map(l => Object.assign(new EntranceLane(), l));
            road.approachLaneList = road.approachLaneList.map(l => Object.assign(new ApproachLane(), l));
            return road;
          });
          this._updateUIFromCross();
          this._draw();
        } catch (err) {
          alert('文件格式错误: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  _exportPNG() {
    const canvas = this.renderer.canvas;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.cross.crossName || 'cross') + '.png';
    a.click();
  }

  _updateUIFromCross() {
    document.getElementById('cross-name').value = this.cross.crossName;
    document.getElementById('sel-cross-type').value = this.cross.crossType;
    document.getElementById('sel-draw-type').value = this.cross.crossDrawType;
    this._updateInfoPanel();
  }

  // ======== 绘图 ========
  _draw() {
    if (!this.cross) return;
    this.renderer.draw(this.cross);
  }

  // ======== 鼠标交互 ========
  _onMouseDown(e) {
    if (this.currentMode === 'channel') {
      this.isPanning = true;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      document.getElementById('canvas-container').classList.add('grabbing');
    }
  }

  _onMouseMove(e) {
    if (this.isPanning) {
      const dx = e.clientX - this.panStartX;
      const dy = e.clientY - this.panStartY;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.renderer.pan(dx, dy);
      this._draw();
    }
  }

  _onMouseUp(e) {
    this.isPanning = false;
    document.getElementById('canvas-container').classList.remove('grabbing');
  }

  _onClick(e) {
    if (this.currentMode !== 'lane-func') return;
    if (this.isPanning) return;

    const rect = this.renderer.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hit = this.renderer.hitTest(mx, my);
    if (hit) {
      this.selectedLane = { roadIndex: hit.roadIndex, laneIndex: hit.laneIndex };
      this.selectedRoad = hit.roadIndex;
      this._showLaneMenu(e.clientX, e.clientY, hit);
      this._updateLaneDetail(hit);
      this._updateRoadList();
    } else {
      this._hideLaneMenu();
    }
  }

  // ======== 车道功能菜单 ========
  _showLaneMenu(x, y, hit) {
    const menu = document.getElementById('lane-func-menu');
    const items = document.getElementById('lane-func-items');

    const laneFunOptions = [
      LaneSigning.GoStraight, LaneSigning.LeftTurning, LaneSigning.RightTurning,
      LaneSigning.StraightLeft, LaneSigning.StraightRight,
      LaneSigning.LeftRight, LaneSigning.LeftStraightRight,
      LaneSigning.UTurning, LaneSigning.None
    ];

    items.innerHTML = laneFunOptions.map(f => {
      const selected = hit.lane.laneFun === f ? ' style="font-weight:bold;background:#e3f2fd"' : '';
      return `<button class="popup-item" data-fun="${f}"${selected}>${LaneSigningNames[f]}</button>`;
    }).join('');

    menu.style.display = 'block';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    menu.querySelectorAll('.popup-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const fun = parseInt(btn.dataset.fun);
        hit.lane.laneFun = fun;
        this._hideLaneMenu();
        this._draw();
        this._updateLaneDetail(hit);
      });
    });
  }

  _hideLaneMenu() {
    document.getElementById('lane-func-menu').style.display = 'none';
  }

  // ======== 信息面板 ========
  _updateInfoPanel() {
    const c = this.cross;
    document.getElementById('info-type').textContent = c.crossType === 1 ? '信号控制' : '无控制';
    document.getElementById('info-road-count').textContent = c.roadCount;

    let totalLanes = 0;
    c.roadLinkList.forEach(r => {
      totalLanes += r.roadEntranceNum + r.roadApproachNum;
    });
    document.getElementById('info-total-lanes').textContent = totalLanes;

    this._updateRoadList();
  }

  _updateRoadList() {
    const list = document.getElementById('road-list');
    list.innerHTML = this.cross.roadLinkList.map((r, i) => {
      const sel = i === this.selectedRoad ? ' selected' : '';
      return `<div class="road-item${sel}" data-idx="${i}">
        <span class="road-icon" style="background:${this._roadColor(i)}"></span>
        <span class="road-name">${r.roadName}</span>
        <span class="road-lanes">进${r.roadEntranceNum}出${r.roadApproachNum}</span>
      </div>`;
    }).join('');

    list.querySelectorAll('.road-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectedRoad = parseInt(item.dataset.idx);
        this._updateRoadList();
        this.selectedLane = null;
        document.getElementById('lane-detail').innerHTML = '点击车道查看详情';
      });
    });
  }

  _updateLaneDetail(hit) {
    const lane = hit.lane;
    const road = hit.road;
    const el = document.getElementById('lane-detail');
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;">${road.roadName} 车道${lane.laneId}</div>
      <div>功能: <span class="lane-func-tag">${LaneSigningNames[lane.laneFun]}</span></div>
      <div style="margin-top:4px;font-size:10px;color:#999;">
        饱和流率: ${lane.laneSaturatedFlow} pcu/h
      </div>
    `;
  }

  _roadColor(i) {
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
    return colors[i % colors.length];
  }
}

// ======== 启动 ========
window.addEventListener('DOMContentLoaded', () => {
  window.app = new IntersectionApp();
});
