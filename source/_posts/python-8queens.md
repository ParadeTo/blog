---
title: python生成器-8皇后问题
date: 2017-11-03 11:01:06
tags:
- python
categories:
- python
description: 巧用python生成器解决8皇后问题
---

```python
#def flatten(nested):
#     try:
#         try:
#             nested + ''
#         except TypeError:
#             pass
#         else:
#             raise TypeError
#         for sublist in nested:
#             for element in flatten(sublist):
#                 yield element
#     except TypeError:
#         yield nested



def conflict(state, nextX):
    nextY = len(state)
    for i in range(nextY):
        if abs(state[i] - nextX) in (0, nextY - i):
            return True
    return False

def queens(num=8, state=()):
    for pos in range(num):
        if not conflict(state, pos):
            if len(state) == num-1:
                yield (pos, )
            else:
                for result in queens(num, state + (pos, )):
                    yield (pos, ) + result

def prettyprint(solution):
    def line(pos, length=len(solution)):
        return '. ' * (pos) + 'X ' + '. ' * (length-pos-1)

    for pos in solution:
        print(line(pos))

import random
prettyprint(random.choice(list(queens(8))))
print(len(list(queens(8))))
//

. . X . . . . . 
. . . . X . . . 
. . . . . . . X 
. . . X . . . . 
X . . . . . . . 
. . . . . . X . 
. X . . . . . . 
. . . . . X . . 
92

```
