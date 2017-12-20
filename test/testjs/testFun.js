/**
 * Created by ayou on 17/12/16.
 */


function add (arr) {
  return new Function('arr', 'return ' + arr.join("+"))(arr)
}

console.log(add([1,2,3]))