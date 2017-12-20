/**
 * Created by ayou on 17/12/16.
 */

function require1() {
  var module = {
    exports: {}
  }
  // console.log(module.exports)
  var exports = module.exports
  //
  ;(function(module, exports) {
    // a模块的代码
    function a () {
      console.log('a')
    }
    module.exports = a
    exports.b = 1
    //
  })(module, exports)


  return module.exports
}

var obj = require1()

// console.log(obj.b)

var a = Symbol('a')

b = {
  [Symbol('a')]: 1,
  a: 2
}

for (var i in b) {
  console.log(i)
}

console.log(Object.prototype.toString.call(global))
