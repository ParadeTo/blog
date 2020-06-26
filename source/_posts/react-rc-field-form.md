---
title: 模仿 antd 写一个表单组件
date: 2020-06-26 10:52:19
tags:
  - react
  - antd
categories:
  - javascript
description: 模仿 antd4 写一个表单组件
---

我们先来看一段代码，看看我们要实现的组件是怎么使用的：

```javascript
import React, {Component, useEffect} from 'react'
import Form, {Field} from '../components/my-rc-field-form/'
import Input from '../components/Input'

const nameRules = {required: true, message: '请输入姓名！'}
const passworRules = {required: true, message: '请输入密码！'}

export default function MyRCFieldForm(props) {
  const [form] = Form.useForm()

  const onFinish = (val) => {
    console.log('onFinish', val)
  }

  const onFinishFailed = (val) => {
    console.log('onFinishFailed', val)
  }

  useEffect(() => {
    console.log('form', form)
    form.setFieldsValue({username: 'default'})
    console.log(form.getFieldValue('username'))
  }, [])

  return (
    <div>
      <h3>MyRCFieldForm</h3>
      <Form form={form} onFinish={onFinish} onFinishFailed={onFinishFailed}>
        <Field name='username' rules={[nameRules]}>
          <Input placeholder='input UR Username' />
        </Field>
        <Field name='password' rules={[passworRules]}>
          <Input placeholder='input UR Password' />
        </Field>
        <button>Submit</button>
      </Form>
    </div>
  )
}
```

# 框架搭建

我们先把我们组件的架子搭起来，新建 `my-rc-field-form` 目录：

```
my-rc-field-form
  - index.js
  - Form.js
  - Field.js
  - useForm.js
```

其中，`index.js` 中内容如下：

```javascript
import _Form from './Form'
import Field from './Field'
import useForm from './useForm'

const Form = _Form
Form.Field = Field
Form.useForm = useForm

export {Field, useForm}

export default Form
```

我们先简单的实现下 `Field.js`：

```javascript
export default class Field extends Component {
  getControled = () => {
    const {name} = this.props
    return {
      value: '', // TODO
      onChange: (e) => {
        // TODO
      },
    }
  }
  render() {
    const {children} = this.props
    const returnChildNode = React.cloneElement(children, this.getControled())
    return returnChildNode
  }
}
```

然后是 `Form.js`：

```javascript
export default function Form({form, children, onFinish, onFinishFailed}) {
  return <form>{children}</form>
}
```

再然后是 `useForm.js`：

```javascript
export default function useForm() {
  const formRef = useRef()
  return [formRef.current]
}
```

# 表单数据仓库

分析我们的需求，我们发现 `useForm` 返回的对象上面有 `getFieldValue`, `setFieldsValue` 等方法可以来操作我们的表单数据。看来我们需要有个地方存储我们所有的表单数据，我们叫它 `FormStore`：

```javascript
class FormStore {
  constructor(props) {
    // 用来保存表单数据
    this.store = {}
  }

  getFieldValue = (name) => {
    return this.store[name]
  }

  getFieldsValue = () => {
    return this.store
  }

  setFieldsValue = (newStore) => {
    this.store = {
      ...this.store,
      ...newStore,
    }
  }

  getForm = () => {
    return {
      getFieldValue: this.getFieldValue,
      getFieldsValue: this.getFieldsValue,
      setFieldsValue: this.setFieldsValue,
    }
  }
}
```

执行 `useForm` 的时候，需要实例化一个 `FormStore`：

```javascript
export default function useForm(form) {
  const formRef = useRef()
  if (!formRef.current) {
    if (form) {
      formRef.current = form
    } else {
      const formStore = new FormStore()
      formRef.current = formStore.getForm()
    }
  }
  return [formRef.current]
}
```

这里有个问题，数据更新发生在 `Field.js` 中，如何能够让其更新 `FormStore` 中的数据呢，这里我们使用 `React.createContext`：

```javascript
export default function Form({form, children, onFinish, onFinishFailed}) {
  const [formInstance] = useForm(form)
  return (
    <form>
      <FieldContext.Provider value={formInstance}>
        {children}
      </FieldContext.Provider>
    </form>
  )
}
```

现在就可以在 `Field.js` 中对数据进行获取和更新了：

```javascript
export default class Field extends Component {
  static contextType = FieldContext

  onStoreChange = () => {
    this.forceUpdate()
  }

  getControled = () => {
    const {getFieldValue, setFieldsValue} = this.context
    const {name} = this.props
    return {
      value: getFieldValue(name), //从store中取值
      onChange: (e) => {
        // 把新的参数值存到store中
        const newValue = e.target.value
        setFieldsValue({[name]: newValue})
        console.log('newValue', newValue)
      },
    }
  }

  render() {
    const {children} = this.props
    const returnChildNode = React.cloneElement(children, this.getControled())
    return returnChildNode
  }
}
```

不过，现在虽然数据得到了更新，但是组件却无法更新。注意到我们这里写了一个函数 `onStoreChange`，里面调用了 `forceUpdate`。看样子我们只需要在每次修改 `FormStore` 的数据时，去调用这个函数就可以了。

```javascript
setFieldsValue = (newStore) => {
  this.store = {
    ...this.store,
    ...newStore,
  }
  // 调用 Field 的 onStoreChange
}
```

但是，这里又有一个问题了。我们怎么拿到 `Field` 的引用呢？我们在每个 `Field` 挂载的时候去 `FormStore` 中进行注册一下就行了：

```javascript
class FormStore {
  constructor(props) {
    this.store = {}
    this.fieldEntities = []
  }

  registerField = (field) => {
    this.fieldEntities.push(field)
    return () => {
      this.fieldEntities = this.fieldEntities.filter((item) => item != field)
      delete this.store[field.props.name]
    }
  }

  ...

  getForm = () => {
    return {
      registerField: this.registerField,
      getFieldValue: this.getFieldValue,
      getFieldsValue: this.getFieldsValue,
      setFieldsValue: this.setFieldsValue,
    }
  }
}
```

```javascript
export default class Field extends Component {
  ...

  componentDidMount() {
    this.cancelRegister = this.context.registerField(this)
  }

  componentWillUnmount() {
    if (this.cancelRegister) {
      this.cancelRegister()
    }
  }

  ...
}
```

现在，我们可以在 `setFieldsValue` 中调用 `Filed` 的 `onStoreChange` 了：

```javascript
setFieldsValue = (newStore) => {
  this.store = {
    ...this.store,
    ...newStore,
  }
  this.fieldEntities.forEach((enetity) => {
    const {name} = enetity.props
    Object.keys(newStore).forEach((key) => {
      if (key === name) {
        enetity.onStoreChange()
      }
    })
  })
}
```

这样，我们就实现了数据更新的时候去更新组件。

# 表单验证

有了之前的基础，表单验证也好做了，我们增加 `submit` 和 `validate` 方法：

```javascript
validate = () => {
  let err = []
  this.fieldEntities.forEach((entity) => {
    const {name, rules} = entity.props
    let value = this.store[name]
    let rule = rules && rules[0]
    if (rule && rule.required && (value === undefined || value === '')) {
      err.push({
        [name]: rule.message,
        value,
      })
    }
  })
  return err
}

submit = () => {
  let err = this.validate()
  if (err.length === 0) {
    this.calllbacks.onFinish(this.store)
  } else if (err.length > 0) {
    this.calllbacks.onFinishFailed(err)
  }
}
```

然后修改一下 `Form` 组件：

```javascript
export default function Form({form, children, onFinish, onFinishFailed}) {
  const [formInstance] = useForm(form)
  formInstance.setCallback({
    onFinish,
    onFinishFailed,
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        formInstance.submit()
      }}>
      <FieldContext.Provider value={formInstance}>
        {children}
      </FieldContext.Provider>
    </form>
  )
}
```

# 在类组件中使用

注意到 antd4 中的 `Form` 是可以在类组件中使用的：

```javascript
export default class extends React.Component {
  formRef = React.createRef()

  onFinish = (val) => {
    console.log('onFinish', val)
  }

  onFinishFailed = (val) => {
    console.log('onFinishFailed', val)
  }

  componentDidMount() {
    this.formRef.current.setFieldsValue({username: 'default'})
  }

  render() {
    return (
      <div>
        <h3>MyRCFieldForm</h3>
        <Form
          ref={this.formRef}
          onFinish={this.onFinish}
          onFinishFailed={this.onFinishFailed}>
          <Field name='username' rules={[nameRules]}>
            <Input placeholder='input UR Username' />
          </Field>
          <Field name='password' rules={[passworRules]}>
            <Input placeholder='input UR Password' />
          </Field>
          <button>Submit</button>
        </Form>
      </div>
    )
  }
}
```

但是，我们自己实现的 `Form` 组件是函数式组件，怎么获取到 `ref` 呢？这就需要 `React.forwardRef` 和 `React.useImperativeHandle` 来帮忙了，我们改造下 `Form` 组件：

```javascript
export default React.forwardRef(
  ({form, children, onFinish, onFinishFailed}, ref) => {
    const [formInstance] = useForm(form)
    React.useImperativeHandle(ref, () => formInstance)
    formInstance.setCallback({
      onFinish,
      onFinishFailed,
    })
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          formInstance.submit()
        }}>
        <FieldContext.Provider value={formInstance}>
          {children}
        </FieldContext.Provider>
      </form>
    )
  }
)
```

# 总结

从这个例子当中，我们学到以下几点：

- 数据集中管理的思想
- Context 的使用
- 组件注册的思想
- `React.forwardRef` 和 `React.useImperativeHandle` 的用法
