/**
 * 横断面设计 - Canvas 2D 渲染引擎 v3.0
 * 完全对齐桌面版视觉质量
 * 使用原始项目图片资源进行渲染
 */

// ============ 图片缓存管理器 ============
class ImageCache {
  constructor() {
    this._images = {};
    this._loadCount = 0;
    this._totalCount = 0;
  }

  /** 预加载图片 */
  load(src) {
    if (this._images[src]) return this._images[src];
    const img = new Image();
    img.src = src;
    this._images[src] = img;
    this._totalCount++;
    return img;
  }

  /** 获取已加载的图片 */
  get(src) {
    return this._images[src] || null;
  }

  /** 等待所有图片加载完成（带超时防止永久挂起） */
  waitAll(timeout = 10000) {
    const promises = Object.values(this._images).map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      const loadPromise = new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, timeout));
      return Promise.race([loadPromise, timeoutPromise]);
    });
    return Promise.all(promises);
  }
}

// ============ 配置常量 ============
const CFG = {
  SCALE: 16,            // 像素/米
  ROAD_Y: 420,          // 路面线Y坐标
  SIDE_WIDTH: 280,      // 侧边景观带宽度(px)
  SKY_TOP: 0,           // 天空顶部
  BUILDING_Y: 120,      // 建筑起始Y
  BUILDING_HEIGHT: 300, // 建筑区域高度
  BASE_EXTRA: 200,      // 地基下方延伸
  PADDING: 100,         // 画布内边距
  
  // 颜色
  COLOR_SKY_TOP: '#4A90D9',
  COLOR_SKY_BOT: '#C5DFF8',
  COLOR_GROUND: '#E8E4DC',
  COLOR_BASE_FILL: '#E6E6E6',
  COLOR_ASPHALT: '#5A5A5A',
  COLOR_CENTER_LINE: '#F0C040',
  COLOR_LANE_LINE: '#FFFFFF',
  COLOR_RED_LINE: '#D2461C',
  COLOR_DIM_LINE: '#393939',
  COLOR_DIRT: '#DCDCDC',
  COLOR_GREEN: '#4CAF50',
  
  // 样式路径
  BASE_PATH: 'images/',
};
// 挂载到 window，确保其他脚本可访问
window.CFG = CFG;

// ============ 辅助函数 ============
function px(meters) { return meters * CFG.SCALE; }
function mp(pixels) { return pixels / CFG.SCALE; }

// ============ 主渲染器 ============
class CrossSectionRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cache = new ImageCache();
    this.styleId = 1; // 0=实景, 1=剪影
    
    // 画布逻辑尺寸
    this.logicalW = 2000;
    this.logicalH = 800;
    
    // 视图变换
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    
    // 交互状态
    this.selectedIndex = -1;
    this.hoveredIndex = -1;
    this.dragInfo = null;
    
    this._preloadImages();
  }

  // ---- 图片预加载 ----
  _preloadImages() {
    const B = CFG.BASE_PATH;
    // 天空
    this.cache.load(B + 'sky/0.jpg');
    // 纹理
    ['AsphaltDark','AsphaltRed','AsphaltGreen','BrickGray','BrickRed','Cement','Earth','Water','Wood'].forEach(t => {
      this.cache.load(B + 'fill/' + t + '.png');
    });
    // 箭头
    ['S','L','R','U','UL','US','LS','LR','SR','Park','None'].forEach(a => {
      this.cache.load(B + 'arrows/' + a + '.png');
    });
    // 建筑
    this._houseImages = [0,1,2,3,4,5,6,7].map(i => {
      const widths = [1000,1000,640,900,900,800,800,850];
      const realSrc = B + 'sideview/House/' + i + '-' + widths[i] + '.png';
      this.cache.load(realSrc);
      return { idx: i, width: widths[i], src: realSrc };
    });
    // 树木
    this.cache.load(B + 'sideview/Woods/0-1000.png');
    this.cache.load(B + 'sideview/Grass/0-400.png');
    this.cache.load(B + 'sideview/Grass/1-1000.png');
    // 灌木/路灯/防护栏
    this.cache.load(B + 'style1/ElementImage/Bush/0.png');
    this.cache.load(B + 'style1/ElementImage/Lamp/0.png');
    this.cache.load(B + 'style1/ElementImage/Barrier/0.png');
    // 车辆元素 (style0用子目录0.png，style1直接用png)
    ['Car','Bus','Truck','Tramcar'].forEach(v => {
      ['In','Out'].forEach(dir => {
        this.cache.load(B + 'style0/ElementImage/' + v + dir + '/0.png');
        this.cache.load(B + 'style1/ElementImage/' + v + dir + '.png');
      });
    });
  }

  _getFillImage(textureName) {
    switch(textureName) {
      case 'AsphaltDark': return this.cache.get(CFG.BASE_PATH + 'fill/AsphaltDark.png');
      case 'AsphaltRed': return this.cache.get(CFG.BASE_PATH + 'fill/AsphaltRed.png');
      case 'AsphaltGreen': return this.cache.get(CFG.BASE_PATH + 'fill/AsphaltGreen.png');
      case 'BrickGray': return this.cache.get(CFG.BASE_PATH + 'fill/BrickGray.png');
      case 'BrickRed': return this.cache.get(CFG.BASE_PATH + 'fill/BrickRed.png');
      case 'Cement': return this.cache.get(CFG.BASE_PATH + 'fill/Cement.png');
      case 'Earth': return this.cache.get(CFG.BASE_PATH + 'fill/Earth.png');
      case 'Water': return this.cache.get(CFG.BASE_PATH + 'fill/Water.png');
      case 'Wood': return this.cache.get(CFG.BASE_PATH + 'fill/Wood.png');
      default: return null;
    }
  }

  /** 获取元素表面纹理 */
  _getSurfaceTexture(element) {
    const st = element.surfaceType || 0;
    const styles = {
      0: 'AsphaltDark',  // 沥青
      1: 'AsphaltRed',
      2: 'AsphaltGreen',
      3: 'BrickGray',    // 铺装
      4: 'BrickRed',
      5: 'Cement',
      6: null,           // 基础(无纹理)
      7: 'Earth',
      8: 'Wood',         // 隔离带
      9: 'Water',
    };
    return styles[st] || null;
  }

  // ---- 主入口 ----
  async draw(model, viewState) {
    if (viewState) {
      this.scale = isFinite(viewState.scale) ? viewState.scale : 1;
      this.offsetX = isFinite(viewState.offsetX) ? viewState.offsetX : 0;
      this.offsetY = isFinite(viewState.offsetY) ? viewState.offsetY : 0;
    }

    await this.cache.waitAll();

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 计算道路总宽度
    let roadWidth = model.totalWidth;
    if (!isFinite(roadWidth) || roadWidth <= 0) {
      roadWidth = model.elements.reduce((s, e) => s + (isFinite(e.width) ? e.width : 0), 0);
    }
    if (!isFinite(roadWidth) || roadWidth <= 0) roadWidth = 40; // 后备默认值

    // 逻辑画布尺寸
    this.logicalW = Math.max(px(roadWidth) + CFG.SIDE_WIDTH * 2 + CFG.PADDING * 2, w);
    this.logicalH = Math.max(CFG.ROAD_Y + CFG.BASE_EXTRA + CFG.PADDING, h);

    // 防御 NaN
    if (!isFinite(this.logicalW)) this.logicalW = 2000;
    if (!isFinite(this.logicalH)) this.logicalH = 800;

    // 应用视图变换
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 计算关键X坐标
    const roadPxW = px(roadWidth);
    const centerX = this.logicalW / 2;
    const roadLeft = centerX - roadPxW / 2;
    const roadRight = centerX + roadPxW / 2;
    
    // 分层渲染（从后到前）
    this._drawSky(centerX);
    this._drawSideViews(model, roadLeft, roadRight);
    this._drawGround(roadLeft, roadRight, roadPxW);
    this._drawRoadElements(model, roadLeft, roadRight);
    this._drawSplitLines(model, roadLeft);
    this._drawArrows(model, roadLeft);
    this._drawRedLines(model, roadLeft, roadRight);
    this._drawCenterLine(centerX);
    this._drawDimensions(model, roadLeft, roadRight);
    this._drawWatermark(centerX);
    
    ctx.restore();
    
    // 存储关键坐标用于交互
    this._roadLeft = roadLeft;
    this._roadRight = roadRight;
    this._roadPxW = roadPxW;
    this._centerX = centerX;
    this._elementXPositions = this._calcElementPositions(model, roadLeft);
  }

  _calcElementPositions(model, roadLeft) {
    let x = roadLeft;
    const positions = [];
    for (const el of model.elements) {
      positions.push({ left: x, right: x + px(el.width), element: el });
      x += px(el.width);
    }
    return positions;
  }

  // ======== 天空背景 ========
  _drawSky(cx) {
    const ctx = this.ctx;
    const skyImg = this.cache.get(CFG.BASE_PATH + 'sky/0.jpg');
    
    if (skyImg && skyImg.complete && skyImg.naturalWidth > 0) {
      // 使用原始天空图
      const imgW = skyImg.naturalWidth;
      const imgH = skyImg.naturalHeight;
      const drawW = this.logicalW;
      const drawH = (imgH / imgW) * drawW; // 保持比例
      ctx.drawImage(skyImg, 0, 0, drawW, Math.min(drawH, this.logicalH));
    } else {
      // 后备：渐变天空 + 云朵
      const grad = ctx.createLinearGradient(0, 0, 0, CFG.ROAD_Y);
      grad.addColorStop(0, CFG.COLOR_SKY_TOP);
      grad.addColorStop(0.6, '#87CEEB');
      grad.addColorStop(1, CFG.COLOR_SKY_BOT);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.logicalW, CFG.ROAD_Y);
      
      // 简单云朵
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      this._drawCloud(cx - 300, 60, 80);
      this._drawCloud(cx + 200, 100, 60);
      this._drawCloud(cx - 100, 140, 50);
      this._drawCloud(cx + 350, 50, 70);
    }
  }

  _drawCloud(x, y, size) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.arc(x + size * 0.5, y - size * 0.1, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size, y, size * 0.55, 0, Math.PI * 2);
    ctx.arc(x + size * 0.3, y - size * 0.3, size * 0.45, 0, Math.PI * 2);
    ctx.arc(x + size * 0.7, y - size * 0.25, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ======== 侧边景观带 ========
  _drawSideViews(model, roadLeft, roadRight) {
    const ctx = this.ctx;
    const viewType = model.sideViewType || 'House';
    
    // 左侧景观带
    const leftW = roadLeft;
    const svH = px(model.sideViewHeight || 0);
    const retreat = px(model.sideViewRetreat || 2);
    
    // 地基
    const groundY = CFG.ROAD_Y + svH;
    
    if (viewType === 'House') {
      this._drawBuildingSide(CFG.SIDE_WIDTH * 0.2 - 60, roadLeft, 'left');
    } else if (viewType === 'Woods') {
      this._drawWoodsSide(0, roadLeft, 'left');
    } else if (viewType === 'Grass') {
      this._drawGrassSide(0, roadLeft);
    }

    // 右侧景观带（镜像）
    if (viewType === 'House') {
      this._drawBuildingSide(roadRight, this.logicalW, 'right');
    }
  }

  _drawBuildingSide(fromX, toX, side) {
    const ctx = this.ctx;
    const availW = toX - fromX;
    if (availW < 50) return;
    
    // 建筑区域背景（地面色）
    const grad = ctx.createLinearGradient(0, CFG.BUILDING_Y, 0, CFG.ROAD_Y + 60);
    grad.addColorStop(0, '#D4CFC4');
    grad.addColorStop(0.5, '#E8E4DC');
    grad.addColorStop(1, '#C8C0B0');
    ctx.fillStyle = grad;
    ctx.fillRect(fromX, CFG.BUILDING_Y, availW, CFG.ROAD_Y - CFG.BUILDING_Y + 60);
    
    // 绘制建筑群
    const houses = this._houseImages;
    let curX = (side === 'left') ? fromX + 10 : fromX + 10;
    const endX = toX - 10;
    let hIdx = 0;
    
    while (curX < endX - 30 && hIdx < houses.length) {
      const hi = houses[hIdx];
      const img = this.cache.get(hi.src);
      const hw = Math.min(hi.width * 0.15, endX - curX - 5, 180);
      const hh = hw * 0.8;
      const hy = CFG.ROAD_Y - hh - 0 - 5;
      
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, curX, hy - 30, hw, hh + 30);
      } else {
        // 后备：简易建筑
        this._drawSimpleBuilding(curX, hy, hw, hh);
      }
      
      curX += hw + 8;
      hIdx++;
    }
  }

  _drawSimpleBuilding(x, y, w, h) {
    const ctx = this.ctx;
    // 建筑主体
    const bodyColors = ['#C4BBAF', '#D4C9B8', '#BDB5A6', '#CCC0AE', '#D8D0C0'];
    const color = bodyColors[Math.floor(Math.random() * bodyColors.length)];
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    
    // 窗户
    ctx.fillStyle = '#87CEEB';
    const winW = 12, winH = 16;
    for (let row = 0; row < Math.floor(h / 35); row++) {
      for (let col = 0; col < Math.floor(w / 30); col++) {
        ctx.fillRect(x + 8 + col * 28, y + 10 + row * 32, winW, winH);
      }
    }
    // 屋顶
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 2, y - 4, w + 4, 6);
  }

  _drawWoodsSide(fromX, toX, side) {
    const ctx = this.ctx;
    // 地面
    ctx.fillStyle = '#8FBC8F';
    ctx.fillRect(fromX, CFG.ROAD_Y - 40, toX - fromX, 60);
    
    // 树
    for (let x = fromX + 20; x < toX - 20; x += 40 + Math.random() * 30) {
      const treeH = 50 + Math.random() * 40;
      this._drawTree(x, CFG.ROAD_Y - treeH, treeH * 0.25, treeH * 0.4);
    }
  }

  _drawGrassSide(fromX, toX) {
    const ctx = this.ctx;
    ctx.fillStyle = '#7CBA5C';
    ctx.fillRect(fromX, CFG.ROAD_Y - 30, toX - fromX, 50);
  }

  _drawTree(x, baseY, trunkW, crownR) {
    const ctx = this.ctx;
    // 树干
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x - trunkW / 2, baseY - crownR * 0.3, trunkW, crownR * 0.8);
    // 树冠
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.arc(x, baseY - crownR - crownR * 0.15, crownR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.arc(x + crownR * 0.2, baseY - crownR - crownR * 0.25, crownR * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // ======== 地基/地面 ========
  _drawGround(roadLeft, roadRight, roadPxW) {
    const ctx = this.ctx;
    const groundY = CFG.ROAD_Y;
    const baseH = CFG.BASE_EXTRA;
    const totalH = this.logicalH - groundY; // 地面以下全部高度

    // 路面下方地基（渐变）
    const grad = ctx.createLinearGradient(0, groundY, 0, groundY + baseH);
    grad.addColorStop(0, '#D0C8BC');
    grad.addColorStop(0.15, CFG.COLOR_BASE_FILL);
    grad.addColorStop(1, '#C8C0B0');
    ctx.fillStyle = grad;
    ctx.fillRect(roadLeft, groundY, roadPxW, baseH);

    // 地基以下延伸区域（填充到画布底部）
    const extraH = totalH - baseH;
    if (extraH > 0) {
      ctx.fillStyle = '#C8C0B0';
      ctx.fillRect(roadLeft, groundY + baseH, roadPxW, extraH);
    }

    // 路面底部暗色带
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(roadLeft, groundY, roadPxW, 6);

    // 两侧地基（延伸到画布底部）
    ctx.fillStyle = CFG.COLOR_GROUND;
    ctx.fillRect(0, groundY, roadLeft, totalH);
    ctx.fillRect(roadRight, groundY, this.logicalW - roadRight, totalH);
  }

  // ======== 道路元素 ========
  _drawRoadElements(model, roadLeft, roadRight) {
    const ctx = this.ctx;
    let curX = roadLeft;
    const elements = model.elements;
    const surfaceLevel = CFG.ROAD_Y;
    
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const elW = px(el.width);
      const elH = px(el.height || 0.6);
      
      // 1. 地基矩形
      ctx.fillStyle = '#E8E8E8';
      ctx.fillRect(curX, surfaceLevel, elW + 0.5, CFG.BASE_EXTRA);
      
      // 2. 表面层（路面）
      const surfaceH = px((el.surfaceHeight !== undefined ? el.surfaceHeight : 0.6));
      const surfY = surfaceLevel - surfaceH;
      const textureName = this._getSurfaceTexture(el);
      const fillImg = textureName ? this._getFillImage(textureName) : null;
      
      if (fillImg && fillImg.complete && fillImg.naturalWidth > 0) {
        // 使用纹理图案平铺
        const pattern = ctx.createPattern(fillImg, 'repeat');
        ctx.fillStyle = pattern;
      } else {
        // 后备颜色
        ctx.fillStyle = el.surfaceType === 0 ? CFG.COLOR_ASPHALT : 
                        el.surfaceType >= 3 && el.surfaceType <= 5 ? '#A08C0A' : '#E0E0E0';
      }
      ctx.fillRect(curX - 0.5, surfY, elW + 1, surfaceH);
      
      // 3. 表面顶部线
      ctx.strokeStyle = '#1B1B1B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX, surfY);
      ctx.lineTo(curX + elW, surfY);
      ctx.stroke();
      
      // 4. 装饰元素（车辆、行人、树木等）
      this._drawElementDecor(el, curX, elW, surfaceH, surfY);
      
      // 5. 车道线（仅限车道类型）
      if (el.turnTypes && el.turnTypes.length > 0 && el.turnCount > 1) {
        this._drawLaneDividers(el, curX, elW, surfaceH, surfY);
      }
      
      curX += elW;
    }
  }

  _drawElementDecor(el, x, elW, surfaceH, surfY) {
    const ctx = this.ctx;
    const elemType = el.type;
    const isTurned = el.direction === 'In';
    
    switch (elemType) {
      case 'Vehicle': // 机动车道 - 画小汽车
        this._drawSingleVehicle(x, elW, surfY, surfaceH, 'Car' + (isTurned ? 'In' : 'Out'), el);
        break;
      case 'Bus': // 公交专用道
        this._drawSingleVehicle(x, elW, surfY, surfaceH, 'Bus' + (isTurned ? 'In' : 'Out'), el);
        break;
      case 'Truck': // 大车道
        this._drawSingleVehicle(x, elW, surfY, surfaceH, 'Truck' + (isTurned ? 'In' : 'Out'), el);
        break;
      case 'Tramcar': // 有轨电车
        this._drawSingleVehicle(x, elW, surfY, surfaceH, 'Tramcar' + (isTurned ? 'In' : 'Out'), el);
        break;
      case 'Pedestrian': // 人行道 - 画行人
        this._drawArrayPedestrians(x, elW, surfY, surfaceH);
        break;
      case 'Bicycle': // 非机动车道 - 画自行车
        this._drawArrayBicycles(x, elW, surfY, surfaceH);
        break;
      case 'IsoBelt': // 隔离带 - 画灌木/树木/路灯
        this._drawIsoBelt(el, x, elW, surfY, surfaceH);
        break;
      case 'BusStop': // 公交站台
        this._drawBusStop(x, elW, surfY, surfaceH);
        break;
      case 'UserDefine': // 自定义
        this._drawUserDefine(el, x, elW, surfY, surfaceH);
        break;
    }
  }

  _drawSingleVehicle(x, elW, surfY, surfaceH, imgKey, el) {
    const ctx = this.ctx;
    // 尝试使用原版图片 (style0用子目录，style1直接用png)
    const B = CFG.BASE_PATH;
    const styleDir = this.styleId === 0 ? 'style0' : 'style1';
    const subPath = this.styleId === 0 ? '/0' : '';
    const imgPath = B + styleDir + '/ElementImage/' + imgKey + subPath + '.png';
    const img = this.cache.get(imgPath);
    
    if (img && img.complete && img.naturalWidth > 0) {
      const scale = Math.min(elW * 0.6 / img.naturalWidth, surfaceH * 0.7 / img.naturalHeight, 1.2);
      const iw = img.naturalWidth * scale;
      const ih = img.naturalHeight * scale;
      const ix = x + (elW - iw) / 2;
      const iy = surfY - ih;
      
      if (el.direction === 'In') {
        ctx.save();
        ctx.translate(ix + iw, iy + ih / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, -ih / 2, iw, ih);
        ctx.restore();
      } else {
        ctx.drawImage(img, ix, iy, iw, ih);
      }
    } else {
      // 后备：画简易小汽车
      const carW = Math.min(elW * 0.5, 80);
      const carH = carW * 0.45;
      const cx = x + elW / 2;
      const cy = surfY - carH;
      
      ctx.fillStyle = '#3A7BD5';
      ctx.beginPath();
      ctx.moveTo(cx - carW * 0.4, cy);
      ctx.lineTo(cx + carW * 0.4, cy);
      ctx.lineTo(cx + carW * 0.35, cy - carH * 0.3);
      ctx.lineTo(cx - carW * 0.1, cy - carH * 0.5);
      ctx.lineTo(cx - carW * 0.35, cy - carH * 0.3);
      ctx.closePath();
      ctx.fill();
      // 车轮
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(cx - carW * 0.3, cy + 2, carW * 0.12, 0, Math.PI * 2);
      ctx.arc(cx + carW * 0.25, cy + 2, carW * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawArrayPedestrians(x, elW, surfY, surfaceH) {
    const ctx = this.ctx;
    const count = Math.floor(elW / 35);
    const interval = elW / count;
    
    for (let i = 0; i < count; i++) {
      const px2 = x + interval * i + interval / 2;
      const py = surfY - surfaceH * 1.3;
      this._drawStickFigure(px2, py, surfaceH * 0.7);
    }
  }

  _drawStickFigure(x, y, size) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    // 头
    ctx.beginPath();
    ctx.arc(x, y - size * 0.6, size * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD699';
    ctx.fill();
    ctx.stroke();
    // 身体
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.45);
    ctx.lineTo(x, y);
    ctx.stroke();
    // 腿
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * 0.15, y + size * 0.4);
    ctx.moveTo(x, y);
    ctx.lineTo(x + size * 0.15, y + size * 0.4);
    ctx.stroke();
    // 手臂
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.3);
    ctx.lineTo(x - size * 0.2, y - size * 0.1);
    ctx.moveTo(x, y - size * 0.3);
    ctx.lineTo(x + size * 0.2, y);
    ctx.stroke();
  }

  _drawArrayBicycles(x, elW, surfY, surfaceH) {
    const ctx = this.ctx;
    const count = Math.floor(elW / 50);
    const interval = elW / count;
    
    for (let i = 0; i < count; i++) {
      const bx = x + interval * i + interval / 2;
      const by = surfY - surfaceH * 1.1;
      const bw = 20, bh = 14;
      
      // 简化自行车
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1.2;
      // 车轮
      ctx.beginPath();
      ctx.arc(bx - bw * 0.3, by, bh * 0.45, 0, Math.PI * 2);
      ctx.arc(bx + bw * 0.3, by, bh * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      // 车架
      ctx.beginPath();
      ctx.moveTo(bx - bw * 0.3, by);
      ctx.lineTo(bx, by - bh * 0.5);
      ctx.lineTo(bx + bw * 0.3, by);
      ctx.moveTo(bx, by - bh * 0.5);
      ctx.lineTo(bx, by + bh * 0.2);
      ctx.stroke();
    }
  }

  _drawIsoBelt(el, x, elW, surfY, surfaceH) {
    const ctx = this.ctx;
    const isoType = el.isoType || 11;
    
    // 灌木（所有隔离带都有，间距较小）
    const bushCount = Math.floor(elW / 30);
    for (let i = 0; i < bushCount; i++) {
      const bx = x + (i + 0.5) * elW / bushCount;
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.arc(bx, surfY - surfaceH * 1.6, surfaceH * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#43A047';
      ctx.beginPath();
      ctx.arc(bx + 3, surfY - surfaceH * 1.7, surfaceH * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 树木（大多数隔离带都有）
    const hasTree = [11, 12, 13, 15].includes(isoType);
    if (hasTree && elW > px(0.5)) {
      const treeCount = Math.max(1, Math.floor(elW / 120));
      for (let i = 0; i < treeCount; i++) {
        const tx = x + (i + 0.5) * elW / treeCount;
        this._drawTree(tx, surfY, 4, 18);
      }
    }
    
    // 路灯（机非隔离）
    if (isoType === 13) {
      const lampX = el.direction === 'In' ? x + elW * 0.3 : x + elW * 0.7;
      ctx.fillStyle = '#555';
      ctx.fillRect(lampX - 1.5, surfY - surfaceH * 3, 3, surfaceH * 3);
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(lampX, surfY - surfaceH * 3.2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 防护栏
    if (el.hasBarrier) {
      ctx.strokeStyle = '#8B7355';
      ctx.lineWidth = 2;
      const by = surfY - surfaceH * 2;
      ctx.beginPath();
      ctx.moveTo(x + 5, by);
      ctx.lineTo(x + elW - 5, by);
      ctx.stroke();
      // 立柱
      for (let bx = x + 10; bx < x + elW - 10; bx += 20) {
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(bx - 1, by - 5, 2, 10);
      }
    }
  }

  _drawBusStop(x, elW, surfY, surfaceH) {
    const ctx = this.ctx;
    // 站台背景
    ctx.fillStyle = '#D4C9B8';
    ctx.fillRect(x + 3, surfY - surfaceH, elW - 6, surfaceH);
    // 站台标志
    ctx.fillStyle = '#E8E0D0';
    ctx.fillRect(x + 10, surfY - surfaceH + 2, elW - 20, surfaceH - 4);
    ctx.fillStyle = '#333';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUS', x + elW / 2, surfY - surfaceH / 2 + 4);
  }

  _drawUserDefine(el, x, elW, surfY, surfaceH) {
    const ctx = this.ctx;
    const udType = el.userDefineType || 'Overpass';
    switch (udType) {
      case 'Overpass': // 高架
        ctx.fillStyle = '#888';
        ctx.fillRect(x + 5, surfY - surfaceH * 2, elW - 10, surfaceH * 5);
        // 桥墩
        ctx.fillStyle = '#777';
        ctx.fillRect(x + elW * 0.2 - 3, surfY, 6, surfaceH * 2);
        ctx.fillRect(x + elW * 0.8 - 3, surfY, 6, surfaceH * 2);
        break;
      case 'Water': // 河流
        const waterGrad = ctx.createLinearGradient(0, surfY, 0, surfY - surfaceH * 4);
        waterGrad.addColorStop(0, '#4A90D9');
        waterGrad.addColorStop(0.5, '#7BC0F0');
        waterGrad.addColorStop(1, '#4A90D9');
        ctx.fillStyle = waterGrad;
        ctx.fillRect(x, surfY - surfaceH * 4, elW, surfaceH * 4);
        // 水面波纹
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        for (let wy = surfY - surfaceH * 3.5; wy < surfY; wy += 10) {
          ctx.beginPath();
          ctx.moveTo(x, wy);
          ctx.quadraticCurveTo(x + elW * 0.3, wy + 4, x + elW * 0.6, wy);
          ctx.quadraticCurveTo(x + elW * 0.9, wy - 4, x + elW, wy);
          ctx.stroke();
        }
        break;
      case 'ParkLane': // 停车带
        ctx.fillStyle = '#E8E0D0';
        ctx.fillRect(x + 2, surfY - surfaceH, elW - 4, surfaceH);
        // 停车位线
        ctx.strokeStyle = '#CCC';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        for (let px2 = x + 15; px2 < x + elW; px2 += 15) {
          ctx.beginPath();
          ctx.moveTo(px2, surfY - surfaceH);
          ctx.lineTo(px2, surfY);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        break;
      default: // 自定义路面
        ctx.fillStyle = '#C0B8A8';
        ctx.fillRect(x, surfY - surfaceH, elW, surfaceH);
    }
  }

  // ======== 车道分界线 ========
  _drawLaneDividers(el, x, elW, surfaceH, surfY) {
    const ctx = this.ctx;
    const laneCount = el.turnCount || 2;
    const laneW = elW / laneCount;
    
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    
    for (let i = 1; i < laneCount; i++) {
      const lx = x + laneW * i;
      ctx.beginPath();
      ctx.moveTo(lx, surfY - surfaceH * 0.3);
      ctx.lineTo(lx, surfY - surfaceH * 0.9);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // ======== 分割线 ========
  _drawSplitLines(model, roadLeft) {
    const ctx = this.ctx;
    const elements = model.elements;
    let curX = roadLeft;
    
    ctx.strokeStyle = '#1B1B1B';
    ctx.lineWidth = 1.5;
    
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const elW = px(el.width);
      const surfH = px(el.surfaceHeight !== undefined ? el.surfaceHeight : 0.6);
      
      // 右分割线
      if (i < elements.length - 1) {
        const nx = elements[i + 1];
        const nxSurfH = px(nx.surfaceHeight !== undefined ? nx.surfaceHeight : 0.6);
        const heightDiff = surfH - nxSurfH;
        
        ctx.beginPath();
        ctx.moveTo(curX + elW, CFG.ROAD_Y - surfH);
        ctx.lineTo(curX + elW, CFG.ROAD_Y - surfH + heightDiff);
        ctx.stroke();
      }
      
      curX += elW;
    }
  }

  // ======== 方向箭头 ========
  _drawArrows(model, roadLeft) {
    const ctx = this.ctx;
    const elements = model.elements;
    let curX = roadLeft;
    const arrowY = CFG.ROAD_Y - px(1.5); // 箭头在路面下方1.5m
    
    for (const el of elements) {
      const elW = px(el.width);
      
      if (el.turnTypes && el.turnTypes.length > 0 && el.type === 'Vehicle') {
        const laneCount = el.turnCount || el.turnTypes.length;
        const laneW = elW / laneCount;
        
        for (let i = 0; i < laneCount; i++) {
          const turnType = el.turnTypes[i] || 'S';
          const arrowKey = turnType.toUpperCase();
          const img = this.cache.get(CFG.BASE_PATH + 'arrows/' + arrowKey + '.png');
          
          const cx = curX + laneW * (i + 0.5);
          const arrowSize = Math.min(laneW * 0.6, 25);
          
          if (img && img.complete && img.naturalWidth > 0) {
            const as = arrowSize;
            ctx.save();
            if (el.direction === 'In') {
              // 进口方向：180度旋转
              ctx.translate(cx, arrowY);
              ctx.scale(-1, -1);
              ctx.drawImage(img, -as/2, -as/2, as, as);
            } else {
              ctx.drawImage(img, cx - as/2, arrowY - as/2, as, as);
            }
            ctx.restore();
          } else {
            // 后备：手绘箭头
            this._drawSimpleArrow(cx, arrowY, arrowSize, turnType, el.direction);
          }
        }
      }
      
      curX += elW;
    }
  }

  _drawSimpleArrow(x, y, size, turnType, dir) {
    const ctx = this.ctx;
    const s2 = size / 2;
    ctx.fillStyle = '#FFF';
    
    ctx.save();
    ctx.translate(x, y);
    if (dir === 'In') ctx.scale(-1, -1);
    
    switch (turnType.toUpperCase()) {
      case 'S': // 直行
        ctx.beginPath();
        ctx.moveTo(0, -s2); ctx.lineTo(s2 * 0.4, s2 * 0.2); ctx.lineTo(s2 * 0.15, s2 * 0.2);
        ctx.lineTo(s2 * 0.15, s2 * 0.8); ctx.lineTo(-s2 * 0.15, s2 * 0.8);
        ctx.lineTo(-s2 * 0.15, s2 * 0.2); ctx.lineTo(-s2 * 0.4, s2 * 0.2);
        ctx.closePath();
        break;
      case 'L': // 左转
        ctx.beginPath();
        ctx.arc(0, s2 * 0.3, s2 * 0.4, -Math.PI * 0.5, Math.PI * 0.5, true);
        ctx.lineTo(-s2 * 0.6, s2 * 0.5); ctx.lineTo(-s2 * 0.2, s2 * 0.35);
        ctx.lineTo(-s2 * 0.5, s2 * 0.2);
        break;
      case 'R': // 右转
        ctx.beginPath();
        ctx.arc(0, s2 * 0.3, s2 * 0.4, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.lineTo(s2 * 0.6, s2 * 0.5); ctx.lineTo(s2 * 0.2, s2 * 0.35);
        ctx.lineTo(s2 * 0.5, s2 * 0.2);
        break;
    }
    ctx.fill();
    ctx.restore();
  }

  // ======== 红线 ========
  _drawRedLines(model, roadLeft, roadRight) {
    if (!model.redLineWidth || model.redLineWidth <= 0) return;
    const ctx = this.ctx;
    const rlPx = px(model.redLineWidth);
    const totalPx = roadRight - roadLeft;
    
    if (totalPx > rlPx) {
      const leftX = roadLeft + (totalPx - rlPx) / 2;
      const rightX = roadLeft + (totalPx + rlPx) / 2;
      
      ctx.strokeStyle = CFG.COLOR_RED_LINE;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      
      // 左红线
      ctx.beginPath();
      ctx.moveTo(leftX, CFG.ROAD_Y - 300);
      ctx.lineTo(leftX, CFG.ROAD_Y + CFG.BASE_EXTRA);
      ctx.stroke();
      
      // 右红线
      ctx.beginPath();
      ctx.moveTo(rightX, CFG.ROAD_Y - 300);
      ctx.lineTo(rightX, CFG.ROAD_Y + CFG.BASE_EXTRA);
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      // 红线标签
      ctx.fillStyle = CFG.COLOR_RED_LINE;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('红线 ' + model.redLineWidth + 'm', leftX - 10, CFG.ROAD_Y - 320);
    }
  }

  // ======== 中心线 ========
  _drawCenterLine(cx) {
    const ctx = this.ctx;
    ctx.strokeStyle = CFG.COLOR_CENTER_LINE;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 3, 2, 3]);
    
    ctx.beginPath();
    ctx.moveTo(cx, CFG.ROAD_Y - 300);
    ctx.lineTo(cx, CFG.ROAD_Y + 100);
    ctx.stroke();
    
    ctx.setLineDash([]);
  }

  // ======== 尺寸标注 ========
  _drawDimensions(model, roadLeft, roadRight) {
    const ctx = this.ctx;
    const dimY = CFG.ROAD_Y - px(2); // 标注线位置（路面上方2m）
    const elements = model.elements;
    
    let curX = roadLeft;
    
    for (const el of elements) {
      const elW = px(el.width);
      const labelX = curX + elW / 2;
      
      // 标注竖线
      ctx.strokeStyle = '#393939';
      ctx.lineWidth = 1;
      
      // 左竖线
      ctx.beginPath();
      ctx.moveTo(curX, dimY);
      ctx.lineTo(curX, CFG.ROAD_Y);
      ctx.stroke();
      
      // 右竖线
      ctx.beginPath();
      ctx.moveTo(curX + elW, dimY);
      ctx.lineTo(curX + elW, CFG.ROAD_Y);
      ctx.stroke();
      
      // 斜线标记
      const slashSize = 4;
      ctx.beginPath();
      ctx.moveTo(curX, dimY);
      ctx.lineTo(curX + slashSize, dimY + slashSize);
      ctx.moveTo(curX + elW, dimY);
      ctx.lineTo(curX + elW - slashSize, dimY + slashSize);
      ctx.stroke();
      
      // 水平标注线
      ctx.beginPath();
      ctx.moveTo(curX, dimY);
      ctx.lineTo(curX + elW, dimY);
      ctx.stroke();
      
      // 宽度标签
      ctx.fillStyle = '#393939';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      const label = el.width.toFixed(2);
      const textWidth = ctx.measureText(label).width;
      
      if (textWidth < elW) {
        ctx.fillText(label, labelX, dimY - 6);
      } else {
        ctx.fillText(label, labelX, dimY + 16);
      }
      
      curX += elW;
    }
    
    // 总宽标注
    const totalW = roadRight - roadLeft;
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    const totalLabel = '总宽 ' + mp(totalW).toFixed(2) + 'm';
    ctx.fillText(totalLabel, roadLeft + totalW / 2, dimY + 35);
  }

  // ======== 水印 ========
  _drawWatermark(cx) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    
    const startY = CFG.ROAD_Y - 100;
    const endY = CFG.ROAD_Y + 50;
    const stepX = 120;
    const stepY = 80;
    
    for (let wy = startY; wy < endY; wy += stepY) {
      for (let wx = cx - 300; wx < cx + 300; wx += stepX) {
        ctx.fillText('AITS', wx, wy);
        ctx.fillText('济安软件', wx, wy + 20);
      }
    }
  }

  // ======== 交互：点击命中测试 ========
  hitTest(mx, my) {
    // 将屏幕坐标转换为逻辑坐标
    const lx = (mx - this.offsetX) / this.scale;
    const ly = (my - this.offsetY) / this.scale;
    
    if (!this._elementXPositions) return -1;
    
    for (let i = 0; i < this._elementXPositions.length; i++) {
      const pos = this._elementXPositions[i];
      if (lx >= pos.left && lx <= pos.right) {
        return i;
      }
    }
    return -1;
  }

  /** 获取元素像素范围 */
  getElementBounds(index) {
    if (!this._elementXPositions || index < 0 || index >= this._elementXPositions.length) return null;
    const pos = this._elementXPositions[index];
    return {
      left: pos.left * this.scale + this.offsetX,
      right: pos.right * this.scale + this.offsetX,
      top: (CFG.ROAD_Y - 200) * this.scale + this.offsetY,
      bottom: (CFG.ROAD_Y + CFG.BASE_EXTRA) * this.scale + this.offsetY,
      width: (pos.right - pos.left) * this.scale
    };
  }

  /** 获取逻辑坐标 */
  toLogical(screenX, screenY) {
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale
    };
  }
}
