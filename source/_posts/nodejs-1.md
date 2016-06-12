---
title: �첽��̽������-�¼�����/����ģʽ
date: 2016-06-11 22:10:25
tags:
- nodejs
- �¼�
- �첽���
categories:
- nodejs
description: �첽��̽������-�¼�����/����ģʽ���ڽ��ѩ������
---
## �����¼����н��ѩ������
��νѩ�����⣬�����ڸ߷��������󲢷���������»���ʧЧ���龰����ʱ����������ͬʱӿ�����ݿ��У����ݿ��޷�ͬʱ������˴�Ĳ�ѯ���󣬽���Ӱ����վ�������Ӧ�ٶ�(������ǳ��nodejs��)
### ģ�����ݿ��ѯ
```javascript
var num = 0;
var select = function (callback) {
    setTimeout(function() {
        num++;
        callback("test");
    },2000)
}

select(function(res) {
    console.log(res+1);
});

select(function(res) {
    console.log(res+2);
});

select(function(res) {
    console.log(res+3);
});

setTimeout(function() {
   console.log(num);
},5000);
/* ���
test1
test2
test3
3
*/
```
��������ģ����վ��պ�����ʱ���治���ڣ�ͬһ��sql����ѯ�õ�test���ᱻִ�ж�Ρ�
### ����״̬�������Ʒ��ʴ���
```javascript
num = 0;
var status = "ready";
var select = function(callback){
    if (status === 'ready') {
        status = "pending";
        setTimeout(function() {
            num++;
            status = "ready";
            callback("test");
        })
    }
}

select(function(res) {
    console.log(res+1);
});

select(function(res) {
    console.log(res+2);
});

select(function(res) {
    console.log(res+3);
});

setTimeout(function() {
   console.log(num);
},5000);

/* ���
 test1
 1
 */
```
��ʱ����ѯ������Ȼ���Ƴ���1�Σ����Ƕ��select���ֻ�е�һ����Ч��
### �����¼�����
```javascript
num = 0;
var events = require('events');
var proxy = new events.EventEmitter();
var status = "ready";
var select = function(callback){
    proxy.once("selected", callback);
    if (status === 'ready') {
        status = "pending";
        setTimeout(function() {
            num++;
            status = "ready";
            proxy.emit("selected","test");
        })
    }
}

select(function(res) {
    console.log(res+1);
});

select(function(res) {
    console.log(res+2);
});

select(function(res) {
    console.log(res+3);
});

setTimeout(function() {
   console.log(num);
},5000);

/* ���
 test1
 test2
 test3
 1
 */
```
��ʱ���е�select��䶼�õ��˲�ѯ���ص����ݣ��Ҳ�ѯ����Ϊ1���ﵽ�����ǵ�Ԥ��