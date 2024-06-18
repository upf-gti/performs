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
    this.animationsCount = 0;

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

AnimationRecorder.prototype.manageMultipleCapture = async function (keyframeApp) {
    this.keyframeApp = keyframeApp;
    let animations = [];
    
    for (let animationName in keyframeApp.loadedAnimations) {
        let animation = keyframeApp.loadedAnimations[animationName];
        if (!animation.record) {
            continue;
        }
        animations.push(animationName);
    }
    this.animationsCount = animations.length;

    for (let i = 0; i < animations.length; i++) {
        const animationName = animations[i];
        let animation = keyframeApp.loadedAnimations[animationName];
       
        await this.manageCapture(animationName, animation.bodyAnimation.duration);
    }
}

AnimationRecorder.prototype.manageCapture = function (animationName, timeLimit = null) {
    if (window.global.app.mode == App.Modes.BML){
        if (this.isRecording) { this.stopCapture(); }
        else { this.startCapture("BML"); }
    }
    else if (window.global.app.mode == App.Modes.KEYFRAME) {
       
        return new Promise((resolve) => {
            this.onCaptureComplete = resolve;
            this.keyframeApp.onChangeAnimation(animationName);
            this.startCapture(animationName);
            
            // automatically stop recording after animation stops
            this.timeLimit = timeLimit; // in seconds
        });
    }
}

AnimationRecorder.prototype.startCapture = function (animationName) {
    this.isRecording = true;
    this.recordedChunks.forEach((chunk, i, arr) => arr[i] = []); // reset chuncks
    this.mediaRecorders.forEach(recorder => { recorder.start() });
    this.currentAnimationName = animationName; // Store the animation name
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
    if (idx === 0) {
        window.global.app.keyframeApp.changePlayState(true); // start animation
        window.global.app.gui.keyframeGui.refresh();
    }
    this.clock.start();
}

let zip = new JSZip();

function blobToBase64(blob, callback) {
    var reader = new FileReader();
    reader.onload = function() {
        var dataUrl = reader.result;
        var base64 = dataUrl.split(',')[1];
        callback(base64);
    };
    reader.readAsDataURL(blob);
}

AnimationRecorder.prototype.handleStop = function (idx) {
    const animationName = this.currentAnimationName;
    const blob = new Blob(this.recordedChunks[idx], {type: 'video/webm'});
    const url = URL.createObjectURL(blob);
    const name =   `${animationName} ${idx + 1}.webm`;
    blobToBase64(blob, (binaryData) => {
        // add downloaded file to zip:
        zip.folder(animationName).file(name, binaryData, {base64: true})
        let files = Object.keys(zip.files);

        if((files.length - this.animationsCount) == this.animationsCount * this.renderers.length) {
            // all files have been downloaded, create the zip
    
            zip.generateAsync({type:"base64"}).then(function (base64) {
                let zipName = 'performs-recording.zip';
                let a = document.createElement('a'); 
                // then trigger the download link:        
                a.href = "data:application/zip;base64," + base64;
                a.download = zipName;
                a.click();
            });
        }
    });

    // stop animation
    if (idx === 0 && window.global.app.mode == App.Modes.KEYFRAME) {
        window.global.app.keyframeApp.changePlayState(false);
        window.global.app.gui.keyframeGui.refresh();
    }

    // reset clock to 0
    this.clock.elapsedTime = 0;
    this.clock.stop();

    // Check if all recorders have stopped
    if (this.mediaRecorders.every(recorder => recorder.state === 'inactive') && idx == this.mediaRecorders.length - 1) {
        if (this.onCaptureComplete) {
            this.onCaptureComplete(); // Resolve the promise to indicate that capture is complete
            this.onCaptureComplete = null; // Clear the reference
        }
    }
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