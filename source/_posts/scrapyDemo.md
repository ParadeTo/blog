---
title: scrapy通用爬虫
date: 2017-05-22 14:39:43
tags:
- scrapy
categories:
- python
description: 基于scrapy的通用爬虫
---
最近学完了慕课网的爬虫课程，决定自己动手实现一个通用的爬虫，爬取网站的规则记录在数据库中，通过程序读入，然后初始化爬虫
的配置进行爬取。

# model
## article
爬取到的文章的信息

```sql
DROP TABLE IF EXISTS `article`;
CREATE TABLE `article` (
  `url_object_id` varchar(50) NOT NULL DEFAULT '' COMMENT 'url指纹，用作主键',
  `url` varchar(300) NOT NULL DEFAULT '' COMMENT '文章地址',
  `title` varchar(255) NOT NULL DEFAULT '' COMMENT '文章标题',
  `content` longtext,
  `website_id` int(11) NOT NULL COMMENT '所属网站的id，外键',
  `publish_time` datetime DEFAULT NULL COMMENT '文章发布时间，爬取不到时间默认为爬取时间',
  `create_time` datetime DEFAULT NULL COMMENT '爬取时间',
  PRIMARY KEY (`url_object_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

## website
网站信息

```sql
DROP TABLE IF EXISTS `website`;
CREATE TABLE `website` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(50) NOT NULL COMMENT '网站名称',
  `spider_name` varchar(50) NOT NULL COMMENT '爬虫名字',
  `allow_domains` varchar(500) DEFAULT NULL COMMENT ';进行分割',
  `start_urls` varchar(500) DEFAULT NULL COMMENT '开始的url，以;分隔',
  `rules_to_follow` varchar(1000) DEFAULT NULL COMMENT '继续跟踪的链接正则表达式',
  `rules_to_parse` varchar(1000) DEFAULT NULL COMMENT '解析数据链接的正则表达式',
  `title_css` varchar(255) DEFAULT NULL COMMENT '提取标题的css选择器',
  `content_css` varchar(255) DEFAULT NULL COMMENT '提取内容的css选择器',
  `publish_time_css` varchar(255) DEFAULT NULL COMMENT '提取发布时间的css选择器',
  `enable` smallint(6) NOT NULL DEFAULT '1' COMMENT '是否启用',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;
```

为了测试，插入了两个网站的数据：

```sql
INSERT INTO `website` VALUES ('5', '游久网', 'u9', 'news.uuu9.com', 'http://news.uuu9.com/List/List_1409.shtml', '.*', '.*\\/\\d+\\/\\d+.shtml', '.robing_con.cl h1::text', '#content', '.robing_con.cl h4::text', '1');
INSERT INTO `website` VALUES ('6', '虎扑新闻', 'hupu', 'voice.hupu.com', 'https://voice.hupu.com/nba/', '.*', '.*/\\d+.html', '.artical-title .headline::text', '.artical-main-content', '#pubtime_baidu::text', '1');
```

# sqlalchemy
对象关系映射(Object Relational Mapping, ORM)工具采用``sqlalchemy``

## 使用示例

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 初始化数据库连接:
engine = create_engine('mysql+mysqldb://root:123456@localhost:3306/scrapy-demo?charset=utf8')
# 创建DBSession类型:
DBSession = sessionmaker(bind=engine)

...

from sqlalchemy import Column, String , DateTime, Integer
from sqlalchemy.ext.declarative import declarative_base

# 创建对象的基类:
Base = declarative_base()

class Website(Base):
    __tablename__ = 'website'

    # 表的结构:
    id = Column(Integer, primary_key=True)
    name = Column(String)
    spider_name = Column(String)
    allow_domains = Column(String)
    start_urls = Column(String)
    rules_to_follow = Column(String)
    rules_to_parse = Column(String)
    title_css = Column(String)
    content_css = Column(String)
    publish_time_css = Column(String)
    enable = Column(Integer)

    def __str__(self):
        return self.name

...


db = DBSession()

websites = db.query(Website)
for website in websites:
    print(website)
```

## 基于sqlalchemy的pipeline
该处目前是同步阻塞式的，以后为了加快入库速度可以改成异步非阻塞的

```python
from AyouSpider.model.article import Article
from AyouSpider.model.config import DBSession

# 存储到mysql
class MysqlPipeline(object):
    def open_spider(self, spider):
        self.session = DBSession()

    def process_item(self, item, spider):
        a = Article(title=item["title"].encode("utf-8"),
                    url=item["url"],
                    website_id=item["website_id"],
                    url_object_id=item["url_object_id"],
                    content=item["content"].encode("utf-8"),
                    publish_time=item["publish_time"].encode("utf-8"),
                    create_time=item["create_time"].encode("utf-8"))
        self.session.add(a)
        self.session.commit()

    def close_spider(self,spider):
        self.session.close()

```


# spider
使用``scrapy-redis``做分布式爬虫，故``spider``继承自``RedisCrawlSpider``，同时爬虫的参数由构造函数传入

```python
import datetime

import scrapy
from scrapy.spiders import Rule
from scrapy.linkextractors import LinkExtractor
from w3lib.html import remove_tags

from scrapy_redis.spiders import RedisCrawlSpider
from AyouSpider.settings import SQL_DATETIME_FORMAT
from AyouSpider.tools.tools import get_md5, get_datetime


class Article(scrapy.Item):
    title = scrapy.Field()
    website_id = scrapy.Field()
    url = scrapy.Field()
    url_object_id = scrapy.Field()
    content = scrapy.Field()
    publish_time = scrapy.Field()
    create_time = scrapy.Field()


class ArticleSpider(RedisCrawlSpider):

    def __init__(self, website):
        self.name = website.spider_name
        self.redis_key = website.spider_name + ":start_urls"

        self.website = website
        self.allowed_domains = website.allow_domains.split(";")
        self.start_urls = website.start_urls.split(";")

        rule_list = []
        rules_to_follow = website.rules_to_follow.split(";")
        rules_to_parse = website.rules_to_parse.split(";")
        rule_list.append(
            Rule(LinkExtractor(allow=rules_to_parse), follow=True, callback='parse_detail')
        )
        rule_list.append(
            Rule(LinkExtractor(allow=rules_to_follow), follow=True)
        )

        self.rules = tuple(rule_list)
        super(ArticleSpider, self).__init__()

    def parse_detail(self, response):
        now = datetime.datetime.now().strftime(SQL_DATETIME_FORMAT)

        article = Article()
        article["url"] = response.url
        article["url_object_id"] = get_md5(response.url)

        title = response.css(self.website.title_css).extract_first()
        article["title"] = (title if title else '').strip()
        content = remove_tags(response.css(self.website.content_css).extract_first())
        article["content"] = (content if content else '').strip()
        article["website_id"] = self.website.id

        publish_time = response.css(self.website.publish_time_css).extract_first()
        if publish_time:
            publish_time = get_datetime(publish_time)
        article["publish_time"] =  publish_time if publish_time else now

        article["create_time"] =  datetime.datetime.now().strftime(SQL_DATETIME_FORMAT)

        return article
```

# 启动爬虫
启动爬虫时需要先从数据库中查询到待爬网站的信息，然后将改对象作为参数传递给``ArticleSpider``，由于``scrapy-redis``
需要从redis中读取``start_urls``，故需要先将``start_urls``添加到``redis``中，如下所示：

```python
from scrapy.crawler import CrawlerProcess
from scrapy.settings import Settings

from AyouSpider.model.config import DBSession, Redis
from AyouSpider.model.website import Website
from AyouSpider.spiders.article_spider import ArticleSpider

settings = Settings()

# crawl settings
settings.set("USER_AGENT", "Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1667.0 Safari/537.36")
settings.setdict('{"REDIS_PARAMS":{"password": "123456"}}')
settings.setdict('{"ITEM_PIPELINES":{"AyouSpider.pipelines.MysqlPipeline": 300}}')
# settings.setdict('{"ITEM_PIPELINES":{"scrapy_redis.pipelines.RedisPipeline": 300}}')
settings.set("SCHEDULER_PERSIST", True)
settings.set("DEPTH_LIMIT", 3)
settings.set("SCHEDULER", "scrapy_redis.scheduler.Scheduler")
settings.set("DUPEFILTER_CLASS", "scrapy_redis.dupefilter.RFPDupeFilter")

db = DBSession()
crawler = CrawlerProcess(settings)
websites = db.query(Website).filter(Website.enable == 1)
for website in websites:
    Redis.lpush(website.spider_name + ':start_urls', website.start_urls)
    crawler.crawl(ArticleSpider, website)
crawler.start()

```

[Github地址](https://github.com/ParadeTo/scrapy-demo)

# 参考
1. [使用Scrapy定制可动态配置的爬虫](http://www.tuicool.com/articles/77BZfuf)
2. [scrapy doc](https://docs.scrapy.org/en/latest/index.html)

# TODO
* 读取配置文件


* 添加新的网站后如何使其生效
 
    写一个启动单个爬虫的脚本
    
* 爬虫部署管理
* [django-dynamic-scraper](https://github.com/holgerd77/django-dynamic-scraper)