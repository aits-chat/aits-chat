/**
 * Canvas 2D 渲染引擎 v10 - v1.5 条带截断到停车线，彻底消除转角花瓣
 * 2026-06-05: geometry 层将非机动车/人行道/绿化带 near 端从 midPt 移到 stopOffset(8m)
 *            canvas-render 层简化 _fillRoundedStrip 为直边矩形
 *            _drawIntersectionArea 去掉转角弧带，中心多边形覆盖停车线内全部区域
 */

class IntersectionRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.geom = null;
    this.cross = null;

    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.width = rect.width;
    this.height = rect.height;
  }

  draw(cross) {
    this.cross = cross;
    this._resize();

    this.geom = new IntersectionGeom(
      { x: this.width / 2 + this.offsetX, y: this.height / 2 + this.offsetY },
      cross.roadLinkList,
      cross.crossDrawType
    );
    this.geom.init();

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    // 画布底色与路面一致，避免道路板之间透出异色背景
    ctx.fillStyle = rgbStr(cross.bgColor);
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    const cx = this.width / 2;
    const cy = this.height / 2;
    ctx.translate(cx, cy);
    ctx.scale(this.scale, this.scale);
    ctx.translate(this.offsetX / this.scale, this.offsetY / this.scale);
    ctx.translate(-cx, -cy);

    // 图层顺序
    this._drawRoadBoard();     // L0: 道路灰色底板
    this._drawNonVehicle();    // L1: 非机动车道（彩色条带）
    this._drawSidewalk();      // L2: 人行道（彩色条带）
    this._drawLanes();         // L3: 机动车道块
    this._drawGreen();         // L4: 绿化隔离带
    this._drawLaneSeps();      // L5: 车道分隔线 + 停止线
    this._drawCenterLine();    // L6: 中央隔离线
    this._drawRoadSigns();     // L7: 方向箭头
    this._drawCrosswalk();     // L8: 人行横道
    this._drawIntersectionArea(); // L9: 交叉口中心区 + 转角弧
    this._drawRoadNames();     // L10: 道路名称

    ctx.restore();
  }

  /** === L0: 道路灰色底板 === */
  _drawRoadBoard() {
    const ctx = this.ctx;
    const g = this.geom;
    ctx.fillStyle = rgbStr(this.cross.bgColor);

    for (let i = 0; i < g.roadCount; i++) {
      const ps = g.roadBoarders[i];
      if (!ps || ps.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(ps[0].x, ps[0].y);
      for (let j = 1; j < ps.length; j++) ctx.lineTo(ps[j].x, ps[j].y);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** === L1: 非机动车道（彩色条带，交叉口端圆角） === */
  _drawNonVehicle() {
    const ctx = this.ctx;
    ctx.fillStyle = rgbStr(this.cross.nonMotorColor);
    for (const pts of this.geom.nonVehicles) {
      if (!pts || pts.length < 4) continue;
      this._fillRoundedStrip(ctx, pts);
    }
  }

  /** === L2: 人行道（彩色条带，交叉口端圆角） === */
  _drawSidewalk() {
    const ctx = this.ctx;
    ctx.fillStyle = rgbStr(this.cross.sidewalkColor);
    for (const pts of this.geom.sidewalks) {
      if (!pts || pts.length < 4) continue;
      this._fillRoundedStrip(ctx, pts);
    }
  }

  /** 填充矩形条（停车线处直边，远端圆角） */
  _fillRoundedStrip(ctx, pts) {
    // pts = [nearInner, farInner, farOuter, nearOuter]
    // near 端直边（停车线截断处），far 端保留小圆角
    const r = MULTIPLE * 4;
    const v01 = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
    const l01 = Math.sqrt(v01.x * v01.x + v01.y * v01.y);
    if (l01 < r * 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.closePath();
      ctx.fill();
      return;
    }
    const u01 = { x: v01.x / l01, y: v01.y / l01 };
    ctx.beginPath();
    // near 端：直边（不圆角）
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.closePath();
    ctx.fill();
  }

  /** === L3: 机动车道块（仅边框标记，底色由L0提供） === */
  _drawLanes() {
    // 车道底色已由 _drawRoadBoard 统一绘制
    // 车道分隔线在 _drawLaneSeps 中处理
    // 此层保留为空，方便后续扩展（如车道编号标记）
  }

  /** === L4: 绿化隔离带（矩形圆角填充条） === */
  _drawGreen() {
    const ctx = this.ctx;
    const g = this.geom;
    const LEN = ROAD_VISIBLE_LEN;

    ctx.fillStyle = rgbStr(this.cross.greenColor);
    for (let i = 0; i < g.roadCount; i++) {
      const greens = g.roadGreens[i];
      if (!greens) continue;
      for (const gr of greens) {
        if (!gr || !gr.pos) continue;
        const w = Math.max(gr.width || 6, 4);
        const dir = gr.dir;
        const len = gr.length || LEN;

        // 构建4点矩形条：[nearInner, farInner, farOuter, nearOuter]
        const nearInner = Utils.moveByVec(gr.pos, w / 2, dir + 90);
        const nearOuter = Utils.moveByVec(gr.pos, w / 2, dir - 90);
        const farInner = Utils.moveByVec(nearInner, len, dir);
        const farOuter = Utils.moveByVec(nearOuter, len, dir);

        this._fillRoundedStrip(ctx, [nearInner, farInner, farOuter, nearOuter]);
      }
    }
  }

  /** === L5: 车道分隔线 + 停止线 === */
  _drawLaneSeps() {
    const ctx = this.ctx;
    const g = this.geom;
    const M = MULTIPLE;
    const LEN = ROAD_VISIBLE_LEN;
    const laneW = 3.0 * M;

    for (let i = 0; i < g.roadCount; i++) {
      const road = this.cross.roadLinkList[i];
      const midPt = g.roadCenters[i];
      if (!midPt) continue;

      const ang = road.dRoadAngle;
      const dirOut = Utils.normAngleDeg(ang);
      const dirRight = Utils.normAngleDeg(ang + 90);
      const dirLeft = Utils.normAngleDeg(ang - 90);
      const isoHalf = road.centreIsolationWidth * M / 2;

      // === 停止线（进口道最前端，退后8m远离交叉口） ===
      const stopOffset = 8 * M;  // 8m offset from intersection boundary
      const stopStart = Utils.moveByVec(midPt, isoHalf, dirLeft);
      const stopEnd = Utils.moveByVec(midPt, isoHalf + road.roadEntranceNum * laneW, dirLeft);
      const stopStartOut = Utils.moveByVec(stopStart, stopOffset, dirOut);
      const stopEndOut = Utils.moveByVec(stopEnd, stopOffset, dirOut);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.0 * M;       // 中等粗实线（≈5px）
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(stopStartOut.x, stopStartOut.y);
      ctx.lineTo(stopEndOut.x, stopEndOut.y);
      ctx.stroke();

      // === 进口车道分隔线（虚线，沿路方向，从停车线开始向外） ===
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.25 * M;
      ctx.setLineDash([6, 9]);

      for (let k = 1; k < road.roadEntranceNum; k++) {
        const offset = isoHalf + k * laneW;
        const pt = Utils.moveByVec(midPt, offset, dirRight);
        const ptFromStop = Utils.moveByVec(pt, stopOffset, dirOut);
        const endPt = Utils.moveByVec(pt, LEN, dirOut);
        ctx.beginPath();
        ctx.moveTo(ptFromStop.x, ptFromStop.y);
        ctx.lineTo(endPt.x, endPt.y);
        ctx.stroke();
      }

      // === 出口车道分隔线（从停车线开始向外） ===
      for (let k = 1; k < road.roadApproachNum; k++) {
        const offset = isoHalf + k * laneW;
        const pt = Utils.moveByVec(midPt, offset, dirLeft);
        const ptFromStop = Utils.moveByVec(pt, stopOffset, dirOut);
        const endPt = Utils.moveByVec(pt, LEN, dirOut);
        ctx.beginPath();
        ctx.moveTo(ptFromStop.x, ptFromStop.y);
        ctx.lineTo(endPt.x, endPt.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  /** === L6: 中央隔离线 === */
  _drawCenterLine() {
    const ctx = this.ctx;
    const g = this.geom;
    const M = MULTIPLE;
    const LEN = ROAD_VISIBLE_LEN;

    for (let i = 0; i < g.roadCount; i++) {
      const road = this.cross.roadLinkList[i];
      const midPt = g.roadCenters[i];
      if (!midPt) continue;

      const ang = road.dRoadAngle;
      const dirOut = Utils.normAngleDeg(ang);
      const dirRight = Utils.normAngleDeg(ang + 90);
      const isoW = road.centreIsolationWidth * M;
      const farPt = Utils.moveByVec(midPt, LEN, dirOut);

      switch (road.centreIsolationType) {
        case -1: // 不存在
          break;
        case 0: // 单黄实线
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 0.3 * M;
          ctx.beginPath();
          ctx.moveTo(midPt.x, midPt.y);
          ctx.lineTo(farPt.x, farPt.y);
          ctx.stroke();
          break;
        case 1: // 双黄实线
          {
            const off = isoW / 4;
            const pR = Utils.moveByVec(midPt, off, dirRight);
            const pL = Utils.moveByVec(midPt, off, dirLeft);
            const pRf = Utils.moveByVec(pR, LEN, dirOut);
            const pLf = Utils.moveByVec(pL, LEN, dirOut);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 0.2 * M;
            ctx.beginPath();
            ctx.moveTo(pR.x, pR.y); ctx.lineTo(pRf.x, pRf.y);
            ctx.moveTo(pL.x, pL.y); ctx.lineTo(pLf.x, pLf.y);
            ctx.stroke();
          }
          break;
        case 2: // 实体绿化(已在_drawGreen中处理)
          break;
        case 3: // 虚线
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 0.2 * M;
          ctx.setLineDash([2 * M, 4 * M]);
          ctx.beginPath();
          ctx.moveTo(midPt.x, midPt.y);
          ctx.lineTo(farPt.x, farPt.y);
          ctx.stroke();
          ctx.setLineDash([]);
          break;
      }
    }
  }

  /** === L7: 方向箭头 === */
  _drawRoadSigns() {
    const ctx = this.ctx;
    const g = this.geom;
    const M = MULTIPLE;
    const laneW = 3.0 * M;

    for (let i = 0; i < g.roadCount; i++) {
      const road = this.cross.roadLinkList[i];
      const midPt = g.roadCenters[i];
      if (!midPt) continue;

      const ang = road.dRoadAngle;
      const dirOut = Utils.normAngleDeg(ang);
      const dirRight = Utils.normAngleDeg(ang + 90);
      const isoHalf = road.centreIsolationWidth * M / 2;

      for (let k = 0; k < road.roadEntranceNum; k++) {
        const lane = road.entranceLaneList[k];
        if (!lane || lane.laneFun === LaneSigning.None) continue;

        const offset = isoHalf + (k + 0.5) * laneW;
        const laneCenter = Utils.moveByVec(midPt, offset, dirRight);
        // 箭头放在车道中部（距停止线约 3 个车道宽）
        const arrowPt = Utils.moveByVec(laneCenter, laneW * 3, dirOut);

        this._drawLaneArrow(arrowPt.x, arrowPt.y, ang, lane.laneFun, laneW * 0.55);
      }
    }
  }

  _drawLaneArrow(x, y, roadAngle, laneFun, size) {
    const ctx = this.ctx;
    const s = size || 10 * MULTIPLE;

    ctx.save();
    ctx.translate(x, y);
    // 箭头指向道路延伸方向
    ctx.rotate((roadAngle - 90) * Math.PI / 180);

    switch (laneFun) {
      case LaneSigning.GoStraight:
        this._triArrow(ctx, 0, -s * 0.7, 0, s); break;
      case LaneSigning.LeftTurning:
        this._triArrow(ctx, -s * 0.5, 0, s * 0.8, 0); break;
      case LaneSigning.RightTurning:
        this._triArrow(ctx, s * 0.5, 0, -s * 0.8, 0); break;
      case LaneSigning.StraightLeft:
        this._triArrow(ctx, -s * 0.45, s * 0.1, s * 0.7, 0);
        this._triArrow(ctx, 0, -s * 0.7, 0, s); break;
      case LaneSigning.StraightRight:
        this._triArrow(ctx, s * 0.45, s * 0.1, -s * 0.7, 0);
        this._triArrow(ctx, 0, -s * 0.7, 0, s); break;
      case LaneSigning.LeftRight:
        this._triArrow(ctx, -s * 0.4, s * 0.1, s * 0.7, 0);
        this._triArrow(ctx, s * 0.4, s * 0.1, -s * 0.7, 0); break;
      case LaneSigning.LeftStraightRight:
        this._triArrow(ctx, -s * 0.4, s * 0.15, s * 0.65, 0);
        this._triArrow(ctx, 0, -s * 0.7, 0, s);
        this._triArrow(ctx, s * 0.4, s * 0.15, -s * 0.65, 0); break;
      case LaneSigning.UTurning:
        this._drawUTurn(ctx, s); break;
      default:
        this._triArrow(ctx, 0, -s * 0.7, 0, s);
    }

    ctx.restore();
  }

  _triArrow(ctx, fromX, fromY, toX, toY) {
    const dx = toX - fromX, dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const nx = dx / len, ny = dy / len;
    const perpX = -ny, perpY = nx;

    // 深色外轮廓
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY);
    ctx.stroke();

    const headSize = len * 0.45;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - nx * headSize + perpX * headSize * 0.55,
      toY - ny * headSize + perpY * headSize * 0.55);
    ctx.lineTo(toX - nx * headSize - perpX * headSize * 0.55,
      toY - ny * headSize - perpY * headSize * 0.55);
    ctx.closePath();
    ctx.stroke();

    // 白色填充
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY);
    ctx.stroke();
  }

  _drawUTurn(ctx, size) {
    const s = size * 0.65;
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, s * 0.3, s, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, s * 0.3, s, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s, s * 0.3);
    ctx.lineTo(s - s * 0.35, s * 0.3 - s * 0.35);
    ctx.lineTo(s - s * 0.35, s * 0.3 + s * 0.35);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  /** === L8: 人行横道 === */
  _drawCrosswalk() {
    const ctx = this.ctx;
    const g = this.geom;
    const M = MULTIPLE;

    for (let i = 0; i < g.roadCount; i++) {
      const ps = g.crosswalks[i];
      if (!ps) continue;
      const cw = this.cross.roadLinkList[i].crosswalkAcrossInfo;
      const p0 = ps[0], p1 = ps[1], p2 = ps[2], p3 = ps[3];

      ctx.save();
      switch (cw.type) {
        case 0: // 双粗实线
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5 * M;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y); ctx.lineTo(p3.x, p3.y);
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          break;
        case 1: // 全斑马线
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.4 * M;
          const totalLen = Utils.dist(p0, p3);
          const stripeCount = Math.floor(totalLen / (M * 1.2));
          for (let s = 0; s <= stripeCount; s++) {
            const t = s / Math.max(stripeCount, 1);
            const sx = p0.x + (p3.x - p0.x) * t;
            const sy = p0.y + (p3.y - p0.y) * t;
            const ex = p1.x + (p2.x - p1.x) * t;
            const ey = p1.y + (p2.y - p1.y) * t;
            ctx.beginPath();
            ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
            ctx.stroke();
          }
          break;
        case 2: // 区分划线
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5 * M;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y); ctx.lineTo(p3.x, p3.y);
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.lineWidth = 0.3 * M;
          const slen = Utils.dist(p0, p3);
          const scount = Math.floor(slen / (M * 1.5));
          for (let s = 1; s < scount; s++) {
            const t = s / scount;
            const sx = p0.x + (p3.x - p0.x) * t;
            const sy = p0.y + (p3.y - p0.y) * t;
            const ex = p1.x + (p2.x - p1.x) * t;
            const ey = p1.y + (p2.y - p1.y) * t;
            ctx.beginPath();
            ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
            ctx.stroke();
          }
          break;
      }
      ctx.restore();
    }
  }

  /** === L9: 交叉口中心区 === */
  _drawIntersectionArea() {
    const ctx = this.ctx;
    const g = this.geom;
    const n = g.roadCount;
    if (n < 3) return;

    // 中心多边形填充（覆盖道路板间和停车线内所有间隙）
    if (g.centerPoints && g.centerPoints.length >= 3) {
      ctx.fillStyle = rgbStr(this.cross.bgColor);
      ctx.beginPath();
      ctx.moveTo(g.centerPoints[0].x, g.centerPoints[0].y);
      for (let i = 1; i < g.centerPoints.length; i++) {
        ctx.lineTo(g.centerPoints[i].x, g.centerPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  /** === L10: 道路名称 === */
  _drawRoadNames() {
    const ctx = this.ctx;
    const g = this.geom;
    const M = MULTIPLE;

    for (let i = 0; i < g.roadCount; i++) {
      const road = this.cross.roadLinkList[i];
      const midPt = g.roadCenters[i];
      if (!midPt) continue;

      const ang = road.dRoadAngle;
      const dirOut = Utils.normAngleDeg(ang);

      // 名称放在道路远端，沿路外侧
      const textPt = Utils.moveByVec(midPt, ROAD_VISIBLE_LEN * 0.65, dirOut);

      ctx.save();
      ctx.translate(textPt.x, textPt.y);
      ctx.rotate((ang - 90) * Math.PI / 180);
      ctx.fillStyle = rgbStr(road.textColor);
      ctx.font = `${road.fontSize * 0.5}px ${road.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(road.roadName, 0, 0);
      ctx.restore();
    }
  }

  // ======== 视图操作 ========
  zoom(factor, mx, my) {
    const newScale = Math.max(SCL_MIN, Math.min(SCL_MAX, this.scale * factor));
    if (mx !== undefined && my !== undefined) {
      this.offsetX = mx - (mx - this.offsetX) * (newScale / this.scale);
      this.offsetY = my - (my - this.offsetY) * (newScale / this.scale);
    }
    this.scale = newScale;
  }

  pan(dx, dy) {
    this.offsetX += dx / this.scale;
    this.offsetY += dy / this.scale;
  }

  fitView() {
    if (!this.geom || !this.geom.roadBoarders.length) {
      this.scale = 1.0; this.offsetX = 0; this.offsetY = 0;
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ps of this.geom.roadBoarders) {
      if (!ps) continue;
      for (const p of ps) {
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      }
    }
    if (!isFinite(minX)) { this.scale = 1.0; return; }
    const padding = 60;
    const scaleX = (this.width - padding * 2) / (maxX - minX);
    const scaleY = (this.height - padding * 2) / (maxY - minY);
    this.scale = Math.max(0.1, Math.min(scaleX, scaleY, 3.0));
    this.offsetX = 0; this.offsetY = 0;
  }

  screenToWorld(sx, sy) {
    const cx = this.width / 2, cy = this.height / 2;
    return {
      x: (sx - cx) / this.scale - this.offsetX / this.scale + cx,
      y: (sy - cy) / this.scale - this.offsetY / this.scale + cy
    };
  }

  hitTest(mx, my) {
    const wp = this.screenToWorld(mx, my);
    const g = this.geom;
    if (!g) return null;
    const M = MULTIPLE;
    const laneW = 3.0 * M;
    const hitRadius = 20;

    for (let i = 0; i < g.roadCount; i++) {
      const road = this.cross.roadLinkList[i];
      const midPt = g.roadCenters[i];
      if (!midPt) continue;
      const ang = road.dRoadAngle;
      const dirOut = Utils.normAngleDeg(ang);
      const dirRight = Utils.normAngleDeg(ang + 90);
      const isoHalf = road.centreIsolationWidth * M / 2;

      for (let k = 0; k < road.roadEntranceNum; k++) {
        const offset = isoHalf + (k + 0.5) * laneW;
        const pt = Utils.moveByVec(midPt, offset, dirRight);
        const arrowPt = Utils.moveByVec(pt, laneW * 3, dirOut);
        if (Utils.dist(wp, arrowPt) < hitRadius) {
          return { roadIndex: i, laneIndex: k, road, lane: road.entranceLaneList[k] };
        }
      }
    }
    return null;
  }
}
