---
title: jquery轮播图插件
date: 2016-10-10 16:25:41
tags:
- javascript
- jquery插件
categories:
- javascript
description: jquery轮播图插件
---
# 一个jQuery插件框架模板
```javascript
(function($){
	
	/**
	 * [插件类]
	 */
	var Plugin = (function() {
		function Plugin(element, options) {
            // 拓展参数
			this.settings = $.extend(true,$.fn.Plugin.default,options || {});
			this.element = element;
			this.init();
		}
		Plugin.prototype = {
			init : function () {

			}
		}
		return Plugin;
	})();

	/**
	 * [在jquery的原型下挂载我们的方法]
	 * @param {[type]} options [用户自定义参数]
	 */
	$.fn.Plugin = function (options) {
		return this.each(function() {
			var me = $(this),
					 // 将插件实例保持在对象的data属性中，实现单例模式
					 instance = me.data("Plugin");
			if (!instance) {
				instance = new Plugin(me,options);
				me.data("Plugin", instance);
			}
			// 调用插件的方法，如：$("div").Plugin("init")
			if ($.type(options) === 'string') return instance[options]();
		});
	}

	// 插件默认参数
	$.fn.Plugin.default = {

	}

	// 获取页面上所有data-Plugin的元素来初始化
	$(function () {
		$("[data-Plugin]").Plugin();
	})
})(jQuery);
```

# 利用上面的模板开发一个轮播图插件

[项目地址](https://github.com/ParadeTo/page-switch)
## 说明
* 支持横屏/竖屏滑动
* 支持循环播放
* 支持自动播放（鼠标悬停到导航按钮上可暂停）
* 支持键盘方向键和鼠标滑轮切换

![demo.gif](page-switch/demo.gif)


## 使用
```html
	<div id="container">
		<div class="sections">
			<div class="section" id="section0"><h3>this is the page0</h3></div>
			<div class="section" id="section1"><h3>this is the page1</h3></div>
			<div class="section" id="section2"><h3>this is the page2</h3></div>
			<div class="section" id="section3"><h3>this is the page3</h3></div>
		</div>
	</div>
	<script src="./jquery.min.js"></script>
	<script src="../dist/pageSwitch.min.js"></script>
	<script>
		$("#container").PageSwitch({
			direction:'horizontal',
			easing:'ease-in',
			duration:1000,
			autoPlay:true,
			loop:'false'
		});
	</script>
```

## 参数说明
```javascript
selectors : {
	sections : ".sections",  // 容器
	section : ".section", // 每一页
	pages : ".pages", // 分页导航(小圆点)
	active : ".active" // 当前激活页
},
index : 0, // 开始位置
easing :  "ease", // 动画函数
duration : 500, // 毫秒
loop : false, // 是否循环播放，自动播放时该属性为true，设置无效
pagination : true, // 是否分页处理，是否显示小圆点
keyboard : true, // 是否支持键盘上下左右切换
direction : "vertical", // 竖直或水平滑动
autoPlay: true, // 自动播放
interval: 3000, // 自动播放间隔
callback :  "" // 切换动画结束后回调函数
```