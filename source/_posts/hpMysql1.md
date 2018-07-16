---
title: 高性能MySQL(第3版)第一章-MySQL架构与历史
date: 2017-05-24 14:11:53
tags:
- mysql
categories:
- 读书笔记
description: 高性能MySQL(第3版)第一章-MySQL架构与历史
---
# 逻辑架构
![](1.png)

## 连接管理与安全性
* 客户端连接都会在服务器进程中拥有一个线程
* 服务器会负责缓存线程，不需要为每一个新建的连接创建或者销毁线程

## 优化与执行
* mysql会解析查询，创建内部数据结构，然后进行优化（重写查询，决定表的读取顺序，选择合适的索引）
* 可以通过特殊关键字提示优化器，影响其决策
* 可以请求优化器解释优化过程
* 对于select语句，在解析查询前，会先检查查询缓存

# 并发控制
## 读写锁
* 共享锁，读锁
* 排他锁，写锁

## 锁粒度
* 表锁
	* 开销最小的策略，锁定整张表，阻塞其他用户的读写操作
* 行级锁
	* 可最大程度地支持并发处理（最大锁开销）
	* 只在存储引擎层实现

# 事务
* 原子性：要么全做，要么全不做
* 一致性：从一个一致性的状态转换到另外一个一致性的状态
* 隔离性：一个事务所做的修改在最终提交前，对其他事务是不可见的
* 持久性：一旦提交，则事务所做的修改就会永久保存到数据库中

## 隔离级别
* READ UNCOMMITTED (未提交读)：事务中的修改，即使没有提交，对其他事务也都是可见的。可能出现脏度，由于其不会比其他级别好太多，但却缺乏其他级别带来的好处，故一般很少使用。

* READ COMMITTED (提交读)：这个是大多数数据库的默认级别。一个事务从开始直到结束，所做的任何修改对其他事务都是不可见的。这个级别又叫不可重复读。

* REPEATABLE READ (可重复读)：这个是mysql的默认级别。该级别保证了在同一个事务中多次读取同样的记录结果是一致的。但是无法解决幻读的问题（指当某个事务在读取某个范围内的记录时，另外一个事务又在该范围内插入了新的记录，当之前的事务再次读取该范围的记录时，会产生幻行）。InnoDB通过多版本并发控制解决了幻行的问题。

* SERIALIZABLE (串行化)：强制事务串行执行，避免了前面的幻读。会在读取的每一行数据都加锁，所以可能导致大量的超时和锁争用的问题。实际很少用，除非有非常强烈的一致性要求。

### 实例
```sql
DROP TABLE IF EXISTS `test`;
CREATE TABLE `test` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `num` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
```

#### READ UNCOMMITTED(未提交读)
```python
# 设置隔离级别为READ UNCOMMITTED并查询
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT @@tx_isolation;

# A:启动事务，查询数据
START TRANSACTION;
SELECT * from test;

|id|num|
|1|1|
|2|2|
|3|3|

# B:启动事务，更新数据，不提交
START TRANSACTION;
update test set num=10 where id=1;

# A:再次查询数据，查询到了B事务未提交的更新
SELECT * from test;
|id|num|
|1|10|
|2|2|
|3|3|
```

#### READ COMMITTED(提交读)
```python
# 隔离级别为READ COMMITTED并查询
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT @@tx_isolation;

# A:启动事务，查询数据
START TRANSACTION;
SELECT * from test;

|id|num|
|1|1|
|2|2|
|3|3|

# B:启动事务，更新数据，不提交
START TRANSACTION;
update test set num=10 where id=1;

# A:再次查询数据，数据没有发生变化，解决了脏读的问题
SELECT * from test;
|id|num|
|1|1|
|2|2|
|3|3|

# B:提交事务
commit;

# A:再次查询数据，查询到了B事务提交的更新，与之前所读不一致，即所谓的“不可重复读”
SELECT * from test;
|id|num|
|1|10|
|2|2|
|3|3|
```

#### REPEATABLE READ(可重复读)
```python
# 隔离级别为REPEATABLE READ并查询
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT @@tx_isolation;

# A:启动事务，查询数据
START TRANSACTION;
SELECT * from test;

|id|num|
|1|1|
|2|2|
|3|3|

# B:启动事务，更新数据，并提交
START TRANSACTION;
update test set num=10 where id=1;
commit;

# A:再次查询数据，数据没有发生变化（即使B事务已提交），解决了不可重复读的问题
SELECT * from test;
|id|num|
|1|1|
|2|2|
|3|3|

# A:但是！！！！！！如果我更新数据呢，变啦
update test set num=num+1 where id=1;
SELECT * from test;
|id|num|
|1|11|
|2|2|
|3|3|

# B:插入一条新的数据
INSERT INTO test (num) values(4);
SELECT * FROM test;
|id|num|
|1|10|
|2|2|
|3|3|
|4|4|

# A:再次查询数据，没有变化，发生了幻读
SELECT * from test;
|id|num|
|1|1|
|2|2|
|3|3|

```

#### SERIALIZABLE(串行化)
```python
# 隔离级别为SERIALIZABLE并查询
SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT @@tx_isolation;

# A:启动事务，查询数据
START TRANSACTION;
SELECT * from test;

|id|num|
|1|1|
|2|2|
|3|3|

# B:启动事务，更新数据，并提交，此时事务B会等待
START TRANSACTION;
update test set num=10 where id=1;
......

# A:提交事务
commit;

# B:完成刚才的更新


```

## 死锁
多个事务在同一资源上相互占用，并请求锁定对方占用的资源，从而导致恶性循环的现象。例如：

```python
# 事务1
START TRANSACTION;
UPDATE StockPrice SET close = 45.5 WHERE stock_id = 4 and date = '2002-05-01';
UPDATE StockPrice SET close = 19.8 WHERE stock_id = 3 and date = '2002-05-02';
COMMIT;


# 事务2
START TRANSACTION;
UPDATE StockPrice SET high = 20.12 WHERE stock_id = 3 and date = '2002-05-02';
UPDATE StockPrice SET high = 45.5 WHERE stock_id = 4 and date = '2002-05-01';
COMMIT;
```

如果凑巧，两个事务刚好都执行了第一条语句，同时也锁定了该行数据，接着都去尝试执行第二条语句，发现该行已经被对方锁定，然后两个事务都等待对方释放锁，同时又都持有对方需要的锁，陷入死循环。

* 死锁检测
* 死锁超时
* innodb处理死锁的方法：将持有最少行级排他锁的事务进行回滚

## 事务日志
* 修改表的时候，只需要修改内存中的拷贝，而不用马上持久化到硬盘，可以在事务日志持久化后，在后台慢慢刷回到磁盘
* 事务日志采用追加的方式，写到磁盘小块区域的顺序I/O，相对于持久化数据来说要快得多
* 如果事务日志持久化，但数据本身还没有写回时系统崩溃了，存储引擎在重启时能够自动恢复这部分的数据

## mysql中的事务
* innodb
* ndb cluster
* 自动提交
* 在事务中混合使用存储引擎不可靠，非事务性的表无法回滚
* 隐式和显式锁定（建议：除了事务中禁用了AUTOCOMMIT，可以使用LOCK TABLES之外，其他任何时候都不要显式地执行LOCK TABLES，不管使用的是什么存储引擎）

# 多版本并发控制（MVCC）
* 保存数据在某个时间点的快照
* innodb的MVCC，是通过在每行记录后面保存两个隐藏的列来实现的，一个保存了行的“创建时间”，一个保存行的“过期时间”（或“删除时间”），不是真的时间，而是系统版本号。
* 每开始一个新的事务，系统版本号+1

REPEATABLE READ隔离级别下，MVCC的工作模式：

```sql
SELECT
	a.查找早于等于当前事务版本的数据行，保证事务读取的行，要么是在事务开始前已经存在的，要么是事务自身插入或者修改过的。
	b.行的删除版本要么未定义，要么大于当前事务版本号。保证事务读取到的行，在事务开始之前未被删除
INSERT
	为新插入的每一行保存当前系统版本号作为行版本号
DELETE
	为删除的每一行保存当前系统版本号作为行删除标识
UPDATE
	插入一条新记录，保存当前系统版本号作为行版本号，同时保存当前系统版本号到原来的行作为删除标识
```
* 这样就不用加锁了
* 只在REPEATABLE READ和READ COMMITTED两个隔离级别下工作
	* READ UNCOMMITTED总是读取新的数据行
	* SERIALIZABLE则会对所有读取的行都加锁

# mysql的存储引擎
## InnoDB
* mysql默认
* 间隙锁防止幻读
* 热备份

## MyISAM
* 不支持事务和行级锁
* 指针长度6个字节，通过``MAX_ROWS``和``AVG_ROW_LENGTH``来修改
* 表锁
* 支持全文索引
* 压缩表

## 其他
暂略

## 转换表的引擎
* ALTER TABLE

	```sql
	ALTER TABLE mytable ENGINE = InnoDB;
	```

	* 执行时间长，mysql会按行复制到一个新表，原表加读锁
	* InnoDB->MyISAM->InnoDB，原InnoDB上所有的外键将丢失

* 导出导入
* 创建与查询

	```sql
	CREATE TABLE innodb_table LIKE myisam_table;
	ALTER TABLE innodb_table ENGINE=InnoDB;
	INSERT INTO innodb_table SELECT * FROM myisam_table;
	```

	数据太大时，分批处理

	```sql
	START TRANSACTION;
	INSERT INTO innodb_table SELECT * FROM myisam_table WHERE id BETWEEN x AND y;
	COMMIT;
	```
	