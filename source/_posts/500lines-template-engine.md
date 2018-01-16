---
title: 500 行或更少系列之模板引擎
date: 2018-01-04 15:22:18
tags:
- python
categories:
- python
description: 用500行左右的代码实现一个模板引擎
---

*原文请见：http://aosabook.org/en/500L/a-template-engine.html*

*代码请见：https://github.com/aosabook/500lines/tree/master/template-engine*

# 引言
大多数程序包含大量的逻辑，以及少量文本数据。编程语言被设计成适合这种类型的编程。但是一些编程任务只涉及一点逻辑，以及大量的文本数据。
对于这些任务，我们希望有一个更适合这些问题的工具。模板引擎就是这样一种工具。在本章中，我们将构建一个简单的模板引擎。

最常见的一个以文字为主的任务是在 web 应用程序。任何 web 应用程序的一个重要工序是生成用于浏览器显示的 HTML。
很少有 HTML 页面是完全静态的：它们至少包含少量的动态数据，比如用户名。通常，它们包含大量的动态数据：产品列表、好友的新闻更新等等。

与此同时，每个HTML页面都包含大量的静态文本。这些页面很大，包含成千上万个字节的文本。
web 应用程序开发人员有一个问题要解决：如何最好地生成包含静态和动态数据混合的大段字符串？另一个问题是：
静态文本实际上是由团队的另一个成员、前端设计人员编写的 HTML 标记，他们希望能够以熟悉的方式使用它。

为了便于说明，假设我们想要生成这个 HTML:

```html
<p>Welcome, Charlie!</p>
<p>Products:</p>
<ul>
    <li>Apple: $1.00</li>
    <li>Fig: $1.50</li>
    <li>Pomegranate: $3.25</li>
</ul>
```
这里，用户的名字将是动态的，就像产品的名称和价格一样。甚至产品的数量也不是固定不变的：有时可能会有更多或更少的产品展示出来。

构造这个 HTML 的一种方法是在我们的代码中将字符串常量们合并到一起来生成页面。动态数据将插入以替换某些字符串。我们的一些动态数据是重复的，就像我们的产品列表一样。
这意味着我们将会有大量重复的 HTML，因此这些内容必须单独处理，并与页面的其他部分合并。

比如，我们的 demo 页面像这样：

```python
# The main HTML for the whole page.
PAGE_HTML = """
<p>Welcome, {name}!</p>
<p>Products:</p>
<ul>
{products}
</ul>
"""

# The HTML for each product displayed.
PRODUCT_HTML = "<li>{prodname}: {price}</li>\n"

def make_page(username, products):
    product_html = ""
    for prodname, price in products:
        product_html += PRODUCT_HTML.format(
            prodname=prodname, price=format_price(price))
    html = PAGE_HTML.format(name=username, products=product_html)
    return html
```

这是可行的，但是有点乱。HTML 是嵌入在我们的代码中的多个字符串常量。页面的逻辑很难看到，因为静态文本被拆分为独立的部分。如何格式化数据的细节隐藏在 Python 代码中。为了修改 HTML 页面，我们的前端设计人员需要能够编辑 Python 代码。想象一下，如果页面是10(或者100)倍的复杂，代码会是什么样子；它很快就会变得无法维护。

# 模板

生成 HTML 页面的更好方法是使用模板。HTML 页面是作为模板编写的，这意味着该文件主要是静态的 HTML，其中嵌入了使用特殊符号标记的动态片段。我们的 demo 页面模板可以像这样:

```html
<p>Welcome, {{user_name}}!</p>
<p>Products:</p>
<ul>
{% for product in product_list %}
    <li>{{ product.name }}:
        {{ product.price|format_price }}</li>
{% endfor %}
</ul>
```

这里的重点是 HTML 文本，其中嵌入了一些逻辑。将这种以文档为中心的方法与上面的以逻辑为中心的代码进行对比。前面的程序主要是 Python 代码，HTML 嵌入在 Python 逻辑中。这里我们的程序主要是静态 HTML 标记。

要在我们的程序中使用 HTML 模板，我们需要一个模板引擎：一个使用静态模板来描述页面的结构和静态内容的函数，以及提供动态数据插入模板的动态上下文。模板引擎将模板和上下文结合起来生成完整的 HTML 字符串。模板引擎的工作是解释模板，用真实数据替换动态片段。

# 支持的语法
模板引擎在它们支持的语法中有所不同。我们的模板语法基于 Django，一个流行的 web 框架。既然我们在 Python 中实现了我们的引擎，那么一些 Python 概念将出现在我们的语法中。在我们的 demo 示例中，我们已经看到了这一章的一些语法，下面是我们将要实现的所有语法：

使用双花括号插入上下文中的数据：

```html
<p>Welcome, {{user_name}}!</p>
```
当模板被呈现时，模板中可用的数据将提供给上下文。稍后将进行更详细的讨论。

模板引擎通常使用简化的、轻松的语法来访问数据中的元素。在 Python 中，这些表达式有不同的效果:

```python
dict["key"]
obj.attr
obj.method()
```

在我们的模板语法中，所有这些操作都用点来表示：

```python
dict.key
obj.attr
obj.method
```

点符号将访问对象属性或字典值，如果结果值是可调用的，它将自动调用。这与 Python 代码不同，您需要使用不同的语法来执行这些操作。这就产生了更简单的模板语法：

```html
<p>The price is: {{product.price}}, with a {{product.discount}}% discount.</p>
```

您可以使用过滤器函数来修改值，通过管道字符调用:

```html
<p>Short name: {{story.subject|slugify|lower}}</p>
```

构建好玩的页面通常需要少量的决策，所以条件语句也是可用的：

```html
{% if user.is_logged_in %}
    <p>Welcome, {{ user.name }}!</p>
{% endif %}
```

循环允许我们在页面中包含数据集合:

```html
<p>Products:</p>
<ul>
{% for product in product_list %}
    <li>{{ product.name }}: {{ product.price|format_price }}</li>
{% endfor %}
</ul>
```

与其他编程语言一样，条件语句和循环可以嵌套来构建复杂的逻辑结构。

最后，注释也不能少：

```html
{# This is the best template ever! #}
```

# 实现方法
总的来说，模板引擎有两个主要的工作：解析模板，渲染模板。

渲染模板具体涉及：

* 管理动态上下文，数据的来源
* 执行逻辑元素
* 实现点访问和筛选执行

从解析阶段传递什么到呈现阶段是关键。
解析可以提供什么？有两种选择：我们称它们为解释和编译。
在解释模型中，解析生成一个表示模板结构的数据结构。呈现阶段将根据所找到的指令对数据结构进行处理，并将结果文本组合起来。Django 模板引擎使用这种方法。
在编译模型中，解析生成某种形式的可直接执行的代码。呈现阶段执行该代码，生成结果。Jinja2 和 Mako 是使用编译方法的模板引擎的两个例子。
我们的引擎的实现使用编译模型：我们将模板编译成 Python 代码。当它运行时，组装成结果。
模板被编译成 Python 代码，程序将运行得更快，因为即使编译过程稍微复杂一些，但它只需要运行一次。
将模板编译为 Python 要稍微复杂一些，但它并没有您想象的那么糟糕。而且，正如任何开发人员都能告诉你的那样，编写一个会编写程序的程序比编写程序要有趣得多！


# 编译代码
在我们了解模板引擎的代码之前，让我们看看它要生成的代码。解析阶段将把模板转换为 Python 函数。这是我们的模板：

```html
<p>Welcome, {{user_name}}!</p>
<p>Products:</p>
<ul>
{% for product in product_list %}
    <li>{{ product.name }}:
        {{ product.price|format_price }}</li>
{% endfor %}
</ul>
```

针对上面的模板，我们最后想得到编译后的 Python 代码如下所示:

```python
def render_function(context, do_dots):
    c_user_name = context['user_name']
    c_product_list = context['product_list']
    c_format_price = context['format_price']

    result = []
    append_result = result.append
    extend_result = result.extend
    to_str = str

    extend_result([
        '<p>Welcome, ',
        to_str(c_user_name),
        '!</p>\n<p>Products:</p>\n<ul>\n'
    ])
    for c_product in c_product_list:
        extend_result([
            '\n    <li>',
            to_str(do_dots(c_product, 'name')),
            ':\n        ',
            to_str(c_format_price(do_dots(c_product, 'price'))),
            '</li>\n'
        ])
    append_result('\n</ul>\n')
    return ''.join(result)
```

几点说明：

* 通过缓存了一些函数到局部变量来对代码进行了优化（比如 append_result = result.append 等）
* 点符号操作被转化成了 `do_dots` 函数
* 逻辑代码被转化成了 python 代码和循环


# 编写模板引擎
## 模板类
可以使用模板的文本构造了 Templite 对象，然后您可以使用它来呈现一个特定的上下文，即数据字典:

```python
# Make a Templite object.
templite = Templite('''
    <h1>Hello {{name|upper}}!</h1>
    {% for topic in topics %}
        <p>You are interested in {{topic}}.</p>
    {% endfor %}
    ''',
    {'upper': str.upper},
)

# Later, use it to render some data.
text = templite.render({
    'name': "Ned",
    'topics': ['Python', 'Geometry', 'Juggling'],
})
```

在创建对象时，我们会传递模板的文本，这样我们就可以只执行一次编译步骤，然后调用多次来重用编译后的结果。

构造函数还受一个字典参数，一个初始上下文。这些存储在Templite对象中，当模板稍后呈现时将可用。这些都有利于定义我们想要在任何地方都可用的函数或常量，比如上一个例子中的upper。

在讨论实现 Templite 之前，让我们先搞定一个工具类： `CodeBuilder`

## CodeBuilder

引擎中的大部分工作是解析模板并生成 Python 代码。为了帮助生成 Python，我们创建了 CodeBuilder 类，它帮我们添加代码行，管理缩进，最后从编译的 Python 中给出结果。

CodeBuilder 对象保存了一个字符串列表，这些字符串将一起作为最终的 Python 代码。它需要的另一个状态是当前的缩进级别:

```python
class CodeBuilder(object):
    """Build source code conveniently."""

    def __init__(self, indent=0):
        self.code = []
        self.indent_level = indent
```

CodeBuilder 做的事并不多。add_line添加了一个新的代码行，它会自动将文本缩进到当前的缩进级别，并提供一条新行:

```python
def add_line(self, line):
    """Add a line of source to the code.

    Indentation and newline will be added for you, don't provide them.

    """
    self.code.extend([" " * self.indent_level, line, "\n"])
```

`indent` 和 `dedent` 提高或减少缩进级别:

```python
INDENT_STEP = 4      # PEP8 says so!

def indent(self):
    """Increase the current indent for following lines."""
    self.indent_level += self.INDENT_STEP

def dedent(self):
    """Decrease the current indent for following lines."""
    self.indent_level -= self.INDENT_STEP
```

`add_section` 由另一个 `CodeBuilder` 对象管理。这让我们可以在代码中预留一个位置，随后再添加文本。self.code 列表主要是字符串列表，但也会保留对这些 section 的引用:

```python
def add_section(self):
    """Add a section, a sub-CodeBuilder."""
    section = CodeBuilder(self.indent_level)
    self.code.append(section)
    return section
```

`__str__` 使用所有代码生成一个字符串，将 self.code 中的所有字符串连接在一起。注意，因为 self.code 可以包含 sections，这可能会递归调用其他 `CodeBuilder` 对象:

```python
def __str__(self):
    return "".join(str(c) for c in self.code)
```

`get_globals` 通过执行代码生成最终值。他将对象字符串化，然后执行，并返回结果值:

```python
def get_globals(self):
    """Execute the code, and return a dict of globals it defines."""
    # A check that the caller really finished all the blocks they started.
    assert self.indent_level == 0
    # Get the Python source as a single string.
    python_source = str(self)
    # Execute the source, defining globals, and return them.
    global_namespace = {}
    exec(python_source, global_namespace)
    return global_namespace
```

最后一个方法利用了 Python 的一些奇异特性。`exec` 函数执行包含 Python 代码的字符串。`exec` 的第二个参数是一个字典，它将收集由代码定义的全局变量。举个例子，如果我们这样做:

```python
python_source = """\
SEVENTEEN = 17

def three():
    return 3
"""
global_namespace = {}
exec(python_source, global_namespace)
```

则 `global_namespace['SEVENTEEN']` 是 17，`global_namespace['three']` 返回函数 `three`。

虽然我们只使用 `CodeBuilder` 来生成一个函数，但是这里没有限制它只能做这些。这使得类更易于实现，也更容易理解。
`CodeBuilder` 允许我们创建一大块 Python 源代码，并且不需要了解我们的模板引擎相关知识。`get_globals` 会返回一个字典，使代码更加模块化，因为它不需要知道我们定义的函数的名称。无论我们在 Python 源代码中定义了什么函数名，我们都可以从 `get_globals` 返回的对象中检索该名称。
现在，我们可以进入 `Templite` 类本身的实现，看看 `CodeBuilder` 是如何使用的以及在哪里使用。


## 实现模板类
### 编译
将模板编译成 Python 函数的所有工作都发生在 Templite 构造函数中。首先，传入的上下文被保存:

```python
def __init__(self, text, *contexts):
    """Construct a Templite with the given `text`.

    `contexts` are dictionaries of values to use for future renderings.
    These are good for filters and global values.

    """
    self.context = {}
    for context in contexts:
        self.context.update(context)
```

这里，使用了 python 的可变参数，可以传入多个上下文，且后面传入的会覆盖前面传入的。

我们用集合 `all_vars` 来记录模板中用到的变量，用 `loop_vars` 记录模板循环体中用到的变量:

```python
self.all_vars = set()
self.loop_vars = set()
```

稍后我们将看到这些如何被用来帮助构造函数的代码。首先，我们将使用前面编写的 `CodeBuilder` 类来构建我们的编译函数:

```python
code = CodeBuilder()

code.add_line("def render_function(context, do_dots):")
code.indent()
vars_code = code.add_section()
code.add_line("result = []")
code.add_line("append_result = result.append")
code.add_line("extend_result = result.extend")
code.add_line("to_str = str")
```

在这里，我们构造了 `CodeBuilder` 对象，并开始编写代码行。我们的 Python 函数将被称为 `render_function`，它将接受两个参数：上下文是它应该使用的数据字典，而 `do_dots` 是实现点属性访问的函数。

我们创建一个名为 `vars_code` 的部分。稍后我们将把变量提取行写到这一部分中。`vars_code` 对象让我们在函数中保存一个位置，当我们有需要的信息时，它可以被填充。

然后缓存了 `list` 的两个方法及 `str` 到本地变量，正如上面所说的，这样可以提高代码的性能。

接下来，我们定义一个内部函数来帮助我们缓冲输出字符串:

```python
buffered = []
def flush_output():
    """Force `buffered` to the code builder."""
    if len(buffered) == 1:
        code.add_line("append_result(%s)" % buffered[0])
    elif len(buffered) > 1:
        code.add_line("extend_result([%s])" % ", ".join(buffered))
    del buffered[:]
```

当我们创建大量代码到编译函数中时，我们需要将它们转换为 `append` 函数调用。我们希望将重复的 `append` 调用合并到一个 `extend` 调用中，这是一个优化点。为了使这成为可能，我们缓冲了这些块。

缓冲列表包含尚未写入到我们的函数源代码的字符串。在我们的模板编译过程中，我们将附加字符串缓冲，当我们到达控制流点时，比如 if 语句，或循环的开始或结束时，将它们刷新到函数代码。

`flush_output` 函数是一个闭包。这简化了我们对函数的调用：我们不必告诉 `flush_output` 要刷新什么缓冲区，或者在哪里刷新它；它清楚地知道所有这些。

如果只缓冲了一个字符串，则使用 `append_result` 将其添加到结果中。如果有多个缓冲，那么将使用 `extend_result` 将它们添加到结果中。


回到我们的 Templite 类。在解析控制结构时，我们希望检查它们语法是否正确。需要用到栈结构 `ops_stack`:

```python
ops_stack = []
```

例如，当我们遇到控制语句 `\{\% if \%\}`，我们入栈 `if`。当我们遇到 `\{\% endif \%\}`时，出栈并检查出栈元素是否为`if`。

现在真正的解析开始了。我们使用正则表达式将模板文本拆分为多个 token。这是我们的正则表达式:

```python
tokens = re.split(r"(?s)({{.*?}}|{%.*?%}|{#.*?#})", text)
```

`split` 函数将使用正则表达式拆分一个字符串。我们的模式是圆括号，因此匹配将用于分割字符串，也将作为分隔列表中的片段返回。

`(?s)` 为单行模式，意味着一个点应该匹配换行符。接下来是匹配表达式/控制结构/注释，都为非贪婪匹配。

拆分的结果是字符串列表。例如，该模板文本：

```python
<p>Topics for {{name}}: {% for t in topics %}{{t}}, {% endfor %}</p>
```

会被分隔为：

```python
[
    '<p>Topics for ',               # literal
    '{{name}}',                     # expression
    ': ',                           # literal
    '{% for t in topics %}',        # tag
    '',                             # literal (empty)
    '{{t}}',                        # expression
    ', ',                           # literal
    '{% endfor %}',                 # tag
    '</p>'                          # literal
]
```

将文本拆分为这样的 tokens 之后，我们可以对这些 tokens 进行循环，并依次处理它们。根据他们的类型划分，我们可以分别处理每种类型。
编译代码是对这些 tokens 的循环：

```python
for token in tokens:
    # 注释直接忽略
    if token.startswith('{#'):
        # Comment: ignore it and move on.
        continue
    # 表达式：提取出内容交给 _expr_code 进行处理，然后生成一行代码
    elif token.startswith('{{'):
        # An expression to evaluate.
        expr = self._expr_code(token[2:-2].strip())
        buffered.append("to_str(%s)" % expr)
    # 控制语句
    elif token.startswith('{%'):
        # Action tag: split into words and parse further.
        # 先将前面生成的代码刷新到编译函数之中
        flush_output()
        words = token[2:-2].strip().split()
        if words[0] == 'if':
            # An if statement: evaluate the expression to determine if.
            # if语句只能有两个单词
            if len(words) != 2:
                self._syntax_error("Don't understand if", token)
            # if 入栈
            ops_stack.append('if')
            # 生成代码
            code.add_line("if %s:" % self._expr_code(words[1]))
            # 增加下一条语句的缩进级别
            code.indent()
        elif words[0] == 'for':
            # A loop: iterate over expression result.
            # 语法检查
            if len(words) != 4 or words[2] != 'in':
                self._syntax_error("Don't understand for", token)
            # for 入栈
            ops_stack.append('for')
            # 记录循环体中的局部变量
            self._variable(words[1], self.loop_vars)
            # 生成代码
            code.add_line(
                "for c_%s in %s:" % (
                    words[1],
                    self._expr_code(words[3])
                )
            )
            # 增加下一条语句的缩进级别
            code.indent()
        elif words[0].startswith('end'):
            # Endsomething.  Pop the ops stack.
            # 语法检查
            if len(words) != 1:
                self._syntax_error("Don't understand end", token)
            end_what = words[0][3:]
            # end 语句多了
            if not ops_stack:
                self._syntax_error("Too many ends", token)
            # 对比栈顶元素
            start_what = ops_stack.pop()
            if start_what != end_what:
                self._syntax_error("Mismatched end tag", end_what)
            # 循环体结束，缩进减少缩进级别
            code.dedent()
        else:
            self._syntax_error("Don't understand tag", words[0])
    else:
        # Literal content.  If it isn't empty, output it.
        # 纯文本内容
        if token:
            buffered.append(repr(token))
```

有几点需要注意：

* 使用 `repr` 来给文本加上引号，否则生成的代码会像这样:

```python
extend_result([
  <h1>Hello , to_str(c_upper(c_name)), !</h1>
  ])
```

* 使用 `if token:` 来去掉空字符串，避免生成不必要的空行代码


循环结束后，需要检查 `ops_stack` 是否为空，不为空说明控制语句格式有问题：

```python
if ops_stack:
    self._syntax_error("Unmatched action tag", ops_stack[-1])

flush_output()
```

前面我们通过 `vars_code = code.add_section()` 创建了一个 section，它的作用是将传入的上下文解构为渲染函数的局部变量。

循环完后，我们收集到了所有的变量，现在可以添加这一部分的代码了，以下面的模板为例:

```python
<p>Welcome, {{user_name}}!</p>
<p>Products:</p>
<ul>
{% for product in product_list %}
    <li>{{ product.name }}:
        {{ product.price|format_price }}</li>
{% endfor %}
</ul>
```

这里有三个变量 `user_name` `product_list` `product`。 `all_vars` 集合会包含它们，因为它们被用在表达式和控制语句之中。

但是，最后只有 `user_name` `product_list` 会被解构成局部变量，因为 `product` 是循环体内的局部变量:

```python
for var_name in self.all_vars - self.loop_vars:
    vars_code.add_line("c_%s = context[%r]" % (var_name, var_name))
```

到此，我们代码就都加入到 `result` 中了，最后将他们连接成字符串就大功告成了：

```python
code.add_line("return ''.join(result)")
code.dedent()
```

通过 `get_globals`  我们可以得到所创建的渲染函数，并将它保存到 `_render_function` 上：

```python
self._render_function = code.get_globals()['render_function']
```

### 表达式
现在让我们来仔细的分析下表达式的编译过程。

我们的表达式可以简单到只有一个变量名:

```python
{{user_name}}
```

也可以很复杂：

```python
{{user.name.localized|upper|escape}}
```

这些情况， `_expr_code` 都会进行处理。同其他语言中的表达式一样，我们的表达式是递归构建的：大表达式由更小的表达式组成。一个完整的表达式是由管道分隔的，其中第一个部分是由逗号分开的，等等。所以我们的函数自然是递归的形式:

```python
def _expr_code(self, expr):
    """Generate a Python expression for `expr`."""
```

第一种情形是表达式中有 `|`。
这种情况会以 `|` 做为分隔符进行分隔，并将第一部分传给 `_expr_code` 继续求值。
剩下的每一部分都是一个函数，我们可以迭代求值，即前面函数的结果作为后面函数的输入。同样，这里要收集函数变量名以便后面进行解构。

```python
if "|" in expr:
    pipes = expr.split("|")
    code = self._expr_code(pipes[0])
    for func in pipes[1:]:
        self._variable(func, self.all_vars)
        code = "c_%s(%s)" % (func, code)
```

**我们的渲染函数中的变量都加了c_前缀，下同**

第二种情况是表达式中没有 `|`，但是有 `.`。
则以 `.` 作为分隔符分隔，第一部分传给 `_expr_code` 求值，所得结果作为 `do_dots` 的第一个参数。
剩下的部分都作为 `do_dots` 的不定参数。

```python
elif "." in expr:
    dots = expr.split(".")
    code = self._expr_code(dots[0])
    args = ", ".join(repr(d) for d in dots[1:])
    code = "do_dots(%s, %s)" % (code, args)
```

比如, `x.y.z` 会被解析成函数调用 `do_dots(x, 'y', 'z')`

最后一种情况是什么都不包含。这种比较简单，直接返回带前缀的变量：

```python
else:
    self._variable(expr, self.all_vars)
    code = "c_%s" % expr
return code
```

### 工具函数

* 错误处理

```python
def _syntax_error(self, msg, thing):
    """Raise a syntax error using `msg`, and showing `thing`."""
    raise TempliteSyntaxError("%s: %r" % (msg, thing))
```

* 变量收集

```python
def _variable(self, name, vars_set):
    """Track that `name` is used as a variable.

    Adds the name to `vars_set`, a set of variable names.

    Raises an syntax error if `name` is not a valid name.

    """
    if not re.match(r"[_a-zA-Z][_a-zA-Z0-9]*$", name):
        self._syntax_error("Not a valid name", name)
    vars_set.add(name)
```

### 渲染
前面我们已经将模板编译成了 python 代码，渲染过程就很简单了。我们要做的就是得到上下文，调用编译后的函数：

```python
def render(self, context=None):
    """Render this template by applying it to `context`.

    `context` is a dictionary of values to use in this rendering.

    """
    # Make the complete context we'll use.
    render_context = dict(self.context)
    if context:
        render_context.update(context)
    return self._render_function(render_context, self._do_dots)
```

`render` 函数首先将初始传入的数据和参数进行合并得到最后的上下文数据，最后通过调用 `_render_function` 来得到最后的结果。
最后，再来分析一下 `_do_dots`：

```python
def _do_dots(self, value, *dots):
    """Evaluate dotted expressions at runtime."""
    for dot in dots:
        try:
            value = getattr(value, dot)
        except AttributeError:
            value = value[dot]
        if callable(value):
            value = value()
    return value
```

前面说过，表达式 `x.y.z` 会被编译成 `do_dots(x, 'y', 'z')`。 下面以此为例：
首先，将 y 作为对象 x 的一个属性尝试求值。如果失败，则将其作为一个键求值。最后，如果 y 是可调用的，则进行调用。
然后，以得到的 value 作为对象继续进行后面的相同操作。

# TODO
为了保持代码的精简，我们还有很多功能没有实现：

* 模板继承和包含
* 自定义标签
* 自动转义
* 过滤器参数
* 复杂的控制逻辑如 else 和 elif
* 超过一个循环变量的循环体
* 空格控制
