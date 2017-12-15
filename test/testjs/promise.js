/**
 * Created by ayou on 2017/12/15.
 */

// new Promise((resolve, reject) => {
//   console.log('Initial');
//
//   resolve(1);
// })
//   .then((a) => {
//     console.log(a)
//     console.log('Do this whatever happened before');
//   })
//   .then((a) => {
//     console.log(a)
//     throw new Error('Something failed');
//
//     console.log('Do this');
//   })
//   .catch(() => {
//     console.log('Do that');
//   })
//   .then((a) => {
//     console.log(a)
//     console.log('Do this whatever happened before');
//   });


function func1() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(1)
      resolve(1)
    }, 5000)
  })
}

function func2() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(2)
      resolve(2)
    }, 10000)
  })
}

Promise.race([func1(), func2()])
  .then(function(data) {
    console.log(data)
  })
