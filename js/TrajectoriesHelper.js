import * as THREE from 'three'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Line2 } from 'three/addons/lines/Line2.js';

class TrajectoriesHelper {
    constructor( object, mixer ) {
        this.mixer = mixer;        
        this.object = object;

        this.trajectories = {
            "LeftHand": new THREE.Group( { name: "LeftHand", thickness: 8 }),
            "LeftHandThumb4": new THREE.Group( { name: "LeftHandThumb4", thickness: 6, color: new THREE.Color("#51A3A3") } ),
            "LeftHandIndex4": new THREE.Group( { name: "LeftHandIndex4", thickness: 6, color: new THREE.Color("#75485E")} ),
            "LeftHandMiddle4": new THREE.Group( { name: "LeftHandMiddle4", thickness: 6, color: new THREE.Color("#CB904D") } ),
            "LeftHandRing4": new THREE.Group( { name: "LeftHandRing4", thickness: 6, color: new THREE.Color("#DFCC74") } ),
            "LeftHandPinky4": new THREE.Group( { name: "LeftHandPinky4", thickness: 6, color: new THREE.Color("#C3E991") } ),
            "RightHand": new THREE.Group( { name: "RightHand", thickness: 8 } ),
            "RightHandThumb4": new THREE.Group( { name: "RightHandThumb4", thickness: 6, color: new THREE.Color("#51A3A3")} ),
            "RightHandIndex4": new THREE.Group( { name: "RightHandIndex4", thickness: 6, color: new THREE.Color("#75485E") } ),
            "RightHandMiddle4": new THREE.Group( { name: "RightHandMiddle4", thickness: 6, color: new THREE.Color("#CB904D") } ),
            "RightHandRing4": new THREE.Group( { name: "RightHandRing4", thickness: 6, color: new THREE.Color("#DFCC74") } ),
            "RightHandPinky4": new THREE.Group( { name: "RightHandPinky4", thickness: 6, color: new THREE.Color("#C3E991") } ),
        }

        for( const t in this.trajectories) {
            this.trajectories[t].thickness = 6;
            if(t.includes("Thumb")) {
                this.trajectories[t].color = new THREE.Color("#51A3A3");//"#DBC2CF");
            }
            else if(t.includes("Index")) {
                this.trajectories[t].color = new THREE.Color("#75485E");//"#9FA2B2");
            }
            else if(t.includes("Middle")) {
                this.trajectories[t].color = new THREE.Color("#CB904D");//"#3C7A89");
            }
            else if(t.includes("Ring")) {
                this.trajectories[t].color = new THREE.Color("#DFCC74");//"#2E4756");
            }
            else if(t.includes("Pinky")) {
                this.trajectories[t].color = new THREE.Color("#C3E991");//"#16262E");
            }
            else {
                this.trajectories[t].thickness = 8;
            }
        }
        this.trajectoryStart = 0;
        this.trajectoryEnd = 100;
    }
        
    computeTrajectories( animation ) {
        let boneName = null;

        for(let i = 0; i < animation.mixerBodyAnimation.tracks.length; i++) {
            const track = animation.mixerBodyAnimation.tracks[i]
            const trackName = track.name;
            for(let trajectory in this.trajectories) {

                if(trackName.includes(trajectory+".") || trackName.includes(trajectory.replace("4","EndSite")+".")) {
                    boneName = trackName.replace(".quaternion", "");
                    if(boneName) {
                        this.trajectories[trajectory].name = boneName;
                        const isHand = trajectory == "LeftHand" || trajectory == "RightHand";
                        if(isHand) { // Add hand trajectories to the model object
                            const root = this.object;
                            root.remove(this.trajectories[trajectory]);
                            root.add(this.trajectories[trajectory]);
                        }
                        else { // Add finger trajectories to the first joint of the finger
                            const root = this.object.getObjectByName(boneName.replace("4","1").replace("EndSite","1"));
                            root.remove(this.trajectories[trajectory]);
                            root.add(this.trajectories[trajectory]);
                        }
                        break;
                    }
                }
            }
        }
        const mixer = this.mixer;//this.performs.currentCharacter.mixer;
        const track = animation.mixerBodyAnimation.tracks[0];
        this.trajectoryEnd = track.times.length;

        const findFirstFingerJoint = (bone) => {
            let name = bone.name.replace("mixamorig","").replaceAll("_","").replaceAll(":","");
            while (bone && !name.includes("1")) {
                bone = bone.parent;
                name = bone.name.replace("mixamorig","").replaceAll("_","").replaceAll(":","");
            }
            return bone;
        };

        for(let trajectory in this.trajectories) {
            this.trajectories[trajectory].clear();
            const boneName = this.trajectories[trajectory].name;
            const positions = [];
            const colors = [];

            for(let t = 0; t < track.times.length-1; t++) {
                // First frame
                mixer.setTime(track.times[t]);
               this.object.updateMatrixWorld(true);

                const bone =this.object.getObjectByName(boneName);
                const isHand = trajectory == "LeftHand" || trajectory == "RightHand";

                let localPosition = new THREE.Vector3();
                let rootWorldMatrix = new THREE.Matrix4().identity();

                if(!isHand) { // For fingers trajectories: Get fingertip position relative to the first joint of the finger
                    const root = findFirstFingerJoint(bone);
                    if (!bone || !root) continue;
                    const tipWorldMatrix = bone.matrixWorld.clone();
                    rootWorldMatrix = root.matrixWorld.clone();
                    const rootWorldInverse = new THREE.Matrix4().copy(rootWorldMatrix).invert();

                    const localMatrix = new THREE.Matrix4().multiplyMatrices(rootWorldInverse, tipWorldMatrix);
                    localPosition = new THREE.Vector3().setFromMatrixPosition(localMatrix);
                }
                else { // For hand trajectory : Get global position of the wrist
                    bone.getWorldPosition(localPosition);
                }

                // Second frame
                mixer.setTime(track.times[t+1]);
               this.object.updateMatrixWorld(true);
                
                const bone2 =this.object.getObjectByName(boneName);
                let localPosition2 = new THREE.Vector3();

                let rootWorldMatrix2 = new THREE.Matrix4().identity();
                if(!isHand) { // For fingers trajectories: Get fingertip position relative to the first joint of the finger
                    const root2 = findFirstFingerJoint(bone2);
                    if (!bone2 || !root2) continue;

                    const tipWorldMatrix2 = bone2.matrixWorld.clone();
                    rootWorldMatrix2 = root2.matrixWorld.clone();
                    const rootWorldInverse2 = new THREE.Matrix4().copy(rootWorldMatrix2).invert();

                    const localMatrix2 = new THREE.Matrix4().multiplyMatrices(rootWorldInverse2, tipWorldMatrix2);
                    localPosition2 = new THREE.Vector3().setFromMatrixPosition(localMatrix2);
                } else { // For hand trajectory : Get global position of the wrist
                    bone2.getWorldPosition(localPosition2);
                }

                const position = localPosition.clone();
                const position2 = localPosition2.clone()

                positions.push(position.x, position.y, position.z);
                const color = this.trajectories[trajectory].color || new THREE.Color(`hsl(${180*Math.sin( track.times[t]/Math.PI)}, 100%, 50%)`);
                colors.push(color.r, color.g, color.b, 0.8);
                colors.push(color.r, color.g, color.b, 0.8);
                // colors.push(color.r, color.g, color.b);

                const arrow = customArrow(position2.x, position2.y, position2.z, position.x, position.y, position.z,  this.trajectories[trajectory].thickness*0.0002, color)
                arrow.name = t;
                this.trajectories[trajectory].add(arrow);
            }
            if( !this.trajectoryEnd ) {
                this.computeTrajectories(animation);
                return;
            }
            // Create geometry
            const geometry = new MagicLineGeometry();
            geometry.setPositions(positions);
            geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 4 ) );
            geometry.setColors(colors);
            const material = new LineMaterial({
                vertexColors: true,
                dashed: false,
                alphaToCoverage: true,
                linewidth: this.trajectories[trajectory].thickness,
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                transparent: true,
            });
            material.resolution.set(window.innerWidth, window.innerHeight);

            const line = new Line2(geometry, material);
            line.name = "line";
            this.trajectories[trajectory].add(line);
            this.trajectories[trajectory].positions = positions;
            this.trajectories[trajectory].colors = colors;
        }
    }

    updateTrajectories( startTime, endTime ) {
        const mixer = this.mixer// this.performs.currentCharacter.mixer;
        const action = mixer._actions[0];
        if( !action ) {
            return;
        }

        // Get start frame index
        const startFrame = getFrameIndex(action, startTime);
        this.trajectoryStart = startFrame;
        
        // Get end frame index
        const endFrame = getFrameIndex(action, endTime);
        this.trajectoryEnd = endFrame;
    
        // Update material alpha for each trajectory (line and arrows)
        for( let trajectory in this.trajectories ) {
            const positions = this.trajectories[trajectory].positions;
            let colors = this.trajectories[trajectory].colors;

            const line = this.trajectories[trajectory].getObjectByName("line");
            const totalFrames = positions.length / 3;

            for(let frame = 0; frame < totalFrames; frame++) {
                const arrow = this.trajectories[trajectory].getObjectByName(frame);
                let alpha = 0;
                if( frame < startFrame ) {
                    alpha = (frame - startFrame)/10;
                }
                else if( frame > endFrame ) {
                    alpha = (endFrame - frame)/10;
                }
                const opacity = Math.max(0,Math.min(1,0.8 + alpha));
                colors[frame*8+3] = opacity;
                colors[frame*8+7] = opacity;

                arrow.children[0].material.opacity = opacity;
                if( opacity == 0 ) {
                    arrow.visible = false;
                }
                else {
                    arrow.visible = true;
                }
            }
            line.geometry.setColors(colors);
        }
    }

    show( ) {
        for( let trajectory in this.trajectories ) {
            this.trajectories[trajectory].visible = true;
        }
    }

    hide( ) {
        for( let trajectory in this.trajectories ) {
            this.trajectories[trajectory].visible = false;
        }
    }
}

// Array of objects. Each object is a frame with all world landmarks. See mediapipe.js detections
function createBodyAnimationFromWorldLandmarks( worldLandmarksArray, skeleton ){
    function getTwistQuaternion( q, normAxis, outTwist ){
        let dot =  q.x * normAxis.x + q.y * normAxis.y + q.z * normAxis.z;
        outTwist.set( dot * normAxis.x, dot * normAxis.y, dot * normAxis.z, q.w )
        outTwist.normalize(); // already manages (0,0,0,0) quaternions by setting identity
        return outTwist;
    }

    function computeSpine( skeleton, bindQuats, bodyLandmarks ){
        if ( !bodyLandmarks ){ return; }
        //bodyLandmarks is an array of {x,y,z,visiblity} (mediapipe)

        const boneHips = skeleton.bones[ 0 ];
        boneHips.quaternion.copy( bindQuats[ 0 ] );
        const boneSpine0 = skeleton.bones[ 1 ]; // connected to hips
        boneSpine0.quaternion.copy( bindQuats[ 1 ] );
        const boneSpine1 = skeleton.bones[ 2 ];
        boneSpine1.quaternion.copy( bindQuats[ 2 ] );
        const boneSpine2 = skeleton.bones[ 3 ];
        boneSpine2.quaternion.copy( bindQuats[ 3 ] );
        const boneLeftLeg = skeleton.bones[ 57 ]; // connected to hips
        const boneRightLeg = skeleton.bones[ 62 ]; // connected to hips


        boneHips.updateWorldMatrix( true, true );

        const landmarkHipsLeft = bodyLandmarks[ 23 ];
        const landmarkHipsRight = bodyLandmarks[ 24 ];
        const landmarkShoulderLeft = bodyLandmarks[ 11 ];
        const landmarkShoulderRight = bodyLandmarks[ 12 ];
        const landmarkHipsMid = new THREE.Vector3(0,0,0);
        const landmarkShoulderMid = new THREE.Vector3(0,0,0);
        let dirHipsPred = ( new THREE.Vector3() ).subVectors( landmarkHipsRight, landmarkHipsLeft );
        let dirShoulderPred = ( new THREE.Vector3() ).subVectors( landmarkShoulderRight, landmarkShoulderLeft );
        landmarkHipsMid.addScaledVector( dirHipsPred, 0.5).add( landmarkHipsLeft );
        landmarkShoulderMid.addScaledVector( dirShoulderPred, 0.5).add( landmarkShoulderLeft );
        let dirSpinePred = ( new THREE.Vector3() ).subVectors( landmarkShoulderMid, landmarkHipsMid ).normalize();

        const dirBone = new THREE.Vector3();
        const _ignoreVec3 = new THREE.Vector3();
        const invWorldQuat = new THREE.Quaternion();
        const qq = new THREE.Quaternion();
        const tempQuat = new THREE.Quaternion();

        // hips
        boneHips.matrixWorld.decompose( _ignoreVec3, invWorldQuat, _ignoreVec3 );
        invWorldQuat.invert();

        dirHipsPred.applyQuaternion( invWorldQuat ).normalize(); // world direction to local hips space
        dirBone.subVectors( boneRightLeg.position, boneLeftLeg.position ).normalize(); // Local hips space
        qq.setFromUnitVectors( dirBone, dirHipsPred ).normalize();
        let twist = getTwistQuaternion( qq, dirBone, tempQuat ); // remove unwanted roll forward/backward
        qq.multiply( twist.invert() );
        boneHips.quaternion.multiply( qq );
        invWorldQuat.premultiply( qq.invert() );

        // spine
        dirSpinePred.applyQuaternion( invWorldQuat ); // world direction to local hips space
        boneSpine2.updateWorldMatrix( true, false );
        dirBone.setFromMatrixPosition( boneSpine2.matrixWorld ); // world position of shoulders union
        dirBone.applyMatrix4( boneHips.matrixWorld.clone().invert() ); //world position to local direction hips space
        qq.setFromUnitVectors( dirBone, dirSpinePred ).normalize();
        // divide final rotation into for offset (one for each hips-spine bone) (nlerp with identityQuat)
        let f= 1.0/4.0;
        qq.x = qq.x * f;
        qq.y = qq.y * f;
        qq.z = qq.z * f;
        qq.w = qq.w * f + 1 * (1-f);
        qq.normalize();
        boneHips.quaternion.multiply(qq);

        // move qq from left_spine0_Quat to right_spine_Quat.
        // Q = (hips * qq) * spine0Quat = hips * (qq * spine0Quat) = hips * spine0Quat * qq'
        qq.multiply( boneSpine0.quaternion ).premultiply( tempQuat.copy( boneSpine0.quaternion ).invert() );
        boneSpine0.quaternion.multiply( qq );

        // Q = (spine0Quat * qq') * spine1Quat = spine0Quat * (qq' * spine1Quat) = spine0Quat * spine1Quat * qq''
        qq.multiply( boneSpine1.quaternion ).premultiply( tempQuat.copy( boneSpine1.quaternion ).invert() );
        boneSpine1.quaternion.multiply( qq );

        // // Q = (spine1Quat * qq'') * spine2Quat = spine1Quat * (qq'' * spine2Quat) = spine1Quat * spine2Quat * qq'''
        // qq.multiply( boneSpine2.quaternion ).premultiply( tempQuat.copy( boneSpine2.quaternion ).invert() );
        // boneSpine2.quaternion.multiply( qq );
        boneSpine2.quaternion.premultiply( qq );
    }

    function computeQuatHead( skeleton, bindQuats, bodyLandmarks ){
        if ( !bodyLandmarks ){ return; }
        //bodyLandmarks is an array of {x,y,z,visiblity} (mediapipe)

        let tempVec3 = new THREE.Vector3();
        let qq = new THREE.Quaternion();

        const boneHead = skeleton.bones[ 5 ]; // head
        boneHead.quaternion.copy( bindQuats[ 5 ] );
        let boneHeadTop = boneHead; // head top, must be a children of head
        for(let i = 0; i < boneHead.children.length; i++) {
            if(boneHead.children[i].name.toLowerCase().includes('eye')) {
                continue;
            }
            boneHeadTop = boneHead.children[i];
            break;
        }
        boneHead.updateWorldMatrix( true, false );
        // character bone local space direction
        let headBoneDir = boneHeadTop.position.clone().normalize();

        // world space
        let earsDirPred = (new THREE.Vector3()).subVectors( bodyLandmarks[8], bodyLandmarks[7] ).normalize();
        let earNoseDirPred = (new THREE.Vector3()).subVectors( bodyLandmarks[0], bodyLandmarks[7] ).normalize();
        let upHeadDirPred = (new THREE.Vector3()).crossVectors( earsDirPred, earNoseDirPred ).normalize(); // will change to local
        let forwardHeadDirPred = (new THREE.Vector3()).crossVectors( upHeadDirPred, earsDirPred ).normalize();

        boneHead.matrixWorld.decompose( tempVec3, qq, tempVec3 );
        qq.invert(); // invWorldQuat
        upHeadDirPred.applyQuaternion( qq ).normalize(); // local space

        // move head to predicted direction (SWING)
        qq.setFromUnitVectors( headBoneDir, upHeadDirPred );
        boneHead.quaternion.multiply( qq )
        getTwistQuaternion( qq, headBoneDir, qq ); // unwanted twist from the swing operation
        boneHead.quaternion.multiply( qq.invert() ).normalize(); // remove twist

        // compute head roll (TWIST)
        tempVec3.set(-1,0,0); // because of mediapipe points
        let angle = Math.acos( forwardHeadDirPred.dot( tempVec3 ) ); // computing in world space
        angle -= Math.PI/2;
        qq.setFromAxisAngle( headBoneDir, angle ); // angle does not which space is in
        boneHead.quaternion.multiply( qq ).normalize();
    }

    function computeQuatArm( skeleton, bodyLandmarks, isLeft = false ){
        if ( !bodyLandmarks ){ return; }
        //bodyLandmarks is an array of {x,y,z,visiblity} (mediapipe)

        let landmarks = isLeft? [ 11,13,15 ] : [ 12,14,16 ];
        let boneIdxs = isLeft? [ 10,11,12 ] : [ 34,35,36 ]; // [arm, elbow, wrist]

        let _ignoreVec3 = new THREE.Vector3();
        let invWorldQuat = new THREE.Quaternion();
        let dirPred = new THREE.Vector3();
        let dirBone = new THREE.Vector3();
        let qq = new THREE.Quaternion();
        let twist = new THREE.Quaternion();

        for( let i = 0; i < (landmarks.length-1); ++i ){
            let boneSrc = skeleton.bones[ boneIdxs[ i ] ];
            let boneTrg = skeleton.bones[ boneIdxs[ i+1 ] ];
            let landmarkSrc = bodyLandmarks[ landmarks[i] ];
            let landmarkTrg = bodyLandmarks[ landmarks[i+1] ];
            boneSrc.updateWorldMatrix( true, false );

            boneSrc.matrixWorld.decompose( _ignoreVec3, invWorldQuat, _ignoreVec3 );
            invWorldQuat.invert();

            // world mediapipe bone direction to local space
            dirPred.subVectors( landmarkTrg, landmarkSrc );
            dirPred.applyQuaternion( invWorldQuat ).normalize();

            // character bone local space direction
            dirBone.copy( boneTrg.position ).normalize();

            // move bone to predicted direction
            qq.setFromUnitVectors( dirBone, dirPred );
            boneSrc.quaternion.multiply( qq );
            getTwistQuaternion( qq, dirBone, twist ); // remove undesired twist from bone
            boneSrc.quaternion.multiply( twist.invert() ).normalize();
        }
    }

    function computeQuatHand( skeleton, handLandmarks, isLeft = false ){
        if ( !handLandmarks ){ return; }
        //handlandmarks is an array of {x,y,z,visiblity} (mediapipe)

        const boneHand = isLeft? skeleton.bones[ 12 ] : skeleton.bones[ 36 ];
        const boneMid = isLeft? skeleton.bones[ 21 ] : skeleton.bones[ 45 ];
        // const boneThumbd = isLeft? skeleton.bones[ 13 ] : skeleton.bones[ 53 ];
        const bonePinky = isLeft? skeleton.bones[ 29 ] : skeleton.bones[ 37 ];
        const boneIndex = isLeft? skeleton.bones[ 17 ] : skeleton.bones[ 49 ];

        boneHand.updateWorldMatrix( true, false );

        let _ignoreVec3 = new THREE.Vector3();
        let invWorldQuat = new THREE.Quaternion();
        boneHand.matrixWorld.decompose( _ignoreVec3, invWorldQuat, _ignoreVec3 ); // get L to W quat
        invWorldQuat.invert(); // W to L

        // metacarpian middle finger
        let mcMidPred = new THREE.Vector3();
        mcMidPred.subVectors( handLandmarks[9], handLandmarks[0] ); // world
        mcMidPred.applyQuaternion( invWorldQuat ).normalize(); // hand local space

        //swing (with unwanted twist)
        let dirBone = boneMid.position.clone().normalize();
        let qq = new THREE.Quaternion();
        qq.setFromUnitVectors( dirBone, mcMidPred );
        boneHand.quaternion.multiply( qq );
        invWorldQuat.premultiply( qq.invert() ); // update hand's world to local quat

        // twist
        let mcPinkyPred = (new THREE.Vector3()).subVectors( handLandmarks[17], handLandmarks[0] );
        let mcIndexPred = (new THREE.Vector3()).subVectors( handLandmarks[5], handLandmarks[0] );
        let palmDirPred = (new THREE.Vector3()).crossVectors(mcPinkyPred, mcIndexPred).normalize(); // world space
        palmDirPred.applyQuaternion( invWorldQuat ).normalize(); // local space
        let palmDirBone = (new THREE.Vector3()).crossVectors(bonePinky.position, boneIndex.position).normalize(); // local space. Cross product "does not care" about input sizes
        qq.setFromUnitVectors( palmDirBone, palmDirPred ).normalize();
        boneHand.quaternion.multiply( qq ).normalize();
    }

    /* TODO
        Consider moving the constraints direclty into the mediapipe landmarks.
        This would avoid unnecessary recomputations of constraints between different characters.
        Changes would be baked already in the mediapipe landmarks
    */
    function computeQuatPhalange( skeleton, bindQuats, handLandmarks, isLeft = false ){
        if ( !handLandmarks ){ return; }
        //handlandmarks is an array of {x,y,z,visiblity} (mediapipe)

        const bonePhalanges = isLeft ?
        [ 13,14,15,16,    17,18,19,20,    21,22,23,24,    25,26,27,28,    29,30,31,32 ] :
        [ 53,54,55,56,    49,50,51,52,    45,46,47,48,    41,42,43,44,    37,38,39,40 ];

        let tempVec3_1 = new THREE.Vector3();
        let tempVec3_2 = new THREE.Vector3();
        const invWorldQuat = new THREE.Quaternion();

        tempVec3_1.subVectors(handLandmarks[5], handLandmarks[0]).normalize();
        tempVec3_2.subVectors(handLandmarks[17], handLandmarks[0]).normalize();
        const handForward = (new THREE.Vector3()).addScaledVector(tempVec3_1,0.5).addScaledVector(tempVec3_2,0.5); // direction of fingers
        const handNormal = (new THREE.Vector3()).crossVectors(tempVec3_2,tempVec3_1).normalize(); // on right hand and left hand, direction from back of hand outwards
        const handSide = (new THREE.Vector3()).crossVectors(handNormal,handForward).normalize(); // on right hand, direction from center of hand to thumb side. On left hand, direction form center of hand to pinky side
        if ( isLeft ){
            handNormal.multiplyScalar(-1);
            handSide.multiplyScalar(-1);
        }

        const prevForward = new THREE.Vector3();
        const prevNormal = new THREE.Vector3();
        const prevSide = new THREE.Vector3();

        const maxLateralDeviation = Math.cos(60 * Math.PI/180);
        const latDevQuat = new THREE.Quaternion();
        const latDevNormal = new THREE.Vector3();

        // for each finger (and thumb)
        for( let f = 1; f < handLandmarks.length; f+=4){

            // fingers can slightly move laterally. Compute the mean lateral movement of the finger
            let meanSideDeviation = 0;
            tempVec3_1.subVectors(handLandmarks[f+1], handLandmarks[f+0]).normalize();
            meanSideDeviation += handSide.dot(tempVec3_1) * 1/3;
            const fingerBend = handNormal.dot(tempVec3_1);
            tempVec3_1.subVectors(handLandmarks[f+2], handLandmarks[f+1]).normalize();
            meanSideDeviation += handSide.dot(tempVec3_1) * 1/3;
            tempVec3_1.subVectors(handLandmarks[f+3], handLandmarks[f+2]).normalize();
            meanSideDeviation += handSide.dot(tempVec3_1) * 1/3;

            if (Math.abs(meanSideDeviation) > maxLateralDeviation){
                meanSideDeviation = (meanSideDeviation < 0) ? -maxLateralDeviation : maxLateralDeviation;
            }
            if ( fingerBend < 0){ // the more the finger is bended, the less it can be moved sideways
                meanSideDeviation *= 1+fingerBend;
            }
            // end of lateral computations

            // phalanges can bend. Thus, reference vectors need to be with respect to the last phalange (or the base of the hand)
            prevForward.copy(handForward);
            prevSide.copy(handSide);
            prevNormal.copy(handNormal);

            // for each phalange of each finger (and thumb)
            for( let i = 0; i < 3; ++i){
                const boneSrc = skeleton.bones[ bonePhalanges[ f + i-1 ] ];
                const boneTrg = skeleton.bones[ bonePhalanges[ f + i ] ];
                const landmark = f + i;
                boneSrc.quaternion.copy( bindQuats[ bonePhalanges[ f+i-1 ] ] );
                boneSrc.updateWorldMatrix( true, false );

                // world mediapipe phalange direction
                let v_phalange = new THREE.Vector3();
                v_phalange.subVectors( handLandmarks[landmark+1], handLandmarks[landmark] ).normalize();

                // fingers (no thumb). All lateral deviation is removed and added later on
                if ( f > 4 ){
                    // remove all lateral deviation (later will add the allowed one)
                    v_phalange.addScaledVector(handSide, -v_phalange.dot(handSide));
                    if (v_phalange.length() < 0.0001 ){
                        v_phalange.copy(prevForward);
                    }else{
                        v_phalange.normalize();
                    }

                    // prevForward and prevNormal do not have any lateral deviation
                    const dotForward = v_phalange.dot(prevForward);
                    const dotNormal = v_phalange.dot(prevNormal);

                    // finger cannot bend uppwards
                    if (dotNormal > 0){
                        v_phalange.copy( prevForward );
                    }else{
                        const limitForward = -0.76; // cos 40º
                        const limitNormal = -0.64; // sin 40º
                        // too much bending, restrict it (set default bended direction)
                        if ( dotForward < limitForward ){
                            v_phalange.set(0,0,0);
                            v_phalange.addScaledVector( prevForward, limitForward);
                            v_phalange.addScaledVector( prevNormal, limitNormal);
                        }
                    }

                    v_phalange.normalize();

                    prevNormal.crossVectors( v_phalange, handSide ).normalize();
                    prevForward.copy(v_phalange); // without any lateral deviation

                    // store lateral deviation rotation axis. As the finger could be bent, the fingerNormal and handNormal do not necessarily match.
                    if ( i == 0 ){
                        latDevNormal.copy( prevNormal );
                    }
                }
                else {
                    // thumb
                    if (i==0){
                        // base of thumb
                        const dotthumb = v_phalange.dot(handNormal);
                        const mint = -0.45;
                        const maxt = 0.0;
                        if ( dotthumb > maxt || dotthumb < mint ){
                            const clampDot = Math.max(mint, Math.min(maxt, dotthumb));
                            v_phalange.addScaledVector(handNormal, -dotthumb + clampDot);
                        }
                        prevForward.copy(handForward);
                        prevSide.copy(handNormal); // swap
                        prevNormal.copy(handSide); // swap
                        if ( isLeft ){
                            prevNormal.multiplyScalar(-1);
                        }
                    }
                    else{
                        // other thumb bones
                        // remove lateral deviation
                        v_phalange.addScaledVector(prevSide, -v_phalange.dot(prevSide));

                        // cannot bend on that direction
                        const dotNormal = v_phalange.dot(prevNormal);
                        if (dotNormal > 0){
                            v_phalange.addScaledVector(prevNormal, -dotNormal)
                        }
                    }

                    v_phalange.normalize();

                    if (v_phalange.length() < 0.0001 ){
                        v_phalange.copy(prevForward);
                    }

                    // update previous directions with the current ones
                    if ( isLeft ){
                        prevNormal.crossVectors( v_phalange, prevSide ).normalize();
                        prevSide.crossVectors( prevNormal, v_phalange ).normalize();
                        prevForward.copy(v_phalange);
                    }else{
                        prevNormal.crossVectors( prevSide, v_phalange ).normalize();
                        prevSide.crossVectors( v_phalange, prevNormal ).normalize();
                        prevForward.copy(v_phalange);
                    }
                }


                boneSrc.matrixWorld.decompose( tempVec3_1, invWorldQuat, tempVec3_1 );
                invWorldQuat.invert();
                // world phalange direction to local space
                v_phalange.applyQuaternion( invWorldQuat ).normalize();

                // character bone local space direction
                let phalange_p = boneTrg.position.clone().normalize();

                // move bone to predicted direction
                const rot = new THREE.Quaternion();
                const twist = new THREE.Quaternion();
                rot.setFromUnitVectors( phalange_p, v_phalange );
                getTwistQuaternion( rot, phalange_p, twist ); // remove undesired twist from phalanges
                boneSrc.quaternion.multiply( rot ).multiply( twist.invert() ).normalize();
            }// end of phalange for

            // add lateral deviation for fingers, only on the base bone. Right now, fingers are all in the plane ( Normal x Forward )
            if( f > 4 ){
                const boneSrc = skeleton.bones[ bonePhalanges[ f-1 ] ];
                boneSrc.updateMatrixWorld(true);
                let q = new THREE.Quaternion();
                boneSrc.matrixWorld.decompose(tempVec3_1, q, tempVec3_1);
                latDevNormal.applyQuaternion( q.invert() );
                latDevQuat.setFromAxisAngle( latDevNormal, (Math.PI-Math.acos(meanSideDeviation)) - Math.PI*0.5);
                boneSrc.quaternion.multiply(latDevQuat);
            }
        } // end of finger 'for'
    };

    skeleton.pose(); // bind pose

    let tracks = [];
    let bindQuats = [];
    for( let i = 0; i < skeleton.bones.length; ++i ){
        tracks.push( new Float32Array( worldLandmarksArray.length * 4 ) );
        bindQuats.push( skeleton.bones[i].quaternion.clone() );
    }
    let times = new Float32Array( worldLandmarksArray.length );
    let timeAcc = 0;

    // for each frame compute and update quaternions
    for( let i = 0; i < worldLandmarksArray.length; ++i ){
        let body = worldLandmarksArray[i].PWLM;
        let rightHand = worldLandmarksArray[i].RWLM;
        let leftHand = worldLandmarksArray[i].LWLM;

        computeSpine( skeleton, bindQuats, body );
        computeQuatHead( skeleton, bindQuats, body );

        // right arm-hands
        computeQuatArm( skeleton, body, false );
        computeQuatHand( skeleton, rightHand, false);
        computeQuatPhalange( skeleton, bindQuats, rightHand, false );

        // left arm-hands
        computeQuatArm( skeleton, body, true );
        computeQuatHand( skeleton, leftHand, true );
        computeQuatPhalange( skeleton, bindQuats, leftHand, true );

        // remove hips delta rotation from legs (children of hips). Hardcoded for EVA
        skeleton.bones[62].quaternion.copy( skeleton.bones[0].quaternion ).invert().multiply( bindQuats[0] ).multiply( bindQuats[62] );
        skeleton.bones[57].quaternion.copy( skeleton.bones[0].quaternion ).invert().multiply( bindQuats[0] ).multiply( bindQuats[57] );

        // store skeleton quat values
        // for( let j = 0; j < skeleton.bones.length; ++j ){
        //     tracks[j].set( skeleton.bones[j].quaternion.toArray(), i * 4 );
        // }

        // // store timing
        // if (i != 0){ timeAcc += worldLandmarksArray[i].dt/1000; }
        // times[i] = timeAcc;
    }

    // // for each bone create a quat track
    // for( let i = 0; i < skeleton.bones.length; ++i ){
    //     tracks[i] = new THREE.QuaternionKeyframeTrack( skeleton.bones[i].name + ".quaternion", times.slice(), tracks[i] );
    // }

    // return new THREE.AnimationClip( "animation", -1, tracks );
}

const getFrameIndex = ( action, time = action.time, mode = 0 ) => {

    if(!action)
        return -1;

    const animationTime = time;
    const times = action._clip.tracks[0].times;

    //binary search
    let min = 0, max = times.length - 1;
    
    // edge cases
    if ( times[min] > animationTime ){
        return mode == -1 ? -1 : 0;
    }
    if ( times[max] < animationTime ){
        return mode == 1 ? -1 : max;
    }
    
    // time is between first and last frame
    let half = Math.floor( ( min + max ) / 2 );
    while ( min < half && half < max ){
        if ( animationTime < times[half] ){ max = half; }
        else{ min = half; }
        half = Math.floor( ( min + max ) / 2 );
    }

    if (mode == 0 ){
        return Math.abs( animationTime - times[min] ) < Math.abs( animationTime - times[max] ) ? min : max;
    }
    else if ( mode == -1 ){
        return times[max] == animationTime ? max : min;
    }
    return times[min] == animationTime ? min : max;
}


const customArrow = ( fx, fy, fz, ix, iy, iz, thickness, color) => {
    const material = new THREE.MeshLambertMaterial( {color: color, transparent: true} );

    const length = Math.sqrt( (ix-fx)**2 + (iy-fy)**2 + (iz-fz)**2 );

    const geometry = new THREE.ConeGeometry( 1, 1, 12 ).rotateX( Math.PI/2).translate( 0, 0, -0.5 );
    const head = new THREE.Mesh( geometry, material );
    head.position.set( 0, 0, length );

    if(length < 0.01) {
        head.scale.set( 0, 0, 0 );
    }
    else {
        head.scale.set( 2*thickness, 2*thickness, 8*thickness );
    }

    const arrow = new THREE.Group( );
    arrow.position.set( ix, iy, iz );
    arrow.lookAt( fx, fy, fz );
    arrow.add( head );

    return arrow;
}


// MagicLineGeometry: LineGeometry modified version with rgba colors (allow alpha vertex)
const fragmentShader =
	/* glsl */`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			float alpha = opacity;
			vec4 diffuseColor = vec4( vec3(1.0,1.0,1.0), alpha );

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			#include <logdepthbuf_fragment>
			#include <color_fragment>

            #ifdef USE_COLOR_ALPHA
                alpha = vColor.a;
                //diffuseColor.rgb = vColor.rbg;
            #endif

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			// #include <tonemapping_fragment>
			// #include <colorspace_fragment>
			// #include <fog_fragment>
			// #include <premultiplied_alpha_fragment>

		}
		`;

const vertexShader =
	/* glsl */`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

        #ifdef USE_COLOR_ALPHA

            attribute vec4 instanceColorStart;
            attribute vec4 instanceColorEnd;
        #else
            attribute vec3 instanceColorStart;
            attribute vec3 instanceColorEnd;
        #endif

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {
            
            #ifdef USE_COLOR_ALPHA
                vColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;
            #endif

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart.xyz : instanceColorEnd.xyz;

			#endif

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`

class MagicLineGeometry extends LineGeometry {
    constructor( ) {
		super( );
	}

    /**
	 * Sets the given line colors for this geometry. The length must be a multiple of eight since
	 * each line segment is defined by a start end color in the pattern `(rgba rgba)`.
	 *
	 * @param {Float32Array|Array<number>} array - The position data to set.
	 * @return {LineSegmentsGeometry} A reference to this geometry.
	 */
	setColors( array ) {

        // converts [ r1, g1, b1, a1, r2, g2, b2, a2, ... ] to pairs format

		const length = array.length - 4;
		let colors = new Float32Array( 2 * length );

		for ( let i = 0; i < length; i += 4 ) {

			colors[ 2 * i ] = array[ i ];
			colors[ 2 * i + 1 ] = array[ i + 1 ];
			colors[ 2 * i + 2 ] = array[ i + 2 ];
			colors[ 2 * i + 3 ] = array[ i + 3 ];

			colors[ 2 * i + 4 ] = array[ i + 4 ];
			colors[ 2 * i + 5 ] = array[ i + 5 ];
			colors[ 2 * i + 6 ] = array[ i + 6 ];
			colors[ 2 * i + 7 ] = array[ i + 7 ];

		}
		

		if ( array instanceof Float32Array ) {

			colors = array;

		} else if ( Array.isArray( array ) ) {

			colors = new Float32Array( array );

		}

		const instanceColorBuffer = new THREE.InstancedInterleavedBuffer( colors, 8, 1 ); // rgba, rgba

		this.setAttribute( 'instanceColorStart', new THREE.InterleavedBufferAttribute( instanceColorBuffer, 4, 0 ) ); // rgba
		this.setAttribute( 'instanceColorEnd', new THREE.InterleavedBufferAttribute( instanceColorBuffer, 4, 4 ) ); // rgba

		return this;

	}
}

export { TrajectoriesHelper }