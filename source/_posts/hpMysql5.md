---
title: 高性能MySQL(第3版)第五章-创建高性能的索引
date: 2017-05-27 09:41:02
tags:
- mysql
categories:
- 读书笔记
description: 高性能MySQL(第3版)第五章-创建高性能的索引
---

# 索引的类型
## B/B+-Tree索引

![](hpMysql5/1.png)

* 索引列是顺序组织存储的，很适合查找范围数据，所以像“找出所有以I到K开头的名字”这样的查找效率会非常高


假设有如下数据表：

```sql
CREATE TABLE People (
	last_name varchar(50) not null,
	first_name varchar(50) not null,
	dob date not null,
	gender enum('m', 'f') not null,
	key(last_name, first_name, dob)
)
```

则其部分索引如下所示：

![](hpMysql5/2.png)

B/B+-Tree适用的查询有：

* 全值匹配
* 匹配最左前缀：上述索引可用于查找所有姓Allen的人
* 匹配列前缀：上述索引可用于查找以J开头的姓的人
* 匹配范围值：上述索引可用于查找在Allen和Barrymore之间的人
* 精确匹配某一列并范围匹配另外一列：上述索引可用于查询所有姓为Allen，并且名字是字母K开头的人
* 只访问索引的查询

限制：

* 如果不是按照索引的最左列开始查找，则无法使用索引：上述索引无法用于查找名字为Bill的人
* 不能跳过索引中的列。
* 如果查询中有某个列的范围查询，则其右边所有列都无法使用索引优化查找。

## 哈希索引
假设有如下表：

```sql
CREATE TABLE testhash (
	fname VARCHAR(50) NOT NULL,
	lname VARCHAR(50) NOT NULL,
	KEY USING HASH(fname)
) ENGINE=MEMORY;
```

包含数据：

|fname|lname|
|-----|-----|
|Arjen|Lentz|
|Baron|Schwarts|
|Peter|Zaitsev|
|Vadim|Tkachenko|

假设索引使用假想的哈希函数f()，它返回下面的值：

```sql
f(Arjen) = 2323 # 指向第1行的指针
f(Baron) = 7437 # 指向第4行的指针
f(Peter) = 8784 # 2
f(Vadim) = 2458 # 3
```

* 索引不能存储字段值
* 无法用于排序
* 不支持部分索引列
* 只支持等值比较，包括=, in(), <=>

	```sql
	<=> =
	'a' <=> NULL => 0
	NULL <=> NULL => 1
	'a' = NULL => NULL
	NULL = NULL => NULL
	```

* 速度快
* 解决冲突的代价
* InnoDB自适应哈希索引

如果存储引擎不支持哈希索引，可以创建自定义哈希索引，例如需要根据url来查询：

```sql
SELECT id FROM url WHERE url="http://www.mysql.com";
```

若删除原来url上的索引，新增url_crc，使用CRC32做哈希，就可以使用下面的方式查询：

```sql
SELECT id FROM url WHERE url="http://www.mysql.com" AND url_crc=CRC32("http://www.mysql.com");
```

可以使用触发器来更新:

```sql
DELEMITER //
CREATE TRIGGER pseudohash_crc_ins BEFORE INSERT ON pseudohash FOR EACH ROW BEGIN
SET NEW.url_crc=crc32(NEW.url);
END;
//


CREATE TRIGGER pseudohash_crc_ins BEFORE UPDATE ON pseudohash FOR EACH ROW BEGIN
SET NEW.url_crc=crc32(NEW.url);
END;
//

DELEMITER ;
```

注意不要使用SHA1()和MD5()，因为计算出来的哈希值是非常长的字符串。


为了处理**哈希冲突**，当使用哈希索引进行查询的时候，必须在WHERE子句中包含常量值

## 空间数据索引（R-Tree）
略

## 全文索引
略

## 其他
略

# 索引优点

* 减少了服务器需要扫描的数据量
* 帮助服务器避免排序和临时表
* 将随机I/O变为顺序I/O

# 高性能的索引策略
## 独立的列
独立的列是指索引列不能是表达式的一部分

这样不行：

```sql
SELECT actor_id FROM sakila.actor WHERE actor_id = 5;

SELECT ... WHERE TO_DAYS(CURRENT_DATE) - TO_DAYS(date_col) <= 10;
```

最好是把查询列单独放到比较符号一侧

## 前缀索引和索引选择性
索引选择性：不重复的索引值和数据表的记录总数（T）的比值，范围从1/T到1之间。选择性越高则查询效率越高。

下面给出了如何在同一个查询中计算不同前缀长度的选择性：

```sql
SELECT COUNT(DISTINCT LEFT(city, 3))/COUNT(*) AS sel3,
COUNT(DISTINCT LEFT(city, 4))/COUNT(*) AS sel4,
COUNT(DISTINCT LEFT(city, 5))/COUNT(*) AS sel5,
COUNT(DISTINCT LEFT(city, 6))/COUNT(*) AS sel6
FROM sakila.city_demo;
```

创建前缀索引：

```sql
ALTER TABLE sakila.city_demo ADD KEY (city(7))
```

* 优点：使索引更小、更快
* 缺点：无法使用前缀索引做ORDER BY和GROUP BY，无法使用前缀索引做覆盖扫描

## 多列索引
索引合并策略：

```sql
SELECT file_id, actor_id FROM sakila.file_actor
WHERE actor_id = 1 OR film_id = 1;
```

在mysql5.0和更新的版本中，查询能够同时使用这两个单列索引进行扫描，并将结果进行合并。

* 当出现服务器对多个索引做相交操作时（通常有多个AND条件），通常意味着需要一个包含所有相关列的多列索引
* 当出现服务器对多个索引做联合操作时（通常有多个OR条件），通常需要耗费大量CPU和内存资源在算法的缓存、排序和合并操作上。
* 优化器不会把这些计算到“查询成本”中，优化器只关心随机页面读取。使得查询的成本被“低估”，导致还不如走全表扫描。


如果在EXPLAIN中看到有索引合并，应该好好检查一下查询和表的结构，看是不是已经是最优的。也可以通过参数optimizer_switch来关闭索引合并功能。也可以使用IGNORE
INDEX提升让优化器忽略掉某些索引。

## 选择合适的索引列顺序
经验法则：将选择性最高的列放到索引的最前列（并没有那么重要）。

## 聚簇索引
数据行和所以存储在一起，一个表只能有一个聚簇索引。InnoDB将通过主键聚集数据。如果没有定义主键，InnoDB会选择一个唯一的非空索引代替。

![](hpMysql5/3.png)

优点：

1. 可以把相关数据保存在一起。
2. 数据访问更快。
3. 使用覆盖索引扫描的查询可以直接使用页节点中的主键值。

缺点：

1. 最大限度地提高了I/O密集型应用的性能，但如果数据全部都放在内存中，则访问的顺序就没那么重要了
2. 插入速度依赖于插入顺序
3. 更新代价很高
4. 可能导致页分裂操作
5. 导致全表扫描变慢
6. 二级索引（非聚簇索引）比想象的要大，因为在二级索引的叶子节点包含了引用行的主键列
7. 二级索引访问需要两次索引查找，而不是一次：二级索引中保存的“行指针”**不是指向行的物理位置**，而是行的主键值，所以要经过两次B-Tree查找。


### InnoDB和MyISAM的数据分布对比
```sql
CREATE TABLE layout_test (
	col1 int NOT NULL,
	col2 int NOT NULL,
	PRIMARY KEY(col1),
	KEY(col2)
);
```

假设该表的主键取值为1~10000，按照随机顺序插入并使用OPTIMIZE TABLE做了优化。其数据分布如下：

![](hpMysql5/4.png)

索引分布：

MyISAM：

![](hpMysql5/5.png)

![](hpMysql5/6.png)

事实上，MyISAM中主键索引和其他索引在结构上没有什么不同。

InnoDB：

![](hpMysql5/7.png)

![](hpMysql5/8.png)

* innodb的主键索引显示了整个表
* innodb的二级索引的叶子节点中存储的是主键值

下面这个图更加抽象的显示了两者的区别


![](hpMysql5/9.png)

## 覆盖索引
如果一个索引包含（或者说覆盖）所有需要查询的字段的值，我们就称之为“覆盖索引”。

* 索引条目通常远小于数据行大小
* 因为索引是按照列值顺序存储的，所以对于I/O密集型的范围查询会比随机从磁盘读取每一行数据的I/O要少得多
* 由于innodb的聚簇索引，覆盖索引对innodb表特别有用
* 只能用B-Tree
* 当发起一个被索引覆盖的查询时，在EXPLAIN的Extra列可以看到Using index的信息

陷阱：

```sql
EXPLAIN SELECT * FROM products WHERE actor='SEAN CARREY' AND title like '%APOLLO%'\G
...
Extra: Using where
```	

* 没有任何索引能够覆盖这个查询。因为查询选择了所有的列。
* Mysql能在索引中做最左前缀匹配的LIKE比较，因为该操作可以转换为简单的比较操作，但是如果是通配符开头的LIKE查询，存储引擎无法做比较匹配。

重写，先将索引拓展至覆盖三个数据列 （actor，title，prod_id），然后按照如下方式重写：

```sql
EXPLAIN SELECT *
FROM products
	JOIN (
		SELECT prod_id
		FROM products
		WHERE actor='SEAN CARREY' AND title LIKE '%APOLLO%'
	) AS t1 ON (t1.prod_id=products.prod_id)\G
...
Extra: Using where; Using index
```

在查询的第一阶段可以使用覆盖索引，找到匹配的prod_id，然后根据这些prod_id在外层查询匹配获取需要的所有列值。

测试三个不同的数据集（都包含100万行）：

1. Sean Carrey出演了30000部作品，其中有20000部的标题中包含了Apollo
2. Sean Carrey出演了30000部作品，其中有40部的标题中包含了Apollo
3. Sean Carrey出演了50部作品，其中有10部的标题中包含了Apollo

得到的结果：

|数据集|原查询|优化后的查询|分析|
|----|----|----|----|
|示例1|每秒5次|每秒5次|查询返回的数据集很大，大部分时间都花在读取和发送数据上|
|示例2|每秒7次|每秒35次|子查询中可以在索引中得到需要的数据的prod_id|
|示例3|每秒2400次|每秒2000次|通过actor索引得到的数据已经很小了，而后面还需要再做一次连接|


## 使用索引扫描来做排序
有两种生成有序的结果：

* 通过排序操作
* 使用索引顺序扫描：如果EXPLAIN出来的type列的值为index
* 只有当索引的列顺序和ORDER BY的列顺序一致，并且所有列的排序方向都一样，才能够使用索引来对结果做排序。
* 如果查询需要关联多张表，则只有当ORDER BY子句引用的字段全部未第一个表时，才能使用索引做排序。


## 压缩（前缀压缩）索引
MyISAM压缩每个索引块的方法是：

1. 完全保存索引块中的第一个值
2. 将其他值与第一个值比较得到相同前缀的字节数和剩余的不同后缀部分，并保存

例如，索引块中的第一个值是“perform”，第二个值是“performance”，那么第二个值的前缀压缩后存储的是类似“7，ance”这样的形式

* 可以节省空间
* 某些操作可能变慢，无法使用二分查找，倒叙扫描不是很好



