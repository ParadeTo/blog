/**
 * Created by ayou on 2018/1/22.
 */
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function magic(n) {
  var str = []
  while (n > 0) {
    if (n % 2 === 0) {
      str.push(2)
      n = n / 2 - 1
    } else {
      str.push(1)
      n = (n - 1) / 2
    }
  }
  return str.reverse().join('')
}

// while (true) {
  rl.question('line', function (n) {
    return magic(n)
  })
// }