/**
 * Created by ayou on 2017/12/19.
 */


function Promise(fn) {
  var successCb
  var failCb

  this.then = function (_successCb, _failCb) {
    successCb = _successCb
    failCb = _failCb
  }

  function resolve (data) {
    setTimeout(() => {
      successCb(data)
    }, 0)
  }

  function reject (err) {
    setTimeout(() => {
      failCb(err)
    }, 0)
  }

  fn(resolve, reject)
}


var p = new Promise(function(resolve, reject) {
  // resolve(1)
  reject('err')
})

p.then(function(data) {
  console.log(data)
}, function (err) {
  console.log(err)
})