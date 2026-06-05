/**
 * 数学工具 - 从 WPF UsrMath.cs 转译
 * 极坐标 + 向量运算
 */
const Utils = {

  /** 极坐标：从点沿角度移动距离 */
  moveByVec(p, len, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    return { x: p.x + len * Math.cos(rad), y: p.y + len * Math.sin(rad) };
  },

  /** 角度转单位向量 */
  normAngle(angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    return { x: Math.cos(rad), y: Math.sin(rad) };
  },

  /** 向量归一化 */
  normVec(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    return { x: v.x / len, y: v.y / len };
  },

  /** 向量旋转（逆时针） */
  rotateVec(v, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    return {
      x: v.x * Math.cos(rad) - v.y * Math.sin(rad),
      y: v.x * Math.sin(rad) + v.y * Math.cos(rad)
    };
  },

  /** 两点距离 */
  dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  },

  /** 叉积 */
  cross(a, b) {
    return a.x * b.y - a.y * b.x;
  },

  /** 点积 */
  dot(a, b) {
    return a.x * b.x + a.y * b.y;
  },

  /** 两线交点: A + t*dirA = B + s*dirB */
  intersect(A, dirA, B, dirB) {
    const crossDir = dirA.x * dirB.y - dirA.y * dirB.x;
    if (Math.abs(crossDir) < 1e-10) return null;
    const AB = { x: B.x - A.x, y: B.y - A.y };
    const t = (AB.x * dirB.y - AB.y * dirB.x) / crossDir;
    return { x: A.x + t * dirA.x, y: A.y + t * dirA.y };
  },

  /** 角度规范化到 [0, 360) */
  normAngleDeg(a) {
    a = a % 360;
    if (a < 0) a += 360;
    return a;
  },

  /** 角度差（取较小侧） */
  angleDiff(a, b) {
    let d = Math.abs(this.normAngleDeg(a) - this.normAngleDeg(b));
    if (d > 180) d = 360 - d;
    return d;
  },

  /** deg -> rad */
  toRad(deg) { return deg * Math.PI / 180; },

  /** rad -> deg */
  toDeg(rad) { return rad * 180 / Math.PI; },
};

/** 全局常量 */
const INFIN = 10000;
const MULTIPLE = 5;        // 缩放系数（每米→像素）
const ROAD_VISIBLE_LEN = 150 * MULTIPLE; // 道路可见长度（像素）
const DEFAULT_RADIUS = 120; // 转弯半径
const SCL_MAX = 1000;
const SCL_MIN = 0.1;

/** 车道功能枚举 */
const LaneSigning = {
  GoStraight: 0, LeftTurning: 1, LeftRight: 2, RightTurning: 3,
  StraightLeft: 4, StraightRight: 5, LeftStraightRight: 6,
  UTurning: 7, StraightUTurning: 8, LeftUTurning: 9, RightUTurning: 10,
  StraigntLeftUTurning: 11, StraightRightUTurning: 12,
  LeftStraightRightUTurning: 13, LeftRightUTuring: 14,
  None: 16
};

/** 车道功能名称（中文） */
const LaneSigningNames = {
  [LaneSigning.GoStraight]: '⬆️ 直行',
  [LaneSigning.LeftTurning]: '↩️ 左转',
  [LaneSigning.LeftRight]: '↔️ 左右转',
  [LaneSigning.RightTurning]: '↪️ 右转',
  [LaneSigning.StraightLeft]: '⬆️↩️ 直左',
  [LaneSigning.StraightRight]: '⬆️↪️ 直右',
  [LaneSigning.LeftStraightRight]: '↩️⬆️↪️ 左直右',
  [LaneSigning.UTurning]: '🔄 掉头',
  [LaneSigning.StraightUTurning]: '⬆️🔄 直行掉头',
  [LaneSigning.LeftUTurning]: '↩️🔄 左转掉头',
  [LaneSigning.RightUTurning]: '↪️🔄 右转掉头',
  [LaneSigning.StraigntLeftUTurning]: '🐌',
  [LaneSigning.StraightRightUTurning]: '🐌',
  [LaneSigning.LeftStraightRightUTurning]: '🐌',
  [LaneSigning.LeftRightUTuring]: '🐌',
  [LaneSigning.None]: '— 未设置'
};

/** 人行横道类型 */
const CrosswalkType = {
  DoubleSolid: 0,   // 双粗实线
  FullZebra: 1,     // 全斑马线
  SplitZebra: 2     // 区分划线
};
