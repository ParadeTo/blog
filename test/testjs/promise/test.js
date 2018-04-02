const Promise = require('./promise')

// let p = new Promise(function(resolve, reject){
//   // resolve(100)
//   setTimeout(function(){
//     resolve(100)   
//   }, 1000)
// })

// p.then(function(data){
//   console.log('成功', data)
// },function(err){
//   console.log('失败', err)
// })

// p.then(function(data) {
//   console.log('成功2', data)
// })

let p = new Promise(function(resolve, reject){
  resolve('hello')
})

p.then(function(data){
  return data + ' handled' // 这里返回一个值
}, function(){

}).then(function(data){
  console.log(data) // 这里会接收到xxx
}, function(){
})