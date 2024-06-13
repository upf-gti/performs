import * as THREE from 'three';

function AnimationRecorder(numCameras) {
    this.isRecording = false;
    this.timeLimit = null;
    this.mediaRecorders = [];
    this.recordedChunks = [];
    this.renderers = [];

    this.handleDataAvailable = this.handleDataAvailable.bind(this);
    this.handleStop = this.handleStop.bind(this);

    for (let i = 0; i < numCameras; i++) {
        // offscreen renderer for each camera
        const offscreenRenderer = new THREE.WebGLRenderer( {antialias: true} );
        offscreenRenderer.setSize(window.innerWidth, window.innerHeight);
        offscreenRenderer.setPixelRatio(window.devicePixelRatio);
        offscreenRenderer.toneMapping = THREE.LinearToneMapping;
        offscreenRenderer.toneMappingExposure = 1;
        this.renderers.push(offscreenRenderer);

        const stream = this.renderers[i].domElement.captureStream(60);
        const options = { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond: 5 * 1024 * 1024 }; // 5 Mbps

        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorder.ondataavailable = (event) => this.handleDataAvailable(event, i);
        mediaRecorder.onstop = () => this.handleStop(i);

        this.mediaRecorders.push( mediaRecorder );
        this.recordedChunks.push([]);
    };

}

AnimationRecorder.prototype.manageCapture = function (timeLimit = null) {
    if (this.isRecording) { this.stopCapture() }
    else {this.startCapture(); }
}

AnimationRecorder.prototype.startCapture = function () {
    this.isRecording = true;
    this.recordedChunks.forEach((chunk, i, arr) => arr[i] = []);
    this.mediaRecorders.forEach(recorder => { recorder.start() });
}
    
AnimationRecorder.prototype.stopCapture = function () {
    this.isRecording = false;
    this.mediaRecorders.forEach(recorder => recorder.stop());
}

AnimationRecorder.prototype.handleDataAvailable = function (event, idx) {
    if (event.data.size > 0) {
        this.recordedChunks[idx].push(event.data);
    }
}

AnimationRecorder.prototype.handleStop = function (idx) {
    const blob = new Blob(this.recordedChunks[idx], {type: 'video/webm'});
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `camera ${idx + 1} recording.webm`;
    downloadLink.style.display = 'none';
    downloadLink.click();
}

AnimationRecorder.prototype.update = function (scene, cameras) {
    for (let i = 0; i < this.renderers.length; i++) {
        this.renderers[i].render( scene, cameras[i] );
    }
}

export { AnimationRecorder }