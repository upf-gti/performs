import * as THREE from 'three';
import { App } from '../App.js'

function AnimationRecorder(numCameras, app) {
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
        const options = { mimeType: 'video/webm;', videoBitsPerSecond: 5 * 1024 * 1024 }; // 5 Mbps

        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorder.ondataavailable = (event) => this.handleDataAvailable(event, i);
        mediaRecorder.onstop = () => this.handleStop(i);
        mediaRecorder.onstart = () => this.handleStart(i);

        this.mediaRecorders.push( mediaRecorder );
        this.recordedChunks.push([]);
    };
    this.app = app;
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
        if(this.onStartCapture) {
            this.onStartCapture('(' + (i+1) + '/' + animations.length+ ') ' + animationName);
        }
        await this.manageCapture(animationName, animation.bodyAnimation.duration);
    }
}

AnimationRecorder.prototype.manageCapture = function (animationName, timeLimit = null) {
    if (window.global.app.mode == App.Modes.SCRIPT){
        this.animationsCount = 1;
        if(this.onStartCapture) {
            this.onStartCapture('');
        }
        if (this.isRecording) { 
            this.stopCapture(); 
            // if(this.onStopCapture) {
            //     this.onStopCapture();
            // }
        }
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

let zip = typeof JSZip != 'undefined' ? new JSZip() : null;

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
        if (window.global.app.mode == App.Modes.SCRIPT){
            window.global.app.bmlApp.replay();
        }
        else if (window.global.app.mode == App.Modes.KEYFRAME) {
            window.global.app.keyframeApp.changePlayState(true); // start animation
            window.global.app.gui.keyframeGui.refresh();
        }
    }
    this.clock.start();
}



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
    const name =  `${animationName} ${idx + 1}.webm`;

    blobToBase64(blob, (binaryData) => {
        if(!zip) {
            console.error("JSZip not imported. The recordings can't be downloaded.");
            return;
        }
        // Add downloaded file video to zip in the specified folder:
        zip.folder(animationName).file(name, binaryData, {base64: true})
        let files = Object.keys(zip.files);

        if((files.length - this.animationsCount) == this.animationsCount * this.renderers.length) {
            if(this.onStopCapture) {
                this.onStopCapture();
            }
            // All files have been downloaded, create the zip and download it
            zip.generateAsync({type:"base64"}).then(function (base64) {
                let zipName = 'performs-recordings.zip';
                let a = document.createElement('a'); 
                // Then trigger the download link
                a.href = "data:application/zip;base64," + base64;
                a.download = zipName;
                a.click();
                zip.files = {};
            });
        }
    });

    // refresh gui
    if (idx === 0) {
        if (window.global.app.mode == App.Modes.KEYFRAME) window.global.app.gui.keyframeGui.refresh();
        else if (window.global.app.mode == App.Modes.SCRIPT) {
            // reset avatar pose / stop animation
            if(window.global.app.gui.bmlGui) {
                window.global.app.gui.bmlGui.setValue( "Mood", "Neutral" ); 
            }
            window.global.app.bmlApp.ECAcontroller.reset();
            if(window.global.app.gui.bmlGui) {
                window.global.app.gui.bmlGui.refresh();
            }
        }
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
        window.global.app.keyframeApp.changePlayState(false);  // stop animation
        this.stopCapture();
        window.global.app.gui.refresh(); // change state of capture button
    }
}

export { AnimationRecorder }