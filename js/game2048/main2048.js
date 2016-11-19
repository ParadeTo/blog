var board = new Array();
var score = 0;
// var dict = {
// 	'2':"小白",
// '4':"天真",
// '8':"涉世",
// '16':"开窍",
// '32':"爱美",
// '64':"好色",
// '128':"小流氓",
// '256':"大流氓",
// '512':"淫魔",
// '1024':"禽兽",
// '2048':"OOXX"
// };
// var dict = {
// '2':"贰",
// '4':"肆",
// '8':"捌",
// '16':"壹陆",
// '32':"叁贰",
// '64':"陆肆",
// '128':"壹贰捌",
// '256':"贰伍陆",
// '512':"伍壹贰",
// '1024':"壹零贰肆",
// '2048':"贰零肆捌"
// }
var dict = {
	'2':"好人",
	'4':"人",
	'8':"傻瓜",
'16':"笨蛋",
'32':"坏人",
'64':"坏蛋",
'128':"小混蛋",
'256':"大混蛋",
'512':"小流氓",
'1024':"大流氓",
'2048':"老流氓",
'4096':'禽兽'
};
// 解决 2 2 4 8 点击一次左边后出现16 0 0 0的bug
var hasConflicted = new Array();
// 手指滑动坐标
var startx,starty,endx,endy;

$(document).ready(function(){
	prepareForMobile();
	newGame();
})

$(document).keydown(function(event) {
	event.preventDefault();
	switch(event.keyCode) {
		case 37: // left
			if(moveLeft()){
				generateOneNumber();
				isGameOver();
			}
			break;
		case 38: // up
			if(moveUp()){
				generateOneNumber();
				isGameOver();
			}
			break;
		case 39: // right
			if(moveRight()){
				generateOneNumber();
				isGameOver();
			}
			break;
		case 40: // down
			if(moveDown()){
				generateOneNumber();
				isGameOver();
			}
			break;
		default:
			break;
	}
});

document.addEventListener('touchstart',function(event) {
	startx = event.touches[0].pageX;
	starty = event.touches[0].pageY;
})

document.addEventListener('touchmove',function(event) {
	event.preventDefault()
})

document.addEventListener('touchend',function(event) {
	endx = event.changedTouches[0].pageX
	endy = event.changedTouches[0].pageY
	var deltax = endx - startx
	var deltay = endy - starty

	// 滑动超过一定阈值才算滑动
	if (Math.abs(deltax) < 0.2*documentWidth && Math.abs(deltay) < 0.3*documentWidth) {
		return ;
	}


	// 滑动在x轴上进行
	if (Math.abs(deltax)>=Math.abs(deltay)) {
		// 向右滑动
		if (deltax > 0) {
			if(moveRight()){
				generateOneNumber();
				isGameOver();
			}
		}
		// 向左滑动
		else {
			if(moveLeft()){
				generateOneNumber();
				isGameOver();
			}
		}
	}
	// 滑动在y轴上进行
	else {
		// 向下滑动
		if (deltay > 0) {
			if(moveDown()){
				generateOneNumber();
				isGameOver();
			}
		}
		// 向上滑动
		else {
			if(moveUp()){
				generateOneNumber();
				isGameOver();
			}
		}
	}
})

function prepareForMobile () {
	if (documentWidth > 500) {
		gridContainerWidth = 500;
		cellSpace = 20;
		cellSideLength = 100;
	}
	$('#grid-container').css('width', gridContainerWidth-2*cellSpace);
	$('#grid-container').css('height', gridContainerWidth-2*cellSpace);
	$('#grid-container').css('border-radius', 0.02*gridContainerWidth);
	$('#grid-container').css('padding', cellSpace);

	$('.grid-cell').css('width',cellSideLength);
	$('.grid-cell').css('height',cellSideLength);
	$('.grid-cell').css('border-radius', 0.02*cellSideLength);
}

function isGameOver() {
	if (nospace(board) && nomove(board)) {
		storeRecord(board,score);
		initRecord()
		gameover();
	}
	if (achieve2048(board)) {
		storeRecord(board,score);
		initRecord()
		win();
	}
}

function gameover() {
	alert('game over');
}

function win() {
	alert('你赢了，可以继续游戏！')
}

function newGame() {
	// 初始化棋盘格
	init();
	// 随机两个格子生成数字
	generateOneNumber();
	generateOneNumber();
}

function init() {
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			var gridCell = $('#grid-cell-'+i+'-'+j);
			gridCell.css('top',getPosTop(i,j));
			gridCell.css('left',getPosLeft(i,j));
		}
	}
	for (var i = 0; i < 4; i++) {
		board[i] = new Array();
		hasConflicted[i] = new Array();
		for (var j = 0; j < 4.; j++) {
			board[i][j] = 0;
			hasConflicted[i][j] = false;
		}
	}
	updateBoardView();
	initRecord();
	score = 0;
}

// 初始化记录
function initRecord() {
	var record = localStorage.getItem('record');
	if(record) {
		record = JSON.parse(record);
		var html ='';
		for(var k in record) {
			var bgColor = getNumberBackgroundColor(parseInt(k))
			var color = getNumberColor(parseInt(k))
			html += 	'<span style="background-color:'+bgColor+';color:'+color+'">' + dict[k] + '<i>' + record[k] + '</i></span>';
		}
		$("#record").html(html);
	}

	var highest = localStorage.getItem('highest')
	if(highest) {
		$('#highest').text(highest)
	} else {
		$('#highest').text(0)
	}
}

// 根据board中的值来更新前端
function updateBoardView() {
	$(".number-cell").remove();
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4.; j++) {
			$("#grid-container").append("<div class='number-cell' id='number-cell-"+i+"-"+j+"'></div>");
			var theNumberCell = $("#number-cell-"+i+"-"+j);
			if (!board[i][j]) {
				theNumberCell.css('width','0px');
				theNumberCell.css('height','0px');
				theNumberCell.css('top',getPosTop(i,j)+cellSideLength/2);
				theNumberCell.css('left',getPosLeft(i,j)+cellSideLength/2);
			}
			else {
				theNumberCell.css('width',cellSideLength+'px');
				theNumberCell.css('height',cellSideLength+'px');
				theNumberCell.css('top',getPosTop(i,j));
				theNumberCell.css('left',getPosLeft(i,j));
				theNumberCell.css('background-color',getNumberBackgroundColor(board[i][j]));
				theNumberCell.css('color',getNumberColor(board[i][j]));
				theNumberCell.text(dict[board[i][j].toString()]);
			}
			hasConflicted[i][j] = false;
		}
	}
	$('.number-cell').css('line-height',cellSideLength+'px')
	$('.number-cell').css('font-size',0.3*cellSideLength+'px')
}

// 随机生成数字
function generateOneNumber() {
	if (nospace( board )) {
		return false;
	}
	// 随机一个位置
	do {
		var randx = parseInt(Math.floor(Math.random() * 4));
		var randy = parseInt(Math.floor(Math.random() * 4));
	} while (board[randx][randy] !== 0);
	// 随机一个数字2/4
	var randNumber = Math.random() < 0.5 ? 2 : 4;
	// 在随机位置上显示随机数字
	board[randx][randy] = randNumber;
	showNumberWithAnimation(randx,randy,randNumber,dict);
}

function moveLeft() {
	if (!canMoveLeft(board)) {
		return false;
	}
	// moveleft
	for (var i = 0; i < 4; i++) {
		for (var j = 1; j < 4.; j++) {
			if (board[i][j] != 0) {
				// 考察该元素左边所有的位置
				for (var k = 0; k < j; k++) {
					// 元素为0，且两者之间没有障碍物
					if (board[i][k] == 0 && noBlockHorizontal(i,k,j,board)) {
						// move,move完后更新数据到页面
						showMoveAnimation(i,j,i,k,updateBoardView,dict);
						board[i][k] = board[i][j];
						board[i][j] = 0
						break;
					}
					// 两者值相等，且两者之间没有障碍物
					else if (board[i][k] == board[i][j] && noBlockHorizontal(i,k,j,board) && !hasConflicted[i][k]){
						// move
						showMoveAnimation(i,j,i,k,updateBoardView,dict);
						// add
						board[i][k] = board[i][j] * 2;
						board[i][j] = 0
						// 加分
						score += board[i][k];
						updateScore(score);

						hasConflicted[i][k] = true;
						break;
					}
				}
			}
		}
	}
	return true;
}

function moveRight() {
	if (!canMoveRight(board)) {
		return false;
	}
	// move right 要先循环右边列
	for (var i = 0; i < 4; i++) {
		for (var j = 2; j >= 0.; j--) {
			if (board[i][j] != 0) {
				// 考察该元素右边边所有的位置，也必须先从最右边考虑
				for (var k = 3; k > j; k--) {
					// 元素为0，且两者之间没有障碍物
					if (board[i][k] == 0 && noBlockHorizontal(i,j,k,board)) {
						// move,move完后更新数据到页面
						showMoveAnimation(i,j,i,k,updateBoardView,dict);
						board[i][k] = board[i][j];
						board[i][j] = 0
						break;
					}
					// 两者值相等，且两者之间没有障碍物
					else if (board[i][k] == board[i][j] && noBlockHorizontal(i,j,k,board) && !hasConflicted[i][k]){
						// move
						showMoveAnimation(i,j,i,k,updateBoardView,dict);
						// add
						board[i][k] = board[i][j] * 2;
						board[i][j] = 0
						// 加分
						score += board[i][k];
						updateScore(score);

						hasConflicted[i][k] = true;
						break;
					}
				}
			}
		}
	}
	return true;
}

function moveUp() {
	if (!canMoveUp(board)) {
		return false;
	}
	// move up 要先循环上面行
	for (var i = 1; i < 4; i++) {
		for (var j = 0; j < 4.; j++) {
			if (board[i][j] != 0) {
				// 考察该元素上边边所有的位置，必须先从最上边考虑
				for (var k = 0; k < i; k++) {
					// 元素为0，且两者之间没有障碍物
					if (board[k][j] == 0 && noBlockVertical(j,k,i,board)) {
						// move,move完后更新数据到页面
						showMoveAnimation(i,j,k,j,updateBoardView,dict);
						board[k][j] = board[i][j];
						board[i][j] = 0
						break;
					}
					// 两者值相等，且两者之间没有障碍物
					else if (board[k][j] == board[i][j] && noBlockVertical(j,k,i,board) && !hasConflicted[k][j]){
						// move
						showMoveAnimation(i,j,k,j,updateBoardView,dict);
						// add
						board[k][j] = board[i][j] * 2;
						board[i][j] = 0
						// 加分
						score += board[k][j];
						updateScore(score);

						hasConflicted[k][j] = true;
						break;
					}
				}
			}
		}
	}
	return true;
}

function moveDown() {
	if (!canMoveDown(board)) {
		return false;
	}
	// move up 要先循环下面行
	for (var i = 2; i  >= 0; i--) {
		for (var j = 0; j < 4.; j++) {
			if (board[i][j] != 0) {
				// 考察该元素下边边所有的位置，必须先从最下边考虑
				for (var k = 3; k > i; k--) {
					// 元素为0，且两者之间没有障碍物
					if (board[k][j] == 0 && noBlockVertical(j,i,k,board)) {
						// move,move完后更新数据到页面
						showMoveAnimation(i,j,k,j,updateBoardView,dict);
						board[k][j] = board[i][j];
						board[i][j] = 0
						break;
					}
					// 两者值相等，且两者之间没有障碍物
					else if (board[k][j] == board[i][j] && noBlockVertical(j,i,k,board) && !hasConflicted[k][j]){
						// move
						showMoveAnimation(i,j,k,j,updateBoardView,dict);
						// add
						board[k][j] = board[i][j] * 2;
						board[i][j] = 0
						// 加分
						score += board[k][j];
						updateScore(score);

						hasConflicted[k][j] = true;
						break;
					}
				}
			}
		}
	}
	return true;
}
