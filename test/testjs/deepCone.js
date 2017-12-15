function deepClone(obj) {
  var target

  function is(obj, type) {
    return Object.prototype.toString.call(obj) === '[object ' + type + ']'
  }

  if (!is(obj, 'Object') && !is(obj, 'Array')) {
    throw new Error('请传入对象')
  }

  function _clone(obj) {
    var _target
    if (is(obj, 'Object') || is(obj, 'Array')) {
      _target = deepClone(obj)
    } else {
      _target = obj
    }
    return _target
  }

  if (is(obj, 'Array')) {
    target = []
    for (var i = 0, len = obj.length; i < len; i++) {
      target[i] = _clone(obj[i])
    }
  } else {
    target = {}
    for (var i in obj) {
      target[i] = _clone(obj[i])
    }
  }

  return target
}


obj = [1,2,3,{a: [1, 2]}]
newObj = deepClone(obj)
obj[3]['a'].push(3)

console.log(obj, newObj)

obj = {a:[1,2,{b:3}], c: 4}
newObj = deepClone(obj)
obj['a'].push(3)

console.log(obj, newObj)
