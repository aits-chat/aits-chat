/**
 * 横断面设计 - 数据模型
 * 从 WPF C# RoadSectionDesign 迁移至 JavaScript
 */

// ==================== 枚举常量 ====================
const SectionElementDir = { In: 'In', Out: 'Out', NoDirection: 'NoDirection' };
const EleLock = { Lock: 'Lock', UnLock: 'UnLock', NoExist: 'NoExist' };
const RoadType = { Default: 'Default', Driveway: 'Driveway', Pavement: 'Pavement', Earth: 'Earth', Facility: 'Facility' };
const SurfaceType = { PaveMent: 'PaveMent', Asphalt: 'Asphalt', None: 'None', Earth: 'Earth', IsoBelt: 'IsoBelt', Water: 'Water' };
const UserDefineType = { Water: 'Water', Overpass: 'Overpass', ParkLane: 'ParkLane', URoadface: 'URoadface' };
const ImageLocation = { Left: 'Left', Center: 'Center', Right: 'Right' };
const IsoBeltType = { Unknown: 0, Center: 11, SplitFlow: 12, BicVeh: 13, SlowVeh: 14, PedVeh: 15 };
const ArrowDirection = { U: 'U', L: 'L', S: 'S', R: 'R', UL: 'UL', US: 'US', LS: 'LS', LR: 'LR', SR: 'SR', Park: 'Park', None: 'None' };
const LampLocation = { Center: 'Center', Left: 'Left', Right: 'Right' };
const LampType = { OneBrance: 'OneBrance', TwoBrance: 'TwoBrance' };

// 元素类型编码
const EleTypeCode = {
    Pedestrian: 1, Bicycle: 2, MixedVehicle: 3, Truck: 4,
    Bus: 5, BusStop: 9, BRT: 10,
    CenterIso: 11, SplitFlowIso: 12, BicVehIso: 13, SlowVehIso: 14, PedVehIso: 15,
    SplitLine: 16, UserDefine: 17, Tramcar: 18, Undefined: -1
};

// ==================== 全局常量 ====================
const EleScale = 20;        // 米 → 像素
const DefHeight = 400;      // 默认画布高度

// ==================== 地表样式数据 ====================
// 预定义颜色 (RGBA)
const SurfaceColors = {
    Asphalt:   [90, 90, 90, 255],
    Pavement:  [160, 140, 10, 255],
    SplitLine: [27, 27, 27, 255],
    Brick:     [120, 120, 120, 255],
    Earth:     [220, 220, 220, 255],
    Green:     [19, 252, 82, 255],
    Base:      [230, 230, 230, 255],
    White:     [248, 248, 248, 255],
    Water:     [150, 150, 229, 255]
};

// 两种绘图风格的地表样式
const StyleSurfaceTypes = {
    0: [ // Style 0: 经典
        { surfaceType: SurfaceType.None, name: '无', fill: null, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.Asphalt, name: '沥青深色', fill: SurfaceColors.Asphalt, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.Asphalt, name: '沥青红色', fill: [150, 60, 60, 255], stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.Asphalt, name: '沥青绿色', fill: [60, 130, 60, 255], stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.PaveMent, name: '砖灰色', fill: SurfaceColors.Brick, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.PaveMent, name: '砖红色', fill: [170, 100, 80, 255], stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.PaveMent, name: '水泥', fill: [200, 200, 195, 255], stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.Earth, name: '泥土', fill: SurfaceColors.Earth, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.IsoBelt, name: '绿地', fill: SurfaceColors.Green, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.Water, name: '水体', fill: SurfaceColors.Water, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.None, name: '木质', fill: [180, 140, 100, 255], stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.None, name: '白色', fill: SurfaceColors.White, stroke: SurfaceColors.SplitLine, opacity: 1.0 }
    ],
    1: [ // Style 1: 现代
        { surfaceType: SurfaceType.Asphalt, name: '沥青', fill: SurfaceColors.Asphalt, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.PaveMent, name: '铺装灰', fill: SurfaceColors.Pavement, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.PaveMent, name: '铺装棕', fill: [140, 100, 70, 255], stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.Earth, name: '素土', fill: SurfaceColors.Earth, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.IsoBelt, name: '绿地', fill: SurfaceColors.Green, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.Water, name: '水体', fill: SurfaceColors.Water, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.None, name: '灰色', fill: SurfaceColors.Brick, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.None, name: '白色', fill: SurfaceColors.White, stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.None, name: '木质', fill: [180, 140, 100, 255], stroke: SurfaceColors.SplitLine, opacity: 1.0 },
        { surfaceType: SurfaceType.None, name: '地基', fill: SurfaceColors.Base, stroke: SurfaceColors.SplitLine, opacity: 1.0 }
    ]
};

// ==================== 基准参数表 (替代 Access 数据库) ====================
// 按 CJJ 37 城市道路工程设计规范
// key: `${eleType}_${speed}` -> SerialNo -> width
const RoadStandardDB = {
    // 人行道 (TypeId=1)
    '1_无': { 0: 3.0, 1: 3.5, 2: 4.0, 3: 4.5, 4: 5.0, 5: 6.0, 6: 8.0, 7: 10.0 },
    // 非机动车道 (TypeId=2), SpeedInfo="无"
    '2_无': { 0: 2.5, 1: 3.0, 2: 3.5, 3: 4.0, 4: 4.5, 5: 5.0, 6: 6.0 },
    // 综合车道 (TypeId=3)
    '3_20': { 0: 3.0, 1: 3.25, 2: 3.5 },
    '3_30': { 0: 3.25, 1: 3.5 },
    '3_40': { 0: 3.25, 1: 3.5 },
    '3_50': { 0: 3.5 },
    '3_60': { 0: 3.5 },
    // 大车道 (TypeId=4)
    '4_40': { 0: 3.5 },
    '4_50': { 0: 3.5 },
    '4_60': { 0: 3.5, 1: 3.75 },
    '4_80': { 0: 3.75 },
    '4_100': { 0: 3.75 },
    // 公交专用道 (TypeId=5)
    '5_无': { 0: 3.5 },
    // 有轨电车 (TypeId=18)
    '18_无': { 0: 3.5 },
    // 侧向加宽 LateralWidth (TypeId=8)
    '8_≤40': 0.25,
    '8_50': 0.5,
    '8_60': 0.5,
    '8_80': 0.75,
    '8_100': 0.75,
    // 隔离带 (TypeId=11-16)
    '11_无': { 0: 0.5, 1: 1.0, 2: 2.0, 3: 3.0, 4: 4.0, 5: 6.0, 6: 8.0 },
    '12_无': { 0: 0.5, 1: 1.0, 2: 1.5, 3: 2.0, 4: 3.0, 5: 4.0 },
    '13_无': { 0: 0.5, 1: 1.0, 2: 1.5, 3: 2.0, 4: 3.0, 5: 4.0 },
    '14_无': { 0: 0.5, 1: 1.0, 2: 1.5, 3: 2.0, 4: 3.0 },
    '15_无': { 0: 0.5, 1: 1.0, 2: 1.5, 3: 2.0, 4: 3.0 }
};

/**
 * 从参数表查询宽度值
 * @param {number} eleType - 元素类型
 * @param {number} speed - 设计速度 (km/h)
 * @param {number} serialNo - 序列号 (0=初始推荐值)
 * @returns {number|null} 宽度值(米)
 */
function getRoadStandardWidth(eleType, speed, serialNo) {
    let key;
    if ([1, 2, 5, 11, 12, 13, 14, 15, 16, 18].includes(eleType)) {
        key = `${eleType}_无`;
    } else if (eleType === 3) {
        if (speed <= 20) key = '3_20';
        else if (speed <= 40) key = '3_40';
        else key = '3_60';
    } else if (eleType === 4) {
        if (speed <= 50) key = '4_50';
        else if (speed <= 60) key = '4_60';
        else if (speed <= 80) key = '4_80';
        else key = '4_100';
    } else {
        key = `${eleType}_无`;
    }

    const table = RoadStandardDB[key];
    if (!table) return null;

    // 如果serialNo超出范围，用最大值
    const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
    if (serialNo >= keys.length) serialNo = keys[keys.length - 1];
    return table[serialNo] !== undefined ? table[serialNo] : table[keys[keys.length - 1]];
}

/**
 * 获取侧向加宽值
 * @param {number} speed - 设计速度
 * @returns {number}
 */
function getLateralWidth(speed) {
    if (speed <= 40) return 0.25;
    if (speed <= 50) return 0.5;
    if (speed <= 60) return 0.5;
    if (speed <= 80) return 0.75;
    return 0.75;
}

// ==================== 道路等级信息 ====================
class RoadRankInfo {
    /**
     * @param {string} name - 道路等级名称
     * @param {number} speed - 设计速度 (km/h)
     * @param {number} redLineMin - 最小红线宽度
     * @param {number} redLineMax - 最大红线宽度
     * @param {number} laneMin - 最小车道数
     * @param {number} laneMax - 最大车道数
     */
    constructor(name, speed, redLineMin, redLineMax, laneMin, laneMax) {
        this.Name = name;
        this.Speed = speed;
        this.RedLineMin = redLineMin;
        this.RedLineMax = redLineMax;
        this.LaneMin = laneMin;
        this.LaneMax = laneMax;
    }

    clone() {
        return new RoadRankInfo(this.Name, this.Speed, this.RedLineMin, this.RedLineMax, this.LaneMin, this.LaneMax);
    }

    toString() { return this.Name; }
}

// 预定义道路等级 (CJJ 37)
const RoadRanks = {
    Expressway:  new RoadRankInfo('快速路', 80, 40, 80, 4, 8),
    Arterial60:  new RoadRankInfo('主干路(60)', 60, 40, 60, 4, 8),
    Arterial50:  new RoadRankInfo('主干路(50)', 50, 35, 55, 4, 6),
    Arterial40:  new RoadRankInfo('主干路(40)', 40, 30, 50, 4, 6),
    Collector40: new RoadRankInfo('次干路(40)', 40, 25, 40, 2, 4),
    Collector30: new RoadRankInfo('次干路(30)', 30, 20, 35, 2, 4),
    Branch30:    new RoadRankInfo('支路(30)', 30, 16, 30, 2, 4),
    Branch20:    new RoadRankInfo('支路(20)', 20, 12, 24, 2, 2)
};

const RoadRankOptions = [
    RoadRanks.Expressway, RoadRanks.Arterial60, RoadRanks.Arterial50, RoadRanks.Arterial40,
    RoadRanks.Collector40, RoadRanks.Collector30, RoadRanks.Branch30, RoadRanks.Branch20
];

// ==================== 断面元素基类 ====================
class SectionElement {
    constructor() {
        this._eleType = -1;
        this._eleWidth = 0;
        this._eleHeight = 0;
        this._maxWidth = 100;
        this._minWidth = 0;
        this._maxHeight = 15;
        this._minHeight = -15;
        this._direction = SectionElementDir.NoDirection;
        this._location = ImageLocation.Center;
        this._eleLock = EleLock.UnLock;
        this._roadType = RoadType.Default;
        this._surfaceType = SurfaceType.None;
        this._arrowDirection = ArrowDirection.None;
        this._hasLateralWidth = false;
        this._surfaceStyleIndex = 0;  // 地表样式索引
    }

    // --- Getters/Setters ---
    get EleType() { return this._eleType; }
    set EleType(v) { this._eleType = v; }

    get EleWidth() { return this._eleWidth; }
    set EleWidth(v) {
        this._eleWidth = Math.max(this._minWidth, Math.min(this._maxWidth, v));
    }

    get EleHeight() { return this._eleHeight; }
    set EleHeight(v) {
        this._eleHeight = Math.max(this._minHeight, Math.min(this._maxHeight, v));
    }

    get MaxWidth() { return this._maxWidth; }
    set MaxWidth(v) { this._maxWidth = v; }

    get MinWidth() { return this._minWidth; }
    set MinWidth(v) { this._minWidth = v; }

    get MaxHeight() { return this._maxHeight; }
    set MaxHeight(v) { this._maxHeight = v; }

    get MinHeight() { return this._minHeight; }
    set MinHeight(v) { this._minHeight = v; }

    get Direction() { return this._direction; }
    set Direction(v) { this._direction = v; }

    get Location() { return this._location; }
    set Location(v) { this._location = v; }

    get EleLock() { return this._eleLock; }
    set EleLock(v) { this._eleLock = v; }

    get IsLocked() { return this._eleLock !== EleLock.UnLock; }

    get RoadType() { return this._roadType; }
    set RoadType(v) { this._roadType = v; }

    get SurfaceType() { return this._surfaceType; }
    set SurfaceType(v) { this._surfaceType = v; }

    get ArrowDirection() { return this._arrowDirection; }
    set ArrowDirection(v) { this._arrowDirection = v; }

    get HasLateralWidth() { return this._hasLateralWidth; }
    set HasLateralWidth(v) { this._hasLateralWidth = v; }

    get SurfaceStyleIndex() { return this._surfaceStyleIndex; }
    set SurfaceStyleIndex(v) { this._surfaceStyleIndex = Math.max(0, Math.min(v, 11)); }

    get EleTypeName() {
        const names = {
            1: '人行道', 2: '非机动车道', 3: '综合车道', 4: '大车道', 5: '公交车道',
            9: '公交站', 10: 'BRT站',
            11: '中央隔离', 12: '同向隔离', 13: '机非隔离', 14: '慢行隔离', 15: '人机隔离',
            16: '标线', 17: '自定义', 18: '有轨电车', [-1]: '未定义'
        };
        return names[this._eleType] || '未定义';
    }

    get EleWidthPx() { return this._eleWidth * EleScale; }
    get EleHeightPx() { return this._eleHeight * EleScale; }

    /**
     * 克隆数据（浅拷贝关键属性用于序列化）
     */
    toJSON() {
        return {
            eleType: this._eleType, eleWidth: this._eleWidth, eleHeight: this._eleHeight,
            direction: this._direction, location: this._location, eleLock: this._eleLock,
            roadType: this._roadType, surfaceType: this._surfaceType,
            arrowDirection: this._arrowDirection, hasLateralWidth: this._hasLateralWidth,
            surfaceStyleIndex: this._surfaceStyleIndex
        };
    }

    /**
     * 从JSON恢复
     */
    static fromJSON(json) {
        const el = new SectionElement();
        Object.assign(el, {
            _eleType: json.eleType, _eleWidth: json.eleWidth, _eleHeight: json.eleHeight,
            _direction: json.direction, _location: json.location, _eleLock: json.eleLock,
            _roadType: json.roadType, _surfaceType: json.surfaceType,
            _arrowDirection: json.arrowDirection, _hasLateralWidth: json.hasLateralWidth,
            _surfaceStyleIndex: json.surfaceStyleIndex || 0
        });
        return el;
    }
}

// ==================== 机动车道 ====================
class VehicleElement extends SectionElement {
    /**
     * @param {number} eleType - 3=综合, 4=大车, 5=公交, 18=有轨电车
     * @param {string} direction - 'In'|'Out'
     */
    constructor(eleType = 3, direction = SectionElementDir.In) {
        super();
        this._eleType = eleType;
        this._direction = direction;
        this._eleLock = EleLock.UnLock;
        this._eleWidth = 0;
        this._eleHeight = 0.8;
        this._hasLateralWidth = false;
        this._minWidth = 2;
        this._maxWidth = 10;
        this._minHeight = -15;
        this._maxHeight = 15;
        this._location = ImageLocation.Center;
        this._arrowDirection = ArrowDirection.S;
        this._surfaceType = SurfaceType.Asphalt;
        this._roadType = RoadType.Driveway;
        this._surfaceStyleIndex = 0;
    }
}

// ==================== 人行道 ====================
class PedestrianElement extends SectionElement {
    constructor() {
        super();
        this._eleType = 1;
        this._eleLock = EleLock.UnLock;
        this._eleWidth = 0;
        this._eleHeight = 1;
        this._minWidth = 1;
        this._maxWidth = 50;
        this._location = ImageLocation.Center;
        this._surfaceType = SurfaceType.PaveMent;
        this._roadType = RoadType.Pavement;
        this._surfaceStyleIndex = 1; // 默认铺装灰
    }
}

// ==================== 非机动车道 ====================
class BicycleElement extends SectionElement {
    /**
     * @param {string} direction - 'In'|'Out'
     */
    constructor(direction = SectionElementDir.In) {
        super();
        this._eleType = 2;
        this._direction = direction;
        this._eleLock = EleLock.UnLock;
        this._eleWidth = 0;
        this._eleHeight = 0.8;
        this._minWidth = 1;
        this._maxWidth = 50;
        this._location = ImageLocation.Center;
        this._surfaceType = SurfaceType.Asphalt;
        this._roadType = RoadType.Driveway;
        this._surfaceStyleIndex = 0;
    }
}

// ==================== 公交站 ====================
class BusStopElement extends SectionElement {
    /**
     * @param {number} eleType - 9=普通公交站, 10=BRT站
     */
    constructor(eleType = 9) {
        super();
        this._eleType = eleType;
        this._eleLock = EleLock.UnLock;
        this._eleWidth = 0;
        this._eleHeight = 1;
        this._minWidth = 1;
        this._maxWidth = 20;
        this._location = ImageLocation.Left;
        this._surfaceType = SurfaceType.None;
        this._roadType = RoadType.Facility;
        this._surfaceStyleIndex = 8; // 绿地
    }
}

// ==================== 隔离带 ====================
class IsoBeltElement extends SectionElement {
    /**
     * @param {number} isoBeltType - 11=中央, 12=同向, 13=机非, 14=慢行, 15=人机
     */
    constructor(isoBeltType = IsoBeltType.Center) {
        super();
        this._eleType = isoBeltType;
        this._isoBeltType = isoBeltType;
        this._eleLock = EleLock.UnLock;
        this._eleWidth = 0;
        this._eleHeight = 1;
        this._isHardIsoBelt = true;  // true=实体隔离, false=标线
        this._minWidth = 0.25;
        this._maxWidth = 50;
        this._location = ImageLocation.Center;
        this._surfaceType = SurfaceType.IsoBelt;
        this._roadType = RoadType.Earth;
        this._surfaceStyleIndex = 4; // 绿地
        // 附件配置
        this._hasBush = false;
        this._hasTree = false;
        this._hasBarrier = false;
        this._hasLamp = false;
        this._lampLocation = LampLocation.Center;
        this._lampType = LampType.OneBrance;
    }

    get IsoBeltType() { return this._isoBeltType; }
    get IsHardIsoBelt() { return this._isHardIsoBelt; }
    set IsHardIsoBelt(v) { this._isHardIsoBelt = v; }

    get HasBush() { return this._hasBush; }
    get HasTree() { return this._hasTree; }
    get HasBarrier() { return this._hasBarrier; }
    get HasLamp() { return this._hasLamp; }
    get LampLocation() { return this._lampLocation; }
    set LampLocation(v) { this._lampLocation = v; }
    get Lamptype() { return this._lampType; }

    /**
     * 设置隔离带附件
     */
    SetIsobeltType(hasBush, hasTree, hasBarrier, hasLamp) {
        this._hasBush = hasBush;
        this._hasTree = hasTree;
        this._hasBarrier = hasBarrier;
        this._hasLamp = hasLamp;
    }

    /**
     * 初始化隔离带附件（根据宽度自动判断）
     */
    InitAttachmentsByWidth() {
        const w = this._eleWidth;
        const t = this._isoBeltType;

        if (t === IsoBeltType.Center) {
            if (w > 0.5) {
                this.SetIsobeltType(false, true, false, false);
                this._eleHeight = 1;
            } else {
                this.SetIsobeltType(false, false, false, false);
                this._eleHeight = 1;
                this._isHardIsoBelt = false;
                this._eleType = 16; // 标线
            }
        } else if (t === IsoBeltType.SplitFlow) {
            if (w > 0.5) {
                this.SetIsobeltType(true, true, false, false);
            } else {
                this.SetIsobeltType(false, false, true, false);
            }
        } else if (t === IsoBeltType.BicVeh) {
            if (w > 0.5) {
                this.SetIsobeltType(true, true, true, true);
            } else {
                this.SetIsobeltType(false, false, true, false);
            }
        } else if (t === IsoBeltType.SlowVeh) {
            if (w > 0.5) {
                this.SetIsobeltType(true, false, false, false);
            } else {
                this.SetIsobeltType(true, false, false, false);
            }
        } else if (t === IsoBeltType.PedVeh) {
            if (w > 0.5) {
                this.SetIsobeltType(true, true, false, false);
            } else {
                this.SetIsobeltType(true, false, false, false);
            }
        }
    }
}

// ==================== 用户自定义元素 ====================
class UserDefineElement extends SectionElement {
    /**
     * @param {string} userDefineType - 'Water'|'Overpass'|'ParkLane'|'URoadface'
     * @param {string} location - 'Left'|'Center'|'Right'
     */
    constructor(userDefineType = UserDefineType.URoadface, location = ImageLocation.Center) {
        super();
        this._eleType = 17;
        this._userDefineType = userDefineType;
        this._eleLock = EleLock.NoExist;
        this._location = location;

        switch (userDefineType) {
            case UserDefineType.Water:
                this._eleHeight = -5;
                this._maxHeight = 0;
                this._minHeight = -15;
                this._eleWidth = 5;
                this._minWidth = 2;
                this._maxWidth = 100;
                this._surfaceType = SurfaceType.Water;
                this._roadType = RoadType.Facility;
                this._surfaceStyleIndex = 5; // 水体
                break;
            case UserDefineType.Overpass:
                this._eleHeight = 1;
                this._eleWidth = 5;
                this._minWidth = 2;
                this._maxWidth = 100;
                this._surfaceType = SurfaceType.IsoBelt;
                this._roadType = RoadType.Facility;
                this._surfaceStyleIndex = 4; // 绿地
                break;
            case UserDefineType.ParkLane:
                this._eleHeight = 0.8;
                this._eleWidth = 5;
                this._minWidth = 2;
                this._maxWidth = 100;
                this._surfaceType = SurfaceType.Asphalt;
                this._roadType = RoadType.Driveway;
                this._surfaceStyleIndex = 0;
                break;
            case UserDefineType.URoadface:
            default:
                this._eleHeight = 0.8;
                this._eleWidth = 0.5;
                this._minWidth = 0.25;
                this._maxWidth = 5;
                this._surfaceType = SurfaceType.Asphalt;
                this._roadType = RoadType.Driveway;
                this._surfaceStyleIndex = 0;
                break;
        }
    }

    get UserDefineType() { return this._userDefineType; }

    get EleTypeName() {
        const names = {
            Water: '河水', Overpass: '高架', ParkLane: '停车带', URoadface: '路缘石'
        };
        return names[this._userDefineType] || '自定义';
    }
}

// ==================== 道路输入参数 ====================
class RoadInputPara {
    constructor() {
        this.Id = 0;
        this.Name = '';
        this.Rank = RoadRanks.Arterial50.clone();  // 默认主干路50
        this.LaneNo = 4;
        this.RedLineLength = 40;
        this.InLaneNo = 2;
        this.OutLaneNo = 2;
    }
}

// ==================== 横断面数据模型 ====================
class RoadSectionModel {
    constructor() {
        this.RoadInputPara = new RoadInputPara();
        this.EleList = [];
        this.StyleIndex = 0;        // 0=经典, 1=现代
        this.CanvasHeight = 400;
        this.RoadName = '';
    }

    get Speed() { return this.RoadInputPara.Rank.Speed; }
    get RedLineLength() { return this.RoadInputPara.RedLineLength; }
    set RedLineLength(v) { this.RoadInputPara.RedLineLength = v; }

    get TotalWidth() {
        return this.EleList.reduce((sum, el) => sum + el.EleWidth, 0);
    }

    /**
     * 生成默认横断面元素序列（镜像对称）
     */
    InitSectionSeries() {
        this.EleList = [];
        const rank = this.RoadInputPara.Rank;
        const speed = rank.Speed;
        const laneNo = this.RoadInputPara.LaneNo;
        const inLaneNo = Math.ceil(laneNo / 2);
        const outLaneNo = laneNo - inLaneNo;

        // 判断是否需要中央隔离带
        const isBranchOrCollector = rank.Name.includes('支路') || rank.Name.includes('次干路');
        const needCenterIso = speed > 30 && !isBranchOrCollector && laneNo >= 4;

        // === 左侧：从外到内 (人行道 → ... → 机动车道) ===
        // 1. 人行道 (左侧)
        this.EleList.push(new PedestrianElement());
        // 2. 人非隔离
        this.EleList.push(new IsoBeltElement(IsoBeltType.PedVeh));
        // 3. 非机动车道(In)
        this.EleList.push(new BicycleElement(SectionElementDir.In));

        // 4. 机非隔离 (如果总车道数>2)
        if (laneNo > 2) {
            this.EleList.push(new IsoBeltElement(IsoBeltType.BicVeh));
        }

        // 5. 机动车道(In) - 由内到外分配
        for (let i = 0; i < inLaneNo; i++) {
            // 最内侧=大车，其余=综合
            const eleType = (i === 0 && (rank.Name.includes('快速路') || rank.Name.includes('主干路'))) ? 4 : 3;
            this.EleList.push(new VehicleElement(eleType, SectionElementDir.In));
        }

        // === 中央隔离带 ===
        if (needCenterIso) {
            this.EleList.push(new IsoBeltElement(IsoBeltType.Center));
        }

        // === 右侧：从内到外 (机动车道 → ... → 人行道) ===
        // 6. 机动车道(Out)
        for (let i = 0; i < outLaneNo; i++) {
            const eleType = (i === 0 && (rank.Name.includes('快速路') || rank.Name.includes('主干路'))) ? 4 : 3;
            this.EleList.push(new VehicleElement(eleType, SectionElementDir.Out));
        }

        // 7. 机非隔离
        if (laneNo > 2) {
            this.EleList.push(new IsoBeltElement(IsoBeltType.BicVeh));
        }

        // 8. 非机动车道(Out)
        this.EleList.push(new BicycleElement(SectionElementDir.Out));
        // 9. 人非隔离
        this.EleList.push(new IsoBeltElement(IsoBeltType.PedVeh));
        // 10. 人行道 (右侧)
        this.EleList.push(new PedestrianElement());

        // 插入路缘石
        this.InsertSideTrip();

        // 修正隔离带类型
        this.CorrectIsoBeltType();
    }

    /**
     * 插入路缘石 (车辆与隔离带之间)
     */
    InsertSideTrip() {
        const curbWidth = this.Speed <= 40 ? 0.5 : 1.0;
        const newList = [];

        for (let i = 0; i < this.EleList.length; i++) {
            const el = this.EleList[i];
            newList.push(el);

            // 检查当前元素是否为车辆
            if (el.EleType >= 3 && el.EleType <= 5 || el.EleType === 18) {
                // 检查下一个元素是否为隔离带
                const next = this.EleList[i + 1];
                if (next && next instanceof IsoBeltElement) {
                    const curb = new UserDefineElement(UserDefineType.URoadface, ImageLocation.Center);
                    curb.EleWidth = curbWidth;
                    newList.push(curb);
                }
            }

            // 检查当前是否为隔离带，下一个为车辆
            if (el instanceof IsoBeltElement) {
                const next = this.EleList[i + 1];
                if (next && (next.EleType >= 3 && next.EleType <= 5 || next.EleType === 18)) {
                    const curb = new UserDefineElement(UserDefineType.URoadface, ImageLocation.Center);
                    curb.EleWidth = curbWidth;
                    newList.push(curb);
                }
            }
        }

        this.EleList = newList;
    }

    /**
     * 修正隔离带类型（根据相邻元素）
     */
    CorrectIsoBeltType() {
        for (let i = 0; i < this.EleList.length; i++) {
            const el = this.EleList[i];
            if (!(el instanceof IsoBeltElement)) continue;

            const prev = i > 0 ? this.EleList[i - 1] : null;
            const next = i < this.EleList.length - 1 ? this.EleList[i + 1] : null;

            // 根据相邻元素确定隔离带类型
            const prevIsVehicle = prev && (prev.EleType >= 3 && prev.EleType <= 5 || prev.EleType === 18);
            const nextIsVehicle = next && (next.EleType >= 3 && next.EleType <= 5 || next.EleType === 18);
            const prevIsBicycle = prev && prev.EleType === 2;
            const nextIsBicycle = next && next.EleType === 2;
            const prevIsPed = prev && prev.EleType === 1;
            const nextIsPed = next && next.EleType === 1;

            if (prevIsVehicle && nextIsVehicle) {
                el._isoBeltType = IsoBeltType.Center;
                el._eleType = 11;
            } else if ((prevIsVehicle && (nextIsBicycle || nextIsPed)) || ((prevIsBicycle || prevIsPed) && nextIsVehicle)) {
                el._isoBeltType = IsoBeltType.BicVeh;
                el._eleType = 13;
            } else if ((prevIsBicycle && nextIsPed) || (prevIsPed && nextIsBicycle)) {
                el._isoBeltType = IsoBeltType.SlowVeh;
                el._eleType = 14;
            }
        }
    }

    /**
     * 核心宽度计算
     */
    CalculateElementWidth() {
        const speed = this.Speed;
        const redLine = this.RedLineLength;

        // 重置所有未锁定元素宽度
        for (const el of this.EleList) {
            if (!el.IsLocked) el.EleWidth = 0;
        }

        const lateralWidth = getLateralWidth(speed);

        // 按类型分组计算
        for (let serialNo = 0; serialNo < 32; serialNo++) {
            let totalW = 0;

            for (const el of this.EleList) {
                if (el.IsLocked) {
                    totalW += el.EleWidth;
                    continue;
                }

                const eleType = el.EleType;
                if (eleType <= 0 || eleType === 17) continue;

                let width = getRoadStandardWidth(eleType, speed, serialNo);
                if (width === null) continue;

                // 车辆侧向加宽
                if (el.HasLateralWidth) {
                    width += lateralWidth;
                }

                // 隔离带特殊处理
                if (el instanceof IsoBeltElement) {
                    if (serialNo === 0) {
                        width = getRoadStandardWidth(eleType, speed, 0) || 0.5;
                    } else {
                        width += (serialNo - 1) * 0.25;
                        width = Math.min(width, el.MaxWidth);
                    }
                }

                el.EleWidth = width;
                totalW += width;
            }

            // 第一条记录最低红线
            if (serialNo === 0) {
                this._queryMinRedLine = totalW;
            }

            // 如果已达到红线宽度
            if (totalW >= redLine && serialNo > 0) {
                // 尝试校正多余宽度
                const excess = totalW - redLine;
                this._distributeExcess(excess);
                break;
            }
        }

        // 分配剩余红线宽度
        const remaining = redLine - this.TotalWidth;
        if (remaining > 0) {
            this.AssignmentExceedWidth(remaining);
        }

        // 清除零宽度元素
        this.EleList = this.EleList.filter(el => el.EleWidth > 0 || el.IsLocked);

        // 初始化隔离带附件
        this.InitIsoBeltAndLampType();
    }

    /**
     * 分配多余宽度（优先给隔离带）
     */
    _distributeExcess(excess) {
        const isoElements = this.EleList.filter(el => el instanceof IsoBeltElement);
        for (const iso of isoElements) {
            if (excess <= 0) break;
            const deduct = Math.min(excess, 0.25);
            iso.EleWidth = Math.max(iso.MinWidth, iso.EleWidth - deduct);
            excess -= deduct;
        }
    }

    /**
     * 分配剩余红线宽度
     */
    AssignmentExceedWidth(remaining) {
        const isoElements = this.EleList.filter(el => el instanceof IsoBeltElement);
        if (isoElements.length === 0) return;

        const perIso = remaining / isoElements.length;
        for (const iso of isoElements) {
            iso.EleWidth = Math.min(iso.MaxWidth, iso.EleWidth + perIso);
        }
    }

    /**
     * 初始化隔离带附件和路灯配置
     */
    InitIsoBeltAndLampType() {
        for (let i = 0; i < this.EleList.length; i++) {
            const el = this.EleList[i];
            if (!(el instanceof IsoBeltElement)) continue;
            el.InitAttachmentsByWidth();
        }
    }

    /**
     * 获取路段总宽度查询最小值
     */
    GetTheQueryMinRedLineLength() {
        return this._queryMinRedLine || 0;
    }

    /**
     * 添加元素到指定位置
     */
    AddElement(element, index = -1) {
        if (index < 0 || index >= this.EleList.length) {
            this.EleList.push(element);
        } else {
            this.EleList.splice(index, 0, element);
        }
    }

    /**
     * 删除指定位置的元素
     */
    RemoveElement(index) {
        if (index >= 0 && index < this.EleList.length) {
            this.EleList.splice(index, 1);
        }
    }

    // ===== 简化接口 (供渲染器和控制器使用) =====

    /** 获取简单元素数组 */
    get elements() {
        return this.EleList.map(el => ({
            type: this._getSimpleType(el),
            width: el.EleWidth,
            height: el.EleHeight,
            surfaceHeight: el.EleHeight,
            surfaceType: this._getSurfaceTypeIndex(el),
            turnTypes: this._getTurnTypes(el),
            turnCount: this._getTurnCount(el),
            direction: el.Direction || 'Out',
            isoType: el instanceof IsoBeltElement ? el.IsoBeltType : undefined,
            hasBarrier: el instanceof IsoBeltElement ? el.HasBarrier : false,
            hasTree: el instanceof IsoBeltElement ? el.HasTree : false,
            hasBush: el instanceof IsoBeltElement ? el.HasBush : false,
            hasLamp: el instanceof IsoBeltElement ? el.HasLamp : false,
            userDefineType: el instanceof UserDefineElement ? el.UserDefineType : undefined,
            _raw: el
        }));
    }

    get totalWidth() { return this.TotalWidth; }
    get totalLaneCount() { return this.RoadInputPara.LaneNo; }
    get redLineWidth() { return this.RoadInputPara.RedLineLength; }
    set redLineWidth(v) { this.RoadInputPara.RedLineLength = v; }
    get sideViewType() { return 'House'; }
    get sideViewHeight() { return 0; }
    get sideViewRetreat() { return 2; }

    _getSimpleType(el) {
        const t = el.EleType;
        if (t === 1) return 'Pedestrian';
        if (t === 2) return 'Bicycle';
        if ([3,4,5].includes(t)) {
            if (t === 4) return 'Truck';
            if (t === 5) return 'Bus';
            return 'Vehicle';
        }
        if (t === 18) return 'Tramcar';
        if ([9,10].includes(t)) return 'BusStop';
        if ([11,12,13,14,15].includes(t)) return 'IsoBelt';
        if (t === 17) return 'UserDefine';
        return 'Vehicle';
    }

    _getSurfaceTypeIndex(el) {
        const st = el.SurfaceType;
        if (st === SurfaceType.Asphalt) return 0;
        if (st === SurfaceType.PaveMent) return 3;
        if (st === SurfaceType.Earth) return 7;
        if (st === SurfaceType.IsoBelt) return 8;
        if (st === SurfaceType.Water) return 9;
        return 0;
    }

    _getTurnTypes(el) {
        if (el instanceof VehicleElement) {
            const count = this._getTurnCount(el);
            if (el.Direction === 'In') return Array(count).fill('S');
            return Array(count).fill('S');
        }
        return [];
    }

    _getTurnCount(el) {
        if (el instanceof VehicleElement) {
            return el.Direction === 'In' ? this.RoadInputPara.InLaneNo : this.RoadInputPara.OutLaneNo;
        }
        return 0;
    }

    recalc() { this.CalculateElementWidth(); }

    static createFromGrade(gradeIndex) {
        const model = new RoadSectionModel();
        const rank = RoadRankOptions[gradeIndex] || RoadRanks.Arterial50;
        model.RoadInputPara.Rank = rank;
        model.RoadInputPara.LaneNo = Math.min(rank.LaneMax, 4);
        model.RoadInputPara.InLaneNo = Math.ceil(model.RoadInputPara.LaneNo / 2);
        model.RoadInputPara.OutLaneNo = model.RoadInputPara.LaneNo - model.RoadInputPara.InLaneNo;
        model.RoadInputPara.RedLineLength = rank.RedLineMin + 10;
        model.RoadInputPara.Name = rank.Name;
        model.InitSectionSeries();
        model.CalculateElementWidth();
        return model;
    }

    static createElement(type, userDefineType) {
        switch (type) {
            case 'Vehicle': return new VehicleElement(3, SectionElementDir.Out);
            case 'Bus': return new VehicleElement(5, SectionElementDir.Out);
            case 'Truck': return new VehicleElement(4, SectionElementDir.Out);
            case 'Tramcar': return new VehicleElement(18, SectionElementDir.Out);
            case 'Pedestrian': return new PedestrianElement();
            case 'Bicycle': return new BicycleElement(SectionElementDir.Out);
            case 'IsoBelt': return new IsoBeltElement(IsoBeltType.Center);
            case 'BusStop': return new BusStopElement(9);
            case 'UserDefine': return new UserDefineElement(userDefineType || UserDefineType.URoadface);
            default: return null;
        }
    }

    /**
     * 序列化为JSON
     */
    toJSON() {
        return {
            version: '2.1.0-web',
            roadInputPara: {
                id: this.RoadInputPara.Id,
                name: this.RoadInputPara.Name,
                rankName: this.RoadInputPara.Rank.Name,
                speed: this.RoadInputPara.Rank.Speed,
                laneNo: this.RoadInputPara.LaneNo,
                redLineLength: this.RoadInputPara.RedLineLength,
                inLaneNo: this.RoadInputPara.InLaneNo,
                outLaneNo: this.RoadInputPara.OutLaneNo
            },
            eleList: this.EleList.map(el => {
                const json = el.toJSON();
                // 额外保存子类型信息
                if (el instanceof IsoBeltElement) {
                    json.isoBeltType = el._isoBeltType;
                    json.hasBush = el._hasBush;
                    json.hasTree = el._hasTree;
                    json.hasBarrier = el._hasBarrier;
                    json.hasLamp = el._hasLamp;
                    json.lampLocation = el._lampLocation;
                }
                if (el instanceof UserDefineElement) {
                    json.userDefineType = el._userDefineType;
                }
                if (el instanceof VehicleElement) {
                    json.eleType = el.EleType;
                }
                return json;
            }),
            styleIndex: this.StyleIndex,
            canvasHeight: this.CanvasHeight,
            roadName: this.RoadName
        };
    }

    /**
     * 从JSON恢复
     */
    static fromJSON(json) {
        const model = new RoadSectionModel();
        model.RoadInputPara = new RoadInputPara();
        model.RoadInputPara.Name = json.roadInputPara.name || '';
        model.RoadInputPara.RedLineLength = json.roadInputPara.redLineLength || 40;
        model.RoadInputPara.LaneNo = json.roadInputPara.laneNo || 4;
        model.RoadInputPara.InLaneNo = json.roadInputPara.inLaneNo || 2;
        model.RoadInputPara.OutLaneNo = json.roadInputPara.outLaneNo || 2;
        model.StyleIndex = json.styleIndex || 0;
        model.CanvasHeight = json.canvasHeight || 400;
        model.RoadName = json.roadName || '';

        // 恢复道路等级
        const rankName = json.roadInputPara.rankName || '主干路(50)';
        model.RoadInputPara.Rank = RoadRankOptions.find(r => r.Name === rankName) || RoadRanks.Arterial50;

        // 恢复元素列表
        model.EleList = (json.eleList || []).map(elJson => {
            const eleType = elJson.eleType;
            if (eleType === 1) {
                return Object.assign(new PedestrianElement(), SectionElement.fromJSON(elJson));
            } else if (eleType === 2) {
                return Object.assign(new BicycleElement(elJson.direction), SectionElement.fromJSON(elJson));
            } else if ([3, 4, 5, 18].includes(eleType)) {
                return Object.assign(new VehicleElement(eleType, elJson.direction), SectionElement.fromJSON(elJson));
            } else if ([11, 12, 13, 14, 15].includes(eleType)) {
                const iso = new IsoBeltElement(elJson.isoBeltType || eleType);
                Object.assign(iso, SectionElement.fromJSON(elJson));
                if (elJson.hasBush !== undefined) iso.SetIsobeltType(elJson.hasBush, elJson.hasTree, elJson.hasBarrier, elJson.hasLamp);
                return iso;
            } else if (eleType === 17) {
                return Object.assign(new UserDefineElement(elJson.userDefineType, elJson.location), SectionElement.fromJSON(elJson));
            }
            return Object.assign(new SectionElement(), SectionElement.fromJSON(elJson));
        });

        return model;
    }
}
