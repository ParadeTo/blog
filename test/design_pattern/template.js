/**
 * Created by ayou on 17/12/20.
 */

var PutInFridge = function () {

}


PutInFridge.prototype.open = function () {
  console.log('打开门')
}

PutInFridge.prototype.putin = function () {
  throw new Error('必须实现putin')
}

PutInFridge.prototype.close = function () {
  throw new Error('关门')
}

PutInFridge.prototype.do = function () {
  this.open()
  this.putin()
  if (this.beforeClose) {
    this.beforeClose()
  }
  this.close()
}