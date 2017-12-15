/**
 * Created by ayou on 2017/12/15.
 */
function memoFunc(func) {
  var cache = {}
  return function() {
    var argstr = JSON.stringify(arguments)
    if (cache[argstr]) return cache[argstr]
    cache[argstr] = func.apply(null, arguments)
  }
}

function add(a, b) {
  return a + b
}

var obj = {
  a: 1,
  b: 2,
  add: function () {
    return this.a + this.b
  }
}

var add1 = memoFunc(add)

add1(1, 2)
add1(1, 2)
add1(2, 3)
add1(3, 2)

var add2 = memoFunc(obj.add)
add2(1, 2)
add2(1, 2)

// function a() {
//   console.log(JSON.stringify(arguments))
// }
//
// console.log(a(1,2,3, {a:1}))