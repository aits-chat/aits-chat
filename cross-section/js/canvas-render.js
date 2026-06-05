/**
 * 横断面设计 - Canvas 2D 渲染引擎
 * 从 WPF ImageDrawer/ZoomCanvus 迁移
 */

class CrossSectionRenderer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {RoadSectionModel} model
     */
    constructor(canvas, model) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.model = model;

        // 缩放/平移状态
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.minScale = 0.3;
        this.maxScale = 3.0;

        // 拖动状态
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragTranslateX = 0;
        this.dragTranslateY = 0;

        // 选中状态
        this.selectedIndex = -1;
        this.hoveredIndex = -1;

        // 边缘拖拽调节宽度
        this.resizing = null; // { index, edge: 'left'|'right', startX, startWidth }

        // 标注开关
        this.showDimensions = true;
    }

    // ==================== 坐标转换 ====================

    get properWidth() {
        const totalPx = this.model.TotalWidth * EleScale;
        return Math.max(totalPx, 800);
    }

    get properHeight() {
        return Math.max(this.model.CanvasHeight, 400);
    }

    /**
     * 屏幕坐标 → 世界坐标
     */
    screenToWorld(sx, sy) {
        const rect = this.canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        return {
            x: (sx - rect.left - cx - this.translateX) / this.scale + this.properWidth / 2,
            y: (sy - rect.top - cy - this.translateY) / this.scale
        };
    }

    /**
     * 获取最佳缩放比例
     */
    getProperScale() {
        const rect = this.canvas.getBoundingClientRect();
        return Math.min((rect.width - 100) / this.properWidth, 1.0);
    }

    /**
     * 居中显示
     */
    centerView() {
        this.scale = this.getProperScale();
        this.translateX = 0;
        this.translateY = 0;
    }

    // ==================== 主渲染入口 ====================

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        ctx.save();
        // 应用缩放和平移变换
        const cx = w / 2;
        const cy = h / 2;
        ctx.translate(cx + this.translateX, cy + this.translateY);
        ctx.scale(this.scale, this.scale);

        // 计算断面起始X (居中)
        const totalPx = this.model.TotalWidth * EleScale;
        const startX = (this.properWidth - totalPx) / 2;

        this._drawBackground(startX, totalPx);
        this._drawElements(startX);
        this._drawDimensions(startX);

        ctx.restore();
    }

    // ==================== 背景绘制 ====================

    _drawBackground(startX, totalPx) {
        const ctx = this.ctx;
        const w = this.properWidth;
        const h = this.properHeight;

        // 天空渐变
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
        skyGrad.addColorStop(0, '#87CEEB');
        skyGrad.addColorStop(0.6, '#B0D4F1');
        skyGrad.addColorStop(1, '#E8F0FE');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h * 0.68);

        // 地面
        const groundGrad = ctx.createLinearGradient(0, h * 0.68, 0, h);
        groundGrad.addColorStop(0, '#C8C8C8');
        groundGrad.addColorStop(1, '#A0A0A0');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, h * 0.68, w, h * 0.32);

        // 路基灰色矩形
        const baseY = h * 0.68 - 20;
        const baseHeight = 80;
        const baseWidth = totalPx + 200;
        ctx.fillStyle = '#E0E0E0';
        ctx.fillRect(startX - 100, baseY, baseWidth, baseHeight);
        ctx.strokeStyle = '#C0C0C0';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX - 100, baseY, baseWidth, baseHeight);
    }

    // ==================== 元素绘制 ====================

    _drawElements(startX) {
        const ctx = this.ctx;
        const h = this.properHeight;
        const baseY = h * 0.68;

        let x = startX;

        for (let i = 0; i < this.model.EleList.length; i++) {
            const el = this.model.EleList[i];
            const elWidthPx = el.EleWidthPx;

            if (elWidthPx <= 0) continue;

            this._drawSingleElement(el, x, baseY, i);
            x += elWidthPx;
        }
    }

    /**
     * 绘制单个元素
     */
    _drawSingleElement(el, x, baseY, index) {
        const ctx = this.ctx;
        const w = el.EleWidthPx;
        const hPx = el.EleHeightPx;

        // 路面顶部Y
        const surfaceY = baseY - hPx;

        // --- 地基 ---
        const baseDepth = 30;
        ctx.fillStyle = '#E8E8E8';
        ctx.fillRect(x, baseY, w, baseDepth);
        ctx.strokeStyle = '#D0D0D0';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, baseY, w, baseDepth);

        // --- 路面表面 ---
        const styleData = this._getSurfaceStyle(el);
        ctx.fillStyle = styleData.fill;
        ctx.fillRect(x, surfaceY, w, hPx);

        // 路面纹理 (铺装纹理)
        if (styleData.texture) {
            this._drawSurfaceTexture(x, surfaceY, w, hPx, styleData);
        }

        // 路面边框
        ctx.strokeStyle = styleData.stroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, surfaceY, w, hPx);

        // --- 路面标线 ---
        if (el instanceof IsoBeltElement && !el.IsHardIsoBelt) {
            // 标线隔离 - 虚线
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const midY = surfaceY + hPx / 2;
            ctx.moveTo(x, midY);
            ctx.lineTo(x + w, midY);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // --- 附件绘制 ---
        if (el instanceof IsoBeltElement) {
            this._drawIsoBeltAttachments(el, x, surfaceY, w, hPx);
        }

        // --- 箭头 ---
        if (el.ArrowDirection && el.ArrowDirection !== ArrowDirection.None) {
            this._drawArrow(el.ArrowDirection, x, surfaceY, w, hPx, el.Direction);
        }

        // --- 车辆图标 ---
        if (el instanceof VehicleElement) {
            this._drawVehicleIcon(el, x, surfaceY, w, hPx);
        }

        // --- 人行道图标 ---
        if (el instanceof PedestrianElement) {
            this._drawPedestrianIcon(x, surfaceY, w, hPx);
        }

        // --- 非机动车道图标 ---
        if (el instanceof BicycleElement) {
            this._drawBicycleIcon(x, surfaceY, w, hPx);
        }

        // --- 用户自定义 ---
        if (el instanceof UserDefineElement) {
            this._drawUserDefineIcon(el, x, surfaceY, w, hPx);
        }

        // --- 选中高亮 ---
        if (index === this.selectedIndex) {
            ctx.strokeStyle = '#0066FF';
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(x - 1, surfaceY - 1, w + 2, hPx + baseDepth + 2);
            ctx.setLineDash([]);

            // 调节手柄
            this._drawResizeHandles(x, surfaceY, w, hPx, baseDepth);
        }

        // --- 悬停高亮 ---
        if (index === this.hoveredIndex && index !== this.selectedIndex) {
            ctx.strokeStyle = 'rgba(0, 102, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, surfaceY, w, hPx + baseDepth);
        }
    }

    /**
     * 获取元素地表样式
     */
    _getSurfaceStyle(el) {
        const styleIdx = Math.min(el.SurfaceStyleIndex, StyleSurfaceTypes[this.model.StyleIndex].length - 1);
        const style = StyleSurfaceTypes[this.model.StyleIndex][styleIdx];

        let fillColor = '#90A4AE'; // 默认
        if (style && style.fill) {
            const [r, g, b, a] = style.fill;
            fillColor = `rgba(${r},${g},${b},${(a||255)/255})`;
        }

        let strokeColor = '#555';
        if (style && style.stroke) {
            const [r, g, b, a] = style.stroke;
            strokeColor = `rgba(${r},${g},${b},${(a||255)/255})`;
        }

        return { fill: fillColor, stroke: strokeColor, texture: false };
    }

    /**
     * 绘制路面纹理
     */
    _drawSurfaceTexture(x, y, w, h, style) {
        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        // 砖纹理
        const brickW = 8, brickH = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.3;
        for (let bx = x; bx < x + w; bx += brickW) {
            const offset = (Math.floor((bx - x) / brickW) % 2) * brickH / 2;
            for (let by = y + offset; by < y + h; by += brickH) {
                ctx.strokeRect(bx, by, brickW, brickH);
            }
        }
        ctx.restore();
    }

    // ==================== 附件绘制 ====================

    _drawIsoBeltAttachments(el, x, surfaceY, w, hPx) {
        const ctx = this.ctx;
        const midX = x + w / 2;

        // 灌木丛
        if (el.HasBush) {
            const bushY = surfaceY - 2;
            ctx.fillStyle = '#2E7D32';
            for (let bx = x + 3; bx < x + w - 3; bx += 6) {
                ctx.beginPath();
                ctx.arc(bx + 3, bushY, 4, Math.PI, 0);
                ctx.fill();
            }
            ctx.fillStyle = '#43A047';
            for (let bx = x + 3; bx < x + w - 3; bx += 6) {
                ctx.beginPath();
                ctx.arc(bx + 3, bushY - 2, 3, Math.PI, 0);
                ctx.fill();
            }
        }

        // 树木
        if (el.HasTree) {
            const treeY = surfaceY - 5;
            ctx.fillStyle = '#5D4037';
            ctx.fillRect(midX - 1, treeY - 10, 2, 12);
            ctx.fillStyle = '#2E7D32';
            ctx.beginPath();
            ctx.arc(midX, treeY - 18, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#388E3C';
            ctx.beginPath();
            ctx.arc(midX - 2, treeY - 20, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(midX + 3, treeY - 16, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // 护栏
        if (el.HasBarrier) {
            ctx.strokeStyle = '#757575';
            ctx.lineWidth = 1.5;
            const barrierY = surfaceY + 5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(x, barrierY);
            ctx.lineTo(x + w, barrierY);
            ctx.stroke();
            // 立柱
            for (let px = x + 5; px < x + w; px += 10) {
                ctx.fillStyle = '#9E9E9E';
                ctx.fillRect(px - 0.5, barrierY - 6, 1, 6);
            }
        }

        // 路灯
        if (el.HasLamp) {
            const lampX = el.LampLocation === LampLocation.Left ? x + 5 :
                          el.LampLocation === LampLocation.Right ? x + w - 5 : midX;
            // 灯杆
            ctx.strokeStyle = '#424242';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lampX, surfaceY);
            ctx.lineTo(lampX, surfaceY - 30);
            ctx.stroke();
            // 灯头
            ctx.fillStyle = '#FFC107';
            const lampHeadY = surfaceY - 30;
            ctx.beginPath();
            if (el.Lamptype === LampType.OneBrance) {
                ctx.arc(lampX + 4, lampHeadY + 2, 5, -Math.PI / 2, Math.PI / 2);
            } else {
                ctx.arc(lampX, lampHeadY + 2, 5, Math.PI, 0);
            }
            ctx.fill();
            // 灯罩渐变
            const glowGrad = ctx.createRadialGradient(lampX, lampHeadY, 3, lampX, lampHeadY, 12);
            glowGrad.addColorStop(0, 'rgba(255, 235, 59, 0.4)');
            glowGrad.addColorStop(1, 'rgba(255, 235, 59, 0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(lampX, lampHeadY - 3, 12, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ==================== 箭头绘制 ====================

    _drawArrow(arrowDir, x, surfaceY, w, hPx, direction) {
        const ctx = this.ctx;
        const midX = x + w / 2;
        const midY = surfaceY + hPx / 2;
        const size = Math.min(w, hPx) * 0.4;

        ctx.save();
        ctx.translate(midX, midY);

        const isOut = direction === SectionElementDir.Out;
        const angle = isOut ? 0 : Math.PI;

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        // 箭头直线
        ctx.beginPath();
        ctx.moveTo(-size * 0.7, 0);
        ctx.lineTo(size * 0.5, 0);
        ctx.stroke();

        // 箭头尖
        ctx.beginPath();
        ctx.moveTo(size * 0.5, 0);
        ctx.lineTo(size * 0.1, -size * 0.3);
        ctx.moveTo(size * 0.5, 0);
        ctx.lineTo(size * 0.1, size * 0.3);
        ctx.stroke();

        ctx.restore();
    }

    // ==================== 图标绘制 ====================

    _drawVehicleIcon(el, x, surfaceY, w, hPx) {
        const ctx = this.ctx;
        const midX = x + w / 2;
        const midY = surfaceY + hPx / 2;
        const carW = w * 0.35;
        const carH = carW * 0.55;

        ctx.save();
        ctx.fillStyle = 'rgba(80,80,80,0.5)';
        // 车身
        const carX = midX - carW / 2;
        const carY = midY - carH / 2;
        ctx.beginPath();
        ctx.roundRect(carX, carY, carW, carH, 2);
        ctx.fill();

        // 车窗
        ctx.fillStyle = 'rgba(180,210,240,0.6)';
        ctx.fillRect(carX + carW * 0.1, carY + 1, carW * 0.35, carH * 0.45);
        ctx.fillRect(carX + carW * 0.5, carY + 1, carW * 0.35, carH * 0.45);

        // 车轮
        ctx.fillStyle = 'rgba(40,40,40,0.5)';
        ctx.beginPath();
        ctx.arc(carX + carW * 0.2, carY + carH + 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(carX + carW * 0.75, carY + carH + 1, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    _drawPedestrianIcon(x, surfaceY, w, hPx) {
        const ctx = this.ctx;
        const midY = surfaceY + hPx / 2;
        const spacing = 10;

        ctx.save();
        ctx.fillStyle = 'rgba(100,100,100,0.5)';

        for (let px = x + spacing; px < x + w - spacing; px += spacing) {
            // 身体
            ctx.beginPath();
            ctx.arc(px, midY - 4, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // 身体线
            ctx.strokeStyle = 'rgba(100,100,100,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px, midY - 1.5);
            ctx.lineTo(px, midY + 4);
            ctx.stroke();
            // 腿
            ctx.beginPath();
            ctx.moveTo(px, midY + 4);
            ctx.lineTo(px - 2, midY + 8);
            ctx.moveTo(px, midY + 4);
            ctx.lineTo(px + 2, midY + 8);
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawBicycleIcon(x, surfaceY, w, hPx) {
        const ctx = this.ctx;
        const midY = surfaceY + hPx / 2;
        const spacing = 12;

        ctx.save();
        ctx.fillStyle = 'rgba(80,120,80,0.5)';
        ctx.strokeStyle = 'rgba(80,120,80,0.5)';
        ctx.lineWidth = 1;

        for (let bx = x + spacing / 2; bx < x + w - spacing / 2; bx += spacing) {
            // 车轮
            ctx.beginPath();
            ctx.arc(bx - 3, midY + 2, 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(bx + 3, midY + 2, 3, 0, Math.PI * 2);
            ctx.stroke();
            // 车身
            ctx.beginPath();
            ctx.moveTo(bx - 3, midY + 2);
            ctx.lineTo(bx, midY - 2);
            ctx.lineTo(bx + 3, midY + 2);
            ctx.stroke();
            // 座垫
            ctx.fillStyle = 'rgba(80,120,80,0.6)';
            ctx.fillRect(bx - 1.5, midY - 3, 3, 2);
        }
        ctx.restore();
    }

    _drawUserDefineIcon(el, x, surfaceY, w, hPx) {
        const ctx = this.ctx;

        if (el.UserDefineType === UserDefineType.ParkLane) {
            // 停车位标记
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 3]);
            const midY = surfaceY + hPx / 2;
            ctx.beginPath();
            ctx.moveTo(x + 3, midY);
            ctx.lineTo(x + w - 3, midY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        } else if (el.UserDefineType === UserDefineType.Water) {
            // 水面波纹
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            for (let wy = surfaceY + 3; wy < surfaceY + hPx - 3; wy += 5) {
                ctx.beginPath();
                for (let wx = x; wx < x + w; wx += 2) {
                    const wy2 = wy + Math.sin((wx - x) * 0.3) * 2;
                    if (wx === x) ctx.moveTo(wx, wy2);
                    else ctx.lineTo(wx, wy2);
                }
                ctx.stroke();
            }
            ctx.restore();
        } else if (el.UserDefineType === UserDefineType.Overpass) {
            // 高架桥墩
            ctx.save();
            ctx.fillStyle = '#90A4AE';
            const pierW = Math.min(w * 0.3, 8);
            ctx.fillRect(x + w / 2 - pierW / 2, surfaceY, pierW, hPx + 20);
            ctx.fillStyle = '#B0BEC5';
            ctx.fillRect(x + w / 2 - w * 0.4, surfaceY - 8, w * 0.8, 8);
            ctx.restore();
        }
    }

    // ==================== 调节手柄 ====================

    _drawResizeHandles(x, surfaceY, w, hPx, baseDepth) {
        const ctx = this.ctx;
        const handleSize = 6;

        // 左边缘手柄
        ctx.fillStyle = '#0066FF';
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(x - handleSize / 2, surfaceY + (hPx + baseDepth) / 2 - handleSize / 2, handleSize, handleSize);
        ctx.fill();
        ctx.stroke();

        // 右边缘手柄
        ctx.beginPath();
        ctx.rect(x + w - handleSize / 2, surfaceY + (hPx + baseDepth) / 2 - handleSize / 2, handleSize, handleSize);
        ctx.fill();
        ctx.stroke();
    }

    // ==================== 标注线绘制 ====================

    _drawDimensions(startX) {
        if (!this.showDimensions) return;

        const ctx = this.ctx;
        const h = this.properHeight;
        const baseY = h * 0.68;
        const dimY = baseY + 55;
        const tickHeight = 8;
        const textOffset = 14;

        ctx.save();
        ctx.strokeStyle = '#555';
        ctx.fillStyle = '#333';
        ctx.font = '11px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 1;

        let x = startX;

        for (const el of this.model.EleList) {
            const w = el.EleWidthPx;
            if (w <= 0) continue;

            // 标注线
            ctx.beginPath();
            ctx.moveTo(x, baseY + 5);
            ctx.lineTo(x, dimY + tickHeight);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x + w, baseY + 5);
            ctx.lineTo(x + w, dimY + tickHeight);
            ctx.stroke();

            // 水平线
            ctx.strokeStyle = '#999';
            ctx.beginPath();
            ctx.moveTo(x, dimY);
            ctx.lineTo(x + w, dimY);
            ctx.stroke();
            ctx.moveTo(x, dimY - 3);
            ctx.lineTo(x, dimY + 3);
            ctx.stroke();
            ctx.moveTo(x + w, dimY - 3);
            ctx.lineTo(x + w, dimY + 3);
            ctx.stroke();

            // 宽度文字
            ctx.fillStyle = '#333';
            const label = el.EleWidth.toFixed(2) + 'm';
            ctx.fillText(label, x + w / 2, dimY - 4);

            // 类型名
            if (w > 40) {
                ctx.fillStyle = '#777';
                ctx.font = '9px "Microsoft YaHei", sans-serif';
                ctx.fillText(el.EleTypeName, x + w / 2, dimY + textOffset);
                ctx.font = '11px "Microsoft YaHei", sans-serif';
            }

            x += w;
        }

        // 总宽度标注
        const totalPx = this.model.TotalWidth * EleScale;
        const totalDimY = dimY + 30;
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(startX, dimY + 5);
        ctx.lineTo(startX, totalDimY + tickHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(startX + totalPx, dimY + 5);
        ctx.lineTo(startX + totalPx, totalDimY + tickHeight);
        ctx.stroke();
        ctx.strokeStyle = '#555';
        ctx.beginPath();
        ctx.moveTo(startX, totalDimY);
        ctx.lineTo(startX + totalPx, totalDimY);
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
        ctx.fillText('总宽 ' + this.model.TotalWidth.toFixed(2) + 'm', startX + totalPx / 2, totalDimY - 4);

        ctx.restore();
    }

    // ==================== 交互处理 ====================

    /**
     * 获取鼠标所在元素索引
     */
    getElementAt(screenX, screenY) {
        const world = this.screenToWorld(screenX, screenY);
        const h = this.properHeight;
        const baseY = h * 0.68;
        const totalPx = this.model.TotalWidth * EleScale;
        const startX = (this.properWidth - totalPx) / 2;

        let x = startX;
        for (let i = 0; i < this.model.EleList.length; i++) {
            const w = this.model.EleList[i].EleWidthPx;
            if (w <= 0) continue;

            const elY = baseY - this.model.EleList[i].EleHeightPx;
            if (world.x >= x && world.x <= x + w && world.y >= elY && world.y <= baseY + 30) {
                return i;
            }
            x += w;
        }
        return -1;
    }

    /**
     * 鼠标按下
     */
    onMouseDown(screenX, screenY, button) {
        const idx = this.getElementAt(screenX, screenY);

        if (button === 0) {
            if (idx >= 0) {
                this.selectedIndex = idx;
                // 检查是否点击调节手柄
                const el = this.model.EleList[idx];
                const w = el.EleWidthPx;
                const world = this.screenToWorld(screenX, screenY);

                // 计算元素位置
                const totalPx = this.model.TotalWidth * EleScale;
                const startX = (this.properWidth - totalPx) / 2;
                let elX = startX;
                for (let i = 0; i < idx; i++) {
                    elX += this.model.EleList[i].EleWidthPx;
                }

                const handleMargin = 8 / this.scale;
                if (Math.abs(world.x - elX) < handleMargin) {
                    this.resizing = { index: idx, edge: 'left', startX: screenX, startWidth: el.EleWidth };
                } else if (Math.abs(world.x - (elX + w)) < handleMargin) {
                    this.resizing = { index: idx, edge: 'right', startX: screenX, startWidth: el.EleWidth };
                } else {
                    this.isDragging = true;
                    this.dragStartX = screenX;
                    this.dragStartY = screenY;
                    this.dragTranslateX = this.translateX;
                    this.dragTranslateY = this.translateY;
                }
            } else {
                this.selectedIndex = -1;
                this.isDragging = true;
                this.dragStartX = screenX;
                this.dragStartY = screenY;
                this.dragTranslateX = this.translateX;
                this.dragTranslateY = this.translateY;
            }
        }
    }

    /**
     * 鼠标移动
     */
    onMouseMove(screenX, screenY) {
        if (this.resizing) {
            const delta = (screenX - this.resizing.startX) / this.scale;
            const deltaMeters = delta / EleScale;
            const el = this.model.EleList[this.resizing.index];
            let newWidth = this.resizing.startWidth + deltaMeters;

            if (this.resizing.edge === 'left') {
                // 左侧拖拽：影响当前元素和前一个元素
                newWidth = this.resizing.startWidth - deltaMeters;
                // 简化处理：只调当前元素
            }

            newWidth = Math.max(el.MinWidth, Math.min(el.MaxWidth, newWidth));
            el.EleWidth = newWidth;
            this.render();
            return;
        }

        if (this.isDragging) {
            const dx = screenX - this.dragStartX;
            const dy = screenY - this.dragStartY;
            this.translateX = this.dragTranslateX + dx;
            this.translateY = this.dragTranslateY + dy;
            this.render();
            return;
        }

        // 悬停检测
        const idx = this.getElementAt(screenX, screenY);
        if (idx !== this.hoveredIndex) {
            this.hoveredIndex = idx;
            this.canvas.style.cursor = this.resizing ? 'ew-resize' : (idx >= 0 ? 'pointer' : 'grab');
            this.render();
        }
    }

    /**
     * 鼠标释放
     */
    onMouseUp() {
        this.isDragging = false;
        this.resizing = null;
    }

    /**
     * 滚轮缩放
     */
    onWheel(screenX, screenY, deltaY) {
        const oldScale = this.scale;
        if (deltaY < 0) {
            this.scale = Math.min(this.maxScale, this.scale * 1.1);
        } else {
            this.scale = Math.max(this.minScale, this.scale / 1.1);
        }

        // 以鼠标位置为中心缩放
        const rect = this.canvas.getBoundingClientRect();
        const mx = screenX - rect.left - rect.width / 2;
        const my = screenY - rect.top - rect.height / 2;
        const ratio = this.scale / oldScale;
        this.translateX = mx + ratio * (this.translateX - mx);
        this.translateY = my + ratio * (this.translateY - my);

        this.render();
    }

    /**
     * 删除选中元素
     */
    deleteSelected() {
        if (this.selectedIndex >= 0) {
            this.model.RemoveElement(this.selectedIndex);
            this.selectedIndex = -1;
            this.render();
        }
    }
}
