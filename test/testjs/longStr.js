function isHw (str) {
  return str.split('').reverse().join("") === str
}

function longStr (str) {
  var len = str.length
  var longestStr = ''
  var longestLen = 0
  for (var i = 0; i < len; i++) {
    for (var j = 0; j < len; j++) {
      subStr = str.substring(i, j + 1)
      if (isHw(subStr) && longestLen < j - i + 1) {
        longestLen = j - i + 1
        longStr = subStr
      }
    }
  }
  return longStr
}

function longStr2 (str) {
  var len = str.length
  var longestStart = 0
  var longestEnd = 0
  var longestLen = 0
  var p = []
  // 初始化都不是回文
  for (var i = 0; i < len; i++) {
    p[i] = []
    for (var j = 0; j < len; j++) {
      p[i][j] = false
    }
  }

  for (var i = 0; i < len; i++) {
    var j = i
    while (j >= 0) {
      // 小于等于2的子串只需判断str[i] === str[j]
      // 否则需判断p[j + 1][i - 1]
      if (str[i] === str[j] && (i - j < 2 || p[j + 1][i - 1])) {
        p[j][i] = true
        if (longestLen < i - j + 1) {
          longestStart = j
          longestEnd = i
          longestLen = i - j + 1
        }
      }
      j--
    }
  }
  return {
    len: longestLen,
    str: str.substring(longestStart, longestEnd + 1)
  }
}


function longStr3 (str) {
  function _longStr3 (str, i, j, p) {
    var len = j - i + 1
    if (p[i][j] != null) {
      return p[i][j]
    }

    if (len === 1 || (len === 2 && str[i] === str[j])) {
      p[i][j] = true
      return true
    }

    if (str[i] === str[j] && _longStr3(str, i+1, j-1, p)) {
      p[i][j] = true
      return true
    }

    p[i][j] = false
    return false
  }

  var p = []
  var len = str.length
  var longestStart = 0
  var longestEnd = 0
  var longestLen = 0
  // 初始化都不是回文
  for (var i = 0; i < len; i++) {
    p[i] = []
    for (var j = 0; j < len; j++) {
      p[i][j] = null
    }
  }
  for (var i = len - 1; i > 0; i--) {
    for (var j = 0; j <= i; j++) {
      if (_longStr3(str, j, i, p) && longestLen < i - j +1) {
        longestStart = j
        longestEnd = i
        longestLen = i - j + 1
      }
    }
  }

  return {
    len: longestLen,
    str: str.substring(longestStart, longestEnd + 1)
  }
}



console.log(longStr3('acbadddabc'))
