/**
 * Created by ayou on 2017/12/15.
 */

function Promise(fn){
  //需要一个成功时的回调
  var callback;
  //一个实例的方法，用来注册异步事件
  this.then = function(done){
    callback = done;
  }
  function resolve(a){
    setTimeout(() => {
      callback(a);
    }, 0)
  }
  fn(resolve);
}

var p = new Promise(function (resolve, reject) {
  resolve(1)
})

setTimeout(() => {
  p.then(function (a) {
    console.log(a)
  })
}, 100)



