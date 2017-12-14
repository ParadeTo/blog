/**
 * Created by ayou on 17/11/7.
 */

var str = "abbb".split("")

function permutation(i, n) {
  if (i+1 === n) {
    console.log(str.join(""))
    return
  }

  permutation(i+1,n)

  for (var k = i+1; k < n; k++) {
    if (str[k] === str[i]) continue

    var tmp = str[k]
    str[k] = str[i]
    str[i] = tmp

    permutation(i+1,n)

    tmp = str[k]
    str[k] = str[i]
    str[i] = tmp
  }
}

// str[1] = str[2]
// console.log(str)

permutation(0, str.length)
