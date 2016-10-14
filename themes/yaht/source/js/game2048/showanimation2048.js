

// 数字显示动画
function showNumberWithAnimation (i,j,randNumber,dict) {
	var theNumberCell = $("#number-cell-"+i+"-"+j);
	theNumberCell.css('background-color',getNumberBackgroundColor(randNumber));
	theNumberCell.css('color',getNumberColor(randNumber));
	theNumberCell.text(dict[randNumber]);

	theNumberCell.animate({
		width: cellSideLength,
		height: cellSideLength,
		top:getPosTop(i,j),
		left:getPosLeft(i,j)
	},200);
}

// 移动动画，move完后更新数据到页面
function showMoveAnimation(fromx,fromy,tox,toy,cb){
	var theNumberCell = $("#number-cell-"+fromx+"-"+fromy);
	theNumberCell.animate({
		top:getPosTop(tox,toy),
		left:getPosLeft(tox,toy)
	},200,cb);
}

function updateScore(score) {
	var highest = parseInt($('#highest').text());
	if (highest < score) {
			$('#highest').text(score);
	}
	$('#score').text(score);
}
