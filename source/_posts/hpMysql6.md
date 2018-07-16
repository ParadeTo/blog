---
title: 高性能MySQL(第3版)第六章-查询性能优化
date: 2017-06-01 14:19:08
tags:
- mysql
categories:
- 读书笔记
description: 高性能MySQL(第3版)第六章-查询性能优化
---

# 慢查询基础：优化数据访问
大部分性能低下的查询都可以通过减少访问的数据量的方式进行优化。对于低效的查询，通过下面两个步骤来分析总是很有效：

1. 确认应用程序是否在检索大量超过需要的数据。访问太多和行或列。
2. 确认Mysql服务器

## 是否向数据库请求了不需要的数据
这里有些典型案例：

* 查询不需要的记录：先使用SELECT语句查询大量结果，然后获取前面的N行后关闭结果集
* 多表关联时返回全部列：多表关联时不要``SELECT *``，否则会返回所有关联的表的列
* 重复查询相同的数据：这时应该用缓存

## 是否在扫描额外的记录
对于mysql，最简单的衡量查询开销的三个指标如下：

* 响应时间：服务时间+排队时间。
* 扫描的行数
* 返回的行数

### 扫描的行数和访问类型
访问类型从慢到快有很多种：全表扫描、索引扫描、范围扫描、唯一索引查询、常数引用等。

一般Mysql能够使用如下三种方式应用WHERE条件，从好到坏依次为：

* 在索引中使用WHERE条件来过滤不匹配的记录。这是在存储引擎层完成的。
* 使用索引覆盖扫描（在Extra列中出现了Using index）来返回记录，直接从索引中过滤不需要的记录并返回命中的结果。这是在服务器层完成的，无须再回表查询记录。
* 从数据表中返回数据，然后过滤掉不满足条件的记录（在Extra列中出现Using Where）。这在服务器层完成，需要从数据表中读出记录然后过滤。

如果发现查询需要扫描大量的数据但只返回少数的行，那么可以尝试下面的技巧去优化：

* 使用索引覆盖扫描
* 改变库表结构
* 重写查询

# 重构查询的方式
## 一个复杂查询还是多个简单查询
在传统的实现中，总是强调需要数据库层完成尽可能多的工作。但是对mysql并不适用，mysql从设计上让连接和断开都很轻量级，在返回一个小的查询结果方面很高效。

## 切分查询
比如可以将下面这条语句进行切分：

```sql
DELETE FROM messages WHERE created < DATE_SUB(NOW(), INTERVAL 3 MONTH);
```

改写后为：

```sql
rows_affected = 0
do {
	rows_affected = do_query (
		"DELETE FROM messages WHERE created < DATE_SUB(NOW(), INTERVAL 3 MONTH) LIMIT 10000"	
	)
} while rows_affected > 0
```

## 分解关联查询
例如，下面这个查询：

```sql
SELECT * FROM tag
	JOIN tag_post ON tag_post.tag_id=tag.id
	JOIN post ON tag_post.post_id=post.id
WHERE tag.tag='mysql';
```

可以分解成下面这些查询来代替:

```sql
SELECT * FROM tag WHERE tag='mysql';
SELECT * FROM tag_post WHERE tag_id=1234;
SELECT * FROM post WHERE post.id in (123,456,9098,8904);
```

有如下好处：

* 让缓存的效率更高
* 将查询分解后，可以减少锁的竞争
* 在应用层做关联，可以更容易对数据库进行拆分，更容易做到高性能和可拓展
* 查询本身效率也可能会有所提升
* 减少冗余记录的查询
* 这样做相当于在应用中实现了哈希关联，而不是使用mysql的嵌套循环关联

下面这样的场景适合该做法：
* 应用可以方便地缓存单个查询
* 可以将数据分布到不同的mysql服务器上
* 能够使用in()方式代替关联查询
* 查询中使用同一个数据表

# 查询执行的基础
![](1.png)

上图描绘的是一个查询的流程：

1. 客户端发送一条查询给服务器。
2. 服务器检查缓存，如果命中，返回缓存的结果。否则进入下阶段。
3. 服务器端进行SQL解析，预处理，再由优化器生成对应的执行计划。
4. mysql根据优化器生成的执行计划调用存储引擎的API来执行查询。
5. 将结果返回，缓存结果

## Mysql客户端/服务器通信协议
* 半双工
* 服务器一旦开始给客户端传输数据，客户端无法让其停止
* 大多数连接Mysql的库函数从Mysql获取数据时，实际上都是从这个库函数的缓存获取数据。当返回一个很大的结果集的时候，库函数会花很多时间和内存来存储所有的结果集。

### 查询状态
SHOW FULL PROCESSLIST

* Sleep：线程正在等待客户端发送新的请求
* Query：线程正在查询或者正在将结果发送给客户端
* Locked：正在等待表锁
* Analyzing and statistics：线程正在收集存储引擎的统计信息，并生成查询的执行计划
* Copying to tmp table [on disk]：要么是在做GROUP BY操作，要么是文件排序操作，或者是UNION操作。
* Sorting result
* Sending data

## 查询缓存 
* 大小写敏感的哈希查找实现

## 查询优化处理
### 语法解析器和预处理
* 生成解析树
* 语法规则验证和解析树合法性验证

**查询优化器**

找到最好的执行计划，基于成本。可通过查询当前会话的Last_query_cost的值来得知Mysql计算的当前查询的成本。

```sql
show status like 'Last_query_cost';
```

有很多原因会导致Mysql优化器选择错误的执行计划：

* 统计信息不准确。Mysql依赖存储引擎提供的统计信息来评估成本，但是有的存储引擎提供的信息是准确的，有的偏差可能非常大。
* 即使统计准确，也不一定能给出最优的。例如有时候某个执行计划虽然需要读取更多的页面，但是它的成本却更小。
* 执行成本和执行时间并不是一回事
* 不考虑并发执行的查询，可能会影响到当前查询的速度
* 如果存在全文搜索的MATCH()子句，则在存在全文索引的时候就使用全文索引。即使其他索引和WHERE条件可以远比这种方式要快
* 不会考虑不受其控制的操作的成本，例如执行存储过程或者用户自定义函数


两种优化方式：

* 静态优化，编译时优化
* 动态优化，运行时优化

能够处理的优化类型：

* 重新定义关联表的顺序
* 将外连接转化成内连接
* 使用等价变换规则
*　优化COUNT(),MIN()和MAX()：在B-Tree索引中，可以直接查找索引的最左端和最右端。如果使用了这种类型的优化，在EXPLAIN中可以看到“Select tables optimized away”，它表示优化器已经从执行计划中移除了该表，并以一个常数取而代之
* 预估并转化为常数表达式。例子：
	
	```sql
	EXPLAIN SELECT film.film_id, film_actor.actor_id
	FROM sakila.film
		INNER JOIN sakila.film_actor USING(film_id)
	WHERE film.film_id = 1;

	id select_type table      type   key          ref   rows
	1   SIMPLE     film       const primary        const  1
	1   SIMPLE     film_actor ref   idx_fk_film_id const  10
	```

	第一步先从film表中找到需要的行。因为在film_id字段上有主键索引，所以Mysql优化器知道这只会返回一行数据，所以这里的表访问类型是const。
	
	第二步mysql将第一步返回的film_id当做一个已经取值的列来处理。所以下面进行连接的行数也可以确定了，所以第二步的ref也是const

* 覆盖索引扫描
* 子查询优化
* 提前终止查询，一个典型的例子是使用了LIMIT子句的时候
* 等值传播，如果两个列的值通过等式关联，那么mysql能够把其中一个列的where条件传递到另一列上
* 列表IN()的比较，将IN()列表中的数据先进行排序，然后通过二分查找的方式来确定列表中的值是否满足条件


**mysql如何执行关联查询**
mysql认为每一个查询都是一次“关联”，所以，理解如何执行关联查询至关重要。

以UNION为例，mysql先将一系列的单个查询结果放到一个临时表中，然后再重新读出临时表数据来完成UNION查询。

执行关联的策略很简单，即嵌套循环：先在一个表中循环取出单条数据，然后再嵌套循环到下一个表中寻找匹配的行。例如：

```sql
SELECT tbl1.col1, tbl2.col2
FROM tbl1 INNER JOIN tbl2 USING(col3)
WHERE tbl1.col1 IN (5,6);
```

可以用下面的伪代码表示：

```sql
outer_iter = iterator over tbl1 where col1 IN(5,6)
outer_row = outer_iter.next
while outer_row
	inner_iter = iterator over tbl2 where col3 = outer_row.col3
	inner_row = inner_iter.next
	while inner_row
		output [ outer_row.col1, inner_row.col2 ]
		inner_row = inner_iter.next
	end
	outer_row = outer_iter.next
end
```

![](2.png)


**执行计划**

mysql不会生成查询字节码来执行查询，而是生成查询的一棵指令树，然后通过存储引擎执行这棵指令树返回结果。

**关联查询优化器**

通过评估不同顺序时的成本来选择一个代价最小的关联顺序，例如：

```sql
SELECT film.film_id, film.title, film.release_year, actor.actor_id, actor.first_name, actor.last_name
FROM sakila.film
INNER JOIN sakila.film_actor USING(film_id)
INNER JOIN sakila.actor USING(actor_id);
```