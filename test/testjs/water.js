/**
 * Created by ayou on 18/3/2.
 */

/**
 * situation['12:0:0'] = true // 表示局面已存在过
 */
var cup1 =  {v: 12, w: 12}
var cup2 = {v: 8, w: 0}
var cup3 =  {v: 5, w: 0}

var situation = {'12:0:0': true}
move(cup1, cup2, cup3, [])

var situation = {'12:0:0': true}
var cup1 =  {v: 12, w: 12}
var cup2 = {v: 8, w: 0}
var cup3 =  {v: 5, w: 0}
move(cloneObj(cup1), cloneObj(cup3), cloneObj(cup2), [])

function isSatisfied(w1, w2, w3) {
  if (w1 === 6 && w2 === 6) {
    return true
  } else if (w1 === 6 && w3 === 6) {
    return true
  } else if (w2 === 6 && w3 === 6) {
    return true
  }
  return false
}


function isExist (ws) {
  ws.sort(function (a, b) {
    return b.v - a.v
  })
  if (situation[ws[0].w+":"+ws[1].w+":"+ws[2].w]) {
    return true
  }
  situation[ws[0].w+":"+ws[1].w+":"+ws[2].w] = true
  return false
}

// function log(cups) {
//   cups.sort(function(a, b) {
//     return b.v - a.v
//   })
//   var _log = ""
//   for (var i = 0; i < cups.length; i++) {
//     _log += cups[i].w + " "
//   }
//   console.log(_log)
// }

function cloneObj(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function move(cupFrom, cupTo, thirdCup, ope) {
  var w1, w2, w3
  w3 = thirdCup.w
  var remain = cupTo.v - cupTo.w
  if (cupFrom.w > 0 && remain > 0) {
    if (remain > cupFrom.w) {
      w1 = 0
      w2 = cupTo.w + cupFrom.w
    } else {
      w1 = cupFrom.w - remain
      w2 = cupTo.v
    }
    if (isSatisfied(w1, w2, w3)) {
      cupFrom.w = w1
      cupTo.w = w2
      console.log("success")
      console.log([...ope, cupFrom.v + "->" + cupTo.v])
      return true
    }
    if (isExist([{w: w1, v: cupFrom.v}, {w: w2, v: cupTo.v}, {w: w3, v: thirdCup.v}])) {
      return true
    }
    cupFrom.w = w1
    cupTo.w = w2

    move(cloneObj(cupFrom), cloneObj(cupTo), cloneObj(thirdCup), [...ope, cupFrom.v + "->" + cupTo.v])
    move(cloneObj(cupFrom), cloneObj(thirdCup), cupTo, [...ope, cupFrom.v + "->" + cupTo.v])
    move(cloneObj(cupTo), cloneObj(cupFrom), cloneObj(thirdCup), [...ope, cupFrom.v + "->" + cupTo.v])
    move(cloneObj(cupTo), cloneObj(thirdCup), cloneObj(cupFrom), [...ope, cupFrom.v + "->" + cupTo.v])
    move(cloneObj(thirdCup), cloneObj(cupFrom), cloneObj(cupTo), [...ope, cupFrom.v + "->" + cupTo.v])
    move(cloneObj(thirdCup), cloneObj(cupTo), cloneObj(cupFrom), [...ope, cupFrom.v + "->" + cupTo.v])
  }
}