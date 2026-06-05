/**
 * 横断面设计 - 主控制器
 */
(function() {
    'use strict';

    // ==================== 全局状态 ====================
    let model = new RoadSectionModel();
    let renderer = null;
    let canvas = null;

    // ==================== 初始化 ====================

    function init() {
        canvas = document.getElementById('main-canvas');
        renderer = new CrossSectionRenderer(canvas, model);

        // 填充道路等级选项
        const rankSelect = document.getElementById('road-rank-select');
        RoadRankOptions.forEach((r, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = r.Name + ' (' + r.Speed + 'km/h)';
            if (r.Name === '主干路(50)') opt.selected = true;
            rankSelect.appendChild(opt);
        });

        // 更新参数界面
        updateParamUI();

        // 自动生成默认断面
        generateDefault();

        // 绑定事件
        bindEvents();

        // 初始渲染
        resizeCanvas();
        renderer.centerView();
        renderer.render();
        updateStatusBar();
    }

    function resizeCanvas() {
        const wrapper = document.getElementById('canvas-wrapper');
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
    }

    function generateDefault() {
        const rankIdx = parseInt(document.getElementById('road-rank-select').value);
        model.RoadInputPara.Rank = RoadRankOptions[rankIdx].clone();
        model.RoadInputPara.LaneNo = parseInt(document.getElementById('lane-count-select').value);
        model.RoadInputPara.InLaneNo = Math.ceil(model.RoadInputPara.LaneNo / 2);
        model.RoadInputPara.OutLaneNo = model.RoadInputPara.LaneNo - model.RoadInputPara.InLaneNo;
        model.RoadInputPara.RedLineLength = parseFloat(document.getElementById('redline-input').value);

        model.InitSectionSeries();
        model.CalculateElementWidth();
        updateParamUI();
    }

    function updateParamUI() {
        document.getElementById('speed-input').value = model.Speed;
        document.getElementById('redline-input').value = model.RedLineLength;
        document.getElementById('lane-count-select').value = model.RoadInputPara.LaneNo;
        document.getElementById('total-width-display').textContent = model.TotalWidth.toFixed(2);
        document.getElementById('road-name-input').value = model.RoadName || '';

        // 道路等级
        const rankSelect = document.getElementById('road-rank-select');
        const currentRankName = model.RoadInputPara.Rank.Name;
        for (let i = 0; i < rankSelect.options.length; i++) {
            if (rankSelect.options[i].textContent.includes(currentRankName)) {
                rankSelect.value = i;
                break;
            }
        }
    }

    function updateStatusBar() {
        document.getElementById('zoom-display').textContent = Math.round(renderer.scale * 100);
        document.getElementById('total-width-display').textContent = model.TotalWidth.toFixed(2);
    }

    // ==================== 属性面板 ====================

    function updatePropPanel() {
        const panel = document.getElementById('prop-content');
        if (renderer.selectedIndex < 0 || renderer.selectedIndex >= model.EleList.length) {
            panel.innerHTML = '<div class="no-selection">点击选中断面元素</div>';
            return;
        }

        const el = model.EleList[renderer.selectedIndex];
        panel.innerHTML = `
            <div class="prop-row"><label>类型</label><span>${el.EleTypeName}</span></div>
            <div class="prop-row">
                <label>宽度(m)</label>
                <input type="number" id="prop-width" value="${el.EleWidth.toFixed(2)}"
                       min="${el.MinWidth}" max="${el.MaxWidth}" step="0.25">
            </div>
            <div class="prop-row">
                <label>高度(m)</label>
                <input type="number" id="prop-height" value="${el.EleHeight.toFixed(2)}"
                       min="${el.MinHeight}" max="${el.MaxHeight}" step="0.1">
            </div>
            <div class="prop-row">
                <label>方向</label>
                <select id="prop-direction">
                    <option value="In" ${el.Direction === 'In' ? 'selected' : ''}>进口</option>
                    <option value="Out" ${el.Direction === 'Out' ? 'selected' : ''}>出口</option>
                    <option value="NoDirection" ${el.Direction === 'NoDirection' ? 'selected' : ''}>无</option>
                </select>
            </div>
            <div class="prop-row">
                <label>锁定</label>
                <input type="checkbox" id="prop-locked" ${el.IsLocked ? 'checked' : ''}>
            </div>
            <div class="prop-row">
                <label>地表样式</label>
                <select id="prop-surface-style"></select>
            </div>
            ${(el instanceof IsoBeltElement) ? `
            <div class="prop-row"><label>隔离类型</label><span>${IsoBeltTypeName(el._isoBeltType)}</span></div>
            <div class="prop-row"><label>护栏</label><input type="checkbox" id="prop-barrier" ${el.HasBarrier?'checked':''}></div>
            <div class="prop-row"><label>灌木</label><input type="checkbox" id="prop-bush" ${el.HasBush?'checked':''}></div>
            <div class="prop-row"><label>乔木</label><input type="checkbox" id="prop-tree" ${el.HasTree?'checked':''}></div>
            <div class="prop-row"><label>路灯</label><input type="checkbox" id="prop-lamp" ${el.HasLamp?'checked':''}></div>
            ` : ''}
        `;

        // 填充地表样式选项
        const styleSelect = document.getElementById('prop-surface-style');
        if (styleSelect) {
            const styles = StyleSurfaceTypes[model.StyleIndex];
            styles.forEach((s, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = s.name;
                if (i === el.SurfaceStyleIndex) opt.selected = true;
                styleSelect.appendChild(opt);
            });
        }

        // 绑定属性修改事件
        bindPropEvents(el);
    }

    function bindPropEvents(el) {
        const widthInput = document.getElementById('prop-width');
        if (widthInput) {
            widthInput.addEventListener('input', () => {
                el.EleWidth = parseFloat(widthInput.value) || el.EleWidth;
                renderer.render();
                updateStatusBar();
            });
        }

        const heightInput = document.getElementById('prop-height');
        if (heightInput) {
            heightInput.addEventListener('input', () => {
                el.EleHeight = parseFloat(heightInput.value) || el.EleHeight;
                renderer.render();
            });
        }

        const dirSelect = document.getElementById('prop-direction');
        if (dirSelect) {
            dirSelect.addEventListener('change', () => {
                el.Direction = dirSelect.value;
                renderer.render();
            });
        }

        const lockCheck = document.getElementById('prop-locked');
        if (lockCheck) {
            lockCheck.addEventListener('change', () => {
                el.EleLock = lockCheck.checked ? EleLock.Lock : EleLock.UnLock;
                renderer.render();
            });
        }

        const styleSelect = document.getElementById('prop-surface-style');
        if (styleSelect) {
            styleSelect.addEventListener('change', () => {
                el.SurfaceStyleIndex = parseInt(styleSelect.value);
                renderer.render();
            });
        }

        // 隔离带附件
        ['barrier', 'bush', 'tree', 'lamp'].forEach(attr => {
            const cb = document.getElementById(`prop-${attr}`);
            if (cb && el instanceof IsoBeltElement) {
                cb.addEventListener('change', () => {
                    el.SetIsobeltType(
                        document.getElementById('prop-bush')?.checked || false,
                        document.getElementById('prop-tree')?.checked || false,
                        document.getElementById('prop-barrier')?.checked || false,
                        document.getElementById('prop-lamp')?.checked || false
                    );
                    renderer.render();
                });
            }
        });
    }

    function IsoBeltTypeName(type) {
        const names = { 11: '中央隔离', 12: '同向隔离', 13: '机非隔离', 14: '慢行隔离', 15: '人机隔离' };
        return names[type] || '未知';
    }

    // ==================== 事件绑定 ====================

    function bindEvents() {
        // 生成
        document.getElementById('btn-generate').addEventListener('click', () => {
            generateDefault();
            renderer.selectedIndex = -1;
            updatePropPanel();
            renderer.centerView();
            renderer.render();
            updateStatusBar();
        });

        // 参数联动
        document.getElementById('road-rank-select').addEventListener('change', function() {
            const rank = RoadRankOptions[parseInt(this.value)];
            document.getElementById('speed-input').value = rank.Speed;
            document.getElementById('redline-input').value = rank.RedLineMin || 30;
        });

        document.getElementById('speed-input').addEventListener('change', function() {
            model.RoadInputPara.Rank.Speed = parseInt(this.value) || 50;
        });

        document.getElementById('redline-input').addEventListener('change', function() {
            model.RedLineLength = parseFloat(this.value) || 40;
        });

        // 居中
        document.getElementById('btn-center').addEventListener('click', () => {
            renderer.centerView();
            renderer.render();
            updateStatusBar();
        });

        // 切换风格
        document.getElementById('btn-style').addEventListener('click', () => {
            model.StyleIndex = (model.StyleIndex + 1) % 2;
            renderer.render();
        });

        // 切换标注
        document.getElementById('btn-toggle-dim').addEventListener('click', () => {
            renderer.showDimensions = !renderer.showDimensions;
            renderer.render();
        });

        // 导出PNG
        document.getElementById('btn-export-png').addEventListener('click', exportPNG);

        // 保存
        document.getElementById('btn-save').addEventListener('click', saveFile);

        // 打开
        document.getElementById('btn-load').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input').addEventListener('change', loadFile);

        // 删除
        document.getElementById('btn-delete').addEventListener('click', () => {
            renderer.deleteSelected();
            updatePropPanel();
            updateStatusBar();
        });

        // 道路名称
        document.getElementById('road-name-input').addEventListener('input', function() {
            model.RoadName = this.value;
        });

        // 添加元素按钮
        document.querySelectorAll('#side-panel .add-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const eleType = this.dataset.ele;
                addNewElement(eleType);
            });
        });

        // Canvas 事件
        canvas.addEventListener('mousedown', (e) => {
            renderer.onMouseDown(e.clientX, e.clientY, e.button);
            updatePropPanel();
        });

        canvas.addEventListener('mousemove', (e) => {
            renderer.onMouseMove(e.clientX, e.clientY);
            updateStatusBar();
            // 显示坐标
            const world = renderer.screenToWorld(e.clientX, e.clientY);
            document.getElementById('coord-display').textContent =
                `(${world.x.toFixed(0)}, ${world.y.toFixed(0)})`;
        });

        canvas.addEventListener('mouseup', () => {
            renderer.onMouseUp();
        });

        canvas.addEventListener('mouseleave', () => {
            renderer.onMouseUp();
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            renderer.onWheel(e.clientX, e.clientY, e.deltaY);
            updateStatusBar();
        }, { passive: false });

        // 键盘
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Del') {
                renderer.deleteSelected();
                updatePropPanel();
                updateStatusBar();
            }
            if (e.key === 'Escape') {
                renderer.selectedIndex = -1;
                updatePropPanel();
                renderer.render();
            }
        });

        // 窗口大小
        window.addEventListener('resize', () => {
            resizeCanvas();
            renderer.render();
        });
    }

    // ==================== 添加元素 ====================

    function addNewElement(eleType) {
        let el = null;
        const insertIndex = renderer.selectedIndex >= 0 ? renderer.selectedIndex + 1 : model.EleList.length;

        switch (eleType) {
            case 'car':
                el = new VehicleElement(3, SectionElementDir.In);
                break;
            case 'bus':
                el = new VehicleElement(5, SectionElementDir.In);
                break;
            case 'truck':
                el = new VehicleElement(4, SectionElementDir.In);
                break;
            case 'tramcar':
                el = new VehicleElement(18, SectionElementDir.In);
                break;
            case 'pedestrian':
                el = new PedestrianElement();
                break;
            case 'bicycle':
                el = new BicycleElement(SectionElementDir.In);
                break;
            case 'busstop':
                el = new BusStopElement(9);
                break;
            case 'isobelt':
                el = new IsoBeltElement(IsoBeltType.BicVeh);
                el.InitAttachmentsByWidth();
                break;
            case 'overpass':
                el = new UserDefineElement(UserDefineType.Overpass, ImageLocation.Center);
                break;
            case 'water':
                el = new UserDefineElement(UserDefineType.Water, ImageLocation.Center);
                break;
            case 'park':
                el = new UserDefineElement(UserDefineType.ParkLane, ImageLocation.Center);
                break;
            default:
                return;
        }

        if (el) {
            el.EleWidth = getDefaultWidth(eleType);
            model.AddElement(el, insertIndex);
            renderer.selectedIndex = insertIndex;
            updatePropPanel();
            renderer.render();
            updateStatusBar();
        }
    }

    function getDefaultWidth(eleType) {
        const defaults = {
            car: 3.5, bus: 3.5, truck: 3.75, tramcar: 3.5,
            pedestrian: 3.0, bicycle: 2.5, busstop: 2.0,
            isobelt: 1.0, overpass: 5.0, water: 5.0, park: 2.5
        };
        return defaults[eleType] || 2.0;
    }

    // ==================== 文件操作 ====================

    function exportPNG() {
        // 创建离屏 canvas 用于高质量导出
        const offscreen = document.createElement('canvas');
        const scale = 2;
        const pw = renderer.properWidth;
        const ph = renderer.properHeight + 80;

        offscreen.width = pw * scale;
        offscreen.height = ph * scale;

        const tempRenderer = new CrossSectionRenderer(offscreen, model);
        tempRenderer.scale = scale;
        tempRenderer.translateX = 0;
        tempRenderer.translateY = 0;
        tempRenderer.showDimensions = true;
        tempRenderer.render();

        offscreen.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '横断面_' + (model.RoadName || '未命名') + '.png';
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    function saveFile() {
        const json = model.toJSON();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '横断面_' + (model.RoadName || '未命名') + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function loadFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target.result);
                model = RoadSectionModel.fromJSON(json);
                renderer.model = model;
                updateParamUI();
                renderer.selectedIndex = -1;
                updatePropPanel();
                renderer.centerView();
                renderer.render();
                updateStatusBar();
            } catch (err) {
                alert('文件解析失败: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ==================== 启动 ====================
    window.addEventListener('DOMContentLoaded', init);
})();
