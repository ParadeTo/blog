/**
 * Created by ayou on 17/12/20.
 */

var calculateBonus = function (level, salary) {
  if (level === 'S') {
    return salary * 5
  }
  if (level === 'A') {
    return salary * 4
  }
  if (level === 'B') {
    return salary * 3
  }
}


var S = function () {}
S.prototype.calculate = function (salary) {
  return salary * 5
}

var A = function () {}
A.prototype.calculate = function (salary) {
  return salary * 4
}

var B = function () {}
B.prototype.calculate = function (salary) {
  return salary * 3
}

var Bonus = function () {
  this.salary = null
  this.strategy = null
}

Bonus.prototype.setSalary = function (salary) {
  this.salary = salary
}

Bonus.prototype.setStrategy = function (strategy) {
  this.strategy = strategy
}

Bonus.prototype.getBonus = function () {
  return this.strategy.calculate(this.salary)
}


