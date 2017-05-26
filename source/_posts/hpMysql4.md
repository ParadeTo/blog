---
title: 高性能MySQL(第3版)第四章-Schema与数据类型优化
date: 2017-05-25 10:13:55
tags:
- mysql
categories:
- 读书笔记
description: 高性能MySQL(第3版)第四章-Schema与数据类型优化
---

# 选择优化的数据类型
* 更小的通常更好
* 简单的，整型<字符。例如：使用内建的（date，time，datetime）而不是字符串来存储日期和时间，使用整型存储IP
* 避免NULL。可为NULL的列使得索引、索引统计和值比较都更复杂，会使用更多的存储空间，需要特殊处理，可能导致固定大小的索引变成可变大小的索引。

## 整数类型
* TINYINT 8
* SMALLINT 16
* MEDIUMINT 24
* INT 32
* BIGINT 64
* UNGIGNED：加与不加存储空间一样，只是正数的范围不一样
* INT(11):不会限制值的合法范围，只是规定了一些交互工具用来显示字符的个数，对于存储和计算来说，INT(1)和INT(20)是相同的。

## 实数类型
* float
* double
* decimal
* float/double运算是不精确的，decimal是精确的：

	```sql
	DROP TABLE IF EXISTS `test_f`;
	CREATE TABLE `test_f` (
	  `f` float DEFAULT NULL,
	  `d` double DEFAULT NULL,
	  `de` decimal(10,2) DEFAULT NULL
	) ENGINE=InnoDB DEFAULT CHARSET=latin1;
	
	INSERT INTO test_f VALUES(1.23,1.23,1.23);
	INSERT INTO test_f VALUES(1.24,1.24,1.24);
	SELECT SUM(f), SUM(d), SUM(de) FROM test_f;
	...
	2.4700000286102295	2.4699999999999998	2.47
	```

* float和double一般比decimal使用更少的空间，float使用4个字节，double使用8个字节。mysql5.0及更高将decimal打包保存到一个二进制字符串中，每4个字节保存9个数字。例如：DECIMAL(18，9)小数点两边将各存储9个数字，一共使用9个字节：小数点前的数字用4个，小数点后的数字用4个，小数点本身占1个

* 当数据量比较大时，可以使用int来存储小数，同时避免浮点计算不精确和decimal精确计算代价高的问题

## 字符串类型
* VARCHAR
	* 变长空间。例外：``ROW_FORMAT=FIXED``
	* 需要1（最大长度小于或等于255）或2个额外字节记录字符串的长度。例如：假设采用``latin1``字符集，VARCHAR(10)使用11个字节，VARCHAR(1000)需要1002个字节
	* 适合情况：1.字符串列的最大长度比平均长度大很多；2.列的更新很少，碎片不是问题；3.使用了utf-8这样复杂的字符集，每个字符都使用不同的字节数进行存储。
* CHAR
	* 定长，适合存储很短或者所有值都接近同一个长度
	* 会剔除末尾空格

* BINARY VARBINARY
	* 存储二进制字符串，存储字节码。
* BLOB TEXT
	* 存储大数据，分别采用二进制和字符方式存储。
	* 使用外部存储区域存储，行内存储1~4个字节的指针
* 使用枚举
	
	```sql
	CREATE TABLE enum_test(
		e ENUM('fish','apple','dog') NOT NULL);
	
	INSERT INTO enum_test VALUES('fish'), ('dog');
	```

	* 内部其实存储的是数字（枚举不要用数字，避免混乱），排序也是按照内部的数字排序的
	
	```sql
	SELECT e + 0 FROM enum_test;
	...
	1
	3
	```

	* 对于未来可能会改变的字符串，不适用
	* 可以减小数据量

## 日期和时间类型
* DATETIME
	* 1001~9999年，精度为秒
	* 把日期和时间封装到格式为YYYYMMDDHHMMSS的整数中，与时区无关，使用8个字节存储
* TIMESTAMP
	* 4个字节
	* 1970~2038
	* FROM_UNIXTIME() UNIX_TIMESTAMP()
	* 显示的值依赖于系统时区设置
	* 插入时会自动更新为当前时间

## 位数据类型
* bit
	* 比较费解，避免使用
	
	```sql
	CREATE TABLE bittest(a bit(8));
	INSERT INTO bittest VALUES(b'00111001');
	SELECT a, a + 0 FROM bittest;	
	...
	00111001	57 # 跟书上不一样哦
	```
* SET
	* 改变“枚举”时，代价比较昂贵
* 在整数列上进行按位操作

## 选择标识符
* 确保关联的字段用同样的类型，包括像UNSIGNED这样的属性
* 整数类型
* 避免使用ENUM和SET类型
* 避免使用字符串类型，包括MD5，SHA1，UUID，这些函数生成的新值会任意分布在很大的空间内，导致INSERT以及一些SELECT语句很慢
* 如果使用UUID，应该移除“-”符号；更好的做法：用UNHEX()函数转换UUID值为16字节的数字，并且存储在一个BINARY(16)列中，检索时通过HEX()函数来格式化为十六进制格式。
* 小心ORM系统！

## 特殊类型数据
* 不要用VARCHAR(15)来存储IP地址，用UNSIGNED INT

```sql
SELECT INET_ATON('209.207.224.40'); 
SELECT INET_NTOA(3520061480)
```

# MySQL schema 设计中的陷阱
* 太多的列:存储引擎API工作时需要在服务器层和存储引擎层之间通过行缓冲格式拷贝数据，然后在服务器层将缓冲内容解码成各个列。从行缓冲中将编码过的列转换成行数据结构的操作代价是非常高的。
* 太多的关联：限制最多只能有61张表关联
* 全能的枚举
* 变相的枚举：枚举容易与SET混乱，SET可以是多个
* 非此发明的NULL（到底是用还是不用呢），不要像下面这样：
	
	```sql
	CREATE TABLE ...（
		dt DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00'
	```

# 范式和反范式
* 范式：每个事实数据会出现并且只出现一次
* 反范式：存在信息冗余

## 范式的优点和缺点
优点：

* 更新操作快
* 重复数据少，修改时，修改的数据少
* 表更小，可以更好的放在内存里，执行操作更快
* 更少需要DISTINCT或者GROUP BY语句

缺点：

* 需要关联

## 反范式的优点和缺点
优点：

* 避免关联

## 一个例子对比
假设有一个网站，允许用户发送消息，并且一些用户是付费用户，现在想查看付费用户最近的10条信息。如果是范式化的结构并且索引了发送日期字段published，这个查询也许看起来像这样：

```sql
SELECT message_text, user_name
FROM message
	INNER JOIN user ON message.user_id=user.id
WHERE user.account_type='premiumv'
ORDER BY message.published DESC LIMIT 10;
```

要更有效地执行这个查询，mysql需要扫描message表的published字段的索引。对于每一行找到的数据，将需要到user表里检查这个用户是不是付费用户。如果只有一小部分用户是付费账户，那么这是效率低下的做法。

如果采用反范式化组织数据，将两个表的字段合并，并且增加一个索引(account, published)，就可以不通过关联写出这个查询，非常高效：

```sql
SELECT message_text, user_name
FROM user_messages
WHERE account_type='premium'
ORDER BY published DESC
LIMIT 10;
```

## 混用范式化和反范式化
* 复制或缓存，使用触发器更新缓存值。例如如果需要显示每个用户发了多少消息，可以每次执行一个昂贵的子查询来计算并显示它；也可以在user表中建一个num_messages列，每当用户发新消息时更新这个值。

# 缓存表和汇总表
* 缓存表：用来存储哪些可以比较简单地从schema其他表获取（但是每次获取的速度比较慢）数据的表
* 汇总表：保存是使用GROUP BY语句聚合数据的表
* 重建汇总表和缓存表
	
	```sql
	DROP TABLE IF EXISTS my_summary_new, my_summary_old;
	CREATE TABLE my_summary_new LIKE my_summary;
	...填充数据
	RENAME TABLE my_summary TO my_summary_old, my_summary_new TO my_summary;
	```

## 物化视图
略

## 计数器表
假设有一个计数器表，只有一行数据，记录网站的点击次数:

```python
CREATE TABLE hit_counter (
	cnt int unsigned not null
) ENGINE=InnoDB;
```

对于任何想要更新这一行的事务来说，这条记录上都有一个全局的互斥锁，这会使得这些事务智能串行执行。可以将计数器保存在多行中，每次随机选择一行进行更新。

```sql
CREATE TABLE hit_counter (
	slot tinyint unsigned not null primary key,
	cnt int unsigned not null
) ENGINE=InnoDB;
...预先增加100行数据，初始化为0
UPDATE hit_counter SET cnt=cnt+1 WHERE slot=RAND()*100;
SELECT SUM(cnt) FROM hit_counter;
```

一个常见的需求是每隔一段时间开始一个新的计数器，可以这样：

```sql
CREATE TABLE daily_hit_counter (
	day date not null,
	slot tinyint unsigned not null,
	cnt int unsigned  not null,
	primary key(day, slot)
) ENGINE=InnoDB;

INSERT INTO daily_hit_counter(day, slot, cnt)
	VALUES(CURRENT_DATE, RAND()*100, 1)
	ON DUPLICATE KEY UPDATE cnt=cnt+1;
```

如果希望减少表的行数，以避免表变得太大，可以写一个周期执行的任务，合并所有结果到0号槽，并且删除所有其他的槽：

```python
UPDATE daily_hit_count as c
	INNER JOIN (
		SELECT day, SUM(cnt) AS cnt, MIN(slot) AS mslot
		FROM daily_hit_counter
		GROUP BY day
	) AS x USING(day)
SET c.cnt = IF(c.slot = x.mslot, x.cnt, 0),
	c.slot = IF(c.slot = x.mslot, 0, c.slot);

DELETE FROM daily_hit_counter WHERE slot <> 0 AND cnt=0;
```

# 加快ALTER TABLE操作的速度
mysql中执行大部分修改表结构操作的方法是：

1.用新的结构创建一个空表
2.复制数据，删除旧表

这是一个非常耗时的工作！有一些技巧：

1.在不提供服务的机器上执行，然后与主库切换
2.手动创建新表然后重命名和删除

并不是所有的都很慢，例如，有两种方法可以改变或者删除一个列的默认值：

1.慢方法：

	```python
	ALTER TABLE sakila.film
	MODIFY COLUMN rental_duration TINYINT(3) NOT NULL DEFAULT 5;	
	```

2.快方法：这个会直接修改.frm文件而不涉及表数据

	```python
	ALTER TABLE sakila.film
	ALTER COLUMN rental_duration SET DEFAULT 5;		
	```

## 只修改.frm文件
以下操作是有风险的！！！！

1.创建一张有相同结构的空表，并进行所需要的修改
2.执行FLUSH TABLES WITH READ LOCK。关闭所有正在使用的表，并且禁止任何表被打开。
3.交换.frm文件
4.执行UNLOCK TABLES来释放第2步的读锁


## 快速创建MyISAM索引
```sql
ALTER TABLE test.load_data DISABLE KEYS;
...load data
ALTER TABLE test.load_data ENABLE KEYS;
```

然后通过排序来构建索引，这样会快很多，并且使得索引树的碎片更少、更紧凑，仅对非唯一索引有效。


