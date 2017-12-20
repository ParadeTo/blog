/**
 * Created by ayou on 17/12/20.
 */
var Singleton = function (name) {
  this.name = name
  this.instance = null;
}

Singleton.prototype.getName = function () {
  return this.name
}

Singleton.getInstance = function (name) {
  if (!this.instance) {
    this.instance = new Singleton(name)
  }
  return this.instance
}