---
title: React性能优化（译）
date: 2016-12-15 09:29:51
tags:
- react
categories:
- 前端框架
description: 翻译react官网性能优化
---
*原文请见：https://facebook.github.io/react/docs/optimizing-performance.html*

React内置了很多聪明的方法来减少用于更新UI的耗时DOM操作。对大多数应用来说，不用做太多具体的优化工作就可以创造出快速的用户界面。然而，还是有很多方法去加速我们的React应用。

# 使用生产模式构建
如果你正测试或体验你的应用性能问题，确保你在最小生产模式构建环境下进行：
* 对于使用[create-react-app](https://facebook.github.io/react/blog/2016/07/22/create-apps-with-no-configuration.html)的用户，可以运行``npm run build``并按照指示操作
* 对于单个网页，提供了``.min.js``版本
* 对于Browserify，配合参数``NODE_ENV=production``运行
* 对于Webpack，将下面插件加到生产配置文件中：
```javascript
new webpack.DefinePlugin({
  'process.env': {
    NODE_ENV: JSON.stringify('production')
  }
}),
new webpack.optimize.UglifyJsPlugin()
```
开发模式构建包含了额外有用的警告信息，但是由于其需要额外记录一些信息会导致应用变慢。

# 避免[Reconciliation](https://facebook.github.io/react/docs/reconciliation.html)（调解）
React构建并维护了一套UI内部表现机制。包括组件返回的React元素。使得React可以避免在非必要时创建和访问DOM节点，因为对他们的操作往往比操作Javascript对象要慢。这种机制被称作"virtual DOM"，不过它在React Native中同样适用。

当一个组件的props或state发生改变时，React会通过比较最新的返回元素和之前已经渲染的元素来判断是否有必要更新真实的DOM节点。当他们不相等时，React会更新DOM。

有些情况下，你的组件可以通过重写[生命周期](http://www.codeceo.com/article/reactjs-life-circle-event.html)函数``shouldComponentUpdate``（组件重新渲染前触发）来进行加速，
默认该函数返回``true``，表示应该更新组件。

```javascript
shouldComponentUpdate(nextProps, nextState) {
  return true;
}
```

如果你知道什么情况下你的组件不需要更新，你可以在``shouldComponentUpdate``中返回``false``，跳过组件的重新渲染阶段，包括调用``render()``方法以及其以后的其他方法。

## shouldComponentUpdate 实战
下图是一个组件树。``SCU``表示``shouldComponentUpdate``的返回值，``vDOMEq``表示前后两次虚拟DOM是否相同，圆圈颜色表示组件是否需要更新。
![should-component-update](should-component-update.png)

介于C2的``shouldComponentUpdate``返回``false``，React不会尝试重新渲染C2，甚至不会调用C4和C5的``shouldComponentUpdate``方法。

C1和C3的``shouldComponentUpdate``返回``true``，所以React必需往下继续检查。C6的``shouldComponentUpdate``返回``true``，并且前后两次虚拟DOM不相同，所以需要更新真实DOM。

有意思的是C8。虽然``shouldComponentUpdate``返回``true``，但是因为比较虚拟DOM发现没有变化，所以该组件不更新。

注意到React只需要更新C6，当然，这是无法避免的。但是通过比较虚拟DOM，C8被排除了。对于C2和其子组件，以及C7来说，根本不需要比较虚拟DOM，因为在``shouldComponentUpdate``就排除了，连``render``都无需调用。

## 例子
如果你的组件更新的唯一条件是当``props.color``和``state.count``发生了变化，你可以在``shouldComponentUpdate``中进行检查
```javascript
class CounterButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {count: 1};
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.props.color !== nextProps.color) {
      return true;
    }
    if (this.state.count !== nextState.count) {
      return true;
    }
    return false;
  }

  render() {
    <button
      color={this.props.color}
      onClick={() => this.setState(state => ({count: state.count + 1}))}>
      Count: {this.state.count}
    </button>
  }
}
```

如果你的组件变得更加复杂了，你可以在所有的``props``和``state``中使用“浅比较”来决定组件是否需要更新。你可以通过继承``React.PureComponent``来让React自动为你做这个事情:

```javascript
class CounterButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {count: 1};
  }

  render() {
    <button
      color={this.props.color}
      onClick={() => this.setState(state => ({count: state.count + 1}))}>
      Count: {this.state.count}
    </button>
  }
}
```

不过，当数据不是基本类型时，这个会有问题，看下面这个例子：

```javascript
class ListOfWords extends React.PureComponent {
  render() {
    return <div>{this.props.words.join(',')}</div>;
  }
}

class WordAdder extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      words: ['marklar']
    };
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    // This section is bad style and causes a bug
    const words = this.state.words;
    words.push('marklar');
    this.setState({words: words});
  }

  render() {
    return (
      <div>
        <button onClick={this.handleClick} />
        <ListOfWords words={this.state.words} />
      </div>
    );
  }
}
```

问题出在``PureComponent``只对新旧``props``进行了浅对比，而``ListOfWords``生命周期函数``shouldComponentUpdate``中的``newProps.words``和``this.props.words``指向的是同一个对象的引用，自然他们就相等了，为了验证，我加了如下代码：
```javascript
class ListOfWords extends React.PureComponent {

  shouldComponentUpdate(newProps, newState) {
    console.log(this.props.words);
    console.log(newProps.words);
    console.log(this.props.words === newProps.words);
    return true;
  }
  render() {
    return <div>{this.props.words.join(',')}</div>;
  }
}
```

结果返回：
```javascript
["marklar","marklar"]
["marklar","marklar"]
true
```

## 不可变数据的力量
一个简单的解决该问题的方法是避免使用可变数据，例如：上面的``handleClick``可以改写成这样：
```javascript
handleClick() {
  this.setState(prevState => ({
    words: prevState.words.concat(['marklar'])
  }));
}
```
或者使用[扩展运算符...](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_operator)：
```javascript
handleClick() {
  this.setState(prevState => ({
    words: [...prevState.words, 'marklar'],
  }));
};
```
如果是对象呢？比如要改变一个对象的某个属性，原来的写法是这样：
```javascript
function updateColorMap(colormap) {
  colormap.right = 'blue';
}
```
现在可以改写成这样：
```javascript
function updateColorMap(colormap) {
  return Object.assign({}, colormap, {right: 'blue'});
}
```
上面的函数返回了一个全新的对象，而不是修改原来的对象

或者用[ES6语法](https://github.com/sebmarkbage/ecmascript-rest-spread)，像这样：
```javascript
function updateColorMap(colormap) {
  return {...colormap, right: 'blue'};
}
```

测试结果返回：
```javascript
["marklar"]
["marklar","marklar"]
false
```

## 使用不可变数据结构
[Immutable.js](https://github.com/facebook/immutable-js)是另外一个解决上述问题的方法。具体详情请见官网，本文就不赘述了。


# 参考
* Optimizing Performance-https://facebook.github.io/react/docs/optimizing-performance.html
* Reconciliation-https://facebook.github.io/react/docs/reconciliation.html
* React Component Lifecycle-https://segmentfault.com/a/1190000003691119
* ReactJS 生命周期、数据流与事件-http://www.codeceo.com/article/reactjs-life-circle-event.html
* Object Rest/Spread Properties for ECMAScript-https://github.com/sebmarkbage/ecmascript-rest-spread
* Spread syntax- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_operator
