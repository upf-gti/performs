
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BVHLoader } from './extendedBVHLoader.js';
import { AnimationRetargeting, forceBindPoseQuats } from './retargeting/retargeting.js'

class KeyframeApp {

    constructor() {
        
        this.elapsedTime = 0; // clock is ok but might need more time control to dinamicaly change signing speed
        this.clock = new THREE.Clock();
        this.loaderBVH = new GLTFLoader();
        
        this.currentCharacter = "";
        this.controllers = {}; // store avatar controllers

        this.currentAnimation = "";
        this.loadedAnimations = {};
        this.bindedAnimations = {};

        this.mixer = null;
    }

    update( deltaTime ) {
        this.elapsedTime += deltaTime;
        if ( this.mixer ) { 
            this.mixer.update( deltaTime ); 
        }
    }

    onLoadAvatar(newAvatar, config){      

        // Create mixer for animation
        const mixer = new THREE.AnimationMixer(newAvatar);  
        this.controllers[newAvatar.name] = { mixer, config };
        this.mixer = mixer;
    }

    onChangeAvatar(avatarName) {
        if (!this.controllers[avatarName]) { 
            return false; 
        }
        this.currentCharacter = avatarName;
        this.mixer = this.controllers[avatarName].mixer;  
        this.bindAnimationToCharacter(this.currentAnimation, avatarName);
        return true;
    }

    onChangeAnimation(animationName) {
        if(!this.loadedAnimations[animationName]) {
            console.warn(animationName + 'not found')
        }
        this.currentAnimation = animationName;
        this.bindAnimationToCharacter(this.currentAnimation, this.currentCharacter);
    }
    /* 
    * Given an array of animations of type { name: "", data: "" } where "data" is Blob of text/plain type 
    * 
    */
     async processMessageFiles( files = []) {
        let parsedFiles = {};
        let loader = new BVHLoader();
        let promises = [];

        for(let i = 0; i < files.length; i++) {
            const file = files[i];
            let filePromise = new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => {                                    
                    const data = loader.parseExtended(reader.result);
                    this.loadBVHAnimation( file.name, data );

                    resolve(parsedFiles[file.name] = data);
                }
                reader.readAsText(file.data);
            });
            promises.push(filePromise);           
        }
        return Promise.all(promises);
    }

    // load animation from bvhe file
    loadBVHAnimation(name, animationData) { // TO DO: Refactor params of loadAnimation...()

        let skeleton = null;
        let bodyAnimation = null;
        let faceAnimation = null;
        if ( animationData && animationData.skeletonAnim ){
            skeleton = animationData.skeletonAnim.skeleton;
            skeleton.bones.forEach( b => { b.name = b.name.replace( /[`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "") } );
            // loader does not correctly compute the skeleton boneInverses and matrixWorld 
            skeleton.bones[0].updateWorldMatrix( false, true ); // assume 0 is root
            skeleton = new THREE.Skeleton( skeleton.bones ); // will automatically compute boneInverses
            
            animationData.skeletonAnim.clip.tracks.forEach( b => { b.name = b.name.replace( /[`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "") } );     
            animationData.skeletonAnim.clip.name = "bodyAnimation";
            bodyAnimation = animationData.skeletonAnim.clip;
        }
        
        if ( animationData && animationData.blendshapesAnim ){
            animationData.blendshapesAnim.name = "faceAnimation";       
            faceAnimation = animationData.blendshapesAnim;
        }
        
        this.loadedAnimations[name] = {
            name: name,
            bodyAnimation: bodyAnimation ?? new THREE.AnimationClip( "bodyAnimation", -1, [] ),
            faceAnimation: faceAnimation ?? new THREE.AnimationClip( "faceAnimation", -1, [] ),
            skeleton,
            type: "bvhe"
        };
    }

    /**
     * KeyframeEditor: fetches a loaded animation and applies it to the character. The first time an animation is binded, it is processed and saved. Afterwards, this functino just changes between existing animations 
     * @param {String} animationName 
     * @param {String} characterName 
     */
    bindAnimationToCharacter(animationName, characterName) {
        
        let animation = this.loadedAnimations[animationName];
        if(!animation) {
            console.warn(animationName + " not found");
            return false;
        }
        this.currentAnimation = animationName;
        
        let currentCharacter = this.controllers[characterName];
        if(!currentCharacter) {
            console.warn(characterName + ' not loaded')
        }
        // Remove current animation clip
        let mixer = currentCharacter.mixer;
        mixer.stopAllAction();

        while(mixer._actions.length){
            mixer.uncacheClip(mixer._actions[0]._clip); // removes action
        }
        currentCharacter.skeletonHelper.skeleton.pose(); // for some reason, mixer.stopAllAction makes bone.position and bone.quaternions undefined. Ensure they have some values

        // if not yet binded, create it. Otherwise just change to the existing animation
        if ( !this.bindedAnimations[animationName] || !this.bindedAnimations[animationName][currentCharacter.name] ) {
            let bodyAnimation = animation.bodyAnimation;        
            let skeletonAnimation = null;
            if(bodyAnimation) {
            
                let tracks = [];        
                // Remove position changes (only keep i == 0, hips)
                for (let i = 0; i < bodyAnimation.tracks.length; i++) {

                    if(i && bodyAnimation.tracks[i].name.includes('position')) {
                        continue;
                    }
                    tracks.push(bodyAnimation.tracks[i]);
                    tracks[tracks.length - 1].name = tracks[tracks.length - 1].name.replace( /[\[\]`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "").replace(".bones", "");
                }

                //tracks.forEach( b => { b.name = b.name.replace( /[`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "") } );
                bodyAnimation.tracks = tracks;            
                let skeleton = animation.skeleton;
                // Retarget NN animation              
                //forceBindPoseQuats(this.currentCharacter.skeletonHelper.skeleton); // TO DO: Fix bind pose of Eva
                forceBindPoseQuats(skeleton); 
                // trgUseCurrentPose: use current Bone obj quats,pos, and scale
                // trgEmbedWorldTransform: take into account external rotations like bones[0].parent.quaternion and model.quaternion
                let retargeting = new AnimationRetargeting(skeleton, this.currentCharacter.model, { trgUseCurrentPose: true, trgEmbedWorldTransforms: true } ); // TO DO: change trgUseCurrentPose param
                bodyAnimation = retargeting.retargetAnimation(bodyAnimation);
                
                this.validateAnimationClip(bodyAnimation);

                bodyAnimation.name = "bodyAnimation";   // mixer
                skeletonAnimation.name = "bodyAnimation";  // timeline
            }
                
            let faceAnimation = animation.faceAnimation;        
            let auAnimation = null;
            if(faceAnimation) { // TO DO: Check if it's if-else or if-if
                
                // Get the formated animation
                if(animation.type == "video") {
                    faceAnimation = this.currentCharacter.blendshapesManager.createBlendShapesAnimation(animation.blendshapes);
                }

                faceAnimation.name = "faceAnimation";   // mixer
                auAnimation.name = "faceAnimation";  // timeline
            }
            
            if(!this.bindedAnimations[animationName]) {
                this.bindedAnimations[animationName] = {};
            }
            this.bindedAnimations[animationName][this.currentCharacter.name] = {
                mixerBodyAnimation: bodyAnimation, mixerFaceAnimation: faceAnimation, // for threejs mixer 
                skeletonAnimation, auAnimation // from gui timeline
            }
        }

        let bindedAnim = this.bindedAnimations[animationName][currentCharacter.name];
        mixer.clipAction(bindedAnim.mixerFaceAnimation).setEffectiveWeight(1.0).play(); // already handles nulls and undefines
        mixer.clipAction(bindedAnim.mixerBodyAnimation).setEffectiveWeight(1.0).play();
        
        this.mixer = mixer;

        return true;
    }

    /** Validate body animation clip created using ML */
    validateAnimationClip(clip) {

        let newTracks = [];
        let tracks = clip.tracks;
        let bones = this.currentCharacter.skeletonHelper.bones;
        let bonesNames = [];
        tracks.map((v) => { bonesNames.push(v.name.split(".")[0])});

        for(let i = 0; i < bones.length; i++)
        {
            
            let name = bones[i].name;
            if(bonesNames.indexOf( name ) > -1)
                continue;
            let times = [0];
            let values = [bones[i].quaternion.x, bones[i].quaternion.y, bones[i].quaternion.z, bones[i].quaternion.w];
            
            let track = new THREE.QuaternionKeyframeTrack(name + '.quaternion', times, values);
            newTracks.push(track);
            
        }
        clip.tracks = clip.tracks.concat(newTracks);
    }
    
}

export { KeyframeApp }