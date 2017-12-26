/**
 * Created by ayou on 2017/12/25.
 */

var addTwoNumbers = function(l1, l2) {
  var sum = []
  var carry = 0
  for (var i = 0;i < l1.length; i++) {
    var _sum = l1[i] + l2[i]
    sum.push(_sum % 10 + carry)
    carry = Math.floor(_sum / 10)
  }
  return sum
};

l1 = [2,4,3]
l2 = [5,6,4]
console.log(addTwoNumbers(l1, l2))
