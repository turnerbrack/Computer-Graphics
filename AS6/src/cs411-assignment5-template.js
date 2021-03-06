"use strict";

////////////////////////////////////////////////////////////////////////////////////////
//
// cs411 assignment 5 - surface rendering
//
/////////////////////////////////////////////////////////////////////////////////////////

var canvas;
var gl;
var buffers;                        // vertex buffers
var model;                          // object model

var lastAnimationTime = Date.now(); // last time tick() was called
var angleStep = 10;                 // increments of rotation angle (degrees)
var fps = 30;                       // frames per second
var currentAngle = 0.0;   
var initObject = false;          // current rotation angle [degree]

var objName = {
  cube: 'https://raw.githubusercontent.com/cs411iit/public/master/mycube.obj',
  cow: 'https://raw.githubusercontent.com/cs411iit/public/master/cow.obj'
};
var CenterMass = {p: 0, q: 0, r: 0};
var BBox = { xmin: 0, xmax: 0, ymin: 0, ymax: 0, zmin: 0, zmax: 0};
var camZ = 1;
var invertNorm = 0;
var curRot = new Matrix4();
var leftRot = new Matrix4();
var rightRot = new Matrix4();
var upRot = new Matrix4();
var downRot = new Matrix4();
var tmpRot = new Matrix4();


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
  mvMatrix.multiply(leftRot);  
}

function turnRight()
{
  tmpRot.set(rightRot);
  tmpRot.multiply(curRot);
  curRot.set(tmpRot);  
  mvMatrix.multiply(rightRot);  
}

function turnUp()
{
  tmpRot.set(upRot);
  tmpRot.multiply(curRot);
  curRot.set(tmpRot); 
  mvMatrix.multiply(upRot);   
}

function turnDown()
{
  tmpRot.set(downRot);
  tmpRot.multiply(curRot);
  curRot.set(tmpRot);
  mvMatrix.multiply(downRot);    
}

function zoomIn()
{
  camZ+=1;
  mvMatrix.scale(camZ, camZ, camZ);
  camZ = 1;
}

function zoomOut()
{
  if (camZ > 1) camZ = 1;
  camZ = (camZ <= 0.1) ? camZ : camZ - 0.3;
  mvMatrix.scale(camZ, camZ, camZ);
  camZ = 1;
}

function invertNormals()
{
  invertNorm = !invertNorm;

  for (var i = 0; i < model.arrays.vertices.length; i++)
    for (var j = 0; j < 3; j++)
      model.arrays.normals[i * 3 + j] *= -1;

  assignVertexBuffersData(gl, buffers, model);
}

function initObjects() {
  initObjects = !initObjects;
  initScene();
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
function Phonge() {
  for (var i = 0; i < model.arrays.normals.length; i++ )
    model.arrays.normals[i] = 0;
  
  for (var i = 0; i < model.arrays.indices.length / 3; i++) {
    var x = [], y = [], z = [];

    for (var j = 0; j < 3; j++)
      for  (var k = 0; k < 3; k++){
        var location = model.arrays.vertices[3 * model.arrays.indices[3 * i + j] + k];
        if (j === 0)
          x.push(location);
        else if (j === 1)
          y.push(location);
        else 
          z.push(location);
      }
    var normal = calcNormal(x, y, z);

    for (var l = 0; l < 3; l++)
      for(var m = 0; m < 3; m++)
        model.arrays.normals[3 * model.arrays.indices[3 * i + l] + m] += normal[m];
  }
}


function Normalize() {
  CenterMass = { p: 0, q: 0, r: 0 };
  BBox = { 
    xmin: 999999,
    xmax: -999999,
    ymin: 999999,
    ymax: -999999,
    zmin: 999999,
    zmax: -999999
  };

  for (var i = 0; i < model.arrays.vertices.length / 3; i++) {
    var location = {
      x: model.arrays.vertices[i * 3 + 0],
      y: model.arrays.vertices[i * 3 + 1],
      z: model.arrays.vertices[i * 3 + 2]
    };

    CenterMass.p += location.x;
    CenterMass.q += location.y;
    CenterMass.r += location.z;

    if (location.x < BBox.xmin) BBox.xmin = location.x;
    if (location.x > BBox.xmax) BBox.xmax = location.x;
    if (location.y < BBox.ymin) BBox.ymin = location.y;
    if (location.y > BBox.ymax) BBox.ymax = location.y;
    if (location.z < BBox.zmin) BBox.zmin = location.z;
    if (location.z > BBox.zmax) BBox.zmax = location.z;
  }

  CenterMass.p /= (model.arrays.vertices.length / 3);
  CenterMass.q /= (model.arrays.vertices.length / 3);
  CenterMass.r /= (model.arrays.vertices.length / 3);

  var Scale = Math.max( 
    BBox.xmax - BBox.xmin,
    BBox.ymax - BBox.ymin,
    BBox.zmax - BBox.zmin
  );

  mvMatrix.scale(80/Scale,80/Scale,80/Scale);

  if (CenterMass.p !== 0 || CenterMass.q !== 0 || CenterMass.r !== 0 ) {
    mvMatrix.translate(-CenterMass.p, -CenterMass.q, -CenterMass.r);
    CenterMass = { p: 0, q: 0, z: 0};
  }
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
  mvMatrix.lookAt(0.0, 500.0, 200.0,   0.0, 0.0, 0.0,   0.0, 1.0, 0.0);

  // start reading the OBJ file
  model = new Object();
  var scale=60; // 1
  if (initObject)
    readOBJFile(objName.cube, gl, model, scale, true); // cube.obj
  else
    readOBJFile(objName.cow, gl, model, scale, true);
  // init rotation matrices
  curRot.setIdentity(); 
  leftRot.setRotate ( 5, 0,1,0);
  rightRot.setRotate(-5, 0,1,0);
  upRot.setRotate   (-5, 0,0,1);
  downRot.setRotate ( 5, 0,0,1);

}


function drawScene(gl, program, angle, buffers, model) 
{
  // get model arrays if necessary
  if (!model.arrays){
    if(isOBJFileLoaded(model)){
      extractOBJFileArrays(model);
      
      printModelInfo(model);

      Normalize();
      Phonge();

      var A, B, C = {value: null, set: false};
      

      for (var i = 0; i < model.arrays.vertices.length / 3; i += 3) {

        var x = [
          model.arrays.vertices[i * 3 + 0],
          model.arrays.vertices[i * 3 + 1],
          model.arrays.vertices[i * 3 + 2]
        ];

        var y = [
          model.arrays.vertices[(i + 1) * 3 + 0],
          model.arrays.vertices[(i + 1) * 3 + 1],
          model.arrays.vertices[(i + 1) * 3 + 2]
        ];

        var z = [
          model.arrays.vertices[(i + 2) * 3 + 0],
          model.arrays.vertices[(i + 2) * 3 + 1],
          model.arrays.vertices[(i + 2) * 3 + 2]
        ];
        
        A = calcNormal(x,y,z);
        B = x;
        B[0] -= CenterMass.p;
        B[1] -= CenterMass.q;
        B[2] -= CenterMass.r;

        C.value = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
        if (C.value < 0 && !C.set)
          C.set = true;

        for (var j = 0; j < 3; j++) 
          for (var k = 0; k < 3; k++)
            model.arrays.normals[(i + j) * 3 + k] = A[k];
      }

      if (C.set) {
        for (var i = 0; i < model.arrays.vertices.length; i++)
          for(var j = 0; j < 3; j++)
              model.arrays.normals[i * 3 + j] *= -1;
      }
      assignVertexBuffersData(gl, buffers, model);
    }
    if (!model.arrays) return;   // drawing failed
  }  

  // clear canvas
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  // Clear color and depth buffers

  mvPushMatrix();

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

  var initObjectsBtn = document.getElementById('initObjectsBtn');
  initObjectsBtn.addEventListener('click', initObjects);
  // initialize the scene and start animation
  

  
  
  initScene();
  tick();
}


// EOF


