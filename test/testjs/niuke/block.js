/**
 * Created by ayou on 2017/12/25.
 */

function f (str) {
  var color = ['R', 'G', 'B', 'Y']
  var arr = str.split('')
  function _f (arr) {
    var len = arr.length
    var minObj = {arr: null, min: Infinity}
    if (len === 1) return {arr: arr, min: 0}
    var subMin = _f(arr.slice(1))
    if (arr[0] != subMin.arr[0]) {
      var _arr = [].concat([arr[0]], subMin.arr.slice())
      minObj = {
        arr: _arr,
        min: subMin.min
      }
    }
    else {
      for (var i = 0; i < color.length; i++) {
        if (color[i] !== subMin.arr[0]) {
          arr[0] = color[i]
          var n = 1 + subMin.min
          if (minObj.min > n) {
            var _arr = [].concat([arr[0]], subMin.arr.slice())
            minObj = {
              arr: _arr,
              min: n
            }
          }
          break
        }
      }
    }
    return minObj
  }
  return _f(arr)
}

console.log(f('GGRRRR'))
