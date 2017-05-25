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

