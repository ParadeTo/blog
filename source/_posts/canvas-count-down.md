---
title: canvas����ʱЧ��
date: 2016-06-10 22:07:05
tags:
- canvas
categories:
- canvas
description: ����canvas������һ������ʱС����
---
�����ʼѧϰcanvas��ʵ����[Ľ����](http://www.imooc.com/learn/133)�ϵ�һ������ʱ���ӡ�
## ����Ч��
!()[canvas-count-down/canvas-result.png]
����Ч���ǲ��Ǻ�Ѥ����
## ���ֱ�ʾ����
�ö�ά�����ʾ0~9���������족��Щ������Ҫ�õ����ַ�
```javascript
digit =
? ? [
? ? ? ? [
? ? ? ? ? ? [0, 0, 1, 1, 1, 0, 0],
? ? ? ? ? ? [0, 1, 1, 0, 1, 1, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 1, 1, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 1, 1, 1, 0, 0]
? ? ? ? ],//0
? ? ? ? [
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 1, 1, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [1, 1, 1, 1, 1, 1, 1]
? ? ? ? ],//1
? ? ? ? [
? ? ? ? ? ? [0, 1, 1, 1, 1, 1, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 1, 1, 0, 0, 0],
? ? ? ? ? ? [0, 1, 1, 0, 0, 0, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 0, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 1, 1, 1, 1, 1]
? ? ? ? ],//2
? ? ? ? [
? ? ? ? ? ? [1, 1, 1, 1, 1, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 1, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 1, 1, 1, 1, 1, 0]
? ? ? ? ],//3
? ? ? ? [
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 1, 0],
? ? ? ? ? ? [0, 0, 1, 1, 1, 1, 0],
? ? ? ? ? ? [0, 1, 1, 0, 1, 1, 0],
? ? ? ? ? ? [1, 1, 0, 0, 1, 1, 0],
? ? ? ? ? ? [1, 1, 1, 1, 1, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 1, 1]
? ? ? ? ],//4
? ? ? ? [
? ? ? ? ? ? [1, 1, 1, 1, 1, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 0, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 0, 0],
? ? ? ? ? ? [1, 1, 1, 1, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 1, 1, 1, 1, 1, 0]
? ? ? ? ],//5
? ? ? ? [
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 1, 1, 0, 0, 0],
? ? ? ? ? ? [0, 1, 1, 0, 0, 0, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 0, 0],
? ? ? ? ? ? [1, 1, 0, 1, 1, 1, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 1, 1, 1, 1, 1, 0]
? ? ? ? ],//6
? ? ? ? [
? ? ? ? ? ? [1, 1, 1, 1, 1, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 1, 1, 0, 0, 0],
? ? ? ? ? ? [0, 0, 1, 1, 0, 0, 0],
? ? ? ? ? ? [0, 0, 1, 1, 0, 0, 0],
? ? ? ? ? ? [0, 0, 1, 1, 0, 0, 0]
? ? ? ? ],//7
? ? ? ? [
? ? ? ? ? ? [0, 1, 1, 1, 1, 1, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 1, 1, 1, 1, 1, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 1, 1, 1, 1, 1, 0]
? ? ? ? ],//8
? ? ? ? [
? ? ? ? ? ? [0, 1, 1, 1, 1, 1, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 1, 1, 1, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 0, 1, 1],
? ? ? ? ? ? [0, 0, 0, 0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 1, 1, 0, 0],
? ? ? ? ? ? [0, 1, 1, 0, 0, 0, 0]
? ? ? ? ],//9
? ? ? ? [
? ? ? ? ? ? [0, 0, 0, 0],
? ? ? ? ? ? [0, 0, 0, 0],
? ? ? ? ? ? [0, 1, 1, 0],
? ? ? ? ? ? [0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 0],
? ? ? ? ? ? [0, 0, 0, 0],
? ? ? ? ? ? [0, 1, 1, 0],
? ? ? ? ? ? [0, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 0],
? ? ? ? ? ? [0, 0, 0, 0]
? ? ? ? ],//:
? ? ? ? [
? ? ? ? ? ? [0, 1, 1, 1, 1, 1, 0],
? ? ? ? ? ? [0, 1, 1, 1, 1, 1, 0],
? ? ? ? ? ? [0, 0, 0, 1, 0, 0, 0],
? ? ? ? ? ? [1, 1, 1, 1, 1, 1, 1],
? ? ? ? ? ? [1, 1, 1, 1, 1, 1, 1],
? ? ? ? ? ? [0, 0, 1, 1, 1, 0, 0],
? ? ? ? ? ? [0, 0, 1, 1, 1, 0, 0],
? ? ? ? ? ? [0, 1, 1, 0, 1, 1, 0],
? ? ? ? ? ? [0, 1, 1, 0, 1, 1, 0],
? ? ? ? ? ? [1, 1, 0, 0, 0, 1, 1]
? ? ? ? ]//��
? ? ];
```
һ�����ֵĻ���ԭ��(���[Ľ����](http://www.imooc.com/video/2450)):
!()[canvas-count-down/canvas-digit.png]
## ģ��һ��С����˶�
�����У������ַ����仯ʱ������ֺܶ��ɫ���˶���С��������ôʵ�ֵ��أ��ȴ�ģ��һ��С����˶���ʼ��
```javascript
var WINDOW_WIDTH = 1024;
var WINDOW_HEIGHT = 400;
var RADIUS = 8;
var MARGIN_TOP = 60;
var MARGIN_LEFT = 30;

var curShowTimeSeconds = 0

var balls = [];
const colors = ["#33B5E5", "#0099CC", "#AA66CC", "#9933CC", "#99CC00", "#669900", "#FFBB33", "#FF8800", "#FF4444", "#CC0000"]

// x,y��ʾС�������
// g��ʾ�������ٶ�
// vx��vy��ʾˮƽ�ʹ�ֱ�����ϵ��ٶ�
// color ��ʾС�����ɫ
var ball = {x: 1000, y: 50, g: 2, vx: -4, vy: -10, color: "blue"};

window.onload = function () {

    var canvas = document.getElementById('canvas');
    var context = canvas.getContext("2d");

    canvas.width = WINDOW_WIDTH;
    canvas.height = WINDOW_HEIGHT;

    curShowTimeSeconds = getCurrentShowTimeSeconds()
    setInterval(
        function () {
            render(context);
            updateBalls();
        }
        ,
        50
    );
}
function getCurrentShowTimeSeconds() {
    var curTime = new Date();
    var ret = endTime.getTime() - curTime.getTime();
    ret = Math.round(ret / 1000)
    return ret >= 0 ? ret : 0;
}
function updateBalls() {
    ball.vy += ball.g; // �ٶȱ仯
    ball.x += ball.vx; // ˮƽ�����λ�ñ仯
    ball.y += ball.vy;  // ��ֱ�����λ�ñ仯
    if (ball.y >= WINDOW_HEIGHT - RADIUS) {
        // ����
        ball.y = WINDOW_HEIGHT - RADIUS;
        // �������
        ball.vy = -ball.vy*0.75;
    }
}
// ����С��
function render(cxt) {
    cxt.clearRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
    cxt.fillStyle = ball.color;
    cxt.beginPath();
    cxt.arc(ball.x, ball.y, RADIUS, 0, 2 * Math.PI, true);
    cxt.closePath();
    cxt.fill();
}
```
С�������һ��б���˶���Ȼ�������ײ��󷴵���������˷�����һֱ����ֱ�ٶ�Ϊ0.
!()[canvas-count-down/canvas-ball.png]

## ��������
�������Ӵ�������ͼ��ʾ��
```javascript
var WINDOW_WIDTH = 642;
var WINDOW_HEIGHT = 500;
var RADIUS = 5;
var MARGIN_TOP = 180;
var MARGIN_LEFT = 0;
const endTime = new Date(2016,11,31,23,59,59);
var curShowTimeSeconds = 0;

var balls = [];
const colors = ["#33B5E5","#0099CC","#AA66CC","#9933CC","#99CC00","#669900","#FFBB33","#FF8800","#FF4444","#CC0000"]

window.onload = function() {
    var canvas = document.getElementById('canvas');
    var context =canvas.getContext("2d");
    canvas.width = WINDOW_WIDTH;
    canvas.height = WINDOW_HEIGHT;
    curShowTimeSeconds = getCurrentShowTimeSeconds();

    // ��ͣ�ĸ��º��ػ棬����ʱ�����ҪС��1�룬����׼ȷ
    setInterval(function() {
        render(context);
        update();
    },50);
}
/**
 * �ж������Ƿ����˱仯�������Ƿ����ʱ��
 */
function update() {
    var nextShowTimeSeconds = getCurrentShowTimeSeconds();

    var nextDays = parseInt(nextShowTimeSeconds/(24*3600));
    var nextHours = parseInt((nextShowTimeSeconds-nextDays*24*3600)/3600);
    var nextMinutes = parseInt((nextShowTimeSeconds-nextDays*24*3600-nextHours*3600)/60);
    var nextSeconds = nextShowTimeSeconds % 60;

    var curDays = parseInt(curShowTimeSeconds/(24*3600));
    var curHours = parseInt((curShowTimeSeconds-curDays*24*3600)/3600);
    var curMinutes = parseInt((curShowTimeSeconds-curDays*24*3600-curHours*3600)/60);
    var curSeconds = curShowTimeSeconds % 60;


    var nextSeconds = nextShowTimeSeconds % 60;
    var curSeconds = curShowTimeSeconds % 60;
    if (nextSeconds != curSeconds) {
        var sNextDays = nextDays.toString();
        sNextDays = sNextDays.length < 3 ?  '0' + sNextDays : sNextDays;
        var sCurDays = curDays.toString();
        sCurDays = sCurDays.length < 3 ? '0' + sCurDays : sCurDays;

        // ��-��λ
        if ( sNextDays[0] != sCurDays[0]) {
            addBalls( MARGIN_LEFT + 93*(RADIUS+1) - 45 * (RADIUS+1), MARGIN_TOP-22*(RADIUS+1) , sCurDays[0] );
        }
        // ��-ʮλ
        if ( sNextDays[1] != sCurDays[1]) {
            addBalls( MARGIN_LEFT + 93*(RADIUS+1) - 30 * (RADIUS+1), MARGIN_TOP-22*(RADIUS+1) , sCurDays[1] );
        }
        // ��-��λ
        if ( sNextDays[2] != sCurDays[2]) {
            addBalls( MARGIN_LEFT + 93*(RADIUS+1) - 15 * (RADIUS+1), MARGIN_TOP-22*(RADIUS+1) , sCurDays[2] );
        }
        // ʱ-ʮλ
        if( parseInt(curHours/10) != parseInt(nextHours/10) ){
            addBalls( MARGIN_LEFT + 0 , MARGIN_TOP , parseInt(curHours/10) );
        }
        // ʱ-��λ
        if( parseInt(curHours%10) != parseInt(nextHours%10) ){
            addBalls( MARGIN_LEFT + 15*(RADIUS+1) , MARGIN_TOP , parseInt(curHours/10) );
        }
        // ��-ʮλ
        if( parseInt(curMinutes/10) != parseInt(nextMinutes/10) ){
            addBalls( MARGIN_LEFT + 39*(RADIUS+1) , MARGIN_TOP , parseInt(curMinutes/10) );
        }
        // ��-��λ
        if( parseInt(curMinutes%10) != parseInt(nextMinutes%10) ){
            addBalls( MARGIN_LEFT + 54*(RADIUS+1) , MARGIN_TOP , parseInt(curMinutes%10) );
        }
        // ��-ʮλ
        if( parseInt(curSeconds/10) != parseInt(nextSeconds/10) ){
            addBalls( MARGIN_LEFT + 78*(RADIUS+1) , MARGIN_TOP , parseInt(curSeconds/10) );
        }
        // ��-��λ
        if( parseInt(curSeconds%10) != parseInt(nextSeconds%10) ){
            addBalls( MARGIN_LEFT + 93*(RADIUS+1) , MARGIN_TOP , parseInt(nextSeconds%10) );
        }
        curShowTimeSeconds = nextShowTimeSeconds;
    }
    updateBalls();
}
/**
 * ����С����˶��켣
 */
function updateBalls(){

    for( var i = 0 ; i < balls.length ; i ++ ){

        balls[i].x += balls[i].vx;
        balls[i].y += balls[i].vy;
        balls[i].vy += balls[i].g;

        // ����
        if( balls[i].y >= WINDOW_HEIGHT-RADIUS ){
            balls[i].y = WINDOW_HEIGHT-RADIUS;
            // �������
            balls[i].vy = - balls[i].vy*0.75;
        }
    }
}
/**
 * ���仯���������Ӳ�ɫС��
 * @param x �������Ͻ�x
 * @param y �������Ͻ�y
 * @param num ����
 */
function addBalls(x, y, num) {
    for( var i = 0  ; i < digit[num].length ; i ++ ) {
        for( var j = 0  ; j < digit[num][i].length ; j ++ ) {
            if( digit[num][i][j] == 1 ){
                var aBall = {
                    x:x+j*2*(RADIUS+1)+(RADIUS+1),
                    y:y+i*2*(RADIUS+1)+(RADIUS+1),
                    g:1.5+Math.random(),// ����������ٶ�
                    vx:Math.pow( -1 , Math.ceil( Math.random()*1000 ) ) * 4,//���ˮƽ�ٶ�
                    vy:-5,
                    color: colors[ Math.floor( Math.random()*colors.length ) ] // �����ɫ
                }

                balls.push( aBall )
            }
        }
    }
}
/**
 * �õ���ǰ����ʱ������
 * @returns {number}
 */
function getCurrentShowTimeSeconds() {
    var curTime = new Date();
    var ret = endTime.getTime() - curTime.getTime();
    ret = Math.round(ret/1000);
    return ret>=0?ret:0;
}
/**
 * �����졢ʱ���֡���
 * @param cxt
 */
function render(cxt) {

    // ��վ��οռ�
    cxt.clearRect(0,0,WINDOW_WIDTH,WINDOW_HEIGHT);
    // �����졢ʱ���֡���
    var days = parseInt(curShowTimeSeconds/(24*3600));
    var hours = parseInt((curShowTimeSeconds-days*24*3600)/3600);
    var minutes = parseInt((curShowTimeSeconds-days*24*3600-hours*3600)/60);
    var seconds = curShowTimeSeconds % 60;
    // ��
    days = days.toString();
    days = days.length < 3 ? '0' + days : days;
    for (var i=days.length- 1;i>=0;i--) {
        renderDigit(MARGIN_LEFT + 93*(RADIUS+1) - 15 * (days.length-i) * (RADIUS+1), MARGIN_TOP-22*(RADIUS+1), days[i], cxt);
    }
    renderDigit(MARGIN_LEFT + 93*(RADIUS+1),MARGIN_TOP-22*(RADIUS+1),11,cxt);
    // Сʱ���֣���
    renderDigit(MARGIN_LEFT,MARGIN_TOP,parseInt(hours/10),cxt);
    renderDigit(MARGIN_LEFT + 15*(RADIUS+1),MARGIN_TOP,parseInt(hours%10),cxt);
    renderDigit(MARGIN_LEFT + 30*(RADIUS+1),MARGIN_TOP,10,cxt);
    renderDigit(MARGIN_LEFT + 39*(RADIUS+1),MARGIN_TOP,parseInt(minutes/10),cxt);
    renderDigit(MARGIN_LEFT + 54*(RADIUS+1),MARGIN_TOP,parseInt(minutes%10),cxt);
    renderDigit(MARGIN_LEFT + 69*(RADIUS+1),MARGIN_TOP,10,cxt);
    renderDigit(MARGIN_LEFT + 78*(RADIUS+1),MARGIN_TOP,parseInt(seconds/10),cxt);
    renderDigit(MARGIN_LEFT + 93*(RADIUS+1),MARGIN_TOP,parseInt(seconds%10),cxt);

    // ��С��
    renderBalls(cxt);
}
/**
 * ��ͼ
 * @param x
 * @param y
 * @param num
 * @param cxt
 */
function renderDigit(x,y,num,cxt) {
    cxt.fillStyle = "rgb(0,102,153)";
    for(var i=0;i<digit[num].length;i++) {
        for(var j=0;j<digit[num].length;j++) {
            if (digit[num][i][j] === 1) {
                cxt.beginPath();
                cxt.arc(x+j*2*(RADIUS+1)+(RADIUS+1),y+i*2*(RADIUS+1)+(RADIUS+1 ),
                    RADIUS, 0, 2*Math.PI);
                cxt.closePath();
                cxt.fill();
            }
        }
    }
}

/**
 * ����
 * @param cxt
 */
function renderBalls(cxt) {
    for( var i = 0 ; i < balls.length ; i ++ ){
        cxt.fillStyle=balls[i].color;

        cxt.beginPath();
        cxt.arc( balls[i].x , balls[i].y , RADIUS , 0 , 2*Math.PI , true );
        cxt.closePath();

        cxt.fill();
    }
}
```
## �Ż�
����Ĵ�����һ�����⣬�������ų��������balls���鳤�Ȼ�һֱ����������ʵ���е�����֮���С��Ϳ��Դ�������ɾȥ�ˣ���������updateBalls�����㷴��ǰ���������´��룬���γ��е㲻ͬ���ٺ٣���������Ŷ����
```javascript
        // ɾȥ������С��
        if (balls[i].x + RADIUS < 0 || balls[i].x - RADIUS > WINDOW_WIDTH) {
            balls.splice(i,1);// �ѵ�ǰԪ��ɾ��������Ҫ��һ ����[1,2,3]�� ɾ��2����һ��Ԫ�ص���������1
            continue;
        }
```
��ӡ����ĳ��ȣ��䳤�Ȳ�����������
!()[canvas-count-down/canvas-length.png]
