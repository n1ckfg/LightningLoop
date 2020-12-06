
"use strict";

const renderer = new THREE.WebGLRenderer({ antialiasing: false, alpha: false, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000);

const exposure = 1.2;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = Math.pow(exposure, 4.0);

renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

const cameraFov = 60;
const cameraAspect = window.innerWidth / window.innerHeight;
const cameraNear = 0.1;
const cameraFar = 100;

const camera = new THREE.PerspectiveCamera(cameraFov, cameraAspect, cameraNear, cameraFar);
resetCameraPosition();

const clock = new THREE.Clock();

const scene = new THREE.Scene();
const fogColor = 0x000000;
const fogDensity = 0.00375;
scene.fog = new THREE.FogExp2(fogColor, fogDensity);
scene.background = new THREE.Color("#000000");  

const room = new THREE.Mesh(
    new THREE.BoxGeometry(6, 6, 6, 10, 10, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.05, 0.05), wireframe: true })
);
room.position.y = 0;
scene.add(room);

const globalScale = new THREE.Vector3(50, -50, 50);
const globalOffset = new THREE.Vector3(-20, 60, -350); 

let now = 0;

const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0; //0;
bloomPass.strength = 6; //1.5;
bloomPass.radius = 0.8; //0.8

const renderPass = new THREE.RenderPass(scene, camera);

const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);

let boxWidth, params, manager, lastRender;

let armSaveJson = false;
let armFrameForward = false;
let armFrameBack = false;
let armTogglePause = false;

let drawWhilePlaying = true;
let clicked = false;

let fps = 12.0;
let frameInterval = (1.0/fps);// * 1000;
let frameDelta = 0;
let time = 0;
let pTime = 0;
let pauseAnimation = false;
let mouse3D = new THREE.Vector3(0, 0, 0);

let isDrawing = false;
let isPlaying = true;
let debugPos = false;

let minDistance = 0.01;
let useMinDistance = true;
let roundValues = true;
let numPlaces = 7;
let altKeyBlock = false;

let c1b0_blocking = false;
let c1b1_blocking = false;
let c1b2_blocking = false;
let c1b3_blocking = false;
let c2b0_blocking = false;
let c2b1_blocking = false;
let c2b2_blocking = false;
let c2b3_blocking = false;

let latk;

function createMtl(color) {
    let mtl = new THREE.LineBasicMaterial({
        color: new THREE.Color(color[0],color[1],color[2]),
    });
    return mtl;
}

const localColor = [0.667, 0.667, 1];
const localMtl = createMtl(localColor);
const remoteColor = [1, 0.5, 0.25];
const remoteMtl = createMtl(remoteColor);

let bigLocalGeoBuffer = new THREE.BufferGeometry();
let bigLocalPoints = [];
let bigLocalLine = new THREE.LineSegments(bigLocalGeoBuffer, localMtl);
bigLocalLine.frustumCulled = false;
scene.add(bigLocalLine);

let bigRemoteGeoBuffer = new THREE.BufferGeometry();
let bigRemotePoints = [];
let bigRemoteLine = new THREE.LineSegments(bigRemoteGeoBuffer, remoteMtl);
bigRemoteLine.frustumCulled = false;
scene.add(bigRemoteLine);

let localTempVec3Array = [];
let remoteTempVec3Array = [];

function setup() {
    latk = new Latk(true);//Latk.read("../animations/jellyfish.latk");
    for (let i=0; i<12; i++) {
        latk.getLastLayer().frames.push(new LatkFrame());
    }

    setupWasd();
    setupMouse();

    draw();
}    

function draw() {
    bigLocalPoints = [];
    bigRemotePoints = [];
    if (!isDrawing) localTempVec3Array = [];

    updateWasd();

    if (armFrameForward) {
        armFrameForward = false;
        isPlaying = false;
        frameForward();
        console.log("ff: " + counter);
    }
    if (armFrameBack) {
        armFrameBack = false;
        isPlaying = false;
        frameBack();
        console.log("rew: " + counter);
    }
    if (armTogglePause) {
        isPlaying = !isPlaying;
        console.log("playing: " + isPlaying);
        armTogglePause = false;
    }

    if (isPlaying) {
        pTime = time;
        time = new Date().getTime() / 1000;
        frameDelta += time - pTime;

        if (frameDelta >= frameInterval) {
            frameDelta = 0;

            frameMotor();
        }

        if (isDrawing) {
            let drawTrailLength = 30;

            if (drawWhilePlaying && frameDelta === 0) {
                createStroke(localTempVec3Array);
                localTempVec3Array = [];
            }
        }
    }
   
    if (armSaveJson) {
        armSaveJson = false;
        isPlaying = false;
        writeJson();
    }   

    for(let layer of latk.layers) {
        for (let stroke of layer.getCurrentFrame().strokes) {
            bigRemotePoints = bigRemotePoints.concat(convertLatkPointToLineSegments(stroke.points));
        }
    }

    bigLocalPoints = bigLocalPoints.concat(convertVec3ToLineSegments(localTempVec3Array));

    bigLocalGeoBuffer.setFromPoints(bigLocalPoints);
    bigRemoteGeoBuffer.setFromPoints(bigRemotePoints);

    composer.render();
    requestAnimationFrame(draw);     
}

function latkPointToVec3(latkPoint) {
    return new THREE.Vector3(latkPoint.co[0], latkPoint.co[1], latkPoint.co[2]);
}

function vec3ToLatkPoint(vec3) {
    return new LatkPoint([vec3.x, vec3.y, vec3.z]);
}

function convertLatkPointToLineSegments(latkPointArray) {
    let returns = [];
    for (let i=1; i<latkPointArray.length; i++) {
        returns.push(latkPointToVec3(latkPointArray[i-1]));
        returns.push(latkPointToVec3(latkPointArray[i]));
    }
    return returns;
}

function convertVec3ToLineSegments(vec3Array) {
    let returns = [];
    for (let i=1; i<vec3Array.length; i++) {
        returns.push(vec3Array[i-1]);
        returns.push(vec3Array[i]);
    }
    return returns; 
}

function convertVec3ToLatkArray(vec3Array) {
    let returns = [];
    for (let vec3 of vec3Array) {
        returns.push(vec3ToLatkPoint(vec3));
    }
    return returns;
}

function roundVal(value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
} 

/*
function tempStrokeToJson() {
    try {
        let color = localColor;
        let sb = [];
        sb.push("{");
        sb.push("\"timestamp\": " + new Date().getTime() + ",");
        sb.push("\"index\": " + latk.layers[latk.layers.length-1].counter + ",");
        sb.push("\"color\": [" + color[0] + ", " + color[1] + ", " + color[2]+ "],");
        sb.push("\"points\": [");
        for (let j=0; j<tempStroke.geometry.attributes.position.array.length; j += 6 ) { 
            let x = tempStroke.geometry.attributes.position.array[j];
            let y = tempStroke.geometry.attributes.position.array[j+1];
            let z = tempStroke.geometry.attributes.position.array[j+2];

            let point = cleanPoint(x, y, z);

            sb.push("{\"co\": [" + point.x + ", " + point.y + ", " + point.z + "]");                  
            if (j >= tempStroke.geometry.attributes.position.array.length - 6) {
                sb[sb.length-1] += "}";
            } else {
                sb[sb.length-1] += "},";
            }
        }
        sb.push("]");
        sb.push("}");

        return JSON.parse(sb.join(""));
    } catch (e) {
        console.log("Something went wrong sending a stroke.")
    }
}
*/

// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~

function beginStroke(x, y, z) {
    isDrawing = true;
    //isPlaying = false;
    localTempVec3Array = [];
    localTempVec3Array.push(new THREE.Vector3(x, y, z));
    console.log("Begin new stroke.");
}

function updateStroke(x, y, z) {
    //let p = new THREE.Vector3(x, y, z);

    //if (p.distanceTo(localTempVec3Array[localTempVec3Array.length-1]) > minDistance) {
        localTempVec3Array.push(new THREE.Vector3(x, y, z));
        console.log("Update " + localTempVec3Array.length + " points."); 
    //}
}

function endStroke() {  // TODO draw on new layer
    //if (isDrawing) {
	isDrawing = false;
    createStroke(localTempVec3Array);
    //~
    //socket.emit("clientStrokeToServer", tempStrokeToJson());
    //~
    console.log("End stroke.");
	//}
    getMagentaButton(localTempVec3Array);
}

function createStroke(vec3Array) {
    latk.layers[0].getCurrentFrame().strokes.push(new LatkStroke(convertVec3ToLatkArray(vec3Array)));
}
// ~ ~ ~ 

function getMagentaButton(points) {
    try {
        let p1 = points[0];
        let p2 = points[points.length-1];
        let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
        let button = parseInt(angle * (4.0/180.0) + 4);
        console.log("Trigger button " + button);
        buttonUp(button);
        buttonDown(button, false);
    } catch (e) { 
        console.log(e);
    }
}

function refreshFrame(index) {
	if (latk.layers[index].frames[latk.layers[index].counter]) {
	    for (let i=0; i<latk.layers[index].frames[latk.layers[index].counter].length; i++) {
	        scene.add(latk.layers[index].frames[latk.layers[index].counter][i]);
	    }
	    socket.emit("clientRequestFrame", { num: latk.layers[index].counter });
	}
}

function frameMotor() {
    for (let h=0; h<latk.layers.length; h++) {
        //redrawFrame(h);
        latk.layers[h].previousFrame = latk.layers[h].counter;
        latk.layers[h].counter++;
        if (latk.layers[h].counter >= latk.layers[h].frames.length - 1) {
            latk.layers[h].counter = 0;
            latk.layers[h].loopCounter++;
        }
    }
}

function frameForward() {
    for (let h=0; h<latk.layers.length; h++) {        
        latk.layers[h].counter++;
        if (latk.layers[h].counter >= latk.layers[h].frames.length - 1) latk.layers[h].counter = 0;
        //redrawFrame(h);
    }
}

function frameBack() {
    for (let h=0; h<latk.layers.length; h++) {        
        latk.layers[h].counter--;
        if (latk.layers[h].counter <= 0) latk.layers[h].counter = latk.layers[h].frames.length - 1;
        //redrawFrame(h);
    }
}

setup();
