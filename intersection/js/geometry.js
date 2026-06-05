/**
 * 交叉口几何计算引擎 v2 - 完全重写
 * 简化为道路-中心对称模型
 */

class IntersectionGeom {
  constructor(center, roads, drawType = 0) {
    this.center = center;
    this.roads = roads;
    this.roadCount = roads.length;
    this.drawType = drawType;
    this.radiusLen = DEFAULT_RADIUS;

    // 基础几何（保持与原 WPF 一致）
    this.bsIntersectPos = [];
    this.bsRoadUpPos = [];
    this.bsRoadDnPos = [];
    this.bsMiddlePos = [];
    this.bsCornerCenter = [];
    this.bsRadius = [];
    this.bsInterAng = [];
    this.bsEntrance = [];
    this.bsApproach = [];
    this.bsCrosswalkPos = [];

    // 图层几何
    this.roadCenters = [];      // 每条路的交叉口边界中点 {x,y}
    this.roadBoarders = [];     // 道路多边形 Point[4] (梯形)
    this.nonVehicles = [];      // 非机动车道矩形 Point[4][]
    this.sidewalks = [];        // 人行道矩形 Point[4][]
    this.crosswalks = [];       // 人行横道 Point[4][]
    this.roadCenterLines = [];
    this.roadStopLines = [];
    this.roadGreens = [];       // 绿化带

    // 交叉口中心区域
    this.centerPoints = [];
  }

  init() {
    this._initParameters();
    this._calcBaseBoarder();
    this._calcRoadGeometry();
    this._calcCrosswalk();
    this._calcGreen();
  }

  _initParameters() {
    for (let i = 0; i < this.roadCount; i++) {
      this.bsEntrance[i] = this.roads[i].entranceWidth * MULTIPLE;
      this.bsApproach[i] = this.roads[i].approachWidth * MULTIPLE;
    }
  }

  /** === 基础坐标（与WPF兼容） === */
  _calcBaseBoarder() {
    const roads = this.roads;
    const n = this.roadCount;

    // 计算总宽度（包含人行道/非机动车）
    for (let i = 0; i < n; i++) {
      const r = roads[i];
      const isoW = r.centreIsolationWidth * MULTIPLE;
      let total = isoW + this.bsEntrance[i] + this.bsApproach[i];
      total += (r.sidewalkRight + r.nonMotorRight + r.machineNonIsoRight) * MULTIPLE;
      total += (r.sidewalkLeft + r.nonMotorLeft + r.machineNonIsoLeft) * MULTIPLE;
      this.bsEntrance[i] = Math.max(total / 2, this.bsEntrance[i]);
      this.bsApproach[i] = Math.max(total / 2, this.bsApproach[i]);
    }

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const rd = roads[i];
      const rdNext = roads[j];
      const angI = Utils.normAngleDeg(rd.dRoadAngle);
      const angJ = Utils.normAngleDeg(rdNext.dRoadAngle);
      let ang = angJ;
      if (ang <= angI) ang += 360;
      const diff = ang - angI;
      this.bsInterAng[i] = diff;
      const midAng = (angI + angJ) / 2;

      const entryHalf = this.bsEntrance[i];
      const apprHalf = this.bsApproach[j];
      const sinDiff = Math.sin(diff * Math.PI / 180);

      if (sinDiff < 0.001) {
        this.bsIntersectPos[i] = Utils.moveByVec(this.center, entryHalf, midAng);
      } else {
        let tmp = Utils.moveByVec(this.center, entryHalf / sinDiff, Utils.normAngleDeg(angJ - 180));
        tmp = Utils.moveByVec(tmp, apprHalf / sinDiff, Utils.normAngleDeg(angI + 180));
        this.bsIntersectPos[i] = tmp;
      }

      const tanHalf = Math.tan(diff * Math.PI / 360);
      this.bsRadius[i] = this.radiusLen * tanHalf;

      if (tanHalf > 0.001) {
        this.bsRoadUpPos[i] = Utils.moveByVec(this.bsIntersectPos[i], this.bsRadius[i] / tanHalf, angI);
        this.bsRoadDnPos[i] = Utils.moveByVec(this.bsIntersectPos[i], this.bsRadius[i] / tanHalf, angJ);
      } else {
        this.bsRoadUpPos[i] = { ...this.bsIntersectPos[i] };
        this.bsRoadDnPos[i] = { ...this.bsIntersectPos[i] };
      }

      const sinHalf = Math.sin(diff * Math.PI / 360);
      if (sinHalf > 0.001) {
        const len = this.bsRadius[i] / sinHalf;
        this.bsMiddlePos[i] = Utils.moveByVec(this.bsIntersectPos[i], len, midAng);
        this.bsCornerCenter[i] = { ...this.bsMiddlePos[i] };
      } else {
        this.bsMiddlePos[i] = { ...this.bsIntersectPos[i] };
        this.bsCornerCenter[i] = { ...this.bsIntersectPos[i] };
      }
    }
  }

  /** === 核心：计算每条道路的完整几何 === */
  _calcRoadGeometry() {
    const n = this.roadCount;
    const LEN = ROAD_VISIBLE_LEN;
    const M = MULTIPLE;
    const laneW = 3.0 * M;

    this.centerPoints = [];
    this.roadBoarders = [];
    this.nonVehicles = [];
    this.sidewalks = [];
    this.roadCenterLines = [];
    this.roadGreens = [];

    for (let i = 0; i < n; i++) {
      const road = this.roads[i];
      const prevI = this.previousIndex(i);
      const ang = road.dRoadAngle;

      // --- 1. 道路中心线定位 ---
      const upPt = this.bsRoadUpPos[i];
      const dnPt = this.bsRoadDnPos[prevI];
      const cx = (upPt.x + dnPt.x) / 2;
      const cy = (upPt.y + dnPt.y) / 2;
      const midPt = { x: cx, y: cy };

      this.roadCenters[i] = midPt;
      this.roadCenterLines[i] = midPt;
      // 交叉口中心区使用道路中点（比up点更准确匹配边界）
      this.centerPoints.push({ x: cx, y: cy });

      // 方向约定：ang = 路从交叉口延伸出去的方向
      const dirOut = Utils.normAngleDeg(ang);           // 远离交叉口
      const dirRight = Utils.normAngleDeg(ang + 90);    // 右侧（进口侧）
      const dirLeft = Utils.normAngleDeg(ang - 90);     // 左侧（出口侧）

      // --- 2. 停车线偏移（条带从此处开始，不伸入交叉口） ---
      const stopOffset = 8 * M;

      // --- 3. 计算各层宽度偏移 ---
      const isoHalf = road.centreIsolationWidth * M / 2;
      const entryW = road.roadEntranceNum * laneW;
      const apprW = road.roadApproachNum * laneW;

      // 右侧（进口）：机动车 → 机非隔离 → 非机动车 → 人行道
      const rightMotorEdge = isoHalf + entryW;
      const rightNonMotorStart = rightMotorEdge + road.machineNonIsoRight * M;
      const rightNonMotorEnd = rightNonMotorStart + road.nonMotorRight * M;
      const rightTotal = rightNonMotorEnd + road.sidewalkRight * M;

      // 左侧（出口）：镜像
      const leftMotorEdge = isoHalf + apprW;
      const leftNonMotorStart = leftMotorEdge + road.machineNonIsoLeft * M;
      const leftNonMotorEnd = leftNonMotorStart + road.nonMotorLeft * M;
      const leftTotal = leftNonMotorEnd + road.sidewalkLeft * M;

      // --- 3. 道路底板（梯形，覆盖全部宽度） ---
      const nearRight = Utils.moveByVec(midPt, rightTotal, dirRight);
      const nearLeft = Utils.moveByVec(midPt, leftTotal, dirLeft);
      const farRight = Utils.moveByVec(nearRight, LEN, dirOut);
      const farLeft = Utils.moveByVec(nearLeft, LEN, dirOut);

      this.roadBoarders[i] = [nearRight, nearLeft, farLeft, farRight];

      // --- 4. 非机动车道（两侧各一个矩形，从停车线开始） ---
      // 右侧非机动车道
      if (road.nonMotorRight > 0) {
        const nearBase = Utils.moveByVec(midPt, stopOffset, dirOut);
        const nvNearInner = Utils.moveByVec(nearBase, rightNonMotorStart, dirRight);
        const nvNearOuter = Utils.moveByVec(nearBase, rightNonMotorEnd, dirRight);
        const nvFarInner = Utils.moveByVec(nvNearInner, LEN, dirOut);
        const nvFarOuter = Utils.moveByVec(nvNearOuter, LEN, dirOut);
        this.nonVehicles.push([nvNearInner, nvFarInner, nvFarOuter, nvNearOuter]);
      }
      // 左侧非机动车道
      if (road.nonMotorLeft > 0) {
        const nearBase = Utils.moveByVec(midPt, stopOffset, dirOut);
        const nvNearInner = Utils.moveByVec(nearBase, leftNonMotorStart, dirLeft);
        const nvNearOuter = Utils.moveByVec(nearBase, leftNonMotorEnd, dirLeft);
        const nvFarInner = Utils.moveByVec(nvNearInner, LEN, dirOut);
        const nvFarOuter = Utils.moveByVec(nvNearOuter, LEN, dirOut);
        this.nonVehicles.push([nvNearInner, nvFarInner, nvFarOuter, nvNearOuter]);
      }

      // --- 5. 人行道（两侧各一个矩形，从停车线开始） ---
      // 右侧人行道
      if (road.sidewalkRight > 0) {
        const nearBase = Utils.moveByVec(midPt, stopOffset, dirOut);
        const swW = road.sidewalkRight * M;
        const swNearInner = Utils.moveByVec(nearBase, rightNonMotorEnd, dirRight);
        const swNearOuter = Utils.moveByVec(nearBase, rightTotal, dirRight);
        const swFarInner = Utils.moveByVec(swNearInner, LEN, dirOut);
        const swFarOuter = Utils.moveByVec(swNearOuter, LEN, dirOut);
        this.sidewalks.push([swNearInner, swFarInner, swFarOuter, swNearOuter]);
      }
      // 左侧人行道
      if (road.sidewalkLeft > 0) {
        const nearBase = Utils.moveByVec(midPt, stopOffset, dirOut);
        const swW = road.sidewalkLeft * M;
        const swNearInner = Utils.moveByVec(nearBase, leftNonMotorEnd, dirLeft);
        const swNearOuter = Utils.moveByVec(nearBase, leftTotal, dirLeft);
        const swFarInner = Utils.moveByVec(swNearInner, LEN, dirOut);
        const swFarOuter = Utils.moveByVec(swNearOuter, LEN, dirOut);
        this.sidewalks.push([swNearInner, swFarInner, swFarOuter, swNearOuter]);
      }

      // --- 6. 绿化隔离带（从停车线开始） ---
      const greens = [];
      const greenBase = Utils.moveByVec(midPt, stopOffset, dirOut);
      const greenLen = LEN - stopOffset;
      // 右侧机非隔离
      if (road.machineNonIsoRight > 0) {
        const offset = rightMotorEdge + road.machineNonIsoRight * M / 2;
        const pos = Utils.moveByVec(greenBase, offset, dirRight);
        greens.push({
          pos, dir: dirOut,
          width: road.machineNonIsoRight * M,
          length: greenLen
        });
      }
      // 左侧机非隔离
      if (road.machineNonIsoLeft > 0) {
        const offset = leftMotorEdge + road.machineNonIsoLeft * M / 2;
        const pos = Utils.moveByVec(greenBase, offset, dirLeft);
        greens.push({
          pos, dir: dirOut,
          width: road.machineNonIsoLeft * M,
          length: greenLen
        });
      }
      // 中央隔离带（实体绿化）
      if (road.centreIsolationType === 2) {
        greens.push({
          pos: greenBase, dir: dirOut,
          width: road.centreIsolationWidth * M,
          length: greenLen, endCap: true
        });
      }
      this.roadGreens[i] = greens;
    }
  }

  /** === 人行横道 === */
  _calcCrosswalk() {
    const n = this.roadCount;
    const M = MULTIPLE;

    for (let i = 0; i < n; i++) {
      const road = this.roads[i];
      const cw = road.crosswalkAcrossInfo;
      const ang = road.dRoadAngle;
      const midPt = this.roadCenters[i];
      if (!midPt) { this.crosswalks[i] = null; continue; }

      const dirOut = Utils.normAngleDeg(ang);
      const dirRight = Utils.normAngleDeg(ang + 90);

      // 计算偏移
      const offset1 = cw.firstRangeOffset;  // 第一道线距停止线
      const offset2 = cw.secondRangeOffset; // 第二道线距停止线

      const laneW = 3.0 * M;
      const entryTotal = road.roadEntranceNum * laneW;
      const isoHalf = road.centreIsolationWidth * M / 2;

      // 人行横道横跨进口车道（在停止线与交叉口边界之间，向外偏移）
      const p0 = Utils.moveByVec(midPt, isoHalf, dirRight);
      const p1 = Utils.moveByVec(p0, offset1, dirOut);
      const p2 = Utils.moveByVec(p0, offset2, dirOut);
      const p3 = Utils.moveByVec(
        Utils.moveByVec(midPt, isoHalf + entryTotal, dirRight),
        offset1, dirOut
      );
      const p4 = Utils.moveByVec(
        Utils.moveByVec(midPt, isoHalf + entryTotal, dirRight),
        offset2, dirOut
      );

      this.crosswalks[i] = [p1, p2, p4, p3];
    }
  }

  /** === 绿化隔离 === */
  _calcGreen() {
    // Already computed in _calcRoadGeometry
  }

  previousIndex(i) { return (i - 1 + this.roadCount) % this.roadCount; }
  nextIndex(i) { return (i + 1) % this.roadCount; }
}
