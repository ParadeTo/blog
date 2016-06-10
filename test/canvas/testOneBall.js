var WINDOW_WIDTH = 1024;
var WINDOW_HEIGHT = 400;
var RADIUS = 8;
var MARGIN_TOP = 60;
var MARGIN_LEFT = 30;

const endTime = new Date(2014, 6, 11, 18, 47, 52);
var curShowTimeSeconds = 0

var balls = [];
const colors = ["#33B5E5", "#0099CC", "#AA66CC", "#9933CC", "#99CC00", "#669900", "#FFBB33", "#FF8800", "#FF4444", "#CC0000"]

var ball = {x: 1000, y: 50, g: 2, vx: -4, vy: -10, color: "blue"};

window.onload = function () {

    var canvas = document.getElementById('canvas');
    var context = canvas.getContext("2d");°¢

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

    ball.vy += ball.g;
    ball.x += ball.vx;
    ball.y += ball.vy;


    if (ball.y >= WINDOW_HEIGHT - RADIUS) {
        // ·´µ¯
        ball.y = WINDOW_HEIGHT - RADIUS;
        // ÄÜÁ¿ËðºÄ
        ball.vy = -ball.vy*0.75;
    }
}



function render(cxt) {

    cxt.clearRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);


    cxt.fillStyle = ball.color;

    cxt.beginPath();
    cxt.arc(ball.x, ball.y, RADIUS, 0, 2 * Math.PI, true);
    cxt.closePath();

    cxt.fill();
}


