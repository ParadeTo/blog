---
title: python3程序开发指南(第二版)第三章-组合数据类型
date: 2017-05-23 22:39:19
tags:
- python
categories:
- 读书笔记
description: python3程序开发指南(第二版)第三章-组合数据类型
---

# 序列类型
* bytearray
* bytes
* list
* str
* tuple

## 元组
* 有序序列
* 支持与字符串一样的分片与步距
* 固定，不能修改，可以先使用``list()``转换为列表再修改
* tuple()
	* 无参数，返回空元组
	* 元组作为参数，返回浅拷贝
	* 其他参数，尝试进行转换
* 两种方法
	* count(x) 返回某个元素出现的次数
	* index(x) 返回某个元素的索引
* 操作符``+ * []``(虽然元组是固定对象)，其实是python创建了新元组，用于存放结果，然后将左边的对象引用设置为指向新元素
* 为特定的索引位置指定名字

	```python
	>>> MANUFACTURER, MODEL, SEATING = (0, 1, 2)
	>>> MINIMUM, MAXIMUM = (0,1)
	>>> aircraft = ('Airbus', 'A320-200', (100, 220))
	>>> aircraft[SEATING][MAXIMUM]
	220
	```
	
* 可以用于两个变量交换

	```python
	a, b = (b, a)
	```


## 命名的元组

```python
>>> import collections
>>> Sale = collections.namedtuple("Sale","productid customerid date quantity price")
>>> sales = []
>>> sales.append(Sale(1,1,'2001-01-12',3,7))
>>> sales.append(Sale(2,2,'2001-01-14',4,8))
>>> sales[0].price
```

* _asdict(): 返回键值对的映射

	```python
	>>> sale = Sale(1,1,'2001-01-12',3,7)
	>>> "{date} {price}".format(**sale._asdict())
	```
	
## 列表
与元组类似，不同的是可以，列表是可变的

* in | not in
* ``+ +=``
* ``* *=``

	```python
	>>> a = [1,1]
	>>> a *= 2
	>>> a
	[1, 1, 1, 1]
	```
* append(x)
* count(x): x出现的次数
* extend 等价于 +=
* index(x, index, end)
	
	```python
	>>> a = [1,1,1,1,3]
	>>> a.index(1,3,4)
	3
	```
	
* insert(i, x) 等价于 list[i,i] = [x]
* pop()
* pop(i)
* remove(x)：移除最左边的x，找不到报ValueError异常
* reverse()
* sort(...)
	
	```python
# 多列排序
>>> a = [(1,'q'), (2,'m') ,(2,'g')]
>>> a.sort()
>>> a
[(1, 'q'), (2, 'g'), (2, 'm')]
# key函数
>>> s = ['Chr1-10.txt','Chr1-1.txt','Chr1-2.txt','Chr1-14.txt','Chr1-3.txt','Chr1-20.txt','Chr1-5.txt']
>>> s.sort(key=lambda d : int(d.split('-')[-1].split('.')[0]))
>>> s
['Chr1-1.txt', 'Chr1-2.txt', 'Chr1-3.txt', 'Chr1-5.txt', 'Chr1-10.txt', 'Chr1-14.txt', 'Chr1-20.txt']
	```
* del
* 带星号的表达式
* 带星号的参数
* 分片赋值
* 步距操作

	```python
	# 星号表达式
	first, *rest = [9, 2, -4, 8, 7]

	# 星号参数
	def product(a,b,c):
		return a * b * c
	product(*[2,3,4])

	# 分片赋值
	>>> a = [1,2,3,4]
	>>> a[2:3] = [5,6,7]
	>>> a
	[1, 2, 5, 6, 7, 4]
	>>> a[2:4] = []
	>>> a
	[1, 2, 7, 4]

	# 步距操作
	>>> x = [1,2,3,4,5,6,7,8,9,10]
	>>> x[1::2] = [0] * len(x[1::2])
	>>> x
	[1, 0, 3, 0, 5, 0, 7, 0, 9, 0]
	```

## 列表内涵
[expression for item in iterable if condition]

可嵌套

```python
codes = [s+z+c for s in 'MF' for z in 'SMLX' for c in 'BGW' if not (s == 'F' and z == 'X')]
```

# 集合类型
* in
* len()
* isdisjoint()
* 支持比较
* 支持位逻辑操作符
* 只有可哈希运算的对象才可以添加到集合中，该对象包含一个__hash__()特殊方法，其返回值在某个对象的整个生命周期内都是相同的，可使用__eq__()进行相等性比较
* 所有内置的固定数据类型(如 float, frozenset, int, str, tuple)
* 可变数据类型(dict, list, set)不是可哈希运算的
* ==比较
	
	```
	# 跟js不一样
	>>> a = set([1,2,3])
	>>> b = set([1,2,3])
	>>> a == b
	True
	```
	
## 集合
* 无序，没有索引概念
* 不能分片和步距操作
* 非空集合不能使用空的圆括号来创建
* 每项都是独一无二的，用于删除重复的数据项

	```python
	x = list(set(x))
	```
	
* s.add()
* s.clear()
* s.copy() 返回浅拷贝
* s.difference(t) s-t 返回包含在s中不包含在t中的所有数据
* s.difference_update(t) s-=t 返回包含在s中不包含在t中的所有数据并赋值给s
* s.discard() 如果x存在于集合s中，就移除该项
* s.remove(x) 从s中移除x，如果不存在报KeyError异常
* s.intersection(t) s&t 既包含在s中又包含在t中
* s.intersection_update(t) s&=t 既包含在s中又包含在t中的数据，并赋值给s
* s.isdisjoint(t) 如果集合s与t没有相同的项，就返回True
* s.issubset(t) s<=t 如果s是t的子集或者与t相同，返回True
* s.issuperset(t) s>=t 如果s是t的超集或者与t相同，返回True
* s.pop() 返回并移除一个随机项
* s.symmetric_difference(t) s^t 返回新集合，包含s与t中的每个项，但不包含交集
* s.symmetric_difference_update(t) s^=t 
* s.union(t) s|t 并集
* s.update(t) s|=t 

	```python
	>>> a = {1,2,3}
	>>> b = {1,2,4}
	>>> a | b
	{1, 2, 3, 4}
	>>> a ^ b
	{3, 4}
	```
	
### 使用示例
```python
if sys.argv[1] in {"-h", "--help"}:
```	

```python
seen = set()
for ip in ips:
	if ip not in seen:
		seen.add(ip)
		process_ip(ip)
```

```python
filenames = set(filenames) - {'MAKEFILE','makefile'}
```

## 集合内涵
{expression for item in iterable if condiion}

## 固定集合
略

# 映射类型
## 字典
```python
d1 = dict({"id":1,"name":"ayou"})
d2 = dict(id=1, name="ayou")
d3 = dict([("id", 1), ("name", "ayou")])
d4 = dict(zip(("id", "name"), (1, "ayou")))
d5 = {"id":1,"name":"ayou"}
```

* d.clear()
* d.copy()
* d.fromkeys(s,v)

	```python
	>>> a.fromkeys(['a','b'],[1,2])
	{'b': [1, 2], 'a': [1, 2]}
	```
	
* d.get(k, v)
* d.items()
* d.keys()
* d.values()
* d.pop(k) 返回k对应得value并移除，不存在报异常
* d.pop(k,v)
* d.popitem() 返回一个任意的(k,v)对，d为空报异常
* d.setdefault(k,v)

	```python
	>>> a = {"a":1}
	>>> a.setdefault("b",2)
	2
	>>> a
	{'b': 2, 'a': 1}
	>>> a.setdefault("a",2)
	1
	>>> a
	{'b': 2, 'a': 1}
	
	# 高级用法
	sites.setdefault(site, set()).add(fname)
	==
	if site not in sites:
		sites[site] = set()
	sites[site].add(fname)
	```
	
* d.update(a)
	
	```python
	>>> a
	{'b': 2, 'a': 1}
	>>> b = {"a":2, "c":3}
	>>> a.update(b)
	>>> a
	{'b': 2, 'a': 2, 'c': 3}
	```

### 迭代


```python
for item in d.items():
...
for key, value in d.items():
...
for key in d:
...
for key in d.keys():
...
```

## 字典内涵
{keyexpression: valueexpression for key, value in iterable if condition}

```python
>>> files_sizes = {name: os.path.getsize(name) for name in os.listdir(".") if os.path.isfile(name)}
>>> files_sizes
{'.dbshell': 3587, '.DS_Store': 14340, '.cnpmrc': 8, '.CFUserTextEncoding': 9, '.python_history': 20, '.mongorc.js': 0, '.viminfo': 6458, 'bash_login.sh': 107, '.npmrc': 301, '.babel.json': 11377626, '.gitconfig': 72, '.bash_history': 9667, '.bash_profile': 561, '.node_repl_history': 7, '.bash_profile.pysave': 359}
```

## 默认字典
```python
>>> words = collections.defaultdict(lambda: 2)
>>> words['a']
2
>>> words
defaultdict(<function <lambda> at 0x101856f28>, {'a': 2})
```

## 有序字典
键是有序的

```python
d = collections.OrderedDict([('z',-4),('e',19),('k',7)])
```

* popitem() 返回最后一个键值对
* popitem(last=False) 返回第一个键值对

# 迭代与复制
## 迭代子、迭代操作与函数
通过下面代码来说明迭代的工作过程：
```python
product = 1
for i in [1,2,4,8]:
	product *= i
print(product)
等价于
product = 1
i = iter([1,2,4,8])
while True:
	try:
		product *= next(i)
	except StopIteration:
		break
print(product)	
```


* s+t
* s*n
* x in i
* all(i)
* any(i)
	
	```python
	>>> l = [True, False]
	>>> any(l)
	True
	>>> all(l)
	False
	```
	
* len(x)
* max(i,key) 
* min(i,key)
* range(start,stop,step)
* reversed(i)
* sorted(i,key,reverse)

	```python
	x = []
	for t in zip(range(-10, 0, 1), range(0, 10, 2), range(1, 10, 2)):
	    x += t
	
	y = sorted(x, key=abs)
	print(y)	
	```

	等价于

	```python
	temp = []
	for item in x:
	    temp.append((abs(item), item))
	y = []
	for key, value in sorted(temp):
	    y.append(value)
	print(y)
	```

* sum(i,start) i中的和加上start

* zip(i1,...,iN)

	```python
	for t in zip(range(4), range(0,10,2), range(1,10,2)):
		print(t)
	(0, 0, 1)
	(1, 2, 3)
	(2, 4, 5)
	(3, 6, 7)
	```

	虽然后面两个序列有5项，但是由于第一个序列只有4项，最后也只生成了四组数据

* enumerate()

	```python
	if len(sys.argv) < 3:
		print('usage: grepword.py word file1 [file2 [...fileN]]')
		sys.exit()
	word = sys.argv[1]
	for filename in sys.argv[2:]:
		# lino是迭代的次数，从start开始
		for lino,line in enumurate(open(filename),start=1):
			if word in line:
				print("{0}:{1}:{2:.40}".format(filename, lino, line.rstrip()))
	```

* ``*``操作符

	```python
	calculate(*(1,2,3))
	calculate(*range(1,5))
	```

## 组合类型的复制
* 拷贝一个序列的副本

	```python
	songs = ["because","boys","carol"]
	beatles = songs[:]
	# 这只是浅拷贝！
	x = [53, 68, ["A", "B"]]
	y = x[:]
	x[2][0] = 'Q'
	print(x, y)
	[53, 68, ['Q', 'B']] [53, 68, ['Q', 'B']]
	```

* 深拷贝
	
	```python
	import copy
	x = [53, 68, ["A", "B"]]
	y = copy.deepcopy(x)
	x[2][0] = 'Q'
	print(x,y)
	[53, 68, ['Q', 'B']] [53, 68, ['A', 'B']]
	```

	
# 实例
## 一
有如下数据：

```python
1601:Alert:Lukas:Montgomery:Legal
3702:Alert:Lukas:Montgomery:Sales
4730:Nadelle::Landale:Warehousing
```

分别表示id，forename，middlename，surname，department，要求输出：

```python
Name                              ID  Username 
-----------------------------------------------
Landale,Nadelle.................(4730)nlandale 
Montgomery,AlertL...............(1601)almontgo 
Montgomery,AlertL...............(3702)almontgo1
```

其中Name列由``{surname},{forename}{middlename[0]}``组成，Username由``{forename[0]}{middlename[0]}{surname}``组成且都是小写，若是相同则在后面添加数字


```python
import sys

import collections

ID, FORENAME, MIDDLENAME, SURNAME, DEPARTMENT = range(5)
User = collections.namedtuple("User",
              "username forename middlename surname id")

def generate_username(fields, usernames):
    """
    :param fields: 当前用户各字段
    :param usernames: 用户名集合
    :return: 独一无二的用户名
    """
    # fields[MIDDLENAME][:1] 当MIDDLENAME为空时返回空字符串，避免抛异常
    username = ((fields[FORENAME][0] + fields[MIDDLENAME][:1] +
                 fields[SURNAME]).replace("-","").replace("'",""))
    username = original_name = username[:8].lower()
    count = 1
    while username in usernames:
        username = "{0}{1}".format(original_name, count)
        count += 1
    usernames.add(username)
    return username

def process_line(line, usernames):
    fields = line.split(":")
    username = generate_username(fields, usernames)
    user = User(username, fields[FORENAME], fields[MIDDLENAME], fields[SURNAME], fields[ID])
    return user

def print_users(users):
    namewidth = 32
    usernamewidth = 9
    # 左对齐32个字符 中间对齐6个字符 左对齐9个字符
    print("{0:<{nw}}{1:^6}{2:{uw}}".format(
        "Name", "ID", "Username", nw=namewidth, uw=usernamewidth))
    print("{0:-<{nw}}{0:-<6}{0:-<{uw}}".format(
        "", nw=namewidth, uw=usernamewidth))

    for key in sorted(users):
        user = users[key]
        initial = ""
        if user.middlename:
            initial = "" + user.middlename[0]
        name = "{0.surname},{0.forename}{1}".format(user, initial)
        print("{0:.<{nw}}({1.id:4}){1.username:{uw}}".format(
            name, user, nw=namewidth, uw=usernamewidth
        ))

if __name__ == '__main__':
    if len(sys.argv) == 1 or sys.argv[1] in ["-h","--help"]:
        print("usage:{0} file1 [file2 [...fileN]]".format(
            sys.argv[0]
        ))
        sys.exit()

    usernames = set()
    users = {}
    for filename in sys.argv[1:]:
        for line in open(filename, encoding="utf8"):
            line = line.rsplit()[0]
            if line:
                user = process_line(line, usernames)
                users[(user.surname.lower(), user.forename.lower(), user.id)] = user
    print_users(users)
```

## 二
下面是分析文件中数字的基本统计信息的程序：


```python
# -*- coding: utf-8 -*-
import collections

import sys

import math

Statistics = collections.namedtuple("Statistics", "mean mode median std_dev")

def read_data(filename, numbers, frequencies):
    for lino, line in enumerate(open(filename, encoding="ascii"), start=1):
        for x in line.split():
            try:
                number = float(x)
                numbers.append(number)
                frequencies[number] += 1
            except ValueError as err:
                print("{filename}:{lino}: skipping {x}: {err}".format(
                    **locals()
                ))

def calculate_mode(frequencies, maximum_modes):
    highest_frequency = max(frequencies.values())
    mode = [num for num, frequency in frequencies.items() if frequency == highest_frequency]
    if not (1 <= len(mode) <= maximum_modes):
        mode = None
    else:
        mode.sort()
    return mode

def calculate_median(numbers):
    numbers = sorted(numbers)
    # 取整
    middle = len(numbers) // 2
    median = numbers[middle]
    # 偶数个
    if len(numbers) % 2 == 0:
        median = (median + numbers[middle-1]) / 2
    return median

def calculate_std_dev(numbers, mean):
    total = 0
    for num in numbers:
        total += ((num - mean) ** 2)
    variance = total / (len(numbers) - 1)
    return math.sqrt(variance)

def calculate_statistics(numbers, frequencies):
    mean = sum(numbers) / len(numbers)
    mode = calculate_mode(frequencies, 3)
    median = calculate_median(numbers)
    std_dev = calculate_std_dev(numbers, mean)
    return Statistics(mean, mode, median, std_dev)

def print_results(count, statistics):
    real = '9.2f'

    if statistics.mode is None:
        modeline = ''
    elif len(statistics.mode) == 1:
        modeline = "mode  = {0:{fmt}}\n".format(statistics.mode[0], fmt=real)
    else:
        modeline = "mode  = [" + ",".join(["{0:.2f}".format(m) for m in statistics.mode]) + "]\n"

    print("""

    count = {0:6}
    mean = {mean:{fmt}}
    median = {median:{fmt}}
    {1}\
    std.dev. = {std_dev:{fmt}}""".format(
        count, modeline, fmt=real, **statistics._asdict()
    ))


if __name__ == '__main__':
    if len(sys.argv) == 1 or sys.argv[1] in ["-h","--help"]:
        print("usage:{0} file1 [file2 [...fileN]]".format(
            sys.argv[0]
        ))
        sys.exit()

    numbers = []
    frequencies = collections.defaultdict(int)
    for filename in sys.argv[1:]:
        read_data(filename, numbers, frequencies)
    if numbers:
        statistics = calculate_statistics(numbers, frequencies)
        print_results(len(numbers), statistics)
    else:
        print("no numbers found")
```

输入数据：

```python
12 87 23 12 34 46 5
123 234 12 34
```

结果：

```python
    count =     11
    mean =     56.55
    median =     34.00
    mode  =     12.00
    std.dev. =     69.06
```
