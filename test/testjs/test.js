/**
 * Created by ayou on 2016-07-01.
 */


function SuperType(name) {
  console.log('调用了超类型的构造函数');
  this.name = name;
  this.colors = ['red','blue','green'];
}

SuperType.prototype.sayName = function() {
  console.log(this.name);
}

function SubType(name, age) {
  SuperType.call(this, name); // 第二次调用SuperType()
  this.age = age;
}

SubType.prototype = new SuperType(); // 第一次调用SuperType()
SubType.prototype.constructor = SubType; // 上面重写了原型，其constructor已不指向SubType
SubType.prototype.sayAge = function() {
  console.log(this.age);
};

var sub = new SubType(); //打印两次 调用了超类型的构造函数
console.log(sub.constructor);


var p = {
  name: 'ayou',
  colors: ['red','blue','green']
}

var s = Object.create(p);
s.name = 'xing';
s.colors.push('yellow');
console.log(s.name);
console.log(s.colors);
console.log(p.name);
console.log(p.colors);

function SuperType(name,func) {
  console.log('调用了超类型的构造函数');
  this.name = name;
  this.colors = ['red','blue','green'];
}