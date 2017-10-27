/**
 * Created by ayou on 2017/10/25.
 */

function *consumer() {
  var r = ''
  while (true) {
    var n = yield r
    if (!n) {
      return
    }
    console.log('[CONSUMER] Consuming ' + n)
    r = '200 OK'
  }
}

function produce(c) {
  c.next()
  n = 0
  while (n < 3) {
    n = n + 1
    console.log('[PRODUCER] Producing ' + n)
    r = c.next(n)
    console.log('[PRODUCER] Consumer return: ' + r.value)
  }
}

c = consumer()
produce(c)