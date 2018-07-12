/**
 * Created by ayou on 17/8/26.
 */
;(function() {
  document.querySelector('meta[name="viewport"]').content = 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1'

  var W = document.body.clientWidth
  var H = document.body.clientHeight * 0.6
  var SEC = 60
  var SIZE = 30
  var SCORE_SUM = 0
  var SCORE = 3
  var V = {max: 0.5, min: 0.1}
  var ARROW_V = 20
  var WY_IMG = '/images/game77/wy.png'
  var XQ_IMG = '/images/game77/xq.png'
  var ARROW_IMG = '/images/game77/arrow.png'
  var GARDEN = document.getElementById('garden')
  var SECONDS = document.getElementById('seconds')
  var BOY = document.getElementById('boy')
  var PRO_INNER = document.getElementById('proInner')
  var LEFT = document.getElementById('left')
  var RIGHT = document.getElementById('right')
  var HIT = document.getElementById('hit')
  var BOW = document.getElementById('bow')
  var RED = document.getElementById('red')
  var RED_BTN = document.getElementById('redBtn')
  var RED_IMG = document.getElementById('redImg')
  var KISS = document.getElementById('kiss')
  var RES = document.getElementById('res')
  var RES_CONTAINER = document.getElementById('res-container')
  var XQ = document.getElementById('xq')
  var ANIMALS = []
  var ARROWS = []
  var DIRECTION = {left: false, right: false}
  var INTERVAL_ID
  var COUNTDOWN_ID

  function initEvents () {
    LEFT.addEventListener('touchstart', function (e) {
      DIRECTION.left = true
      e.preventDefault()
    })
    LEFT.addEventListener('touchend', function (e) {
      DIRECTION.left = false
      e.preventDefault()
    })

    RIGHT.addEventListener('touchstart', function (e) {
      DIRECTION.right = true
      e.preventDefault()
    })
    RIGHT.addEventListener('touchend', function (e) {
      DIRECTION.right = false
      e.preventDefault()
    })

    HIT.addEventListener('click', function() {
      var pos = parseInt(BOW.style.left)
      ARROWS.push(genArrow(pos))
    })

    RED_BTN.addEventListener('click', function() {
      RED_IMG.className = 'rotate'
      setTimeout(function () {
        RED_IMG.style.display = 'none'
        showRes()
      }, 1500)
    })
  }

  function showRes() {
    RES.style.display = 'block'
    // XQ.className = 'move'
    setTimeout(function () {
      XQ.className = 'move'
      setTimeout(function() {
        RES_CONTAINER.style.transform = 'translateX(-50%)'
        genKiss()
      }, 2000)
    }, 1000)
  }

  function genKiss() {
    var frag = document.createDocumentFragment()
    for (var i = 0; i < 80; i++) {
      var div = document.createElement('div')
      var angle = Math.random() * 45
      var x = Math.random() * 100 + '%'
      var y = Math.random() * 100 + '%'
      div.className = 'single-kiss-container'
      div.style.transform = 'rotate('+angle+'deg)'
      div.style.left = x
      div.style.top = y
      var img = document.createElement('img')
      img.className = 'single-kiss'
      img.src = "/images/game77/single_kiss.png"
      img.style.animationDelay = Math.random() * 5 + 's'
      div.appendChild(img)
      frag.appendChild(div)
    }
    KISS.appendChild(frag)
  }

  function preLoadImgs (imgs) {
    var img = new Image()
  }

  function getGifPath (isPraise) {
    return isPraise ? '/images/game77/praise_1.gif' : '/images/game77/hit_1.gif'
  }

  function showGif (isPraise) {
    var gif = document.querySelector(isPraise ? '.praise' : '.punish')
    if (gif) return
    var img = document.createElement('img')

    var imgPath = getGifPath(isPraise)
    var deltaX = isPraise ? 'translateX(100%)' : 'translateX(-100%)'
    var hideCls = isPraise ? 'praise' : 'punish'

    img.src = getGifPath(isPraise)
    img.className = 'gif ' + hideCls
    setTimeout(function(){
      img.style.transform = deltaX
      setTimeout(function(){
        img.style.transform = 'translateX(0)'
        img.parentNode.removeChild(img)
      }, 1500)
    }, 0)
    document.body.appendChild(img)
  }

  function computeScore (hittedAnimal) {
    var score
    if (hittedAnimal.type === 'wy') {
      score = SCORE
    } else {
      score = -SCORE
    }
    SCORE_SUM += score
    if (SCORE_SUM > 100) SCORE_SUM = 100
    if (SCORE_SUM < 0) SCORE_SUM = 0
    return SCORE_SUM
  }

  function setPro (score) {
    BOY.style.left = 'calc(-25px + ' + score + '%)'
    PRO_INNER.style.width = score + '%'
  }

  function genV () {
    return Math.ceil(Math.random() * (V.max - V.min)) + V.min
  }

  function genAnimalMoveParams () {
    var isRight = Math.random() > 0.5

    var y = Math.floor(Math.random() * H)
    var x =  isRight ? W + SIZE : -SIZE
    var xv = genV()
    var yv = genV()

    if (isRight) xv = -xv

    yv = Math.random() > 0.5 ? yv : -yv

    return {
      x: x,
      y: y,
      xv: xv,
      yv: yv
    }
  }


  function resetAnimal (animal) {
    var moveParams = genAnimalMoveParams()
//        animal.dom.style.top = moveParams.y + 'px'
//        animal.dom.style.left = moveParams.x + 'px'
    animal.dom.style.transform = 'translate('+moveParams.x+'px, '+moveParams.y+'px)'
    animal.x = moveParams.x
    animal.y = moveParams.y
    animal.vx = moveParams.vx
    animal.vy = moveParams.vy
  }

  function genAnimal (type) {
    var animal = genAnimalMoveParams()

    var img = document.createElement('img')
    img.src = type === 'wy' ? WY_IMG : XQ_IMG
    img.className = 'animal'
//        img.style.top = animal.y + 'px'
//        img.style.left = animal.x + 'px'
    img.style.transform = 'translate('+animal.x+'px, '+animal.y+'px)'
    GARDEN.appendChild(img)

    animal.dom = img
    animal.type = type
    return animal
  }

  function genArrow(x) {
    var y = H + SIZE

    var img = document.createElement('img')
    img.src = ARROW_IMG
    img.className = 'arrow'
//        img.style.top = y + 'px'
//        img.style.left = x + 'px'
    img.style.transform = 'translate('+x+'px, '+y+'px)'
    GARDEN.appendChild(img)

    return {
      x: x,
      xv: 0,
      y: y,
      yv: -ARROW_V,
      dom: img
    }
  }

  function isOut (animal) {
    var x = animal.x
    var y = animal.y
    var xv = animal.xv
    var yv = animal.yv
    return (x > W && xv > 0) ||
      (y > H && yv > 0) ||
      (x < -SIZE && xv < 0) ||
      (y < -SIZE && yv < 0)
  }

  function move (obj) {
    var newX = obj.x + obj.xv
    var newY = obj.y + obj.yv
    obj.x = newX
    obj.y = newY
//        obj.dom.style.top = newY + 'px'
//        obj.dom.style.left = newX + 'px'
    obj.dom.style.transform = 'translate('+newX+'px, '+newY+'px)'
  }

  function isHit (animal) {
    for (var i = ARROWS.length - 1; i >= 0; i--) {
      var arrow = ARROWS[i]
      if ((arrow.x + SIZE/2) > animal.x &&
        (arrow.x + SIZE/2) < animal.x + SIZE &&
        arrow.y > animal.y &&
        arrow.y < animal.y + SIZE) {
        var dom = arrow.dom
        dom.parentNode.removeChild(dom)
        ARROWS.splice(i, 1)
        return true
      }
    }
    return false
  }

  function moveAnimals () {
    for (var i = 0, len = ANIMALS.length; i < len; i++) {
      var animal = ANIMALS[i]
      move(animal)
      if (isOut(animal)) {
        resetAnimal(animal)
      }
      if (isHit(animal)) {
        showGif(animal.type === 'wy')
        var score = computeScore(animal)
        setPro(score)
        if (SCORE_SUM === 100) {
          clearInterval(COUNTDOWN_ID)
          RED.style.display = 'block'
        }
        resetAnimal(animal)
      }
    }
  }

  function moveArrows () {
    for (var i = 0, len = ARROWS.length; i < len; i++) {
      var arrow = ARROWS[i]
      move(arrow)
    }
  }

  function moveBow () {
    var left = parseInt(BOW.style.left)
    if (DIRECTION.left) {
      BOW.style.left = left - 3 + 'px'
    }

    if (DIRECTION.right) {
      BOW.style.left = left + 3 + 'px'
    }
  }

  function clear() {
    clearInterval(INTERVAL_ID)
    clearInterval(COUNTDOWN_ID)
    setPro(0)
    SCORE_SUM = 0
    for (var i = ANIMALS.length-1; i >= 0; i--) {
      ANIMALS[i].dom.parentNode.removeChild(ANIMALS[i].dom)
    }
    for (var i = ARROWS.length-1; i >= 0; i--) {
      ARROWS[i].dom.parentNode.removeChild(ARROWS[i].dom)
    }
    ANIMALS = []
    ARROWS = []
  }

  function time() {
    var i = SEC
    COUNTDOWN_ID = setInterval(function() {
      SECONDS.innerText = i--
      if (i < 0) {
        window.alert('失败，重新开始？')
        clear()
        start()
      }
    }, 1000)
  }

  function start() {
    for (var i = 0; i < 10; i++) {
      if (i < 6) {
        ANIMALS.push(genAnimal('xq'))
      }
      ANIMALS.push(genAnimal('wy'))
    }

    ARROWS.push(genArrow(100))

    INTERVAL_ID = setInterval(function () {
      moveArrows()
      moveAnimals()
      moveBow()
    }, 20)

    time()
  }

  window.onload = function () {
    initEvents()
    start()
  }
})()