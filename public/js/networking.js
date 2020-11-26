"use strict";

let socket = io();

socket.on("newFrameFromServer", function(data) {
	if (latkDebug) console.log("Receiving new frame " + data[0]["index"] + " with " + data.length + " strokes.");
    let newStrokes = [];

    for (let i=0; i<data.length; i++) {
        let geometry = new THREE.Geometry();
        geometry.dynamic = true;

        let origVerts = [];

        for (let j=0; j<data[i]["points"].length; j++) {
        	let co = data[i]["points"][j]["co"];
            origVerts.push(new THREE.Vector3(co[0], co[1], co[2]));

            //if (j === 0 || !useMinDistance || (useMinDistance && origVerts[j].distanceTo(origVerts[j-1]) > minDistance)) {
            geometry.vertices.push(origVerts[j]);
            //}
        }

        getMagentaButton(origVerts);

        if (latkDebug) console.log("Created new geometry with " + geometry.vertices.length + " vertices.");

        geometry.verticesNeedUpdate = true;

        let line = new THREE.MeshLine();
        line.setGeometry(geometry);
        let meshLine = new THREE.Mesh(line.geometry, createUniqueMtl(serverColor));
        newStrokes.push(meshLine);//line);
	}

    let index = data[0]["index"];
    let last = layers.length - 1;
  	if (newStrokes.length > 0 && layers.length > 0 && layers[last].frames) layers[last].frames[index] = newStrokes;
});
