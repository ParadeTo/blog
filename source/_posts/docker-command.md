---
title: docker 命令汇总
date: 2018-05-05 14:01:55
tags:
- docker
categories:
- docker
description: docker 命令汇总
---

# attach
重新连接容器的会话

```
docker run -idt docker/whalesay

docker attach <containerId>
```

# build
构建一个镜像

```
docker build -t ayou/hello .
```

# create
创建但不启动一个新的容器

# commit
提交当前容器为新的镜像

```
docker create -it ubuntu /bin/bash
docker start -a -i <containerId>
docker commit <containerId> ayou/test
```

# inspect
查看一个镜像的信息
```
docker inspect <imageId>
```

# cp
拷贝容器中的文件到宿主机上

```
docker run -itd docker/whalesay
docker cp <containerId>:/cowsay/cowsay ./
```

# diff
列出一个容器中被改变的文件或目录
A 增加, D 删除, C 改变
```
[vagrant@docker-host ~]$ docker attach d8
root@d8fda83470cd:/cowsay# touch hello.txt
[vagrant@docker-host ~]$ docker diff d8
C /cowsay
A /cowsay/hello.txt
C /root
A /root/.bash_history
```

# events
从 docker 容器中获取实时的事件

```
[vagrant@docker-host ~]$ docker events --since=2018-04-30
2018-05-05T06:09:37.836897425Z container create 998de7aa4d2a00d3e3361f12b0a3a309dd80c4a9e57b2087b703e0be7c1a2700 (image=hello-world, name=practical_wing)
2018-05-05T06:09:37.893142337Z network connect 1366370644abf51aa27c087ff52b3f98fe07b5175e9d8e6cac4ab9b4c5b582e2 (container=998de7aa4d2a00d3e3361f12b0a3a309dd80c4a9e57b2087b703e0be7c1a2700, name=bridge, type=bridge)
2018-05-05T06:09:38.157520748Z container start 998de7aa4d2a00d3e3361f12b0a3a309dd80c4a9e57b2087b703e0be7c1a2700 (image=hello-world, name=practical_wing)
```

# exec
在一个运行的容器中执行一条命令

```
docker run -itd docker/whalesay
[vagrant@docker-host ~]$ docker exec b6 ls
ChangeLog
INSTALL
LICENSE
MANIFEST
README
Wrap.pm.diff
...
```

# export
将容器导出为 tar 文件

```
docker export -o=./whale_tar b3db
```

# import
将 tar 包导入为一个镜像

```
cat whale_tar | docker import - test:11.11
```

# history
查看镜像的创建历史

```
[vagrant@docker-host ~]$ docker history ayou/hello
IMAGE               CREATED             CREATED BY                                      SIZE                COMMENT
acc0e7e830c9        17 hours ago        /bin/sh -c #(nop)  CMD ["/hello"]               0B
726ba4d9b766        17 hours ago        /bin/sh -c #(nop) ADD file:834126d44f4a999f9…   844kB
```

# info
列出系统信息

# kill
杀死一个正在运行的容器

# stop
停止一个容器

与 kill 的区别

docker stop 会向容器发送一个 SIGTERM 信号，然后过一段时间再发送 SIGKILL 信号。
我们知道，处理良好的程序可以捕捉 SIGTERM 信号，并进行清理动作然后退出。但是也可能可以忽
略该信号。
但是经过-t（默认 10S）时间后，会再发送 SIGKILL 信号触发进程的最终的退出。


docker kill 会向容器发送一个信号（SIGKILL 或者其他信号）。
相比来说，docker stop 可以更优雅的关闭容器，容器里的进程可以很好的退出。
docker kill 相当于快速地强制关闭容器。但是关闭容器并非是 docker kill 的唯一功能，向容器发送信
号也是很有用的功能


# start
启动一个或多个容器

# images
查看镜像

# pull
拉一个镜像

# tag
给镜像加标签

```
docker tag <imageId> ayou/test:latest
```

# push
推送一个镜像到远程

# login
登录远程仓库

# logout
登出远程仓库

# save
保存一个镜像到 tar 文件

```
docker save --output=./test_tar ayou/test
```

# load
从 tar 文件加载一个镜像

```
docker load --input=./test_tar
```

# logs
查看容器的日志

# rename
重命名一个容器

# rm
删除一个容器

# rmi
删除一个镜像

# top
查看容器中运行的进程

```
docker top <containerId>
```

# pause
暂停容器中所有进程

1. 启动一个容器
```
docker run -itd docker/whalesay
```

2. 在另外一个终端中 attach 这个容器
```
docker attach 82
```

3. 暂停所有进程
```
docker pause 82
```

现在 attach 的终端里面无法进行输入

4. 恢复进程
```
docker unpause 82
```
现在可以输入了

5. restart 这个容器

```
dokcer restart 82
```

attach 的终端也会自动退出

# unpause
恢复容器中所有进程

# restart
重启一个容器


# stats
显示容器使用资源的情况

# port
查看容器的端口信息

# wait
阻塞一个容器，直到它停止

# run
在一个新的容器中运行镜像

## -a/--attach=[]
如果在执行 run 命令时没有指定 -a 参数，那么 docker 默认会挂载所有标准数据流，包括输入输出和错误
 (stdin, stdout, stderr)，你可以单独指定挂载哪个标准流

## --add-host=[]
动态添加到 /etc/hosts 里面的数据

```
[vagrant@docker-host ~]$ docker run --add-host youxingzhi:127.0.0.1 docker/whalesay cat /etc/hosts
127.0.0.1	localhost
::1	localhost ip6-localhost ip6-loopback
fe00::0	ip6-localnet
ff00::0	ip6-mcastprefix
ff02::1	ip6-allnodes
ff02::2	ip6-allrouters
127.0.0.1	youxingzhi
172.17.0.2	f152d55abd0e
```

## -c/--cpu-shares=
通过-c 可以调整 container
的 cpu 优先级。默认情况下，所有的 container 享有相同的 cpu 优先级和 cpu 调度周期。但你可以通过
Docker 来通知内核给予某个或某几个 container 更多的 cpu 计算周期。
默认情况下，使用-c 或者--cpu-shares 参数值为 0，可以赋予当前活动 container 1024 个 cpu 共享周期。
这个 0 值可以针对活动的 container 进行修改来调整不同的 cpu 循环周期。
比如，我们使用-c 或者--cpu-shares =0 启动了 C0，C1，C2 三个 container，使用-c/--cpu-shares=512
启动了 C3.这时，C0，C1，C2 可以 100%的使用 CPU 资源(1024)，但 C3 只能使用 50%的 CPU 资源
(512)。如果这个 host 的 OS 是时序调度类型的，每个 CPU 时间片是 100 微秒，那么 C0，C1，C2 将
完全使用掉这 100 微秒，而 C3 只能使用 50 微秒

## --cap-add=[] and --cap-drop=[]
权限控制

## --cidfile=
将容器 id 保存到文件中

## --cpu-period=
cpu 使用周期

## --cpu-quota=
cpu 配额

## -d/--detach=true
后台运行

## --device=[]
容器中使用某个设备

## --disable-content-trust=true
是否启用镜像合法性检查

## --dns=[]
#设置添加到/etc/resolv.conf 文件中的 DNS 服
务器 IP 地址。容器运行过程中，当遇到一个主机名不在/etc/hosts 中，将连接这些 IP 的 53 端口上寻找
域名解析服务

## -e/--env=[]
设置环境变量

```
docker run -e "ayou=shuai" -it docker/whalesay /bin/bash
root@5024b6b08cf9:/cowsay# echo $ayou
shuai
```

## --entrypoint=
入口

## --env-file=[]
从一个文件中读取环境变量

## --expose=[]
对外暴露端口

## --group-add=[]
添加组

## -h/--hostname=

## --help=false

## -i/--interactive=false
即使没有 attach 也保持 stdin

## --ipc=
ipc 命名空间

## -l/--label=[]/--label-file=[]
设置元数据

## --link 链接到另外一个容器

```
docker run -it --link my-mysql:db --rm mysql sh -c 'exec mysql -h"db" -P"3306" -uroot -p' // db 是 my-mysql 的别名
```

## --name=
容器的名字

## --net
网络模式

## -p/--publish=[]
指定端口映射

## --rm=false
设置容器结束后是否自动删除

## -v/--volume=[]
挂载本地目录
