import * as THREE from 'three';
import { PERFORMS } from '../Core.js';

let zip = typeof JSZip != 'undefined' ? new JSZip() : null;

class AnimationRecorder {
    constructor(numCameras, app) {
        this.isRecording = false;
        this.timeLimit = null;
        this.mediaRecorders = [];
        this.recordedChunks = [];
        this.renderers = [];
        this.clock = new THREE.Clock();
        this.handleDataAvailable = this.handleDataAvailable.bind(this);
        this.handleStop = this.handleStop.bind(this);
        this.animationsCount = 0;
        this.enabledCameras = 0;
        this.exportZip = true;

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

    async manageMultipleCapture (keyframeApp) {
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

    manageCapture (animationName, timeLimit = null) {
        if (this.app.mode == PERFORMS.Modes.SCRIPT){
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
        else if (this.app.mode == PERFORMS.Modes.KEYFRAME) {
        
            return new Promise((resolve) => {
                this.onCaptureComplete = resolve;
                const crossfade = this.keyframeApp.useCrossFade;
                this.keyframeApp.useCrossFade = false;
                this.keyframeApp.onChangeAnimation(animationName);
                this.keyframeApp.useCrossFade = crossfade;
                
                this.startCapture(animationName);
                
                // automatically stop recording after animation stops
                this.timeLimit = timeLimit; // in seconds
            });
        }
    }

    startCapture (animationName) {
        this.isRecording = true;
        this.enabledCameras = 0;
        for( let i = 0; i < this.app.cameras.length; i++) {
            if(!this.app.cameras[i].record) {
                continue;
            }
            this.enabledCameras += 1;
            this.recordedChunks[i] = [];
            this.mediaRecorders[i].start();
        }
        // this.recordedChunks.forEach((chunk, i, arr) => arr[i] = []); // reset chuncks
        // this.mediaRecorders.forEach(recorder => { recorder.start() });
        this.currentAnimationName = animationName; // Store the animation name
    }
        
    stopCapture () {
        this.isRecording = false;
        this.mediaRecorders.forEach(recorder => recorder.stop());   
    }

    handleDataAvailable (event, idx) {
        if (event.data.size > 0) {
            this.recordedChunks[idx].push(event.data);
        }
    }

    handleStart (idx) {
        if (idx === 0) {
            if (this.app.mode == PERFORMS.Modes.SCRIPT){
                this.app.scriptApp.replay();
            }
            else if (this.app.mode == PERFORMS.Modes.KEYFRAME) {
                this.app.keyframeApp.changePlayState(true); // start animation                
            }
        }
        this.clock.start();
    }

    handleStop (idx) {
        const animationName = this.currentAnimationName;
        const blob = new Blob(this.recordedChunks[idx], {type: 'video/webm'});
        const name =  `${animationName} ${idx + 1}.webm`;

        blobToBase64(blob, (binaryData) => {
            if(!zip && this.exportZip) {
                console.error("JSZip not imported. The recordings can't be downloaded.");
            }

            if(zip && this.exportZip) {
                // Add downloaded file video to zip in the specified folder:
                zip.folder(animationName).file(name, binaryData, {base64: true})
                let files = Object.keys(zip.files);
    
                if((files.length - this.animationsCount) == this.animationsCount * this.enabledCameras) {
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
            }
            else {
                let a = document.createElement('a'); 
                // Then trigger the download link
                a.href = "data:application/webm;base64," + binaryData;
                a.download = name;
                a.click();

                if(this.isRecording == false) {
                    if(this.onStopCapture) {
                        this.onStopCapture();
                    }
                }
            }
            //this.recordedChunks[idx] = [];
        });

        // refresh gui
        if (idx === 0) {
            if (this.app.mode == PERFORMS.Modes.SCRIPT) {
                // reset avatar pose / stop animation
                this.app.scriptApp.ECAcontroller.reset(true);
            }
        }

        // reset clock to 0
        this.clock.elapsedTime = 0;
        this.clock.stop();

        // Check if all recorders have stopped
        if (this.mediaRecorders.every(recorder => recorder.state === 'inactive')) {
            if (this.onCaptureComplete) {
                this.onCaptureComplete(); // Resolve the promise to indicate that capture is complete
                this.onCaptureComplete = null; // Clear the reference
            }
        }
    }

    update (scene, cameras) {
        // render for all cameras
        for (let i = 0; i < this.renderers.length; i++) {
            this.renderers[i].render( scene, cameras[i] );
        }

        if (this.timeLimit && this.clock.getElapsedTime() > this.timeLimit ) {
            this.app.keyframeApp.changePlayState(false);  // stop animation
            this.stopCapture();
        }
    }
}

export { AnimationRecorder }

function blobToBase64(blob, callback) {
    var reader = new FileReader();
    reader.onload = function() {
        var dataUrl = reader.result;
        var base64 = dataUrl.split(',')[1];
        callback(base64);
    };
    reader.readAsDataURL(blob);
}