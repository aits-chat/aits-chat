/**
 * 交叉口数据模型 - 从 WPF Cross/Road/EntranceBasic 等转译
 */

// ======== 默认颜色 ========
const DefaultColors = {
  background: { r: 90, g: 90, b: 90 },      // 道路背景（沥青灰）
  sidewalk:   { r: 225, g: 129, b: 96 },     // 人行道
  nonMotor:   { r: 250, g: 226, b: 180 },    // 非机动车道
  green:      { r: 86,  g: 155, b: 0 },      // 绿化
  incline:    { r: 226, g: 149, b: 159 },    // 缓坡
  pedStop:    { r: 190, g: 182, b: 107 },    // 行人驻足区
};

function rgbStr(c) { return `rgb(${c.r},${c.g},${c.b})`; }

// ======== 车道 ========
class EntranceLane {
  constructor(laneId) {
    this.laneId = laneId;
    this.laneFun = LaneSigning.None;    // 车道功能
    this.laneSaturatedFlow = 1500;      // 饱和流率
    this.laneCap = 0;                   // 通行能力
    this.laneDegree = 0;                // 饱和度
  }
}

// ======== 出口车道 ========
class ApproachLane {
  constructor() {
    this.laneWidth = 3.0;   // m
  }
}

// ======== 横断面元素 ========
class SectionElement {
  constructor(type, width, dir) {
    this.elementType = type;            // 1-18
    this.elementWidth = width || 0;     // m
    this.elementDirection = dir || 0;   // 0=Null, 1=Come(进口), 2=Go(出口)
  }
}

// Section Element Types
const ET = {
  Sidewalk: 1, NonMotor: 2, MixedLane: 3, BigLane: 4,
  BusLane: 5, BusHarbour: 7, ExtraWiden: 8,
  BusStation: 9, BRTStation: 10,
  CenterIso: 11, SameDirIso: 12, MachineNonIso: 13,
  HumanNonIso: 14, HumanMachineIso: 15, MarkingIso: 16,
  Other: 17, IsoBelt: 18
};

// ======== 过街横道 ========
class CrosswalkAcross {
  constructor() {
    this.type = 2;          // 0=双实线, 1=全斑马, 2=区分划线
    this.M = 4;             // 偏移值 (2-10)
    this.L = 10;            // 横道总长 (4-10)
    this.L1 = 4;            // 非机动车道
    this.H = 0;             // 停车线距横道距离
    this.firstRangeOffset = this.M * MULTIPLE;
    this.secondRangeOffset = (this.M + this.L) * MULTIPLE;
    this.drawL1 = this.L1 * MULTIPLE;
    this.hasGentleIncline = false;
    this.gentleInclineOffset = 0;
  }
}

// ======== 道路 ========
class Road {
  constructor(id, name, direction, roadCount) {
    this.roadId = id;
    this.roadName = name || ('路' + id);
    this.direction = direction || 0;    // 角度（度）
    this.redLineLength = 40;            // 红线宽度 m
    this.roadEntranceNum = 3;           // 进口车道数
    this.roadApproachNum = 3;           // 出口车道数
    this.roadNumType = 0;

    // 横断面元素
    this.crossSectionsElementList = [];

    // 车道
    this.entranceLaneList = [];         // EntranceLane[]
    this.approachLaneList = [];         // ApproachLane[]

    // 过街
    this.crosswalkAcrossInfo = new CrosswalkAcross();

    // 中央隔离
    this.centreIsolationType = 0;       // 0=单黄线, 1=双黄线, 2=实体绿化, -1=不存在
    this.centreIsolationWidth = 0.5;

    // 非机动车道 / 人行道
    this.nonMotorLeft = 0; this.nonMotorRight = 0;
    this.sidewalkLeft = 0; this.sidewalkRight = 0;
    this.machineNonIsoLeft = 0; this.machineNonIsoRight = 0;
    this.humanNonIsoLeft = 0; this.humanNonIsoRight = 0;

    // 道路文本
    this.fontSize = 28;
    this.fontFamily = 'sans-serif';
    this.textColor = { r: 255, g: 0, b: 0 };

    // 象限（由几何计算填充）
    this.quadrant = 0;
    this.dRoadAngle = direction;
  }

  /** 总进口宽度 (m) */
  get entranceWidth() {
    return this.entranceLaneList.reduce((s, l) => s + 3.0, 0);
  }

  /** 总出口宽度 (m) */
  get approachWidth() {
    return this.approachLaneList.reduce((s, l) => s + (l.laneWidth || 3.0), 0);
  }

  /** 道路总宽度 (m): 进口+出口+中央隔离 */
  get totalWidth() {
    return this.entranceWidth + this.approachWidth + this.centreIsolationWidth;
  }

  /** 进口半宽 */
  get entranceHalf() { return this.totalWidth / 2; }
  /** 出口半宽 */
  get approachHalf() { return this.totalWidth / 2; }

  /** 设置车道数 */
  setLaneCounts(entrance, approach) {
    this.roadEntranceNum = entrance;
    this.roadApproachNum = approach;
    this.entranceLaneList = [];
    for (let i = 0; i < entrance; i++) {
      this.entranceLaneList.push(new EntranceLane(i + 1));
    }
    this.approachLaneList = [];
    for (let i = 0; i < approach; i++) {
      this.approachLaneList.push(new ApproachLane());
    }
  }
}

// ======== 交叉口 ========
class Cross {
  constructor() {
    this.crossId = 0;
    this.crossName = '交叉口设计方案1';
    this.crossType = 1;           // 1=信号控制, 2=无控制
    this.crossDrawType = 0;       // 0=直接左转, 1=二次过街
    this.roadLinkList = [];
    this.flowInfoList = [];
    this.phaseInfoList = [];

    // 颜色配置
    this.bgColor = { ...DefaultColors.background };
    this.sidewalkColor = { ...DefaultColors.sidewalk };
    this.nonMotorColor = { ...DefaultColors.nonMotor };
    this.greenColor = { ...DefaultColors.green };
    this.inclineColor = { ...DefaultColors.incline };
    this.pedStopColor = { ...DefaultColors.pedStop };
  }

  /** 获取道路总条数 */
  get roadCount() { return this.roadLinkList.length; }

  /** 获取某条路的相邻路索引（逆时针） */
  prevRoadIndex(i) { return (i - 1 + this.roadCount) % this.roadCount; }
  nextRoadIndex(i) { return (i + 1) % this.roadCount; }
}

/** 创建默认四叉口 */
function createDefault4Way() {
  const cross = new Cross();
  cross.crossName = '四叉口信号交叉口';

  // 4条路: 东(0°) → 南(90°) → 西(180°) → 北(270°)
  const angles = [0, 90, 180, 270];
  const names = ['东进口', '南进口', '西进口', '北进口'];

  for (let i = 0; i < 4; i++) {
    const road = new Road((i + 1).toString(), names[i], angles[i], 4);
    road.setLaneCounts(3, 3);
    // 添加人行道和非机动车道
    road.sidewalkRight = 3.0;
    road.sidewalkLeft = 3.0;
    road.nonMotorRight = 2.5;
    road.nonMotorLeft = 2.5;
    road.machineNonIsoRight = 1.5;
    road.machineNonIsoLeft = 1.5;
    road.centreIsolationType = 1;  // 双黄线
    road.centreIsolationWidth = 0.5;

    cross.roadLinkList.push(road);
  }

  return cross;
}

/** 创建默认三叉口 */
function createDefault3Way() {
  const cross = new Cross();
  cross.crossName = '三叉口信号交叉口';

  const angles = [0, 120, 240];
  const names = ['东进口', '西南进口', '西北进口'];

  for (let i = 0; i < 3; i++) {
    const road = new Road((i + 1).toString(), names[i], angles[i], 3);
    road.setLaneCounts(3, 2);
    road.sidewalkRight = 2.5;
    road.sidewalkLeft = 2.5;
    road.nonMotorRight = 2.0;
    road.nonMotorLeft = 2.0;
    road.machineNonIsoRight = 1.0;
    road.machineNonIsoLeft = 1.0;
    cross.roadLinkList.push(road);
  }

  return cross;
}
