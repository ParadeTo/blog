/**
 * Created by ayou on 17/12/20.
 */

function Handler () {
  this.nextSuccessor = null
}

Handler.prototype.setNextSuccessor = function (nextSuccessor) {
  this.nextSuccessor = nextSuccessor
}

Handler.prototype.request = function () {
  throw new Error('需要实现')
}