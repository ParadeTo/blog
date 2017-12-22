/**
 * Created by ayou on 2017/12/21.
 */


var v = [6,3,5,4,6]
var w = [2,2,6,5,4]
var c = 10

function big (v, w, c) {
  function _big(v, w, c, f, s) {
    var n = v.length
    if (f[c][n] >= 0) {
      return f[c][n]
    }
    f[c][n] = 0
    for (var i = 0;i < n;i++) {
      var newW = w.slice()
      newW.splice(i, 1)
      var newV = v.slice()
      newV.splice(i, 1)
      if (w[i] > c) {
        return 0
      }
      var maxValue = v[i] + _big(newV, newW, c - w[i], f, s)
      if (f[c][n] < maxValue) {
        f[c][n] = maxValue
        s[c][n] = {v: v[i], w: w[i]}
      }
    }
    return f[c][n]
  }

  var f = []
  var s = []
  for (var i = 0; i <= c; i++) {
    f[i] = []
    s[i] = []
  }
  _big(v, w, c, f, s)

  console.log(s)
  var n = v.length
  // 从s中得到所选择的物品
  var selected = []
  var i = c
  var j = n
  var sum = 0
  do {
    var thing = s[i][j]
    if (thing) {
      selected.push(thing)
      i -= thing.w
      j--
    }
  } while (thing)

  return {
    maxV: f[c][n],
    selected: selected
  }
}

function big2 (v, w, c) {
  var f = []
  for (var i = 0; i <= c; i++) {
    f[i] = []
  }

  var n = v.length
  // 容量从 0 到 c
  for (var i = 0; i < c; i++) {
    // 物品从 0 到 n
    for (var j = 0; j <= n; j++) {
      if (i === 0 || j === 0) {
        f[i][j] = 0
      }

      var value = v[j]
    }
    f[i][]
  }

  return f
}

var ret = big(v, w, c)
console.log(ret)

