import * as THREE from 'three';
//import { normalize } from 'three/src/math/MathUtils.js';


// asymetric and/or negative scaling of objects is not properly supported 
class AnimationRetargeting {

    /**
    * @DEFAULT Uses skeleton's actual bind pose
    * @CURRENT Uses skeleton's current pose
    * @TPOSE Forces the skeleton's current pose to T-pose and uses skeleton's current pose
    */
    static BindPoseModes = { DEFAULT : 0, CURRENT: 1}
    static boneMap = {
        "LEye":           "lefteye",
        "REye":           "righteye",
        "Head":           "head",
        "Neck":           "neck",
        "ShouldersUnion": "spine2", // chest
        "Stomach":  	  "spine1",
        "BelowStomach":   "spine",
        "Hips":			  "hips",
        "RShoulder":      "rightshoulder",
        "RArm":           "rightarm",
        "RElbow":         "rightforearm",
        "RHandThumb":     "righthandthumb1",
        "RHandThumb2":    "righthandthumb2",
        "RHandThumb3":    "righthandthumb3",
        "RHandThumb4":    "righthandthumb4",
        "RHandIndex":     "righthandindex1",
        "RHandIndex2":    "righthandindex2",
        "RHandIndex3":    "righthandindex3",
        "RHandIndex4":    "righthandindex4",
        "RHandMiddle":    "righthandmiddle1",
        "RHandMiddle2":   "righthandmiddle2",
        "RHandMiddle3":   "righthandmiddle3",
        "RHandMiddle4":   "righthandmiddle4",
        "RHandRing":      "righthandring1",
        "RHandRing2":     "righthandring2",
        "RHandRing3":     "righthandring3",
        "RHandRing4":     "righthandring4",
        "RHandPinky":     "righthandpinky1",
        "RHandPinky2":    "righthandpinky2",
        "RHandPinky3":    "righthandpinky3",
        "RHandPinky4":    "righthandpinky4",
        "RWrist":         "righthand",
        "LShoulder":      "leftshoulder",
        "LArm":           "leftarm",
        "LElbow":         "leftforearm",
        "LHandThumb":     "lefthandthumb1",
        "LHandThumb2":    "lefthandthumb2",
        "LHandThumb3":    "lefthandthumb3",
        "LHandThumb4":    "lefthandthumb4",
        "LHandIndex":     "lefthandindex1",
        "LHandIndex2":    "lefthandindex2",
        "LHandIndex3":    "lefthandindex3",
        "LHandIndex4":    "lefthandindex4",
        "LHandMiddle":    "lefthandmiddle1",
        "LHandMiddle2":   "lefthandmiddle2",
        "LHandMiddle3":   "lefthandmiddle3",
        "LHandMiddle4":   "lefthandmiddle4",
        "LHandRing":      "lefthandring1",
        "LHandRing2":     "lefthandring2",
        "LHandRing3":     "lefthandring3",
        "LHandRing4":     "lefthandring4",
        "LHandPinky":     "lefthandpinky1",
        "LHandPinky2":    "lefthandpinky2",
        "LHandPinky3":    "lefthandpinky3",
        "LHandPinky4":    "lefthandpinky4",
        "LWrist":         "lefthand",
        "LUpLeg":         "leftupleg",
        "LLeg":           "leftleg",
        "LFoot":          "leftfoot",
        "RUpLeg":         "rightupleg",
        "RLeg":           "rightleg",
        "RFoot":          "rightfoot",
    };
    /**
     * Retargets animations and/or current poses from one skeleton to another. 
     * Both skeletons must have the same bind pose (same orientation for each mapped bone) in order to properly work.
     * Use optional parameters to adjust the bind pose.
     * @param srcSkeleton Skeleton of source avatar. Its bind pose must be the same as trgSkeleton. The original skeleton is cloned and can be safely modified
     * @param trgSkeleton Same as srcSkeleton but for the target avatar
     * @param options.srcPoseMode BindPoseModes enum values. Pose of the srcSkeleton that will be used as the bind pose for the retargeting. By default, skeleton's actual bind pose is used.
     * @param options.trgPoseMode BindPoseModes enum values. Same as srcPoseMode but for the target avatar.

     * @param options.srcEmbedWorldTransforms Bool. Retargeting only takes into account transforms from the actual bone objects. 
     * If set to true, external (parent) transforms are computed and embedded into the root joint. 
     * Afterwards, parent transforms/matrices can be safely modified and will not affect in retargeting.
     * Useful when it is easier to modify the container of the skeleton rather than the actual skeleton in order to align source and target poses
     * @param options.trgEmbedWorldTransforms Same as srcEmbedWorldTransforms but for the target avatar
     * @param options.boneNameMap String-to-string mapping between src and trg through bone names. Only supports one-to-one mapping
     */
    constructor( srcSkeleton, trgSkeleton, options = {} ){

        this.srcSkeleton = srcSkeleton; // original ref
        if ( !srcSkeleton.boneInverses ){ // find its skeleton
            srcSkeleton.traverse( (o) => { if( o.isSkinnedMesh ){ this.srcSkeleton = o.skeleton; } } );
        }
        this.trgSkeleton = trgSkeleton; // original ref
        if ( !trgSkeleton.boneInverses ){ // find its skeleton
            trgSkeleton.traverse( (o) => { if( o.isSkinnedMesh ){ this.trgSkeleton = o.skeleton; } } );
        }        

        this.boneMap = this.computeBoneMap( this.srcSkeleton, this.trgSkeleton, options.boneNameMap ); // { idxMap: [], nameMape:{} }
        this.srcBindPose = this.cloneRawSkeleton( this.srcSkeleton, options.srcPoseMode, options.srcEmbedWorldTransforms ); // returns pure skeleton, without any object model applied 
        this.trgBindPose = this.cloneRawSkeleton( this.trgSkeleton, options.trgPoseMode, options.trgEmbedWorldTransforms ); // returns pure skeleton, without any object model applied

        this.precomputedQuats = this.precomputeRetargetingQuats();
        this.proportionRatio = this.computeProportionRatio(); // returns an aproximate ratio of lengths between source skeleton and target skeleton
    }

    /**
     * creates a Transform object with identity values
     * @returns Transform
     */
    _newTransform(){ return { p: new THREE.Vector3(0,0,0), q: new THREE.Quaternion(0,0,0,1), s: new THREE.Vector3(1,1,1) }; }

    /**
     * Deep clone of the skeleton. New bones are generated. Skeleton's parent objects will not be linked to the cloned one
     * Returned skeleton has new attributes: 
     *  - Always: .parentIndices, .transformsWorld, .transformsWorldInverses
     *  - embedWorld == true:  .transformsWorldEmbedded
     * @param {THREE.Skeleton} skeleton 
     * @returns {THREE.Skeleton}
     */
    cloneRawSkeleton( skeleton, poseMode, embedWorld = false ){
        let bones = skeleton.bones;
       
        let resultBones = new Array( bones.length );
        let parentIndices = new Int16Array( bones.length );

        // bones[0].clone( true ); // recursive
        for( let i = 0; i < bones.length; ++i ){
            resultBones[i] = bones[i].clone(false);
            resultBones[i].parent = null;
        }
        
        for( let i = 0; i < bones.length; ++i ){
            let parentIdx = findIndexOfBone( skeleton, bones[i].parent )
            if ( parentIdx > -1 ){ resultBones[ parentIdx ].add( resultBones[ i ] ); }
            
            parentIndices[i] = parentIdx;
        }

        resultBones[0].updateWorldMatrix( false, true ); // assume 0 is root. Update all global matrices (root does not have any parent)
        
        // generate skeleton
        let resultSkeleton;
        switch(poseMode) {
            case AnimationRetargeting.BindPoseModes.CURRENT: 
                resultSkeleton = new THREE.Skeleton( resultBones ); // will automatically compute the inverses from the matrixWorld of each bone               
                
                break;
            default:
                let boneInverses = new Array( skeleton.boneInverses.length );
                for( let i = 0; i < boneInverses.length; ++i ) { 
                    boneInverses[i] = skeleton.boneInverses[i].clone(); 
                }
                resultSkeleton = new THREE.Skeleton( resultBones, boneInverses );
                resultSkeleton.pose();
                break;
        }
        
        resultSkeleton.parentIndices = parentIndices; // add this attribute to the THREE.Skeleton class

        // precompute transforms (forward and inverse) from world matrices
        let transforms = new Array( skeleton.bones.length );
        let transformsInverses = new Array( skeleton.bones.length );
        for( let i = 0; i < transforms.length; ++i ){
            let t = this._newTransform();
            resultSkeleton.bones[i].matrixWorld.decompose( t.p, t.q, t.s );
            transforms[i] = t;
            
            t = this._newTransform();
            resultSkeleton.boneInverses[i].decompose( t.p, t.q, t.s );
            transformsInverses[i] = t;
        }
        resultSkeleton.transformsWorld = transforms;
        resultSkeleton.transformsWorldInverses = transformsInverses;

        // embedded transform
        if ( embedWorld && bones[0].parent ){
            let embedded = { forward: this._newTransform(), inverse: this._newTransform() };
            let t = embedded.forward;
            bones[0].parent.updateWorldMatrix( true, false );
            bones[0].parent.matrixWorld.decompose( t.p, t.q, t.s );
            t = embedded.inverse;
            skeleton.bones[0].parent.matrixWorld.clone().invert().decompose( t.p, t.q, t.s );
            resultSkeleton.transformsWorldEmbedded = embedded;
        }
        return resultSkeleton;
    }


    /**
     * Maps bones from one skeleton to another given boneMap. 
     * Given a null bonemap, an automap is performed
     * @param {THREE.Skeleton} srcSkeleton 
     * @param {THREE.Skeleton} trgSkeleton 
     * @param {object} boneMap { string: string }
     * @returns {object} { idxMap: [], nameMape: {} }
     */
    computeBoneMap( srcSkeleton, trgSkeleton, boneMap = null ){
        let srcBones = srcSkeleton.bones;
        let trgBones = trgSkeleton.bones;
        let result = {
            idxMap: new Int16Array( srcBones.length ),
            nameMap: {}
        }
        result.idxMap.fill( -1 ); // default to no map;
        if ( boneMap ) {
            for ( let srcName in boneMap ){
                let idx = findIndexOfBoneByName( srcSkeleton, srcName );    
                if ( idx < 0 ){ continue; }
                let trgIdx = findIndexOfBoneByName( trgSkeleton, boneMap[ srcName ] ); // will return either a valid index or -1
                result.idxMap[ idx ] = trgIdx;
                result.nameMap[ srcName ] = boneMap[ srcName ];
            }
        }
        else {
            // automap
            const auxBoneMap = Object.keys(AnimationRetargeting.boneMap);
            this.srcBoneMap = computeAutoBoneMap( srcSkeleton );
            this.trgBoneMap = computeAutoBoneMap( trgSkeleton );
            if(this.srcBoneMap.idxMap.length && this.trgBoneMap.idxMap.length) {
                for(let i = 0; i < auxBoneMap.length; i++) {           
                    const name = auxBoneMap[i];
                    if(this.srcBoneMap.idxMap[i] < 0) {
                        continue;
                    }
                    result.idxMap[this.srcBoneMap.idxMap[i]] = this.trgBoneMap.idxMap[i];
                    result.nameMap[ this.srcBoneMap.nameMap[name]] = this.trgBoneMap.nameMap[name]; 
                }
            }
        }

        return result
    }

    /**
    * Computes an aproximate ratio of lengths between source skeleton and target skeleton
    */
    computeProportionRatio(){
        let srcLength = 0;        
        // Compute source sum of bone lengths
        for(let i = 1; i < this.srcBindPose.bones.length; i++) {
            let dist = this.srcBindPose.bones[i].getWorldPosition(new THREE.Vector3()).distanceTo(this.srcBindPose.bones[i].parent.getWorldPosition(new THREE.Vector3()))
            srcLength += dist;
        }

        let trgLength = 0;
        // Compute target sum of bone lengths
        for(let i = 1; i < this.trgBindPose.bones.length; i++) {
            let dist = this.trgBindPose.bones[i].getWorldPosition(new THREE.Vector3()).distanceTo(this.trgBindPose.bones[i].parent.getWorldPosition(new THREE.Vector3()))
            trgLength += dist;
        }        
        return trgLength / srcLength
    }

    precomputeRetargetingQuats(){
        //BASIC ALGORITHM --> trglocal = invBindTrgWorldParent * bindSrcWorldParent * srcLocal * invBindSrcWorld * bindTrgWorld
        // trglocal = invBindTrgWorldParent * invTrgEmbedded * srcEmbedded * bindSrcWorldParent * srcLocal * invBindSrcWorld * invSrcEmbedded * trgEmbedded * bindTrgWorld

        let left = new Array( this.srcBindPose.bones.length ); // invBindTrgWorldParent * invTrgEmbedded * srcEmbedded * bindSrcWorldParent
        let right = new Array( this.srcBindPose.bones.length ); // invBindSrcWorld * invSrcEmbedded * trgEmbedded * bindTrgWorld
        
        for( let srcIndex = 0; srcIndex < left.length; ++srcIndex ){
            let trgIndex = this.boneMap.idxMap[ srcIndex ];
            if( trgIndex < 0 ){ // not mapped, cannot precompute
                left[ srcIndex ] = null;
                right[ srcIndex ] = null;
                continue;
            }

            let resultQuat = new THREE.Quaternion(0,0,0,1);
            resultQuat.copy( this.trgBindPose.transformsWorld[ trgIndex ].q ); // bindTrgWorld
            if ( this.trgBindPose.transformsWorldEmbedded ) { resultQuat.premultiply( this.trgBindPose.transformsWorldEmbedded.forward.q ); } // trgEmbedded
            if ( this.srcBindPose.transformsWorldEmbedded ) { resultQuat.premultiply( this.srcBindPose.transformsWorldEmbedded.inverse.q ); } // invSrcEmbedded
            resultQuat.premultiply( this.srcBindPose.transformsWorldInverses[ srcIndex ].q ); // invBindSrcWorld
            right[ srcIndex ] = resultQuat;

            resultQuat = new THREE.Quaternion(0,0,0,1);
            // bindSrcWorldParent
            if ( this.srcBindPose.bones[ srcIndex ].parent ){ 
                let parentIdx = this.srcBindPose.parentIndices[ srcIndex ];
                resultQuat.premultiply( this.srcBindPose.transformsWorld[ parentIdx ].q ); 
            }

            if ( this.srcBindPose.transformsWorldEmbedded ) { resultQuat.premultiply( this.srcBindPose.transformsWorldEmbedded.forward.q ); } // srcEmbedded
            if ( this.trgBindPose.transformsWorldEmbedded ) { resultQuat.premultiply( this.trgBindPose.transformsWorldEmbedded.inverse.q ); } // invTrgEmbedded

            // invBindTrgWorldParent
            if ( this.trgBindPose.bones[ trgIndex ].parent ){ 
                let parentIdx = this.trgBindPose.parentIndices[ trgIndex ];
                resultQuat.premultiply( this.trgBindPose.transformsWorldInverses[ parentIdx ].q ); 
            } 
            left[ srcIndex ] = resultQuat
        }
        
        return { left: left, right: right };
    }

    /**
     * retargets the bone specified
     * @param {int} srcIndex MUST be a valid MAPPED bone. Otherwise it crashes
     * @param {THREE.Quaternion} srcLocalQuat 
     * @param {THREE.Quaternion} resultQuat if null, a new THREE.Quaternion is created
     * @returns resultQuat
     */
    _retargetQuaternion( srcIndex, srcLocalQuat, resultQuat = null ){
        if ( !resultQuat ){ resultQuat = new THREE.Quaternion(0,0,0,1); }
        //BASIC ALGORITHM --> trglocal = invBindTrgWorldParent * bindSrcWorldParent * srcLocal * invBindSrcWorld * bindTrgWorld
        // trglocal = invBindTrgWorldParent * invTrgEmbedded * srcEmbedded * bindSrcWorldParent * srcLocal * invBindSrcWorld * invSrcEmbedded * trgEmbedded * bindTrgWorld
        
        // In this order because resultQuat and srcLocalQuat might be the same Quaternion instance
        resultQuat.copy( srcLocalQuat ); // srcLocal
        resultQuat.premultiply( this.precomputedQuats.left[ srcIndex ] ); // invBindTrgWorldParent * invTrgEmbedded * srcEmbedded * bindSrcWorldParent
        resultQuat.multiply( this.precomputedQuats.right[ srcIndex ] ); // invBindSrcWorld * invSrcEmbedded * trgEmbedded * bindTrgWorld
        return resultQuat;
    }

    /**
     * Retargets the current whole (mapped) skeleton pose.
     * Currently, only quaternions are retargeted 
     */
    retargetPose(){      
        
        let m = this.boneMap.idxMap;        
        for ( let i = 0; i < m.length; ++i ){
            if ( m[i] < 0 ){ continue; }
            this._retargetQuaternion( i, this.srcSkeleton.bones[ i ].quaternion, this.trgSkeleton.bones[ m[i] ].quaternion );
        }
    }

    /**
     * 
     * assumes srcTrack IS a position track (VectorKeyframeTrack) with the proper values array and name (boneName.scale) 
     * @param {THREE.VectorKeyframeTrack} srcTrack 
     * @returns {THREE.VectorKeyframeTrack}
     */
    retargetPositionTrack( srcTrack ){
        let boneName = srcTrack.name.slice(0, srcTrack.name.length - 9 ); // remove the ".position"
        let boneIndex = findIndexOfBoneByName( this.srcSkeleton, boneName );
        if ( boneIndex < 0 || this.boneMap.idxMap[ boneIndex ] < 0 ){
            return null;
        } 
        // Retargets the root bone posiiton
        let srcValues = srcTrack.values;
        let trgValues = new Float32Array( srcValues.length );
        if( boneIndex == 0 ) { // asume the first bone is the root

            let trgBindPos = this.trgBindPose.bones[boneIndex].getWorldPosition(new THREE.Vector3());
            let srcBindPos = this.srcBindPose.bones[boneIndex].getWorldPosition(new THREE.Vector3());
						
            let pos = new THREE.Vector3();

            for( let i = 0; i < srcValues.length; i+=3 ){
                
                pos.set( srcValues[i], srcValues[i+1], srcValues[i+2]);
                let diffPosition = new THREE.Vector3();
                diffPosition.subVectors(pos, srcBindPos);

                // Scale the animation difference position with the scale diff between source and target and add it to the the Target Bind Position of the bone
                diffPosition.multiplyScalar(this.proportionRatio);
                if(this.srcBindPose.transformsWorldEmbedded) {
                    diffPosition.applyQuaternion(this.srcBindPose.transformsWorldEmbedded.forward.q);
                }
                if(this.trgBindPose.transformsWorldEmbedded) {
                    diffPosition.applyQuaternion(this.trgBindPose.transformsWorldEmbedded.inverse.q);
                }
			    diffPosition.add(trgBindPos);
                
                trgValues[i]   = diffPosition.x ;
                trgValues[i+1] = diffPosition.y ;
                trgValues[i+2] = diffPosition.z ;            
            }
        }
        // TODO missing interpolation mode. Assuming always linear. Also check if arrays are copied or referenced
        return new THREE.VectorKeyframeTrack( this.boneMap.nameMap[ boneName ] + ".position", srcTrack.times, trgValues ); 
    }
    
    /**
     * assumes srcTrack IS a quaternion track with the proper values array and name (boneName.quaternion) 
     * @param {THREE.QuaternionKeyframeTrack} srcTrack 
     * @returns {THREE.QuaternionKeyframeTrack}
     */
    retargetQuaternionTrack( srcTrack ){
        let boneName = srcTrack.name.slice(0, srcTrack.name.length - 11 ); // remove the ".quaternion"
        let boneIndex = findIndexOfBoneByName( this.srcSkeleton, boneName );
        if ( boneIndex < 0 || this.boneMap.idxMap[ boneIndex ] < 0 ){
            return null;
        } 

        let quat = new THREE.Quaternion( 0,0,0,1 );
        let srcValues = srcTrack.values;
        let trgValues = new Float32Array( srcValues.length );
        for( let i = 0; i < srcValues.length; i+=4 ){
            quat.set( srcValues[i], srcValues[i+1], srcValues[i+2], srcValues[i+3] );
            this._retargetQuaternion( boneIndex, quat, quat );
            trgValues[i] = quat.x;
            trgValues[i+1] = quat.y;
            trgValues[i+2] = quat.z;
            trgValues[i+3] = quat.w;
        }

        // TODO missing interpolation mode. Assuming always linear
        return new THREE.QuaternionKeyframeTrack( this.boneMap.nameMap[ boneName ] + ".quaternion", srcTrack.times, trgValues ); 
    }

    /**
     * NOT IMPLEMENTEED
     * assumes srcTrack IS a scale track (VectorKeyframeTrack) with the proper values array and name (boneName.scale) 
     * @param {THREE.VectorKeyframeTrack} srcTrack 
     * @returns {THREE.VectorKeyframeTrack}
     */
    retargetScaleTrack( srcTrack ){
        let boneName = srcTrack.name.slice(0, srcTrack.name.length - 6 ); // remove the ".scale"
        let boneIndex = findIndexOfBoneByName( this.srcSkeleton, boneName );
        if ( boneIndex < 0 || this.boneMap.idxMap[ boneIndex ] < 0 ){
            return null;
        } 
        // TODO

        // TODO missing interpolation mode. Assuming always linear. Also check if arrays are copied or referenced
        return new THREE.VectorKeyframeTrack( this.boneMap.nameMap[ boneName ] + ".scale", srcTrack.times, srcTrack.values ); 
    }

    /**
     * Given a clip, all tracks with a mapped bone are retargeted.
     * Currently only quaternions are retargeted
     * @param {THREE.AnimationClip} anim 
     * @returns {THREE.AnimationClip}
     */
    retargetAnimation( anim ){
        let trgTracks = [];
        let srcTracks = anim.tracks;
        for( let i = 0; i < srcTracks.length; ++i ){
            let t = srcTracks[i];
            let newTrack = null;
            if ( t.name.endsWith( ".position" ) && t.name.includes(this.srcSkeleton.bones[0].name) ){ newTrack = this.retargetPositionTrack( t ); } // ignore for now
            else if ( t.name.endsWith( ".quaternion" ) ){ newTrack = this.retargetQuaternionTrack( t ); }
            else if ( t.name.endsWith( ".scale" ) ){ newTrack = this.retargetScaleTrack( t ); } // ignore for now

            if ( newTrack ){ trgTracks.push( newTrack ); }
        } 

        // negative duration: automatically computes proper duration of animation based on tracks
        return new THREE.AnimationClip( anim.name, -1, trgTracks, anim.blendMode ); 
    }
}

// ---- HELPERS ----
// should be moved into a "utils" file 

// O(n)
function findIndexOfBone( skeleton, bone ){
    if ( !bone ){ return -1;}
    let b = skeleton.bones;
    for( let i = 0; i < b.length; ++i ){
        if ( b[i] == bone ){ return i; }
    }
    return -1;
}

// O(nm)
function findIndexOfBoneByName( skeleton, name ){
    if ( !name ){ return -1; }
    let b = skeleton.bones;
    for( let i = 0; i < b.length; ++i ){
        if ( b[i].name == name ){ return i; }
    }
    return -1;
}

// sets bind quaternions only. Warning: Not the best function to call every frame.
function forceBindPoseQuats( skeleton, skipRoot = false ){
    let bones = skeleton.bones;
    let inverses = skeleton.boneInverses;
    if ( inverses.length < 1 ){ return; }
    let boneMat = inverses[0].clone(); 
    let _ignoreVec3 = new THREE.Vector3();
    for( let i = 0; i < bones.length; ++i ){
        boneMat.copy( inverses[i] ); // World to Local
        boneMat.invert(); // Local to World

        // get only the local matrix of the bone (root should not need any change)
        let parentIdx = findIndexOfBone( skeleton, bones[i].parent );
        if ( parentIdx > -1 ){ boneMat.premultiply( inverses[ parentIdx ] ); }
        else{
            if ( skipRoot ){ continue; }
        }
       
        boneMat.decompose( _ignoreVec3, bones[i].quaternion, _ignoreVec3 );
        // bones[i].quaternion.setFromRotationMatrix( boneMat );
        bones[i].quaternion.normalize(); 
    }
}

/**
     * Apply a T-pose shape to the passed skeleton.     
     * @param {THREE.Skeleton} skeleton 
     * @param {Object} map 
     */
function applyTPose(skeleton, map) {
     
    if(!map) {
        map = computeAutoBoneMap(skeleton);
        map = map.nameMap;
    }
    else {
        if(Object.values(map).every(value => value === null)) {
            map = computeAutoBoneMap(skeleton);
            map = map.nameMap;
        }
    }
    
    let resultSkeleton = skeleton;
    // Check if spine is extended 
    let spineBase = resultSkeleton.getBoneByName(map.BelowStomach); // spine
    let spineChild = spineBase.children[0];
    let spineParent = spineBase; 
    let parent = spineParent.parent;
    while(parent && parent.isBone) {
        let pos = spineParent.getWorldPosition(new THREE.Vector3());
        let parentPos = parent.getWorldPosition(new THREE.Vector3());  
        // Compute direction (parent-to-child)
        let dir = new THREE.Vector3(); 
        dir.subVectors(pos, parentPos).normalize();
        alignBoneToAxis(spineParent, dir);
        spineChild = spineChild.parent;
        spineParent = spineParent.parent; 
        parent = spineParent.parent;
    }
    
    //------------------------------------ LOOK AT Z-AXIS ------------------------------------//
    // Check if the resultSkeleton is oriented in the +Z using the plane formed by left up and the hips
    let leftBaseLeg = resultSkeleton.getBoneByName(map.LUpLeg); // left up leg
    if(!leftBaseLeg) {
        return skeleton;
    }
    let hips = leftBaseLeg.parent; // hips
    if(!hips) {
        return skeleton;
    }
    let leftBaseLegPos = leftBaseLeg.getWorldPosition(new THREE.Vector3());
    let hipsPos = hips.getWorldPosition(new THREE.Vector3());        // new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld); // BEST PERFORMANCE

    // Compute up leg direciton
    let lefLegDir = new THREE.Vector3();
    lefLegDir.subVectors(leftBaseLegPos, hipsPos).normalize();

    spineBase = resultSkeleton.getBoneByName(map.BelowStomach); // spine
    const spineBasePos = spineBase.getWorldPosition(new THREE.Vector3());
    
    // Compute spine direction
    let spineDir = new THREE.Vector3();
    let spineDirO = new THREE.Vector3();
    spineDirO.subVectors(spineBasePos, hipsPos);
    spineDir.subVectors(spineBasePos, hipsPos).normalize();
    
    // Compute perpendicular axis between left up and hips-spine
    let axis = new THREE.Vector3();        
    axis.crossVectors(lefLegDir, spineDir).normalize();

    let zAxis = new THREE.Vector3(0, 0, 1);
    // Compute angle (rad) between perpendicular axis and z-axis
    let angle = (zAxis).angleTo(axis);
   
    if(Math.abs(angle) > 0.001) {
        let rot = new THREE.Quaternion();//.setFromAxisAngle(yAxis, -angle);

        // Get spine bone global rotation 
        let hipsRot = hips.getWorldQuaternion(new THREE.Quaternion());
        // Apply computed rotation to the spine bone global rotation
        rot = rot.setFromUnitVectors(axis, zAxis)
        spineDirO.applyQuaternion(rot);
        hipsRot = hipsRot.premultiply(rot);
        
        if (hips.parent) {
            let parent = hips.parent;
            let hipsParentRot = parent.getWorldQuaternion(new THREE.Quaternion());
            // Convert new spine bone global rotation to local rotation and set to the bone
            hips.quaternion.copy(hipsRot.premultiply(hipsParentRot.invert()));
            // let hipsParentPos = parent.getWorldPosition(new THREE.Vector3());

            // hips.position.copy(spineDirO.sub(hipsParentPos));

        }
        else {
            hips.quaternion.copy(hipsRot);
            hips.position.copy(spineDirO);
        }
        // Update bone matrix and children matrices
        hips.updateMatrix();
        hips.updateMatrixWorld(true, true);
    }
    // Check if spine follows +Y axis
    spineBase = resultSkeleton.getBoneByName(map.BelowStomach); // spine
    let yAxis = new THREE.Vector3(0, 1, 0);
    alignBoneToAxis(hips, yAxis, spineBase);

    //------------------------------------ LEGS ALIGNED TO Y-AXIS ------------------------------------//
    // Check if left leg is extended
    let leftLegEnd = resultSkeleton.getBoneByName(map.LFoot); // foot
    if(!leftLegEnd) {
        return skeleton;
    }
    let leftLegBase = leftLegEnd.parent; // knee
    parent = leftLegBase.parent; // up-leg
    
    let leftLegBasePos = leftLegBase.getWorldPosition(new THREE.Vector3());
    let parentPos = parent.getWorldPosition(new THREE.Vector3());  

    // Compute up leg direction (up-leg-to-knee)
    let leftLegBaseDir = new THREE.Vector3(); 
    leftLegBaseDir.subVectors(leftLegBasePos, parentPos).normalize();
    alignBoneToAxis(leftLegBase, leftLegBaseDir);

    // Check if left leg follow the -Y axis
    yAxis = new THREE.Vector3(0, -1, 0);
    leftLegEnd = resultSkeleton.getBoneByName(map.LFoot);
    leftLegBase = leftLegEnd.parent;

    alignBoneToAxis(parent, yAxis);
    
    // Compute perpendicular axis between left leg and left foot
    leftLegBasePos = leftLegEnd.getWorldPosition(new THREE.Vector3());
    let child = leftLegEnd.children[0].children.length ? leftLegEnd.children[0].children[0] : leftLegEnd.children[0];
    let childPos = child.getWorldPosition(new THREE.Vector3());  

    // Compute leg direction (foot-to-footend)
    leftLegBaseDir.subVectors(childPos, leftLegBasePos).normalize();
    
    axis.crossVectors(leftLegBaseDir, yAxis).normalize();
    var xAxis = new THREE.Vector3(1, 0, 0);

    // Compute angle (rad) between perpendicular axis and x-axis
    angle = (xAxis).angleTo(axis);
    
    if(Math.abs(angle) > 0.001) {
        let rot = new THREE.Quaternion();//.setFromAxisAngle(yAxis, -angle);

        // Get foot bone global rotation 
        let footRot = leftLegEnd.getWorldQuaternion(new THREE.Quaternion());
        // Apply computed rotation to the foot bone global rotation
        rot = rot.setFromUnitVectors(axis, xAxis)
        leftLegBaseDir.applyQuaternion(rot);
        footRot.premultiply(rot);
        
        if (leftLegEnd.parent) {
            let parent = leftLegEnd.parent;
            let footParentRot = parent.getWorldQuaternion(new THREE.Quaternion());
            // Convert new spine bone global rotation to local rotation and set to the bone
            leftLegEnd.quaternion.copy(footRot.premultiply(footParentRot.invert()));
        }
        else {
            leftLegEnd.quaternion.copy(footRot);
        }
        // Update bone matrix and children matrices
        leftLegEnd.updateMatrix();
        leftLegEnd.updateMatrixWorld(true, true);
    }

    // Check if right leg is extended
    let rightLegEnd = resultSkeleton.getBoneByName(map.RFoot); // foot
    if(!rightLegEnd) {
        return skeleton;
    }
    let rightLegBase = rightLegEnd.parent; // knee
    parent = rightLegBase.parent; // up-leg
    
    let rightLegBasePos = rightLegBase.getWorldPosition(new THREE.Vector3());
    parentPos = parent.getWorldPosition(new THREE.Vector3());  

    // Compute up leg direction (up-leg-to-knee)
    let rightLegBaseDir = new THREE.Vector3(); 
    rightLegBaseDir.subVectors(rightLegBasePos, parentPos).normalize();
    alignBoneToAxis(rightLegBase, rightLegBaseDir);

    // Check if right leg follow the -Y axis
    rightLegEnd = resultSkeleton.getBoneByName(map.RFoot);
    rightLegBase = rightLegEnd.parent;

    alignBoneToAxis(parent, yAxis);
           
    // child = rightLegEnd;
    // parent = rightLegBase;
    // while(child && child.isBone && child.children.length) {
    //     let pos = parent.getWorldPosition(new THREE.Vector3());
    //     let parentPos = parent.parent.getWorldPosition(new THREE.Vector3());  
    //     // Compute direction (parent-to-child)
    //     let dir = new THREE.Vector3(); 
    //     dir.subVectors(pos, parentPos).normalize();
    //     this.alignBoneToAxis(child, dir);
    //     parent = child;             
    //     child = child.children[0];
    // }

    // Compute perpendicular axis between right leg and right foot
    rightLegBasePos = rightLegEnd.getWorldPosition(new THREE.Vector3());
    child = rightLegEnd.children[0].children.length ? rightLegEnd.children[0].children[0] : rightLegEnd.children[0];
    childPos = child.getWorldPosition(new THREE.Vector3());  

    // Compute leg direction (foot-to-footend)
    rightLegBaseDir.subVectors(childPos, rightLegBasePos).normalize();
    
    axis.crossVectors(rightLegBaseDir, yAxis).normalize();
    xAxis = new THREE.Vector3(1, 0, 0);

    // Compute angle (rad) between perpendicular axis and x-axis
    angle = (xAxis).angleTo(axis);
    
    if(Math.abs(angle) > 0.001) {
        let rot = new THREE.Quaternion();//.setFromAxisAngle(yAxis, -angle);

        // Get foot bone global rotation 
        let footRot = rightLegEnd.getWorldQuaternion(new THREE.Quaternion());
        // Apply computed rotation to the foot bone global rotation
        rot = rot.setFromUnitVectors(axis, xAxis)
        rightLegBaseDir.applyQuaternion(rot);
        footRot.premultiply(rot);
        
        if (rightLegEnd.parent) {
            let parent = rightLegEnd.parent;
            let footParentRot = parent.getWorldQuaternion(new THREE.Quaternion());
            // Convert new spine bone global rotation to local rotation and set to the bone
            rightLegEnd.quaternion.copy(footRot.premultiply(footParentRot.invert()));
        }
        else {
            rightLegEnd.quaternion.copy(footRot);
        }
        // Update bone matrix and children matrices
        rightLegEnd.updateMatrix();
        rightLegEnd.updateMatrixWorld(true, true);
    }
    //------------------------------------ ARMS COMPLETLY EXTENDED AND ALIGNED TO X-AXIS ------------------------------------//
    //LEFT
        
    // Check if left arm follow the +X axis
    let lArm = resultSkeleton.getBoneByName(map.LArm).parent;
    var xAxis = new THREE.Vector3(1, 0, 0);
    alignBoneToAxis(lArm, xAxis);
    // Check if left arm is extended
    let leftEnd = resultSkeleton.getBoneByName(map.LWrist); // hand
    let leftBase = leftEnd.parent; 
    parent = leftBase.parent; 
    let spine = resultSkeleton.getBoneByName(map.ShouldersUnion);

    while(parent != spine) {
        let pos = leftBase.getWorldPosition(new THREE.Vector3());
        let parentPos = parent.getWorldPosition(new THREE.Vector3());  
        // Compute direction (parent-to-child)
        let dir = new THREE.Vector3(); 
        dir.subVectors(pos, parentPos).normalize();
        alignBoneToAxis(leftBase, dir);
        leftEnd = leftEnd.parent;
        leftBase = leftBase.parent; 
        parent = leftBase.parent;
    }

    leftEnd = resultSkeleton.getBoneByName(map.LWrist);
    const innerLoop = (parent) => {
        child = parent.children[0];
        while(parent.children.length) {
            let pos = child.getWorldPosition(new THREE.Vector3());
            let parentPos = parent.getWorldPosition(new THREE.Vector3());  

            alignBoneToAxis(parent, xAxis);
            parent = child;
            child = parent.children[0];
        }
    }
    for(let i = 0; i < leftEnd.children.length; i++) {
        innerLoop(leftEnd.children[i]);
    }
   
    //RIGHT
    // Check if right arm follow the -X axis
   let rArm = resultSkeleton.getBoneByName(map.RArm).parent;
   var xAxis = new THREE.Vector3(-1, 0, 0);
   alignBoneToAxis(rArm, xAxis);
   // Check if right arm is extended
   let rightEnd = resultSkeleton.getBoneByName(map.RWrist); // hand
   let rightBase = rightEnd.parent; 
   parent = rightBase.parent; 
   spine = resultSkeleton.getBoneByName(map.ShouldersUnion);
   while(parent != spine) {
       let pos = rightBase.getWorldPosition(new THREE.Vector3());
       let parentPos = parent.getWorldPosition(new THREE.Vector3());  
       // Compute direction (parent-to-child)
       let dir = new THREE.Vector3(); 
       dir.subVectors(pos, parentPos).normalize();
       alignBoneToAxis(rightBase, dir);
       rightEnd = rightEnd.parent;
       rightBase = rightBase.parent; 
       parent = rightBase.parent;
   }

    rightEnd = resultSkeleton.getBoneByName(map.RWrist);

    for(let i = 0; i < rightEnd.children.length; i++) {
        innerLoop(rightEnd.children[i]);
    }

    // resultSkeleton.calculateInverses();
    resultSkeleton.update(); 
    return {skeleton: resultSkeleton, map};
}

/**
 * Rotate the given bone in order to be aligned with the specified axis
 * @param {THREE.Bone} bone 
 * @param {THREE.Vector3} axis 
 */
function alignBoneToAxis(bone, axis, child) {
    bone.updateMatrixWorld(true, true);
    // Get global positions
    const bonePos = bone.getWorldPosition(new THREE.Vector3());
    const childPos = child ? child.getWorldPosition(new THREE.Vector3()) : bone.children[0].getWorldPosition(new THREE.Vector3());        
    
    // Compute the unitary direction of the bone from its position and its child position
    let dir = new THREE.Vector3();
    dir.subVectors(childPos, bonePos).normalize();
    
    // Compute angle (rad) between the bone direction and the axis
    let angle = (dir).angleTo(axis);
    if(Math.abs(angle) > 0.001) {
        // Compute the perpendicular unitary axis between the directions
        let perpVector = new THREE.Vector3();
        perpVector.crossVectors(axis, dir).normalize();
        let rot = new THREE.Quaternion().setFromAxisAngle(perpVector, -angle);
        // Get bone global rotation 
        let boneRot = bone.getWorldQuaternion(new THREE.Quaternion());
        // Apply computed rotation to the bone global rotation
        boneRot = boneRot.premultiply(rot);
        
        if (bone.parent) {
            let parent = bone.parent;
            let boneParentRot = parent.getWorldQuaternion(new THREE.Quaternion());
            // Convert new bone global rotation to local rotation and set to the it
            bone.quaternion.copy(boneRot.premultiply(boneParentRot.invert()));
            // Update bone matrix and children matrices
        }
        else {
            bone.quaternion.copy(boneRot);
        }
        bone.updateMatrix();
        bone.updateMatrixWorld(false, true);
    }
}
   

/**
 * Maps automatically bones from the skeleton to an auxiliar map. 
 * Given a null bonemap, an automap is performed
 * @param {THREE.Skeleton} srcSkeleton 
 * @returns {object} { idxMap: [], nameMape: {} }
 */
function computeAutoBoneMap( skeleton ){
    const auxBoneMap = Object.keys(AnimationRetargeting.boneMap);
    let bones = skeleton.bones;
    let result = {
        idxMap: new Int16Array( auxBoneMap.length ),
        nameMap: {} 
    };

    result.idxMap.fill( -1 ); // default to no map;
    // automap
    for(let i = 0; i < auxBoneMap.length; i++) {
        const auxName = auxBoneMap[i];
        for( let j = 0; j < bones.length; ++j ){
            let name = bones[j].name;
            if ( typeof( name ) !== "string" ){ continue; }
            name = name.toLowerCase().replace( "mixamorig", "" ).replace( /[`~!@#$%^&*()_|+\-=?;:'"<>\{\}\\\/]/gi, "" );
            if ( name.length < 1 ){ continue; }
            if(name.toLowerCase().includes(auxName.toLocaleLowerCase()) || name.toLowerCase().includes(AnimationRetargeting.boneMap[auxName].toLocaleLowerCase())) {
                result.nameMap[auxName] = bones[j].name;
                result.idxMap[i] = j;
                break;
            }
        }                
    }
    return result;
}
export { AnimationRetargeting, findIndexOfBone, findIndexOfBoneByName, forceBindPoseQuats, applyTPose, computeAutoBoneMap };
