/**
 * Created by ayou on 17/12/20.
 */


var myImage = (function () {
  var img = document.createElement('img')
  document.body.appendChild(img)
  return {
    setSrc: function (src) {
      img.src = src
    }
  }
})()

var proxyImage = (function () {
  var img = new Image()
  img.onload = function () {
    myImage.setSrc(this.src)
  }

  return {
    setSrc: function (src) {
      myImage.setSrc('./loading.gif')
      img.src = src
    }
  }
})()