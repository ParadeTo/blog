/**
 * Created by ayou on 2017/12/27.
 */


function create_shader(id){
  // 用来保存着色器的变量
  var shader;

  // 根据id从HTML中获取指定的script标签
  var scriptElement = document.getElementById(id);

  // 如果指定的script标签不存在，则返回
  if(!scriptElement){return;}

  // 判断script标签的type属性
  switch(scriptElement.type){

    // 顶点着色器的时候
    case 'x-shader/x-vertex':
      shader = gl.createShader(gl.VERTEX_SHADER);
      break;

    // 片段着色器的时候
    case 'x-shader/x-fragment':
      shader = gl.createShader(gl.FRAGMENT_SHADER);
      break;
    default :
      return;
  }

  // 将标签中的代码分配给生成的着色器
  gl.shaderSource(shader, scriptElement.text);

  // 编译着色器
  gl.compileShader(shader);

  // 判断一下着色器是否编译成功
  if(gl.getShaderParameter(shader, gl.COMPILE_STATUS)){

    // 编译成功，则返回着色器
    return shader;
  }else{

    // 编译失败，弹出错误消息
    alert(gl.getShaderInfoLog(shader));
  }
}


function create_program(vs, fs){
  // 程序对象的生成
  var program = gl.createProgram();

  // 向程序对象里分配着色器
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);

  // 将着色器连接
  gl.linkProgram(program);

  // 判断着色器的连接是否成功
  if(gl.getProgramParameter(program, gl.LINK_STATUS)){

    // 成功的话，将程序对象设置为有效
    gl.useProgram(program);

    // 返回程序对象
    return program;
  }else{

    // 如果失败，弹出错误信息
    alert(gl.getProgramInfoLog(program));
  }
}

function create_vbo(data){
  // 生成缓存对象
  var vbo = gl.createBuffer();

  // 绑定缓存
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

  // 向缓存中写入数据
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

  // 将绑定的缓存设为无效
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // 返回生成的VBO
  return vbo;
}


window.onload = function(){
  // canvasエレメントを取得
  var c = document.getElementById('canvas');
  c.width = 500;
  c.height = 300;

  // webglコンテキストを取得
  gl = c.getContext('webgl') || c.getContext('experimental-webgl');

  // canvasを黒でクリア(初期化)する
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // 设定canvas初始化时候的深度
  gl.clearDepth(1.0);

  // canvas的初始化
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var vs = create_shader('vs')
  var fs = create_shader('fs')
  var prg = create_program(vs, fs)

  // attribute vec3 position;
// 从数组中获取attributeLocation
  var attLocation = new Array(2);
  attLocation[0] = gl.getAttribLocation(prg, 'position');
  attLocation[1] = gl.getAttribLocation(prg, 'color');

// 将元素数attribute保存到数组中
  var attStride = new Array(2);
  attStride[0] = 3;
  attStride[1] = 4;

  // 模型（顶点）数据
// 保存顶点的位置情报的数组
  var vertex_position = [
    0.0, 1.0, 0.0,
    1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0
  ];

// 保存顶点的颜色情报的数组
  var vertex_color = [
    1.0, 0.0, 0.0, 1.0,
    0.0, 1.0, 0.0, 1.0,
    0.0, 0.0, 1.0, 1.0
  ];

// 生成VBO
  var position_vbo = create_vbo(vertex_position);
  var color_vbo = create_vbo(vertex_color);


// VBO绑定(位置情报)
  gl.bindBuffer(gl.ARRAY_BUFFER, position_vbo);
  gl.enableVertexAttribArray(attLocation[0]);
  gl.vertexAttribPointer(attLocation[0], attStride[0], gl.FLOAT, false, 0, 0);

// VBO绑定(颜色情报)
  gl.bindBuffer(gl.ARRAY_BUFFER, color_vbo);
  gl.enableVertexAttribArray(attLocation[1]);
  gl.vertexAttribPointer(attLocation[1], attStride[1], gl.FLOAT, false, 0, 0);

  // 使用minMatrix.js对矩阵的相关处理
  // matIV对象生成
  var m = new matIV();

  // 各种矩阵的生成和初始化
  var mMatrix = m.identity(m.create());
  var vMatrix = m.identity(m.create());
  var pMatrix = m.identity(m.create());
  var mvpMatrix = m.identity(m.create());

  // 视图变换坐标矩阵
  m.lookAt([0.0, 1.0, 3.0], [0, 0, 0], [0, 1, 0], vMatrix);

  // 投影坐标变换矩阵
  m.perspective(90, c.width / c.height, 0.1, 100, pMatrix);

  // 各矩阵想成，得到最终的坐标变换矩阵
  m.multiply(pMatrix, vMatrix, mvpMatrix);
  m.multiply(mvpMatrix, mMatrix, mvpMatrix);

  // uniformLocation的获取
  var uniLocation = gl.getUniformLocation(prg, 'mvpMatrix');

  // 向uniformLocation中传入坐标变换矩阵
  gl.uniformMatrix4fv(uniLocation, false, mvpMatrix);

  // 绘制模型
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // context的刷新
  gl.flush();
};