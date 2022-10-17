---
title: WebGL 编程指南
date: 2022-10-03 21:37:30
tags:
  - webgl
categories:
  - webgl
description: WebGL 编程指南笔记
---

# 第二章 WebGL 入门

```js
// HelloPoint1.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE =
  'void main() {\n' +
  '  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);\n' + // Set the vertex coordinates of the point
  '  gl_PointSize = 10.0;\n' + // Set the point size
  '}\n'

// Fragment shader program
var FSHADER_SOURCE =
  'void main() {\n' +
  '  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n' + // Set the point color
  '}\n'

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl')

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas)
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL')
    return
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.')
    return
  }

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0)

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT)

  // Draw a point
  // 0 表示从哪个点开始绘制
  // 1 表示绘制几次
  gl.drawArrays(gl.POINTS, 0, 1)
}
```

_attribute_ 变量：传输与顶点相关的数据

_uniform_ 变量：所有顶点都能用到的变量

```js
// HelloPint2.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' + // attribute variable
  'void main() {\n' +
  '  gl_Position = a_Position;\n' +
  '  gl_PointSize = 10.0;\n' +
  '}\n'

// Fragment shader program
var FSHADER_SOURCE =
  'void main() {\n' + '  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n' + '}\n'

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl')

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas)
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL')
    return
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.')
    return
  }

  // Get the storage location of a_Position
  // 得到 GL 程序中的 attribute 变量的地址
  var a_Position = gl.getAttribLocation(gl.program, 'a_Position')
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position')
    return
  }

  // Pass vertex position to attribute variable
  // 1 传递 float 4 维数据
  gl.vertexAttrib4f(a_Position, 0.0, 0.0, 0.0, 1)

  // 2
  // 也可以传递 3 维数据
  // 这样第 4 维就是 1
  gl.vertexAttrib3f(a_Position, 0.0, 0.0, 0.0)

  // 3
  var position = new Fload32Array([0.0, 0.0, 0.0, 1])
  gl.vertexAttrib4fv(a_Position, position)

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0)

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT)

  // Draw
  gl.drawArrays(gl.POINTS, 0, 1)
}
```

`ClickedPoints` 的例子改成下面这样就只剩一个点了，原因在于绘制缓存区中的数据每次绘制完后会被重置。

```js
function click(ev, gl, canvas, a_Position) {
  var x = ev.clientX // x coordinate of a mouse pointer
  var y = ev.clientY // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect()

  x = (x - rect.left - canvas.width / 2) / (canvas.width / 2)
  y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2)
  gl.vertexAttrib3f(a_Position, x, y, 0.0)
  gl.drawArrays(gl.POINTS, 0, 1)
}
```

# 第三章 绘制和变换三角形

理解缓冲区对象，他的作用是可以传递多个数据。

```js
// MultiPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'void main() {\n' +
  '  gl_Position = a_Position;\n' +
  '  gl_PointSize = 10.0;\n' +
  '}\n'

// Fragment shader program
var FSHADER_SOURCE =
  'void main() {\n' + '  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n' + '}\n'

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl')

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas)
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL')
    return
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.')
    return
  }

  // Write the positions of vertices to a vertex shader
  var n = initVertexBuffers(gl)
  if (n < 0) {
    console.log('Failed to set the positions of the vertices')
    return
  }

  // Specify the color for clearing <canvas>
  gl.clearColor(0, 0, 0, 1)

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT)

  // Draw three points
  gl.drawArrays(gl.POINTS, 0, n)
}

function initVertexBuffers(gl) {
  // 需要三个点，但是只传了 6 个数，会自动设置默认值
  /**
   * 0.0 0.5 0.0 1.0
   * -0.5 -0.5 0.0 1.0
   * 0.5 -0.5 0.01 1.0
   * */
  var vertices = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5])
  var n = 3 // The number of vertices

  // Create a buffer object
  var vertexBuffer = gl.createBuffer()
  if (!vertexBuffer) {
    console.log('Failed to create the buffer object')
    return -1
  }

  // Bind the buffer object to target
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  // Write date into the buffer object
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

  var a_Position = gl.getAttribLocation(gl.program, 'a_Position')
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position')
    return -1
  }
  // Assign the buffer object to a_Position variable
  // 2 表示是 2 维数据
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0)

  // Enable the assignment to a_Position variable
  gl.enableVertexAttribArray(a_Position)

  return n
}
```

![](./webgl-programming-guide/1.png)

```js
var vertexBuffer = gl.createBuffer()
```

![](./webgl-programming-guide/2.png)

```js
// Bind the buffer object to target
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
```

![](./webgl-programming-guide/3.png)
![](./webgl-programming-guide/4.png)

```js
// Write date into the buffer object
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
```

![](./webgl-programming-guide/5.png)

![](./webgl-programming-guide/6.png)

```js
gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0)
```

![](./webgl-programming-guide/7.png)

所以也可以改成 `1`：

```js
gl.vertexAttribPointer(a_Position, 1, gl.FLOAT, false, 0, 0)
```

这样 y，z，w 都是默认值。

![](./webgl-programming-guide/8.png)

```js
// Enable the assignment to a_Position variable
gl.enableVertexAttribArray(a_Position)
```

![](./webgl-programming-guide/9.png)
![](./webgl-programming-guide/10.png)

```js
// Draw three points
gl.drawArrays(gl.POINTS, 0, 4)
```

![](./webgl-programming-guide/11.png)

```js
gl.drawArrays(gl.LINES, 0, 4)
```

![](./webgl-programming-guide/12.png)

```js
gl.drawArrays(gl.LINE_STRIP, 0, n)
```

![](./webgl-programming-guide/13.png)

```js
gl.drawArrays(gl.LINE_LOOP, 0, 4)
```

![](./webgl-programming-guide/14.png)

```js
gl.drawArrays(gl.LINE_LOOP, 0, 3)
```

![](./webgl-programming-guide/15.png)

```js
var vertices = new Float32Array([
  0, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0, 0.5, 0.2, 0.6, 0.4,
])
gl.drawArrays(gl.TRIANGLES, 0, 6)
```

![](./webgl-programming-guide/16.png)

```js
var vertices = new Float32Array([
  0, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0, 0.5, 0.2, 0.6, 0.4,
])
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6)
```

![](./webgl-programming-guide/17.png)

```js
var vertices = new Float32Array([-0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5])
gl.drawArrays(gl.TRIANGLE_STRIP, 0, n)
```

![](./webgl-programming-guide/19.png)

```js
var vertices = new Float32Array([
  0, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0, 0.5, 0.2, 0.6, 0.4,
])
gl.drawArrays(gl.TRIANGLE_FAN, 0, 6)
```

![](./webgl-programming-guide/18.png)

_仿射变换_

列主序

```js
// eslint-disable-next-line
var xformMatrix = new Float32Array([
  // eslint-disable-next-line
  cosB,
  sinB,
  0.0,
  0.0,
  // eslint-disable-next-line
  -sinB,
  cosB,
  0.0,
  0.0,
  // eslint-disable-next-line
  0.0,
  0.0,
  1.0,
  0.0,
  // eslint-disable-next-line
  0.0,
  0.0,
  0.0,
  1.0,
])
gl.uniformMatrix4fv(u_xformMatrix, false, xformMatrix)
```

传过去的是一位数组，按列的顺序来赋值。

# 第四章 高级变换和动画

```js
const modelMatrix = new Matrix4()
modelMatrix.setRotate(ANGLE, 0, 0, 1) // 设置旋转矩阵
modelMatrix.translate(Tx, 0, 0), // 研 X 轴平移 Tx
```

最后得到的是 `<旋转矩阵>*<平移矩阵>`

# 第五章 颜色与纹理

一个缓冲区缓和存储顶点坐标和尺寸数据

```js
var verticesSizes = new Float32Array([
  // Coordinate and size of points
  0.0,
  0.5,
  10.0, // the 1st point
  -0.5,
  -0.5,
  20.0, // the 2nd point
  0.5,
  -0.5,
  30.0, // the 3rd point
])

gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE * 3, 0)
gl.enableVertexAttribArray(a_Position) // Enable the assignment of the buffer object
gl.vertexAttribPointer(a_PointSize, 1, gl.FLOAT, false, FSIZE * 3, FSIZE * 2)
gl.enableVertexAttribArray(a_PointSize) // Enable buffer allocation
```

![](./webgl-programming-guide/20.png)
![](./webgl-programming-guide/21.png)
![](./webgl-programming-guide/22.png)

_varing 变量_

```js
// MultiAttributeColor.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'varying vec4 v_Color;\n' + // varying variable
  'void main() {\n' +
  '  gl_Position = a_Position;\n' +
  '  gl_PointSize = 10.0;\n' +
  '  v_Color = a_Color;\n' + // Pass the data to the fragment shader
  '}\n'

// Fragment shader program
var FSHADER_SOURCE =
  // '#ifdef GL_ES\n' +
  'precision mediump float;\n' + // Precision qualifier (See Chapter 6)
  // '#endif GL_ES\n' +
  'varying vec4 v_Color;\n' + // Receive the data from the vertex shader
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n'

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl')

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas)
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL')
    return
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.')
    return
  }

  //
  var n = initVertexBuffers(gl)
  if (n < 0) {
    console.log('Failed to set the vertex information')
    return
  }

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0)

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT)

  // Draw three points
  gl.drawArrays(gl.POINTS, 0, n)
}

function initVertexBuffers(gl) {
  var verticesColors = new Float32Array([
    // Vertex coordinates and color
    0.0, 0.5, 1.0, 0.0, 0.0, -0.5, -0.5, 0.0, 1.0, 0.0, 0.5, -0.5, 0.0, 0.0, 1.0,
  ])
  var n = 3 // The number of vertices

  // Create a buffer object
  var vertexColorBuffer = gl.createBuffer()
  if (!vertexColorBuffer) {
    console.log('Failed to create the buffer object')
    return false
  }

  // Write the vertex coordinates and colors to the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, verticesColors, gl.STATIC_DRAW)

  var FSIZE = verticesColors.BYTES_PER_ELEMENT
  //Get the storage location of a_Position, assign and enable buffer
  var a_Position = gl.getAttribLocation(gl.program, 'a_Position')
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position')
    return -1
  }
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE * 5, 0)
  gl.enableVertexAttribArray(a_Position) // Enable the assignment of the buffer object

  // Get the storage location of a_Position, assign buffer and enable
  var a_Color = gl.getAttribLocation(gl.program, 'a_Color')
  if (a_Color < 0) {
    console.log('Failed to get the storage location of a_Color')
    return -1
  }
  gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE * 5, FSIZE * 2)
  gl.enableVertexAttribArray(a_Color) // Enable the assignment of the buffer object

  return n
}
```

![](./webgl-programming-guide/23.png)

_流程_
![](./webgl-programming-guide/24.png)
![](./webgl-programming-guide/25.png)
![](./webgl-programming-guide/26.png)

_纹理_

```js
// TexturedQuad.js (c) 2012 matsuda and kanda
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec2 a_TexCoord;\n' +
  'varying vec2 v_TexCoord;\n' +
  'void main() {\n' +
  '  gl_Position = a_Position;\n' +
  '  v_TexCoord = a_TexCoord;\n' +
  '}\n'

// Fragment shader program
var FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +
  'uniform sampler2D u_Sampler;\n' +
  'varying vec2 v_TexCoord;\n' +
  'void main() {\n' +
  '  gl_FragColor = texture2D(u_Sampler, v_TexCoord);\n' +
  '}\n'

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl')

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas)
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL')
    return
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.')
    return
  }

  // Set the vertex information
  var n = initVertexBuffers(gl)
  if (n < 0) {
    console.log('Failed to set the vertex information')
    return
  }

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0)

  // Set texture
  if (!initTextures(gl, n)) {
    console.log('Failed to intialize the texture.')
    return
  }
}

function initVertexBuffers(gl) {
  var verticesTexCoords = new Float32Array([
    // Vertex coordinates, texture coordinate
    -0.5, 0.5, -0.3, 1.7, -0.5, -0.5, -0.3, -0.2, 0.5, 0.5, 1.7, 11.7, 0.5, -0.5,
    1.7, -0.2,
  ])
  var n = 4 // The number of vertices

  // Create the buffer object
  var vertexTexCoordBuffer = gl.createBuffer()
  if (!vertexTexCoordBuffer) {
    console.log('Failed to create the buffer object')
    return -1
  }

  // Bind the buffer object to target
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexTexCoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, verticesTexCoords, gl.STATIC_DRAW)

  var FSIZE = verticesTexCoords.BYTES_PER_ELEMENT
  //Get the storage location of a_Position, assign and enable buffer
  var a_Position = gl.getAttribLocation(gl.program, 'a_Position')
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position')
    return -1
  }
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE * 4, 0)
  gl.enableVertexAttribArray(a_Position) // Enable the assignment of the buffer object

  // Get the storage location of a_TexCoord
  var a_TexCoord = gl.getAttribLocation(gl.program, 'a_TexCoord')
  if (a_TexCoord < 0) {
    console.log('Failed to get the storage location of a_TexCoord')
    return -1
  }
  // Assign the buffer object to a_TexCoord variable
  gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, FSIZE * 4, FSIZE * 2)
  gl.enableVertexAttribArray(a_TexCoord) // Enable the assignment of the buffer object

  return n
}

function initTextures(gl, n) {
  var texture = gl.createTexture() // Create a texture object
  if (!texture) {
    console.log('Failed to create the texture object')
    return false
  }

  // Get the storage location of u_Sampler
  var u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler')
  if (!u_Sampler) {
    console.log('Failed to get the storage location of u_Sampler')
    return false
  }
  var image = new Image() // Create the image object
  if (!image) {
    console.log('Failed to create the image object')
    return false
  }
  // Register the event handler to be called on loading an image
  image.onload = function () {
    loadTexture(gl, n, texture, u_Sampler, image)
  }
  // Tell the browser to load an image
  image.src =
    'data:image/jpeg;base64,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/////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAA4QklNBAgAAAAAABAAAAABAAACQAAAAkAAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADTQAAAAYAAAAAAAAAAAAAAQAAAAEAAAAADABDAEEAMwBHADAAMwA1ADIAMAAwADAAMQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAQAAAAAAAG51bGwAAAACAAAABmJvdW5kc09iamMAAAABAAAAAAAAUmN0MQAAAAQAAAAAVG9wIGxvbmcAAAAAAAAAAExlZnRsb25nAAAAAAAAAABCdG9tbG9uZwAAAQAAAAAAUmdodGxvbmcAAAEAAAAABnNsaWNlc1ZsTHMAAAABT2JqYwAAAAEAAAAAAAVzbGljZQAAABIAAAAHc2xpY2VJRGxvbmcAAAAAAAAAB2dyb3VwSURsb25nAAAAAAAAAAZvcmlnaW5lbnVtAAAADEVTbGljZU9yaWdpbgAAAA1hdXRvR2VuZXJhdGVkAAAAAFR5cGVlbnVtAAAACkVTbGljZVR5cGUAAAAASW1nIAAAAAZib3VuZHNPYmpjAAAAAQAAAAAAAFJjdDEAAAAEAAAAAFRvcCBsb25nAAAAAAAAAABMZWZ0bG9uZwAAAAAAAAAAQnRvbWxvbmcAAAEAAAAAAFJnaHRsb25nAAABAAAAAAN1cmxURVhUAAAAAQAAAAAAAG51bGxURVhUAAAAAQAAAAAAAE1zZ2VURVhUAAAAAQAAAAAABmFsdFRhZ1RFWFQAAAABAAAAAAAOY2VsbFRleHRJc0hUTUxib29sAQAAAAhjZWxsVGV4dFRFWFQAAAABAAAAAAAJaG9yekFsaWduZW51bQAAAA9FU2xpY2VIb3J6QWxpZ24AAAAHZGVmYXVsdAAAAAl2ZXJ0QWxpZ25lbnVtAAAAD0VTbGljZVZlcnRBbGlnbgAAAAdkZWZhdWx0AAAAC2JnQ29sb3JUeXBlZW51bQAAABFFU2xpY2VCR0Nv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UABoAG8AdABvAHMAaABvAHAAAAATAEEAZABvAGIAZQAgAFAAaABvAHQAbwBzAGgAbwBwACAAQwBTADQAAAABADhCSU0EBgAAAAAABwAEAAAAAQEA/+EUTmh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNC4yLjItYzA2MyA1My4zNTI2MjQsIDIwMDgvMDcvMzAtMTg6MTI6MTggICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIiB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHRpZmY6T3JpZW50YXRpb249IjEiIHRpZmY6WUNiQ3JQb3NpdGlvbmluZz0iMSIgdGlmZjpYUmVzb2x1dGlvbj0iNzIwMDAwLzEwMDAwIiB0aWZmOllSZXNvbHV0aW9uPSI3MjAwMDAvMTAwMDAiIHRpZmY6UmVzb2x1dGlvblVuaXQ9IjIiIHRpZmY6TWFrZT0iS0RESS1DQSIgdGlmZjpNb2RlbD0iQ0EwMDQiIHRpZmY6TmF0aXZlRGlnZXN0PSIyNTYsMjU3LDI1OCwyNTksMjYyLDI3NCwyNzcsMjg0LDUzMCw1MzEsMjgyLDI4MywyOTYsMzAxLDMxOCwzMTksNTI5LDUzMiwzMDYsMjcwLDI3MSwyNzIsMzA1LDMxNSwzMzQzMjs0QzY4RDMyMEMxM0Y2QTAyNUZEOEYyODJDNUMwMkQwOSIgZXhpZjpFeGlmVmVyc2lvbj0iMDIyMCIgZXhpZjpGbGFzaHBpeFZlcnNpb249IjAxMDAiIGV4aWY6Q29sb3JTcGFjZT0iMSIgZXhpZjpQaXhlbFhEaW1lbnNpb249IjI1NiIgZXhpZjpQaXhlbFlEaW1lbnNpb249IjI1NiIgZXhpZjpEYXRlVGltZU9yaWdpbmFsPSIyMDExLTA4LTEzVDExOjA0OjUzKzA5OjAwIiBleGlmOkRhdGVUaW1lRGlnaXRpemVkPSIyMDExLTA4LTEzVDExOjA0OjUzKzA5OjAwIiBleGlmOkV4cG9zdXJlVGltZT0iNDEvMjAwMDAiIGV4aWY6RXhwb3N1cmVCaWFzVmFsdWU9IjAvMTAiIGV4aWY6Q3VzdG9tUmVuZGVyZWQ9IjAiIGV4aWY6RXhwb3N1cmVNb2RlPSIwIiBleGlmOldoaXRlQmFsYW5jZT0iMCIgZXhpZjpEaWdpdGFsWm9vbVJhdGlvPSIzMjY0LzMyNjQiIGV4aWY6U2NlbmVDYXB0dXJlVHlwZT0iMCIgZXhpZjpHYWluQ29udHJvbD0iMCIgZXhpZjpTYXR1cmF0aW9uPSIwIiBleGlmOlN1YmplY3REaXN0YW5jZVJhbmdlPSIwIiBleGlmOk5hdGl2ZURpZ2VzdD0iMzY4NjQsNDA5NjAsNDA5NjEsMzcxMjEsMzcxMjIsNDA5NjIsNDA5NjMsMzc1MTAsNDA5NjQsMzY4NjcsMzY4NjgsMzM0MzQsMzM0MzcsMzQ4NTAsMzQ4NTIsMzQ4NTUsMzQ4NTYsMzczNzcsMzczNzgsMzczNzksMzczODAsMzczODEsMzczODIsMzczODMsMzczODQsMzczODUsMzczODYsMzczOTYsNDE0ODMsNDE0ODQsNDE0ODYsNDE0ODcsNDE0ODgsNDE0OTIsNDE0OTMsNDE0OTUsNDE3MjgsNDE3MjksNDE3MzAsNDE5ODUsNDE5ODYsNDE5ODcsNDE5ODgsNDE5ODksNDE5OTAsNDE5OTEsNDE5OTIsNDE5OTMsNDE5OTQsNDE5OTUsNDE5OTYsNDIwMTYsMCwyLDQsNSw2LDcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4LDIwLDIyLDIzLDI0LDI1LDI2LDI3LDI4LDMwOzUxRjBCN0I3MjIxMEE0M0I3QjY4MTMzMDU3QTM5RDQ1IiB4bXA6Q3JlYXRlRGF0ZT0iMjAxMS0wOC0xM1QxMTowNDo1MyswOTowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTItMDItMTNUMTU6MDQ6MzkrMDk6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTItMDItMTNUMTU6MDQ6MzkrMDk6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvanBlZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9InNSR0IgSUVDNjE5NjYtMi4xIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkIxNzRDNjVFRDc1M0UxMTFBMjFEOThBOEEyODJFNUZCIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkIwNzRDNjVFRDc1M0UxMTFBMjFEOThBOEEyODJFNUZCIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6QjA3NEM2NUVENzUzRTExMUEyMUQ5OEE4QTI4MkU1RkIiPiA8ZXhpZjpDb21wb25lbnRzQ29uZmlndXJhdGlvbj4gPHJkZjpTZXE+IDxyZGY6bGk+MTwvcmRmOmxpPiA8cmRmOmxpPjI8L3JkZjpsaT4gPHJkZjpsaT4zPC9yZGY6bGk+IDxyZGY6bGk+MDwvcmRmOmxpPiA8L3JkZjpTZXE+IDwvZXhpZjpDb21wb25lbnRzQ29uZmlndXJhdGlvbj4gPGV4aWY6Rmxhc2ggZXhpZjpGaXJlZD0iRmFsc2UiIGV4aWY6UmV0dXJuPSIwIiBleGlmOk1vZGU9IjAiIGV4aWY6RnVuY3Rpb249IlRydWUiIGV4aWY6UmVkRXllTW9kZT0iRmFsc2UiLz4gPGRjOmRlc2NyaXB0aW9uPiA8cmRmOkFsdD4gPHJkZjpsaSB4bWw6bGFuZz0ieC1kZWZhdWx0Ij5DQTNHMDM1MjwvcmRmOmxpPiA8L3JkZjpBbHQ+IDwvZGM6ZGVzY3JpcHRpb24+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNyZWF0ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6QjA3NEM2NUVENzUzRTExMUEyMUQ5OEE4QTI4MkU1RkIiIHN0RXZ0OndoZW49IjIwMTItMDItMTNUMTU6MDQ6MzkrMDk6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDUzQgV2luZG93cyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6QjE3NEM2NUVENzUzRTExMUEyMUQ5OEE4QTI4MkU1RkIiIHN0RXZ0OndoZW49IjIwMTItMDItMTNUMTU6MDQ6MzkrMDk6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDUzQgV2luZG93cyIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPD94cGFja2V0IGVuZD0idyI/Pv/iDFhJQ0NfUFJPRklMRQABAQAADEhMaW5vAhAAAG1udHJSR0IgWFlaIAfOAAIACQAGADEAAGFjc3BNU0ZUAAAAAElFQyBzUkdCAAAAAAAAAAAAAAAAAAD21gABAAAAANMtSFAgIAAAAAAAAAAAAAAAAAAA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'

  return true
}

function loadTexture(gl, n, texture, u_Sampler, image) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1) // Flip the image's y axis
  // Enable texture unit0
  gl.activeTexture(gl.TEXTURE0)
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture)

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT)
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)

  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler, 0)

  gl.clear(gl.COLOR_BUFFER_BIT) // Clear <canvas>

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, n) // Draw the rectangle
}
```

# 第七章 三维世界

在什么地方，视点

朝哪看，视线

视野有多宽

能看多远

_投影矩阵公式推导_
https://zhuanlan.zhihu.com/p/554093703

near 和 far 是离视点的距离，不是坐标！
