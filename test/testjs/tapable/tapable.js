// /**
//  * Created by ayou on 2018/1/22.
//  */
//
function Event () {
  this.events = {}
}

Event.prototype.listen = function (key, func) {
  if (!this.events[key]) {
    this.events[key] = []
  }
  this.events[key].push(func)
}

Event.prototype.fireAsync = function () {
  var args = [].slice.call(arguments)
  var key = args[0]
  args = args.slice(1)
  for (var i in this.events) {
    if (i === key) {
      var fnList = this.events[key]

      for (var i = fnList.length - 1; i >= 0; i--) {
        cb = fnList[i + 1] || function () {}
        fnList[i] = (function (fn, cb) {
          return function () {
            fn.apply(null, [...args, cb])
          }
        })(fnList[i], cb)
      }
      fnList[0]()
    }
  }
}


var e = new Event()
e.listen('some', function func1(a, cb) {
  setTimeout(function() {
    console.log(1)
    console.log(a)
    // cb()
  }, 1000)
})

e.listen('some', function func2(a, cb) {
  setTimeout(function() {
    console.log(2)
    console.log(a)
    cb()
  }, 1000)
})

e.fireAsync('some', 'arg')


// var Tapable = require('Tapable')
// var tapable = new Tapable();
// tapable._plugins = {
//   "something": [
//     function(a, cb){
//       setTimeout(()=>{
//         console.log('1', a);
//         cb();
//       },1500);
//     },
//     function(a, cb){
//       setTimeout(()=>{
//         console.log('2', a);
//         cb();
//       },1000);
//     },
//     function(a, cb){
//       setTimeout(()=>{
//         console.log('3', a);
//         cb();
//       },500);
//     }
//   ]
// }
//
// // applyPluginsAsync
// tapable.applyPluginsAsync('something', 'applyPluginsAsync', function(){console.log('end');});
