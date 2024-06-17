
function AnimationRecorder(numCameras) {
    this.isRecording = false;
    this.capturers = [];
    
    for (let i = 0; i < numCameras; i++) {
        this.capturers.push( new CCapture( {
            format: "webm",
            framerate: 30,
            name: "recording camera " + (i + 1) } ));
    };
}

AnimationRecorder.prototype.manageCapture = function () {
    this.isRecording ? this.stopCapture() : this.startCapture();
}

AnimationRecorder.prototype.startCapture = function () {
    this.isRecording = true;
    for (let i = 0; i < this.capturers.length; i++) {
        this.capturers[i].start();
    }
}

AnimationRecorder.prototype.stopCapture = function () {
    this.isRecording = false;
    for (let i = 0; i < this.capturers.length; i++) {
        this.capturers[i].stop();
        this.capturers[i].save(); 
    }
}

AnimationRecorder.prototype.update = function (renderer, scene, cameras) {
    for (let i = 0; i < this.capturers.length; i++) {
        renderer.render( scene, cameras[i] );
        this.capturers[i].capture(renderer.domElement);
    }
}

export { AnimationRecorder }