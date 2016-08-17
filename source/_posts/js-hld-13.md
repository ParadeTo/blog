---
title: 笔记-javascript高级程序设计（第3版）第13章
date: 2016-08-06 15:56:49
tags:
- javascript
categories:
- 读书笔记
description: javascript高级程序设计（第3版）第13章笔记
---
## 事件流
* 事件冒泡
* 事件捕获

## 事件处理程序
### HTML事件处理程序
### DOM0级事件处理程序
```
var btn = document.getElementById('byBtn');
btn.onclick = function() {
  alert(this.id);
}
```
*以这种方式添加的事件处理程序会在事件流的冒泡阶段被处理*
### DOM2级事件处理程序
```
addEventListener(event,callback,type)
type
  true: 捕获阶段调用事件处理程序，不建议
  false：冒泡阶段调用
removeEventListener(event,callback,type)
  无法移除匿名函数
```

### IE事件处理程序
* attachEvent this等于window，事件以添加的相反顺序触发
* detachEvent

```
btn.attachEvent('onclick', function(){
  alert(this === window); // true
})
```

### 跨浏览器的事件处理程序
```
var EventUtil = {
  addHandler: function(ele,type,handler){
    if(ele.addEventListener){
      ele.addEventListener(type,handler,false);
    } else if (ele.attachEvent) {
      ele.attachEvent('on'+type,handler);
    } else {
      ele['on'+type] = handler;
    }
  },
  removeHandler: function(ele,type,handler){
    if(ele.removeEventListener){
      ele.removeEventListener(type,handler,false);
    } else if (ele.attachEvent) {
      ele.detachEvent('on'+type,handler);
    } else {
      ele['on'+type] = null;
    }
  }
};
```

## 事件对象
### DOM中的事件对象
#### event的属性
* bubbles: Boolean，只读，表明事件是否冒泡
* cancelable: Boolean，只读，表明是否可以取消事件的默认行为
* currentTarget: Element, 只读，其事件处理程序当前正在处理事件的那个元素
* defaultPrevented: Boolean，只读，为true表示已经调用了preventDefault()
* detail: Integer，只读，与事件相关的细节信息
* eventPhase: Integer，只读，调用事件处理程序的阶段：1捕获，2处于，3冒泡
* preventDefault(): Function, 只读，取消事件的默认行为，如果cancelable是true，则可以使用这个方法。例如可以调用方法阻止a标签的跳转
* stopImmediatePropagation(): Function,只读，取消事件的进一步捕获或冒泡，同时阻止任何事件处理程序被调用
* stopPropagation(): Function,只读，取消事件的进一步捕获或冒泡。如果bubbles为true，则可以使用这个方法
* target: Element, 只读，事件的目标
* trusted: Boolean 只读 为true表示事件是浏览器生成的。为false表示事件是由开发人员通过javascript创建的
* type：String 只读 被触发的事件的类型
* view: AbstractView 只读 与事件关联的抽象视图，等同于发生事件的window对象

* this currentTarget target
如果直接将事件处理程序指定给了目标元素，则他们想等
如果事件处理程序在其父节点中，则this和currentTarget等于父节点，target等于该节点

### IE中的事件对象
* 使用DOM0级方法添加事件处理程序时，event对象作为window对象的一个属性存在
```
btn.onclick = function() {
  var event = window.event;
  alert(event.type); // click
}
```
* 如果事件处理程序是使用attachEvent()添加的，那么就会有一个event对象作为参数传入
```
btn.attachEvent("onclick", function() {
  alert(event.type); // 'click'
});
```
* event 属性
  * cancelBubble: Boolean，读/写，默认值为false，设置为true就可以取消事件冒泡
  * returnValue:Boolean，读/写，默认值为true，设置为false可以取消事件的默认行为
  * srcElement:Element，只读，事件的目标
  * type：String，只读，被触发的事件的类型

* 不要使用this
```
btn.onclick = function() {
  alert(window.event.srcElement === this); //true
}
btn.attachEvent('onclick', function(event){
  alert(event.srcElement === this); //false
});
```

### 跨浏览器的事件对象
```
var EventUtil = {
    /*省略的代码*/
    getEvent : function(event) {
        return event ? event : window.event;
    },
    getTarget : function(event) {
        return event.target || event.srcElement;
    },
    preventDefault : function (event) {
        if (event.preventDefault) {
            event.preventDefault();
        } else {
            event.returnValue = false;
        }
    },
    stopPropagation : function (event) {
        if (event.stopPropagation) {
            event.stopPropagation();
        } else {
            event.cancelBubble = true;
        }
    }
}
```

## 事件类型
* UI事件，当用户与页面上的元素交互时触发
* 焦点事件，当元素获得或失去焦点时触发
* 鼠标事件，当用户通过鼠标在页面上执行操作时触发
* 滚轮事件，当使用鼠标滚轮时触发
* 文本事件，当在文档中输入文本时触发
* 键盘事件，当用户通过键盘在页面上执行操作时触发
* 合成事件，当为IME（input method editor，输入法编辑器）输入字符时触发
* 变动事件，当底层dom结构发生变化时触发
* ~~变动名称事件，当元素货属性名变动时触发，已废弃~~

### UI事件
* ~~DOMActivate~~
* load: 页面加载完后在window上触发，图像加载完毕时在img元素上触发
* unload
* abort: 当用户停止下载时，如果嵌入的内容没有加载完，则在object元素上面触发
* error：当发生js错误时在window上面触发，当无法加载图像时在img元素上面触发
* select： 当用户选择文本框input或textarea中的一个或多个字符时触发
* resize：窗口大小变化时在window或框架上面触发
* scroll：当用户滚动带滚动条的元素中的内容时，在该元素上面触发

#### load
图像加载
```
EventUtil.addHandler(window,"load",function() {
   var img = document.createElement('img');
    EventUtil.addHandler(img,"load",function(event) {
        event = EventUtil.getEvent(event);
        alert(EventUtil.getTarget(event).src);
    });
    document.body.appendChild(img);
    img.src = "smile.gif"; // 指定src才开始下载图片
});
```
js加载
```
EventUtil.addHandler(window,"load",function() {
    var script = document.createElement('script');
    EventUtil.addHandler(script,"load",function(event) {
        alert("LOADED");
    });
    script.src = "example.js";
    document.body.appendChild(script); // 现在才开始下载
});
```

#### unload
用户从一个页面切换到另一个页面，就会发生unload事件

#### resize
ie, safari, chrome, opera会在浏览器变化了1像素时就出发，然后随着变化不断重复触发；firefox则只会在用户停止调整才触发

#### scroll
```
EventUtil.addHandler(window, "scroll", function (event) {
    if (document.compatMode == 'CSS1Compat') {
        alert(document.documentElement.scrollTop);
    } else {
        alert(document.body.scrollTop);
    }
});
```

### 焦点事件
* blur: 不冒泡
* DOMFocusIn
* DOMFocusOut
* focus 不冒泡
* focusin 冒泡
* focusout

当焦点从一个元素移到另一个元素，会依次触发：
6->5->1->3->4->2

### 鼠标与滚轮事件
* click 左键
* dblclick 左键
* mousedown 任意键
* mouseenter 在鼠标光标从元素外部首次移动到元素范围之内时触发，不冒泡，移动到后代元素上也不触发，不冒泡
* mouseleave 与上面相反，不冒泡
* mousemove
* mouseout
* mouseover
* mouseup

#### 事件顺序
点击某元素时的事件顺序：
mousedown->mouseup->click->mousedown->mouseup->click->dblclick

#### 检测
检测是否支持除dblclick, mouseenter, mouseleave之外的事件
document.implementation.hasFeature('MouseEvents','2.0');
检测是否支持上面的所有事件，可以使用：
document.implementation.hasFeature('MouseEvent','3.0');

#### 客户区坐标位置
event.clientX
event.clientY
*不包括页面滚动的距离*

#### 页面坐标位置
event.pageX
event.pageY
*页面未滚动时与clientX和clientY想等*

#### 屏幕坐标位置（相对于电脑屏幕）
event.screenX
event.screenY

#### 修改键
```
EventUtil.addHandler(div, 'click', function(event) {
  event = EventUtil.getEvent(event);
  var keys = new Array();
  if (event.shiftKey) {
    keys.push("shift");
  }
  if (event.ctrlKey) {
    keys.push("ctrl");
  }
  if (event.altKey) {
    keys.push("alt");
  }
  if (event.metaKey) {
    keys.push("meta");
  }
  alert("Keys:"+keys.join(","));
})
```

#### 相关元素
mouseover 事件主目标是获得光标的元素，相关元素（relateTarget）是失去光标的元素
mouseout 事件主目标是失去光标的元素，相关元素是获得光标的元素

*IE中的是fromElement和toElement*
```
 getRelatedTarget:function(event) {
        if (event.relatedTarget) {
            return event.relatedTarget;
        } else if (event.toElement) {
            return event.toElement
        } else if (event.fromElement) {
            return event.fromElement;
        } else {
            return null;
        }
    }
```

#### 鼠标按钮
对于mousedown mouseup
0 主鼠标按钮
1 中间鼠标按钮，滚轮
2 次鼠标按钮
*IE中有8种*
```
getButton : function(event) {
        if (document.implementation.hasFeature('MouseEvents','2.0')) {
            return event.button;
        }
        // IE
        else {
            switch(event.button) {
                case 0:
                case 1:
                case 3:
                case 5:
                case 7:
                    return 0;
                case 2:
                case 6:
                    return 2;
                case 4:
                    return 1;
            }
        }
    }
```

#### 更多的事件信息
#### 鼠标滚轮事件
```
    // 获取滚动的前后数值向前120 向后－120
    getWheelDelta : function(event) {
        if (event.wheelDelta) {
            // opera浏览器相反
            return (client.engine.opera && client.engine.opera < 9.5 ?
                            -event.wheelDelta : event.wheelDelta);
        } else {
            // Firefox的DOMMouseScroll事件
            return -event.detail * 40;
        }
    }
```

#### 触摸设备
#### 无障碍性问题

### 键盘与文本事件
* keydown 文本框变化之前触发
* keypress 按下字符键触发，文本框变化之前触发
* keyup 文本框变化之后触发

#### 键码
keyCode

#### 字符编码
keypress 任何可以获得焦点的元素都可以触发，按下能够影响文本显示的键会触发（例如退格键）
event.charCode
```
 getCharCode: function(event) {
        if (typeof event.charCode == 'number') {
            return event.charCode;
        } else {
            return event.keyCode;
        }
    }
```

#### DOM3级变化
key char

#### textInput 事件
按下能够输入实际字符键时才会触发
event.data 用户输入的实际字符
event.inputMethod:
* 0，不确定
* 1，使用键盘输入
* 2，是粘贴进来的
* 3，拖放进来
* 4，ime输入
* 5，在表单中选择某一项输入
* 6，通过手写输入
* 7，语音输入
* 8，组合输入
* 9，通过脚本输入

### 复合事件
略

### 变动事件
* DOMSubtreeModified DOM结构中发生任何变化时触发
* DOMNodeInserted 在一个节点作为子节点被插入到另一个节点中时触发
* DOMNodeRemoved 在节点从其父节点中被移除时触发
* DOMNodeInsertedIntoDocument 在一个节点被直接插入文档或通过子树间接插入文档之后触发，这个事件在DOMNodeInserted之后触发
* DOMNodeRemovedFromDocument  类似于上面
* DOMAttrModified 在特性被修改之后触发
* DOMCharacterDataModified 在文本节点的值发生变化时触发

检测浏览器是否支持变动事件:
```
var isSupported = document.implementation.hasFeature('MutationEvents','2.0');
```
#### 删除节点
在使用removeChild()或replaceChild()从DOM中删除节点时：
首先会触发DOMNodeRemoved事件。这个事件的目标（event.target）是被删除的节点，event.relatedNode包含对父节点的引用。
如果被删除的节点包括子节点，那么其所有子节点以及这个被移除的节点上会相继触发DOMNodeRemovedFromDocument事件。
然后触发DOMSubtreeModified事件。该事件的目标是被移除节点的父节点
例子：
```
<body>
<ul id="myList">
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ul>
</body>
```
假设要移除ul元素，此时会触发：
1 在ul上触发DOMNodeRemoved事件，relatedNode等于document.body
2 在ul上触发DOMNodeRemovedFromDocument
3 ul的每个li元素上触发DOMNodeRemovedFromDocument
4 在document.body上触发DOMSubtreeModified事件，因为ul元素是document.body的直接子元素

#### 插入节点
appendChild replaceChild insertBefore
首先触发DOMNodeInserted事件。event.target是被插入的节点，event.relatedNode包含对父节点的引用。冒泡
然后再新插入的节点上触发DOMNodeInsertedIntoDocument事件，不冒泡，插入之前添加事件处理程序。其目标是被插入的节点。
最后触发DOMSubtreeModified，触发于新插入节点的父节点。冒泡

### HTML5事件
#### contextmenu事件
右键菜单
```
<div id="myDiv">右键菜单</div>
  <ul id="myMenu" style="position:absolute;visibility:hidden;background-color:silver">
    <li>1</li>
    <li>2</li>
    <li>3</li>
  </ul>

window.onload = function() {
  var div = document.getElementById('myDiv');
      var menu = document.getElementById('myMenu');
  EventUtil.addHandler(div,'contextmenu',function(event){
    event = EventUtil.getEvent(event);
    event.preventDefault();
    menu.style.visibility = 'visible';
    menu.style.left = event.clientX+'px';
    menu.style.top = event.clientY +'px';
  });
   EventUtil.addHandler(div,'click',function(event){
     document.getElementById("myMenu").style.visibility = 'hidden';
   })
}
```

#### beforeunload 事件
```
  EventUtil.addHandler(div,'contextmenu',function(event){
    event = EventUtil.getEvent(event);
    var message = '真的要关闭吗'
    event.returnValue = message;
    return message;
  });
```

#### DOMContentLoaded 事件
window的load事件会在页面的一切都加载完毕时触发，但这个过程因为要加载的外部资源过多而颇费周折。DOMContentLoaded在形成完整的DOM树之后就会触发，不会处理图像、js、css文件或其他资源是否已经下载完毕。会在load事件之前触发
对于不支持该事件的浏览器，可以这样：
```
setTimeout(function(){
  //
},0)
```

#### readystatechange 事件
* uninitialized 对象存在但未初始化
* loading 对象正在加载数据
* loaded 对象加载数据完成
* interactive 可以操作对象了，但还没有完全加载
* complete 对象已经加载

```
EventUtil.addHandler(document,'readystatechange',function(event){
  if (document.readyState == 'interactive') {
    alert('Content loaded');
  }
})
```

交互阶段和完成阶段的顺序无法保证，有必要同时检测，如:
```
EventUtil.addHandler(document,'readystatechange',function(event){
  if (document.readyState == 'interactive' || document.readyState == 'complete' ) {
    EventUtil.removeHandler(document,'readystatechange',arguments.callee);
    alert('Content loaded');
  }
})
```

上面的代码，检测是否进入交互阶段或完成阶段。如果是，则移除相应的事件处理程序以免在其他阶段再执行

加载script的例子：
```
EventUtil.addHandler(window,'load',function(){
  var script = document.createElement('script');
  EventUtil.addHandler(script, "readystatechange", function(event){
    event = EventUtil.getEvent(event);
    var target = EventUtil.getTarget(event);
      if (document.readyState == 'interactive' || document.readyState == 'complete' ) {
    EventUtil.removeHandler(target,'readystatechange',arguments.callee);
    alert('Script loaded');
  }
  });
  script.src = 'example.js';
  document.body.appendChild(script);
})
```

#### pageshow和pagehide事件
往返缓存（back-forward cache，或bfcache），可以在用户使用浏览器的后退和前进按钮时加快页面的转换速度。
保存了页面数据、DOM和JS得状态。
不触发load事件
* pageshow
这个事件在页面显示时触发，无论页面来自bfcache
1 重新加载页面，在load之后触发
2 bfcache中的页面，在页面状态恢复的时候触发
event.persisted 如果页面被保存在了bfcache中，则这个属性的值为true，否则，为false

* pagehide
发生在unload之前
event.persisted 如果页面在卸载之后会被保存在bfcache中，则为true，否则，为false

#### hashchange
```
EventUtil.addHandler(window,'hashchange',function(){
  alert("old URL:"+event.oldURL+"\nNew URL:"+event.newURL);
});
```
检测
```
var isSupported = ("onhashchange" in window) && (document.documentMode === undefined || document.documentMode > 7)
```

### 设备事件
#### orientationchange
safari
window.orientation
#### MozOrientation
#### deviceorientation
#### devicemotion

### 触摸与手势事件
#### 触摸
* touchstart 当手指触摸屏幕时触发；即使已经有一个手指放在了屏幕上也会触发
* touchmove 当手指滑动时连续触发。preventDefault()可以阻止滚动
* touchend
* touchcancel 当系统停止跟踪触摸时触发
* touches 表示当前跟踪的触摸操作的touch对象的数组
* targetTouches 特定于事件目标的touch对象的数组
* changeTouches 表示自上次触摸以来发生了什么改变的Touch对象的数组

每个touch对象包含下列属性
* clientX,clientY 视口坐标
* identifier 标识触摸的唯一ID
* pageX,pageY 页面坐标
* screenX,screenY 屏幕坐标
* target 触摸的DOM节点目标

```
  function handleTouchEvent(event) {
    // 只跟踪一次触摸
    if (event.touches.length == 1) {
      var output = document.getElementById('output');
      switch (event.type) {
        case "touchstart" :
          output.innerHTML = "Touch started (" + event.touches[0].clientX+
              ","+event.touches[0].clientY+")";
          break;
        case "touchend" :
          output.innerHTML = "Touch ended (" + event.changedTouches[0].clientX+
          ","+event.changedTouches[0].clientY+")";
          break;
        case "touchmove" :
			event.preventDefault();
          output.innerHTML = "Touch started (" + event.changedTouches[0].clientX+
          ","+event.changedTouches[0].clientY+")";
          break;
      }
    }
  }
```

触摸屏幕上的元素时，事件顺序：
touchstart->mouseover->mousemove->mousedown->mouseup->click->touchend

#### 手势
* gesturestart 当一个手指按在屏幕上而另一个手指又触摸屏幕时触发
* gesturechange 当触摸屏幕的任何一个手指的位置发生变化时触发
* gestureend 当任何一个手指从屏幕上面移开时触发

*触摸事件和手势事件之间有联系*
event.rotation 手指变化引起的旋转角度，负值表示逆时针，正值表示顺时针
event.scale 两个手指间距离的变化情况，从1开始距离拉大增大，距离缩短减小

## 内存和性能
添加到页面上的事件处理程序数量将直接关系到页面的整体运行性能。
* 每个函数都是对象，都会占用内存；内存中的对象越多，性能越差
* 必须事先指定所有事件处理程序而导致的DOM访问次数，会延迟整个页面的交互就绪时间

### 事件委托
对“事件处理程序过多”问题的解决方法就是事件委托
利用了事件冒泡，只指定一个事件处理程序，管理某一类型的所有事件
例：
```
<ul id="myLinks">
    <li id="goSomewhere">Go somewhere</li>
    <li id="doSomething">Do something</li>
    <li id="sayHi">Say hi</li>
</ul>

    var i1 = document.getElementById('goSomewhere')
    var i2 = document.getElementById('doSomething')
    var i3 = document.getElementById('sayHi')

    EventUtil.addHandler(i1,"click",function(event){
        location.href = "http://www.wrox.com";
    })
    EventUtil.addHandler(i2,"click",function(event){
        document.title = "I change the document's title";
    })
    EventUtil.addHandler(i3,"click",function(event){
        alert("hi")
    })
```

可以用事件委托来解决这个问题，所有用到按钮的事件（多数鼠标事件和键盘事件）都适合采用事件委托技术。

```
   var list = document.getElementById("myLinks");
    EventUtil.addHandler(list, "click", function (event) {
        event = EventUtil.getEvent(event);
        var target = EventUtil.getTarget(event);
        switch(target.id) {
            case "doSomething":
                document.title = "I changed the document's title";
                break;
            case "goSomewhere":
                location.href = "http://www.wrox.com";
                break;
            case "sayHi":
                alert("hi");
                break;
        }
    });
```

如果可行，可以考虑为document对象添加事件处理程序，优点有：
* document对象很快就可以访问，而且可以在页面生命周期的任何时点上为它添加事件处理程序
* 在页面上设置事件处理程序所需的时间更少，只添加一个事件处理程序所需的DOM引用更少，所花的时间也更少。
* 整个页面占用的内存空间更少，能够提升整体性能
适合事件委托的事件包括:click mousedown mouseup keydown keyup keypress

### 移除事件处理程序
```
<div id="myDiv">
    <input type="button" id="myBtn"/>
</div>
<script>
    var btn = document.getElementById('myBtn');
    btn.onclick = function () {
        // 移除事件处理程序，这个也可以阻止冒泡，因为目标元素在文档中是事件冒泡的前提
        btn.onclick = null;
        document.getElementById('myDiv').innerHTML = 'Processing...';
    }
</script>
```

click事件中移除了input 但是事件处理程序仍然与按钮保持着引用关系，最好手工移除，也可以通过事件委托来解决。

一般在unload事件中移除所有事件处理程序

## 模拟事件
暂时不深究