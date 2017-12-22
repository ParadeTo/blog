/**
 * Created by ayou on 17/12/17.
 */

// 长度对应的价格
var p = [0, 1, 5, 8, 9, 10, 17, 17, 20, 24, 30]
// 切割某长度的钢条对应的成本
var c = [0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10]


function extended_bottom_up_cut_rod(p, c, n) {
  var r = [0]
  var s = [0]
  var q
  for (var j = 1; j <= n; j++) {
    q = -Infinity
    for (var i = 1; i <= j; i++) {
      if (q < (p[i] + r[j-i]) - c[j]) {
        q = (p[i] + r[j-i]) - c[j]
        s[j] = i
      }
    }
    r[j] = q
  }
  return {
    r: r,
    s: s
  }
}

console.log(extended_bottom_up_cut_rod(p, c, 10))

