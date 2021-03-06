"use strict";



var canvas;
var gl;
var buffers;                        // vertex buffers
var model;                          // object model

var lastAnimationTime = Date.now(); // last time tick() was called
var angleStep = 10;                 // increments of rotation angle (degrees)
var fps = 30;                       // frames per second
var currentAngle = 0.0;             // current rotation angle [degree]

var objName = 'https://raw.githubusercontent.com/cs411iit/public/master/mycube.obj'; 
var objName = 'https://raw.githubusercontent.com/cs411iit/public/master/cow.obj';  

var camZ = 0;
var invertNorm = true;
var curRot = new Matrix4();
var leftRot = new Matrix4();
var rightRot = new Matrix4();
var upRot = new Matrix4();
var downRot = new Matrix4();
var tmpRot = new Matrix4();
var centermassMatrix = new Matrix4();

// vertex shader program
var VSHADER_SOURCE = 
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'attribute vec4 a_Normal;\n' +
  'uniform mat4 u_MvpMatrix;\n' +
  'uniform mat4 u_NormalMatrix;\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  vec3 lightDirection = vec3(-0.35, 0.35, 0.87);\n' +
  '  gl_Position = u_MvpMatrix * a_Position;\n' +
  '  vec3 normal = normalize(vec3(u_NormalMatrix * a_Normal));\n' +
  '  float nDotL = max(dot(normal, lightDirection), 0.0);\n' +
  '  v_Color = vec4(a_Color.rgb * nDotL, a_Color.a);\n' +
  '}\n';

// fragment shader program
var FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n';


// event handlers

function turnLeft()
{
  tmpRot.set(leftRot);
  tmpRot.multiply(curRot);
  curRot.set(tmpRot);    
  
}

function turnRight()
{
  tmpRot.set(rightRot);
  tmpRot.multiply(curRot);
  curRot.set(tmpRot);    
}

function turnUp()
{
  tmpRot.set(upRot);
  tmpRot.multiply(curRot);
  curRot.set(tmpRot);    
}

function turnDown()
{
  tmpRot.set(downRot);
  tmpRot.multiply(curRot);
  curRot.set(tmpRot);    
}

function zoomIn()
{
  camZ+=1;
}

function zoomOut()
{
  camZ-=1;
  if (camZ<0) camZ=0;
}

function invertNormals()
{
  invertNorm = !invertNorm;
  readOBJFile(objName, gl, model, 60, invertNorm)
    .then(() => {
      initializeModel();
      drawScene(gl, gl.program, undefined, buffers, model)
    })
    .catch(console.error);

}


// create a buffer object, assign it to attribute variable, and enable the assignment
function createEmptyArrayBuffer(gl, a_attribute, num, type) 
{
  var buffer =  gl.createBuffer();  // Create a buffer object
  if (!buffer) {
    console.log('Failed to create the buffer object');
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);  // Assign the buffer object to the attribute variable
  gl.enableVertexAttribArray(a_attribute);  // Enable the assignment

  return buffer;
}


function initVertexBuffers(gl, program) 
{
  var o = new Object(); // create new object. Utilize Object object to return multiple buffer objects
  o.vertexBuffer = createEmptyArrayBuffer(gl, program.a_Position, 3, gl.FLOAT); 
  o.normalBuffer = createEmptyArrayBuffer(gl, program.a_Normal, 3, gl.FLOAT);
  o.colorBuffer = createEmptyArrayBuffer(gl, program.a_Color, 4, gl.FLOAT);
  o.indexBuffer = gl.createBuffer();
  if (!o.vertexBuffer || !o.normalBuffer || !o.colorBuffer || !o.indexBuffer) { return null; }

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return o;
}


function assignVertexBuffersData(gl, buffers, model) 
{
  // write date into the buffer objects
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, model.arrays.vertices, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, model.arrays.normals, gl.STATIC_DRAW);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, model.arrays.colors, gl.STATIC_DRAW);
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.arrays.indices, gl.STATIC_DRAW);
}


function getShaderVariables(program)
{
  //get the storage locations of attribute and uniform variables
  program.a_Position = gl.getAttribLocation(program, 'a_Position');
  program.a_Normal = gl.getAttribLocation(program, 'a_Normal');
  program.a_Color = gl.getAttribLocation(program, 'a_Color');
  program.u_MvpMatrix = gl.getUniformLocation(program, 'u_MvpMatrix');
  program.u_NormalMatrix = gl.getUniformLocation(program, 'u_NormalMatrix');

  if (program.a_Position < 0 ||  program.a_Normal < 0 || program.a_Color < 0 ||
      !program.u_MvpMatrix || !program.u_NormalMatrix) {
    console.log('attribute, uniform'); 
    return false;
  }
  return true;
}


function printModelInfo(model) 
{
  console.log("number of vertices=%d",model.arrays.vertices.length/3);
  console.log("number of normals=%d",model.arrays.normals.length/3);
  console.log("number of colors=%d",model.arrays.colors.length/4);
  console.log("nummer of faces=%d",model.arrays.indices.length/3);

  for(var i=0;i<10 && i< model.arrays.vertices.length; i++){
    console.log("v[%d]=(%f,%f,%f)",i,
      model.arrays.vertices[i*3+0],
      model.arrays.vertices[i*3+1],
      model.arrays.vertices[i*3+2]);
  }
  for(var i=0;i<10 && i< model.arrays.vertices.length; i++){
    console.log("n[%d]=(%f,%f,%f)",i,
      model.arrays.normals[i*3+0],
      model.arrays.normals[i*3+1],
      model.arrays.normals[i*3+2]);
  }
  for(var i=0;i<10 && i< model.arrays.indices.length; i++){
    console.log("f[%d]=(%d,%d,%d)",i,
      model.arrays.indices[i*3+0],
      model.arrays.indices[i*3+1],
      model.arrays.indices[i*3+2]);
  }
}

//////////////////////////////////////////////////////////////////////////////////////////
// Fix the vertex and face array
//////////////////////////////////////////////////////////////////////////////////////////
function fixVertexAndFaceArray(model){
  // Fix vertex array
  var vertexTable = model.objDoc.vertices;
  var vertexNum = vertexTable.length;
  var vertexArray = [];
  for (var i=0; i<vertexTable.length; i++){
    vertexArray.push(vertexTable[i].x, vertexTable[i].y, vertexTable[i].z);
  }
  model.arrays.vertices = new Float32Array(vertexArray);

  // Fix face array
  var faceTable = model.objDoc.objects[0].faces;
  var faceArray = [];
  for (var i=0; i<faceTable.length;i++){
    faceArray.push(faceTable[i].vIndices[0], faceTable[i].vIndices[1], faceTable[i].vIndices[2]);
  } 
  model.arrays.indices = new Uint16Array(faceArray);

  // Fix normal array
  // Just keep the model.arrays.normals and model.arrays.vertices the same length
  // Need to compute vertex normal again in 2.4. 
  // It seems that there is an outlier vertex in cow.obj, not belonging to any faces. 
  model.arrays.normals = model.arrays.normals.slice(0, vertexArray.length)

  // Fix color array [optional]
  model.arrays.colors = model.arrays.colors.slice(0, vertexArray.length/3*4)

}

function initializeModel() 
{
//check for new model arrays
  if (!model.arrays) {
    if(isOBJFileLoaded(model)) {
      extractOBJFileArrays(model);
    }
    
    if(!model.arrays) {
      console.error("cannot draw model", model);
      return;
    }
  }

  //initialize the normals  at zero
  model.objDoc.normals = model.objDoc.vertices.map(init => ({x: 0, y: 0, z: 0}));
  // then add face normals for each set of vertices
  model.objDoc.objects[0].faces.forEach(f => 
    f.vIndices.forEach(vert => {
      model.objDoc.normals[vert].x += f.normal.x;
      model.objDoc.normals[vert].y += f.normal.y;
      model.objDoc.normals[vert].z += f.normal.z;
    })
  );

  //normalize the vertex normals
  model.objDoc.normals = model.objDoc.normals.map(norm => {
    const c = Math.sqrt(Math.pow(norm.x, 2) + Math.pow(norm.y, 2) + Math.pow(norm.z, 2));
    return { x: norm.x / c, 
             y: norm.y / c,
             z: norm.z / c
            };
  });

  let newarray = [];
  
  model.objDoc.objects[0].faces.forEach(f =>
    f.vIndices.forEach(vertindices => {
      const norm = model.objDoc.normals[vertindices];
      newarray.push(norm.x, norm.y, norm.z);
    })
  );
  model.arrays.normals = new Float32Array(newarray);

  const maximum = model.arrays.vertices.reduce(
    (maximum, b) => Math.max(maximum, Math.abs(b)), 0);
  model.arrays.vertices = model.arrays.vertices.map((vertex, index) => vertex / maximum);

  //Use a bounding box for normalization
  let centermass = [ 0, 0, 0];
  model.arrays.vertices.forEach((con, index) => centermass[index % 3] += con);
  
  centermass = centermass.map(con => - con / model.arrays.vertices.length);
  console.log({centermass});

  centermassMatrix.setTranslate(centermass[0], centermass[1], centermass[2]);
  assignVertexBuffersData( gl, buffers, model);

}

function initScene()
{
  // set the clear color and enable the depth test
  gl.clearColor(0.2, 0.2, 0.2, 1.0);
  gl.enable(gl.DEPTH_TEST);

  // select the viewport
  gl.viewportWidth = canvas.width;
  gl.viewportHeight = canvas.height;
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
 
  // set the projection matrix
  pMatrix.setPerspective(30.0, canvas.width/canvas.height, 1.0, 5000.0);

  // set the modelview matrix
  mvMatrix.setIdentity(); // erase all prior transformations
  mvMatrix.lookAt(20, 0, 0,   0.0, 0.0, 0.0,   0.0, 1.0, 0.0);

  // start reading the OBJ file
  model = new Object();
  var scale=60; // 1
  readOBJFile(objName, gl, model, scale, true)
  .then(() => {
    initializeModel();
  }).catch(console.error);
  

  // init rotation matrices
  curRot.setIdentity(); 
  leftRot.setRotate ( 5, 0,1,0);
  rightRot.setRotate(-5, 0,1,0);
  upRot.setRotate   (-5, 1,0,0);
  downRot.setRotate ( 5, 1,0,0);

}


function drawScene(gl, program, angle, buffers, model) 
{
  //already got model arrays in initialization
  
  if (!model.arrays) return;   // double check if model failed
    

  // clear canvas
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  // Clear color and depth buffers

  // perform modeling transformations (rotate)
  mvPushMatrix();
  
  mvMatrix.multiply(centermassMatrix);
  //do rotation about object
  mvMatrix.translate(camZ, 0, 0);
  mvMatrix.multiply(curRot);

  // set the normal matrix
  nMatrix.setInverseOf(mvMatrix);
  nMatrix.transpose();
  gl.uniformMatrix4fv(program.u_NormalMatrix, false, nMatrix.elements);

  // compute the combined transformation matrix
  mvpMatrix.set(pMatrix); 
  mvpMatrix.multiply(mvMatrix);
  gl.uniformMatrix4fv(program.u_MvpMatrix, false, mvpMatrix.elements);
  mvPopMatrix();

  // draw
  gl.drawElements(gl.TRIANGLES, model.arrays.indices.length, gl.UNSIGNED_SHORT, 0);

}


function animate(angle) 
{
  var now = Date.now(); 
  var elapsed = now - lastAnimationTime;
  if(elapsed < 1000/fps) return angle;
  lastAnimationTime = now;
  // update the current rotation angle (adjusted by elapsed time)
  var newAngle = angle + (angleStep * elapsed) / 1000.0;
  return newAngle % 360;
}


function tick() 
{
  currentAngle = animate(currentAngle); // update current rotation angles
  drawScene(gl, gl.program, currentAngle, buffers, model);
  requestAnimationFrame(tick, canvas);
}


function main() 
{
  // retrieve the <canvas> element
  canvas = document.getElementById('webgl');

  // get rendering context for WebGL
  gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // get storage locations of attribute and uniform variables
  var program = gl.program;
  if(!getShaderVariables(program)){
    console.log('error locating shader variables');
    return; 
  }

  // prepare empty buffer objects 
  buffers = initVertexBuffers(gl, program);
  if (!buffers) {
    console.log('Failed to set the vertex information');
    return;
  }


  // set button event listeners
  var turnLeftBtn = document.getElementById('turnLeftBtn');
  turnLeftBtn.addEventListener('click', turnLeft);

  var turnRightBtn = document.getElementById('turnRightBtn');
  turnRightBtn.addEventListener('click', turnRight);

  var turnUpBtn = document.getElementById('turnUpBtn');
  turnUpBtn.addEventListener('click', turnUp);

  var turnDownBtn = document.getElementById('turnDownBtn');
  turnDownBtn.addEventListener('click', turnDown);

  var zoomInBtn = document.getElementById('zoomInBtn');
  zoomInBtn.addEventListener('click', zoomIn);

  var zoomOutBtn = document.getElementById('zoomOutBtn');
  zoomOutBtn.addEventListener('click', zoomOut);

  var invertNormalsBtn = document.getElementById('invertNormalsBtn');
  invertNormalsBtn.addEventListener('click', invertNormals);

  // initialize the scene and start animation
  initScene();
  tick();
}


// EOF


