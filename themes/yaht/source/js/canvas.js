/**
 * Created by ayou on 2016-06-16.
 */
var canvas = document.getElementById("headerCanvas");

function drawLand(cxt) {
  cxt.save();
  cxt.beginPath();
  cxt.moveTo(0,600);
  cxt.bezierCurveTo(540,400,660,800,1200,600);
  cxt.lineTo(1200,800);
  cxt.lineTo(0,800);
  cxt.closePath();
  var landStyle = cxt.createLinearGradient(0,800,0,0);
  landStyle.addColorStop(0.0,'#030');
  landStyle.addColorStop(1.0,'#580');
  cxt.fillStyle = landStyle;
  cxt.fill();
  cxt.restore();
}

/**
 * 根据日期计算月亮的圆缺
 */
function computerDByDate() {
  var day = new Date(2016,9,13).getDate();
  // 15的月亮最圆
  var d = 21.2*Math.exp(Math.abs(day-15)*(-0.234));
  console.log(d);
  return (day >= 7 && day <= 22) ? -d : d;
}

/**
 * 绘制一个标准的星星
 * @param cxt 绘图上下文
 */
function starPath(cxt) {
  cxt.beginPath();

  for (var i = 0; i < 5; i++) {
    var x1 = Math.cos((18 + i * 72) / 180 * Math.PI);
    var y1 = -Math.sin((18 + i * 72) / 180 * Math.PI);
    var x2 = Math.cos((54 + i * 72) / 180 * Math.PI) * 0.5;
    var y2 = -Math.sin((54 + i * 72) / 180 * Math.PI) * 0.5;
    cxt.lineTo(x1, y1);
    cxt.lineTo(x2, y2);
  }
  cxt.closePath();
}

function drawStar(cxt, x, y, R, rot) {
  cxt.save();
  // 利用图形变换来得到想要的图形
  cxt.translate(x, y);
  cxt.rotate(rot / 180 * Math.PI);
  cxt.scale(R, R)// 绘制原点都在(0, 0),所以scale对坐标的影响没有
  // 绘制一个标准的五角星
  starPath(cxt);
  // 其他设置
  cxt.fillStyle = "#fb3";
  cxt.lineWidth = 1;
  cxt.lineJoin = 'round';

  cxt.fill();
  //cxt.stroke();// 防止缩放效果对边框也进行缩放
  cxt.restore();
}
/**
 * 画月亮
 * @param cxt
 * @param d
 * @param x
 * @param y
 * @param R
 * @param rot
 * @param fillColor
 */
function fillMoon(cxt, d, x, y, R, rot, /*optional*/fillColor) {
  cxt.save();
  cxt.translate(x, y);
  cxt.rotate(rot * Math.PI / 180);
  cxt.scale(R, R);
  pathMoon(cxt, d);
  cxt.fillStyle = fillColor || '#f8fefa';
  cxt.shadowBlur = 100; // 模糊尺寸
  cxt.shadowColor = '#f8fefa'; // 颜色
  cxt.fill();
  cxt.restore();
}
function pathMoon(cxt, d) {

  cxt.beginPath();
  cxt.arc(0, 0, 1, 0.5 * Math.PI, 1.5 * Math.PI, true);
  cxt.moveTo(0, -1);
  cxt.arcTo(d, 0, 0, 1, dis(0, -1, d, 0) / Math.abs(d));
  cxt.closePath();
}
function dis(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
}

/**
 * 太阳
 * @param cxt
 * @param x
 * @param y
 * @param R 半径
 * @param fillColor
 */
function fillSun(cxt,x,y,R,fillColor) {
  cxt.save();
  cxt.translate(x, y);
  cxt.scale(R, R);
  pathSun(cxt);
  cxt.fillStyle = fillColor || '#fdc54e';
  cxt.shadowBlur = 200; // 模糊尺寸
  cxt.shadowColor = '#fff'; // 颜色
  cxt.fill();
  cxt.restore();
}
function pathSun(cxt) {
  cxt.beginPath();
  cxt.arc(0, 0, 1, 0, 2 * Math.PI, true);
  cxt.closePath();
}

/**
 * 渐变天空
 * @param context 开始颜色
 * @param startColor 开始颜色
 * @param endColor 结束颜色
 */
function gradientSky(context,startColor,endColor) {
  // 渐变天空
  var skyStyle = context.createLinearGradient(0, 0, 0, canvas.height);
  skyStyle.addColorStop(0.0, startColor);
  skyStyle.addColorStop(1.0, endColor);
  context.fillStyle = skyStyle;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * 画云朵
 */
function drawCloud(cxt,x,y,scale) {
  cxt.save();
  cxt.translate(x, y);
  cxt.scale(scale, scale);
  pathCloud(cxt);
  cxt.fillStyle = '#f8fefa';
  cxt.shadowBlur = 5; // 模糊尺寸
  cxt.shadowColor = '#f8fefa'; // 颜色
  cxt.fill();
  cxt.restore();
}


/**
 * 云朵路径
 * @param cxt
 */
function pathCloud(cxt) {
    var startX = 0;
    var startY = 0;
    cxt.beginPath();
    cxt.moveTo(startX, startY);
    cxt.bezierCurveTo(startX - 2, startY + 1, startX - 2, startY + 3.5, startX + 3, startY + 3.5);
    cxt.bezierCurveTo(startX + 4, startY + 5, startX + 7.5, startY + 5, startX + 8.5, startY + 3.5);
    cxt.bezierCurveTo(startX + 12.5, startY + 3.5, startX + 12.5, startY + 2, startX + 11, startY + 1);
    cxt.bezierCurveTo(startX + 13, startY - 2, startX + 10, startY - 2.5, startX + 8.5, startY - 1.5);
    cxt.bezierCurveTo(startX + 7.5, startY - 3.75, startX + 4, startY - 3, startX + 4, startY - 1.5);
    cxt.bezierCurveTo(startX + 1.5, startY - 3.75, startX - 1, startY - 3, startX, startY);
    cxt.closePath();
}

function getRand(min,max) {
  return min+Math.random()*(max-min);
}

/**
 * 晚上
 * @param canvas
 * @param context
 * @param scale
 */
function nightCanvas(context,scale) {
  // 渐变天空
  gradientSky(context,'black','#035')
  // 画星星
  for (var i = 0; i < 50; i++) {
    var r = (Math.random() * 10 + 10)*scale;
    var x = Math.random() * canvas.width ;
    var y = Math.random() * canvas.height ;
    var a = Math.random() * 360;
    drawStar(context, x, y, r, a);
  }
  // 画月亮
  var x = 0.9 * canvas.width;
  var y = 0.5 * canvas.height;
  var d = computerDByDate();
  fillMoon(context, d, x, y, 50*scale, 30);
  // 画绿地
  drawLand(context);
}

/**
 * 白天
 * @param canvas
 * @param context
 * @param scale
 */
function dayCanvas(context,scale) {
  // 渐变天空
  gradientSky(context,'#46D0FE','#87effe')
  // 太阳
  var x = 0.9 * canvas.width;
  var y = 0.5 * canvas.height;
  fillSun(context,x,y,50*scale);
  // 白云
  for (var i=0;i<8;i++) {
    var s = (Math.random() * 10 )*scale;
    var x = Math.random() * canvas.width;
    var y = Math.random() * canvas.height ;
    drawCloud(context,x,y,s);
  }

}

function draw() {
  // 初始化canvas
  var header = document.getElementsByTagName("header")[0];
  var width = header.offsetWidth;
  var height = header.offsetHeight;
  canvas.height = height;
  canvas.width = width;
  var context = canvas.getContext("2d");

  // 计算canvas图形比例
  var scale = height/207;

  // 计算晚上还是白天
  var hour = new Date().getHours();
  if (hour>=6&&hour<=18) {
    dayCanvas(context,scale);
  } else {
    nightCanvas(context,scale);
  }
}

window.onload = function() {
  draw();
};

window.onresize = function() {
  draw();
}
