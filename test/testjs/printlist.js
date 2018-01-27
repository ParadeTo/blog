/**
 * Created by ayou on 2018/1/22.
 */

function ListNode(x){
  this.val = x;
  this.next = null;
}

function printListFromTailToHead(head)
{
  if (!p1.hasOwnProperty('val')) return []
  // write code here
  var stack = [];
  var p = head;
  do {
    stack.push(p.val)
    p = p.next
  } while (p);


  return stack.reverse()
}

var p1 = new ListNode(1)
var p2 = new ListNode(2)
p1.next = p2

console.log(p1.hasOwnProperty('val'))

console.log(printListFromTailToHead(p1))

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

console.log(magic(10))

