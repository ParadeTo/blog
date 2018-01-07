---
title: python 多进程多线程初试
date: 2018-01-05 22:42:11
tags:
- python
categories:
- python
description: python 多进程多线程
---
# 多进程
## 进程池
```python
from multiprocessing import Pool
import os, time, random

def long_time_task(name):
    print 'Run task %s (%s)...' % (name, os.getpid())
    start = time.time()
    # time.sleep(random.random() * 3)
    time.sleep(1)
    end = time.time()
    print 'Task %s runs %0.2f seconds.' % (name, (end - start))

if __name__ == '__main__':
    start = time.time()
    print 'Parent process %s.' % os.getpid()
    p = Pool()
    for i in range(5):
        # 进程池中的进程同步执行
        p.apply(long_time_task, args=(i,))
        # 进程池中的进程异步执行
        # p.apply_async(long_time_task, args=(i,))
    print 'Waiting for all subprocesses done...'
    p.close()
    p.join()
    print 'All subprocesses done.'
    end = time.time()
    print 'total time:', (end - start)
```

## 使用 Queue
```python
from multiprocessing import Process, Queue

def f(q, l):
    q.put([42, None, 'hello'])
    l.append('test')


if __name__ == '__main__':
    q = Queue()
    l = []
    p = Process(target=f, args=(q,l))
    p.start()
    print q.get(), l.pop()
```

## 使用管道

```python
from multiprocessing import Process, Pipe

def f(conn):
    conn.send([42, None, 'hello'])
    print conn.recv()
    conn.close()


if __name__ == '__main__':
    parent_conn, child_conn = Pipe()
    p = Process(target=f, args=(child_conn,))
    p.start()
    print parent_conn.recv()
    parent_conn.send('test')
    p.join()
```

## 其他进程通信
* Value
* Manager

# 线程
## 不使用线程

```python
from time import sleep, ctime

def loop0():
    print 'start loop 0 at:', ctime()
    sleep(4)
    print 'loop 0 done at:', ctime()

def loop1():
    print 'start loop 1 at:', ctime()
    sleep(2)
    print 'loop 1 done at:', ctime()

def main():
    print 'starting at:', ctime()
    loop0()
    loop1()
    sleep(6)
    print 'all done at:', ctime()

if __name__ == '__main__':
    main()
```

输出：

```python
starting at: Fri Jan  5 22:44:25 2018
start loop 0 at: Fri Jan  5 22:44:25 2018
loop 0 done at: Fri Jan  5 22:44:29 2018
start loop 1 at: Fri Jan  5 22:44:29 2018
loop 1 done at: Fri Jan  5 22:44:31 2018
all done at: Fri Jan  5 22:44:37 2018
```

程序按序执行，一共执行了 12 秒

## thread 模块
该模块是不推荐使用的，但是还是可以看看如果使用，使用 thread 改写上面的例子：

```python
from time import sleep, ctime
import thread

loops = [4, 2]

def loop(nloop, nsec, lock):
    print 'start loop', nloop, ' at:', ctime()
    sleep(nsec)
    print 'loop', nloop, ' done at:', ctime()
    lock.release()

def main():
    print 'starting at:', ctime()
    locks = []
    nloops = range(len(loops))

    for i in nloops:
        lock = thread.allocate_lock()
        lock.acquire()
        locks.append(lock)

    # 为了让线程同时运行，所以要单独出来
    for i in nloops:
        thread.start_new_thread(loop, (i, loops[i], locks[i]))

    # 等待两个线程的释放
    for i in nloops:
        while locks[i].locked(): pass

    print 'all done at:', ctime()

if __name__ == '__main__':
    main()
```

输出：

```python
starting at: Fri Jan  5 22:52:00 2018
start loop 0  at: Fri Jan  5 22:52:00 2018
start loop 1  at: Fri Jan  5 22:52:00 2018
loop 1  done at: Fri Jan  5 22:52:02 2018
loop 0  done at: Fri Jan  5 22:52:04 2018
all done at: Fri Jan  5 22:52:04 2018
```

线程 0 和 1 是同时运行的，线程 1 先运行完，主线程等待两个线程都执行完后再执行。

## threading 模块
threading 模块中有个 Thread 类，使用他来创建线程有很多方法，下面介绍两种方法：

### 创建 Thread 的实例，传给它一个函数

```python
import threading
from time import sleep, ctime

loops = [4, 2]

def loop(nloop, nsec):
    print 'start loop', nloop, ' at:', ctime()
    sleep(nsec)
    print 'loop', nloop, ' done at:', ctime()

def main():
    print 'starting at:', ctime()
    threads = []
    nloops = range(len(loops))

    for i in nloops:
        t = threading.Thread(target=loop,
                              args=(i, loops[i]))
        threads.append(t)

    for i in nloops:
        threads[i].start()

    for i in nloops:
        threads[i].join()

    print 'all done at:', ctime()

if __name__ == '__main__':
    main()
```

### 派生 Thread 的子类，并创建子类的实例

```python
import threading
from time import sleep, ctime

loops = [4, 2]

class MyThread(threading.Thread):
    def __init__(self, func, args, name=''):
        threading.Thread.__init__(self)
        self.name = name
        self.func = func
        self.args = args

    def run(self):
        self.func(*self.args)

def loop(nloop, nsec):
    print 'start loop', nloop, 'at:', ctime()
    sleep(nsec)
    print 'loop', nloop, 'done at:', ctime()

def main():
    print 'starting at:', ctime()
    threads = []
    nloops = range(len(loops))

    for i in nloops:
        t = MyThread(loop, (i, loops[i]), loop.__name__)
        threads.append(t)

    for i in nloops:
        threads[i].start()

    for i in nloops:
        threads[i].join()

    print 'all done at:', ctime()

if __name__ == '__main__':
    main()
```

## 一个更加实际的例子

```python
from atexit import register
from re import compile
from threading import Thread
from time import ctime
from urllib2 import urlopen as uopen

REGEX = compile('#([\d,]+) in Books')
AMZN = 'http://amazon.com/dp/'

ISBNs = {
    '0132269937': 'Core Python Programming',
    '0132356139': 'Python Web Development with Django',
    '0137143419': 'Python Fundamentals'
}

def getRanking(isbn):
    page = uopen('%s%s' % (AMZN, isbn))
    data = page.read()
    page.close()
    return REGEX.findall(data)[0]

def _showRanking(isbn):
    print '- %r ranked %s' % (
        ISBNs[isbn], getRanking(isbn))

def main():
    print 'At', ctime(), 'on Amazon...'
    for isbn in ISBNs:
        # 不用多线程
        # _showRanking(isbn)
        # 使用多线程
        Thread(target=_showRanking, args=(isbn,)).start()

@register
def _atexit():
    print 'all done at:', ctime()

if __name__ == '__main__':
    main()
```

## 线程池

```python
import threadpool
import time
from urllib import request as urllib2

urls = [
    'http://www.baidu.com',
    'http://www.qq.com',
    'http://www.163.com'
]


def myRequest(url):
    resp = urllib2.urlopen(url)
    print(url, resp.getcode())


def timeCost(request, n):
    print("Elapsed time: %s" % (time.time() - start))


start = time.time()
pool = threadpool.ThreadPool(5)
reqs = threadpool.makeRequests(myRequest, urls, timeCost)
[pool.putRequest(req) for req in reqs]
pool.wait()
```

## 同步原语
### 锁
下面是使用锁的一个例子

```python
from atexit import register
from random import randrange
from threading import Thread, currentThread, Lock
from time import sleep, ctime

class CleanOutputSet(set):
    def __str__(self):
        return ', '.join(x for x in self)

lock = Lock()
loops = (randrange(2,5) for x in xrange(randrange(3,7)))
remaining = CleanOutputSet()

def loop(nsec):
    myname = currentThread().name

    lock.acquire()
    remaining.add(myname)
    print '[%s] Started %s' % (ctime(), myname)
    lock.release()

    sleep(nsec)

    lock.acquire()
    remaining.remove(myname)
    print '[%s] Completed %s (%d secs)' % (
        ctime(), myname, nsec)
    print ' (remaining: %s)' % (remaining or 'NONE')
    lock.release()

def _main():
    for pause in loops:
        Thread(target=loop, args=(pause,)).start()

@register
def _atexit():
    print 'all DONE at:', ctime()

if __name__ == '__main__':
    _main()
```

也可以使用上下文管理：

```python
with lock:
    remaining.add(myname)
    print '[%s] Started %s' % (ctime(), myname)
```

### 信号量
表示不是很理解

```python
from atexit import register
from random import randrange
from time import sleep, ctime
from threading import BoundedSemaphore, Thread, Lock

lock = Lock()
MAX = 5
candytray = BoundedSemaphore(MAX)

def refill():
    lock.acquire()
    print 'Refilling candy...'
    print candytray._Semaphore__value
    try:
        # counter value +1
        candytray.release()
    except ValueError:
        print 'full, skipping'
    else:
        print 'OK'
    lock.release()

def buy():
    lock.acquire()
    print 'Buying candy...'
    if candytray.acquire(False):
        print 'OK'
    else:
        print 'empty, skipping'
    lock.release()

def producer(loops):
    for i in xrange(loops):
        refill()
        sleep(randrange(3))

def consumer(loops):
    for i in xrange(loops):
        buy()
        sleep(randrange(3))

def _main():
    print 'starting at:', ctime()
    nloops = randrange(2, 6)
    print 'THE CANDY MACHINE (full with %d bars)!' % MAX
    Thread(target=consumer, args=(randrange(nloops, nloops+MAX+3),)).start()
    Thread(target=producer, args=(nloops,)).start()

@register
def _atexit():
    print 'all done at:', ctime()

if __name__ == '__main__':
    _main()
```
