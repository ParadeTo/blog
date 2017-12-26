/**
 * Created by ayou on 2017/12/21.
 */


var v = [6,3,5,4,6]
var w = [2,2,6,5,4]
var c = 10

// var v = [3,1,7,4,6]
// var w = [2,2,6,5,4]
// var c = 10

function bag (v, w, c) {
  function _bag (v, w, c, f, s) {
    // 子问题的规模
    var n = v.length
    // 子问题已经被求解
    if (f[n][c] != null) {
      return f[n][c]
    }
    // 从剩下的物品中选择一件
    maxValue = 0
    for (var i = 0; i < n; i++) {
      var newW = w.slice()
      newW.splice(i, 1)
      var newV = v.slice()
      newV.splice(i, 1)
      // 当前物品重量大于背包剩余容量，跳过
      if (w[i] > c) {
        f[n][c] = 0
        continue
      }
      // 否则递归求解，得到子问题的最大的解及当前选择的物品
      var maxValue = v[i] + _bag(newV, newW, c - w[i], f, s)
      if (f[n][c] < maxValue) {
        f[n][c] = maxValue
        s[n][c] = {v: v[i], w: w[i]}
      }
    }
    // 返回子问题的最大解
    return f[n][c]
  }

  var n = v.length
  // 记录最大的价值
  var f = []
  // 记录每一步所做的选择
  var s = []
  for (var i = 0; i <= n; i++) {
    f[i] = []
    s[i] = []
    for (var j = 0; j <= c; j++) {
      f[i][j] = null
      s[i][j] = null
    }
  }
  _bag(v, w, c, f, s)

  // 从s中得到所选择的物品
  console.log(f)
  console.log(s)
  var selected = []
  var i = n
  var j = c
  var sum = 0
  do {
    var thing = s[i][j]
    if (thing) {
      selected.push(thing)
      j -= thing.w
      i--
    }
  } while (thing)

  return {
    maxV: f[n][c],
    selected: selected
  }
}

function bag2 (v, w, c) {
  var f = []
  var s = []
  var n = v.length

  for (var i = 0; i <= n; i++) {
    f[i] = []
    s[i] = []
    for (var j = 0; j <= c; j++) {
      f[i][j] = 0
      s[i][j] = 0
    }
  }

  // 遍历物品
  for (var i = 1; i <= n; i++) {
    var index = i - 1
    // 遍历容量
    for (var j = 0; j <= c; j++) {
      // 当前物品放入的情况
      if (w[index] <= j && v[index] + f[i - 1][j - w[index]] > f[i - 1][j]) {
        f[i][j] = v[index] + f[i - 1][j - w[index]]
        s[i][j] = 1
      }
      // 当前物品不放入的情况
      else {
        f[i][j] = f[i - 1][j]
      }
    }
  }

  return{
    f: f,
    s: s
  }
}

var ret = bag2(v, w, c)
console.log(ret.f)
console.log(ret.s)

