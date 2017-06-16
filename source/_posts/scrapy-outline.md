---
title: scrapy架构分析
date: 2017-05-27 17:06:07
tags:
- scrapy
categories:
- python
description: scrapy架构分析
---

![](scrapy-outline/1.png)

1. ``spider`` ``yield``一个``request``对象给``engine``
2. ``engine``将``request``直接给``scheduler``。从代码看是调用了``scheduler``的``enqueue_request``方法。而``scheduler``则会把``request``放到队列里面

	```python
			# engine中的schedule方法
		    def schedule(self, request, spider):
        self.signals.send_catch_log(signal=signals.request_scheduled,
                request=request, spider=spider)
        if not self.slot.scheduler.enqueue_request(request):
            self.signals.send_catch_log(signal=signals.request_dropped,
                                        request=request, spider=spider)
	```

3. ``engine``通过``_next_request_from_scheduler``从``scheduler``处（调用了``scheduler``的``next_request``）拿到下一个``request``
4. 与5一起分析
5. ``engine``将``request``交给``downloader``下载，该阶段可以添加``downloadermiddlewares``，其中``process_request``是下载之前执行的函数，``process_response``是下载之后执行的函数。例如，可以利用``middleware``实现随机切换``User-Agent``，设置代理ip，使用``selenium``下载动态网页等

	```python
	# 随机切换user-agent
	from fake_useragent import UserAgent
	class RandomUserAgentMiddleware(object):
	    def __init__(self, crawler):
	        super(RandomUserAgentMiddleware, self).__init__()
	        self.ua = UserAgent()
	        self.ua_type = crawler.settings.get("RANDOM_UA_TYPE", "random")
	
	    @classmethod
	    def from_crawler(cls, crawler):
	        return cls(crawler)
	
	    def process_request(self, request, spider):
	        def get_ua():
	            return getattr(self.ua, self.ua_type)
	
	        request.headers.setdefault("User-Agent", get_ua())

	# 设置代理IP
	class RandomProxyMiddleware(object):
    def process_request(self, request, spider):
        get_ip = GetIP()
        request.meta["proxy"] = get_ip.get_random_ip()

	# 使用selenium下载动态网页
	class JSPageMiddleware(object):
	    def process_request(self, request, spider):
		browser = webdriver.Chrome(executable_path="e:/soft/selenium/chromedriver.exe")
	        browser.get(request.url)
	        time.sleep(3)
	        print("访问:{0}".format(request.url))
	        # 不发送到下载器，直接返回给spider
	        return HtmlResponse(url=spider.browser.current_url, body=spider.browser.page_source, encoding="utf-8", request=request)
	```

6. 与7一起分析
7. ``engine``将``response``交给``spider``处理，该阶段可以添加``spidermiddlewares``，其中``process_spider_input``是将返回结果交给``spider``之前执行的函数，``process_spider_output``是``spider``处理完后执行的函数。
8. ``engine``根据``spider``返回的不同类型决定下一步，如果是``request``就跳到第二步，如果是``item``，就交给``pipelines``