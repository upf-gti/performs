import * as THREE from 'three';
import { App } from '../App.js'

function AnimationRecorder(numCameras) {
    this.isRecording = false;
    this.timeLimit = null;
    this.mediaRecorders = [];
    this.recordedChunks = [];
    this.renderers = [];
    this.clock = new THREE.Clock();

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
        mediaRecorder.onstart = () => this.handleStart(i);

        this.mediaRecorders.push( mediaRecorder );
        this.recordedChunks.push([]);
    };

}

AnimationRecorder.prototype.manageCapture = function (timeLimit = null) {
    if (this.isRecording) { this.stopCapture() }
    else {this.startCapture(); }

    // automatically stop recording after animation stops
    this.timeLimit = timeLimit; // in seconds
}

AnimationRecorder.prototype.startCapture = function () {
    this.isRecording = true;
    this.recordedChunks.forEach((chunk, i, arr) => arr[i] = []); // reset chuncks
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

AnimationRecorder.prototype.handleStart = function (idx) {
    if (idx === 0) window.global.app.keyframeApp.changePlayState(true); // start animation
    this.clock.start();
}

AnimationRecorder.prototype.handleStop = function (idx) {
    const blob = new Blob(this.recordedChunks[idx], {type: 'video/webm'});
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `camera ${idx + 1} recording.webm`;
    downloadLink.style.display = 'none';
    downloadLink.click();

    // stop animation
    if (idx === 0 && window.global.app.mode == App.Modes.KEYFRAME) {
        window.global.app.keyframeApp.changePlayState(false);
        window.global.app.gui.keyframeGui.refresh();
    }

    // reset clock to 0
    this.clock.elapsedTime = 0;
    this.clock.stop();
}

AnimationRecorder.prototype.update = function (scene, cameras) {
    // render for all cameras
    for (let i = 0; i < this.renderers.length; i++) {
        this.renderers[i].render( scene, cameras[i] );
    }

    if (this.timeLimit && this.clock.getElapsedTime() > this.timeLimit ) {
        this.stopCapture();
        window.global.app.gui.refresh(); // change state of capture button
    }
}

export { AnimationRecorder }