import * as THREE from "three";
import { forceBindPoseQuats, nlerpQuats } from "./Utils.js";

class ThumbIK {
    constructor( handshape ){
        this.handshape = handshape;
    }

    update( targetWorldPoint, maxIter, shortChain = false, splay = null ){
        let tempQ_0 = new THREE.Quaternion();
        let tempQ_1 = new THREE.Quaternion();
        let tempV3_0 = new THREE.Vector3();
        let tempV3_1 = new THREE.Vector3();
        let tempV3_2 = new THREE.Vector3();

        let thumbBase = this.handshape.fingerIdxs[0]
        let bones = this.handshape.skeleton.bones;
        let bindQuats = this.handshape.fingerAxes.bindQuats;
        let bendAxes = this.handshape.fingerAxes.bendAxes;
        bones[ thumbBase ].quaternion.copy( bindQuats[ 0 ] );
        bones[ thumbBase + 1 ].quaternion.copy( bindQuats[ 1 ] );
        bones[ thumbBase + 2 ].quaternion.copy( bindQuats[ 2 ] );
        bones[ thumbBase + 3 ].updateWorldMatrix( true, false );
       
        let chain = null;
        if ( shortChain ){ chain = [ bones[ thumbBase ], bones[ thumbBase + 1 ], bones[ thumbBase + 2 ] ]; }
        else { chain = [ bones[ thumbBase ], bones[ thumbBase + 1 ], bones[ thumbBase + 2 ], bones[ thumbBase + 3 ] ]; }
        let endEffector = chain[ chain.length -1 ]; // could actually be a point instead of the bone itself

        for ( let iter = 0; iter < maxIter; ++iter ){
            let lastBone = (iter > 0) ? 0 : 1; // first iteration ignore base joint
            
            for ( let i = chain.length - 2 ; i >= lastBone; --i ){
                let endEffectorWorldPos = endEffector.getWorldPosition( tempV3_0 );
                if ( tempV3_1.subVectors( endEffectorWorldPos, targetWorldPoint ).lengthSq() < 0.001*0.001 ){ iter = maxIter; break; }

                let joint = chain[i];
               
                let endEffectorLocalPos = joint.worldToLocal( tempV3_0.copy( endEffectorWorldPos ) ).normalize();
                let targetLocalPos = joint.worldToLocal( tempV3_1.copy( targetWorldPoint ) ).normalize();

                tempQ_0.setFromUnitVectors( endEffectorLocalPos, targetLocalPos );

                if( i != 0 ){ 
                    // apply hinge constraint to upper bones, except base joint
                    let bendAxis = bendAxes[ i ];
                    tempQ_1.setFromUnitVectors( tempV3_0.copy( bendAxis ).applyQuaternion( tempQ_0 ), bendAxis );
                    tempQ_0.premultiply( tempQ_1 );
    
                    joint.quaternion.multiply( tempQ_0 );
                
                    // if bone is bent to forbidden (negative) angles, restore bind. Except base joint
                    tempQ_1.copy( bindQuats[ i ] ).invert();
                    tempQ_1.multiply( joint.quaternion );
                    let dot = tempQ_1.x * bendAxis.x + tempQ_1.y * bendAxis.y +tempQ_1.z * bendAxis.z; // kind of a twist decomposition
                    if ( dot < 0 ){ tempQ_1.w *= -1;}
                    if ( tempQ_1.w < 0 ) { joint.quaternion.copy( bindQuats[ i ] ); }
                }else{
                    joint.quaternion.multiply( tempQ_0 );
                }

                joint.updateWorldMatrix();
            } 
        }

        // compute automatic splay
        if ( isNaN( splay ) || splay === null ){
            let m3 = ( new THREE.Matrix3() ).setFromMatrix4( bones[ this.handshape.wristIdx ].matrixWorld );
            let lateral = this.handshape.thumbThings.palmLateralVec.clone().applyMatrix3( m3 ).normalize();
            let outward = this.handshape.thumbThings.palmOutVec.clone().applyMatrix3( m3 ).normalize();
            let up = this.handshape.thumbThings.palmUpVec.clone().applyMatrix3( m3 ).normalize();
            let thumbSizeFull = this.handshape.thumbThings.thumbSizeFull;
            let thumbSizeUpper = this.handshape.thumbThings.thumbSizeUpper;
            bones[ thumbBase + 3 ].getWorldPosition( tempV3_0 );
            this.handshape.handLocations[ "HAND_RADIAL" ].getWorldPosition( tempV3_1 );
            tempV3_0.sub( tempV3_1 );
            
            tempV3_1.set( lateral.dot( tempV3_0 ), up.dot( tempV3_0 ), outward.dot( tempV3_0 ) ); // base change
            tempV3_1.x *= ( this.handshape.isLeftHand ? 1 : -1 );

            let lateralSplayRaw = Math.min( 1, Math.max( 0, tempV3_1.x / thumbSizeUpper ) );
            let lateralSplay = Math.min( 1, Math.max( 0, ( tempV3_1.x - thumbSizeUpper*0.5 ) / thumbSizeUpper ) );
            let outSplay = Math.min( 1, Math.max( 0, ( tempV3_1.z * 2 ) / thumbSizeFull ) );
            outSplay = outSplay * 0.65 + outSplay*0.45*lateralSplayRaw;
            splay = Math.max(0, Math.min( 1, lateralSplay + outSplay ) );
            splay = splay * 75 * Math.PI / 180 * ( this.handshape.isLeftHand ? 1 : -1 );
            // TODO: splay with user specified range
        }
        bones[ thumbBase + 3 ].getWorldPosition( tempV3_0 );
        bones[ thumbBase ].worldToLocal( tempV3_0 );
        tempQ_0.setFromAxisAngle( tempV3_0.normalize(), splay );
        bones[ thumbBase ].quaternion.multiply( tempQ_0 );
    }
};

class HandShape {
    constructor( config, skeleton, isLeftHand = false ){
        this._tempQ_0 = new THREE.Quaternion(0,0,0,1);

        this.skeleton = skeleton;
        this.isLeftHand = !!isLeftHand;
        
        this.config = config;
        let boneMap = config.boneMap;
        this.handLocations = this.isLeftHand ? config.handLocationsL : config.handLocationsR;
        let handName = this.isLeftHand ? "L" : "R";
        this.wristIdx = boneMap[ handName + "Wrist" ];
        this.fingerIdxs = [ // base bone indexes. The used bones will be i (base finger), i+1 (mid finger) and i+2 (tip finger). 
            boneMap[ handName + "HandThumb" ], 
            boneMap[ handName + "HandIndex" ],
            boneMap[ handName + "HandMiddle" ], 
            boneMap[ handName + "HandRing" ], 
            boneMap[ handName + "HandPinky" ] 
        ];
        
        this.fingerAxes = this._computeFingerAxesOfHand( );
        this.thumbAfterBindTwistAxis = (new THREE.Vector3()).copy(this.skeleton.bones[ this.fingerIdxs[0] + 1 ].position).applyQuaternion( this.fingerAxes.bindQuats[0] ).normalize();

        this.thumbIK = new ThumbIK( this );
        this._computeLookUpTables();
        
        this.curG = [ 
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ], // thumb
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ]
        ];
        this.srcG = [ 
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ], // thumb
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ]
        ];
        this.trgG = [ 
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ], // thumb
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ]
        ];
        this.defG = [ 
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ], // thumb
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ],
            [ new THREE.Quaternion, new THREE.Quaternion, new THREE.Quaternion ]
        ];

        this.time = 0; // current time of transition
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0; 
        this.end = 0;

        this.transition = false;
        
        this.reset();
    }

    _computeFingerAxesOfHand( ){

        // assumes character is in tpose
        let isLeftHand = this.isLeftHand;
        let bones = this.skeleton.bones;
        let fingers = this.fingerIdxs;
        let bendAxis = new THREE.Vector3();
        let splayAxis = new THREE.Vector3();
        let fingerDir = new THREE.Vector3();

        let tempM3_0 = new THREE.Matrix3();
        let tempV3_0 = new THREE.Vector3();
        let tempV3_1 = new THREE.Vector3();

        let result = { bendAxes: [], splayAxes: [], bindQuats: [] };  // although called bindQuats, thumb does not have its actual bind
        this.bendRange = 4; // [1,9]
        
        // Z axis of avatar from mesh space to world space
        tempM3_0.setFromMatrix4( bones[ 0 ].matrixWorld.clone().multiply( this.skeleton.boneInverses[0] ) );
        let worldZ = this.config.axes[2].clone().applyMatrix3( tempM3_0 ).normalize();
        
        // thumb only
        let thumb = fingers[0];
        for ( let i = 0; i < 3; ++i ){
            tempM3_0.setFromMatrix4( bones[ thumb + i ].matrixWorld ).invert(); // World to Local
            tempV3_0.setFromMatrixPosition( bones[ thumb + i ].matrixWorld );
            tempV3_1.setFromMatrixPosition( bones[ thumb + i + 1 ].matrixWorld );
            fingerDir.subVectors( tempV3_1, tempV3_0 ).normalize(); // finger direction 
            bendAxis.crossVectors( worldZ, fingerDir ).normalize(); // assuming Tpose. Thumb is positioned different than other fingers
            let bendLocal = bendAxis.clone().applyMatrix3( tempM3_0 ); // from world to local space
            bendLocal.applyQuaternion( bones[ thumb + i ].quaternion ).normalize(); // from local to afterbind space
            let bindQuat = bones[ thumb + i ].quaternion.clone();

            if ( i == 0 ){
                splayAxis.crossVectors( bendAxis, fingerDir ).normalize(); // assuming Tpose
                if ( !isLeftHand ){ splayAxis.multiplyScalar( -1 ); }
                let splayLocal = splayAxis.clone().applyMatrix3( tempM3_0 ).normalize(); // from world to local space    
                splayLocal.applyQuaternion( bones[ thumb + i ].quaternion ).normalize(); // from local to afterbind space
                
                //assuming bones are in bind pose
                // compute quat so thumb is straight and parallel to fingers instead of whatever pose it is in the mesh
                let currentThumbDir = new THREE.Vector3();
                tempV3_0.setFromMatrixPosition( bones[ thumb ].matrixWorld );
                tempV3_1.setFromMatrixPosition( bones[ thumb + 1 ].matrixWorld );
                currentThumbDir.subVectors( tempV3_1, tempV3_0 ).normalize();

                let targetThumbDir = new THREE.Vector3();
                tempV3_0.setFromMatrixPosition( bones[ fingers[3] ].matrixWorld ); // middle finger - base joint
                tempV3_1.setFromMatrixPosition( bones[ fingers[3] + 2 ].matrixWorld ); // middle finger - pad joint
                targetThumbDir.subVectors( tempV3_1, tempV3_0 ).normalize();
                // targetThumbDir.multiplyScalar( Math.cos(60*Math.PI/180) ).addScaledVector( worldZ, Math.sin(60*Math.PI/180) );
                tempV3_0.crossVectors( targetThumbDir, worldZ ).normalize();
                tempV3_0.cross( targetThumbDir ).normalize();
                targetThumbDir.multiplyScalar( Math.cos(60*Math.PI/180) ).addScaledVector( tempV3_0, Math.sin(60*Math.PI/180) );
                
                let thumbProjection = { x: bendAxis.dot(currentThumbDir), y: splayAxis.dot(currentThumbDir), z: fingerDir.dot(currentThumbDir) };
                let targetProjection = { x: bendAxis.dot(targetThumbDir), y: splayAxis.dot(targetThumbDir), z: fingerDir.dot(targetThumbDir) };
                let thumbAngles = { elevation: - Math.asin( thumbProjection.y ), bearing: Math.atan2( thumbProjection.x, thumbProjection.z) };
                let targetAngles = { elevation: - Math.asin( targetProjection.y ), bearing: Math.atan2( targetProjection.x, targetProjection.z) };

                bindQuat.set(0,0,0,1);
                bindQuat.premultiply( this._tempQ_0.setFromAxisAngle( splayLocal, -thumbAngles.bearing    * (isLeftHand ? -1 : 1) ) );
                bindQuat.premultiply( this._tempQ_0.setFromAxisAngle( bendLocal,  -thumbAngles.elevation  * (isLeftHand ? -1 : 1) ) );
                bindQuat.premultiply( this._tempQ_0.setFromAxisAngle( bendLocal,   targetAngles.elevation * (isLeftHand ? -1 : 1) ) );
                bindQuat.premultiply( this._tempQ_0.setFromAxisAngle( splayLocal,  targetAngles.bearing   * (isLeftHand ? -1 : 1) ) );
                bindQuat.normalize();
                bindQuat.multiply( bones[ thumb + i ].quaternion );
 
                // recompute afterbind axes
                splayLocal.copy( splayAxis ).applyMatrix3( tempM3_0 ).applyQuaternion( bindQuat ).normalize(); // from world to afterbind space    
                bendLocal.copy( bendAxis ).applyMatrix3( tempM3_0 ).applyQuaternion( bindQuat ).normalize(); // from world to afterbind space
                result.splayAxes.push( splayLocal ); 
            }
            result.bendAxes.push( bendLocal );
            result.bindQuats.push( bindQuat );
        }

        // fingers - no thumb
        let bendBaseTweak = [0, -6*Math.PI/180, 0, 6*Math.PI/180, 7*Math.PI/180 ];
        for ( let f = 1; f < fingers.length; ++f ){
            // assuming Tpose
            tempV3_0.setFromMatrixPosition( bones[ fingers[f] ].matrixWorld );
            tempV3_1.setFromMatrixPosition( bones[ fingers[f] + 2 ].matrixWorld );
            fingerDir.subVectors( tempV3_1, tempV3_0 ).normalize();
            splayAxis.crossVectors( fingerDir, worldZ ).normalize(); 
            bendAxis.crossVectors( splayAxis, fingerDir ).normalize(); 
            for ( let i = 0; i < 3; ++i ){
                let bendLocal = bendAxis.clone(); 
                tempM3_0.setFromMatrix4( bones[ fingers[f] + i ].matrixWorld ).invert();
                if ( i == 0 ){
                    let splayLocal = splayAxis.clone(); 
                    splayLocal.applyMatrix3( tempM3_0 ); // from world to local space
                    splayLocal.applyQuaternion( bones[ fingers[f] + i ].quaternion ).normalize(); // from local to afterbind space
                    result.splayAxes.push(splayLocal);    

                    bendLocal.multiplyScalar( Math.cos( bendBaseTweak[f] ) ).addScaledVector( fingerDir, Math.sin( bendBaseTweak[f] ) ); // so fingers rotate a bit inwards
                }
                if ( isLeftHand ){ bendLocal.multiplyScalar( -1 ); }
                bendLocal.applyMatrix3( tempM3_0 ); // from world to local space
                bendLocal.applyQuaternion( bones[ fingers[f] + i ].quaternion ).normalize(); // from local to afterbind space 
                // let arrow = new THREE.ArrowHelper( bendLocal, new THREE.Vector3(0,0,0), 10, 0xff0000 ); bones[ fingers[f] + i ].add( arrow );
                result.bendAxes.push( bendLocal ); // from world to local space
                result.bindQuats.push( bones[ fingers[f] + i ].quaternion.clone() ); // assuming already in TPose
            }
        }
        
        return result;
    }
    
    _computeLookUpTables( ){
        let tempV3_0 = new THREE.Vector3();
        let tempV3_1 = new THREE.Vector3();
        let tempV3_2 = new THREE.Vector3();
        let bones = this.skeleton.bones;

        // set in "bind" pose (thumb is modified)
        for( let i = 0; i < 5; ++i ){
            for( let j = 0; j < 3; ++j ){
                this.skeleton.bones[ this.fingerIdxs[i] + j ].quaternion.copy( this.fingerAxes.bindQuats[ i*3 + j ] );
            }
        }

        // compute some important values
        let palmOutVec = new THREE.Vector3();
        let palmLateralVec = new THREE.Vector3();
        let palmUpVec = new THREE.Vector3();
        let thumbSizeUpper = 0;
        let thumbSizeFull = 0;
        let fingerWidth = 0;
        
        // approximate thumb sizes
        bones[ this.fingerIdxs[0] + 0 ].getWorldPosition( tempV3_0 );
        bones[ this.fingerIdxs[0] + 3 ].getWorldPosition( tempV3_1 );
        thumbSizeFull = tempV3_2.subVectors( tempV3_1, tempV3_0 ).length();
        bones[ this.fingerIdxs[0] + 1 ].getWorldPosition( tempV3_0 );
        thumbSizeUpper = tempV3_2.subVectors( tempV3_1, tempV3_0 ).length();
        this.handLocations[ "2_MID_ULNAR" ].getWorldPosition( tempV3_1 );
        this.handLocations[ "2_MID_RADIAL" ].getWorldPosition( tempV3_0 );
        fingerWidth = tempV3_2.subVectors( tempV3_1, tempV3_0 ).length();

        // palmOutVec
        bones[ this.fingerIdxs[1] ].getWorldPosition( tempV3_0 ); // index finger
        bones[ this.fingerIdxs[3] ].getWorldPosition( tempV3_1 ); // ring finger
        bones[ this.wristIdx ].getWorldPosition( tempV3_2 );
        tempV3_0.sub( tempV3_2 );
        tempV3_1.sub( tempV3_2 );
        palmOutVec.crossVectors( tempV3_0, tempV3_1 ).multiplyScalar( this.isLeftHand ? -1 : 1 ).normalize();

        // palmLateralVec
        bones[ this.fingerIdxs[3] ].getWorldPosition( tempV3_0 );
        bones[ this.fingerIdxs[3] + 2 ].getWorldPosition( tempV3_1 );
        palmLateralVec.subVectors( tempV3_1, tempV3_0 ).cross( palmOutVec ).multiplyScalar( this.isLeftHand ? -1 : 1 ).normalize();

        // palmUpVec
        palmUpVec.crossVectors( palmOutVec, palmLateralVec ).multiplyScalar( this.isLeftHand ? -1 : 1 ).normalize(); 

        this.thumbThings = {};
        let m4 = bones[ this.wristIdx ].matrixWorld.clone().invert();
        let m3 = ( new THREE.Matrix3() ).setFromMatrix4( m4 );
        this.thumbThings.palmOutVec = palmOutVec.clone().applyMatrix3( m3 );
        this.thumbThings.palmLateralVec = palmLateralVec.clone().applyMatrix3( m3 );
        this.thumbThings.palmUpVec = palmUpVec.clone().applyMatrix3( m3 );
        this.thumbThings.thumbSizeUpper = thumbSizeUpper;
        this.thumbThings.thumbSizeFull = thumbSizeFull;
        this.thumbThings.fingerWidth = fingerWidth;


        let angleRanges = this.angleRanges = [ // in case of config...
            [ [ 0, Math.PI * 0.2 ], [ 0, Math.PI * 0.5 ], [ 0, Math.PI * 0.4 ], [ 0, Math.PI * 0.4 ] ],  // [ splay, base, mid, high ]
            [ [ 0, 20*Math.PI/180 ], [ 0, Math.PI * 0.5 ], [ 0, Math.PI * 0.6 ], [ 0, Math.PI * 0.5 ] ], // [ splay, base, mid, high ]
            [ [ 0, 20*Math.PI/180 ], [ 0, Math.PI * 0.5 ], [ 0, Math.PI * 0.6 ], [ 0, Math.PI * 0.5 ] ], // [ splay, base, mid, high ]
            [ [ 0, 20*Math.PI/180 ], [ 0, Math.PI * 0.5 ], [ 0, Math.PI * 0.6 ], [ 0, Math.PI * 0.5 ] ], // [ splay, base, mid, high ]
            [ [ 0, 20*Math.PI/180 ], [ 0, Math.PI * 0.5 ], [ 0, Math.PI * 0.6 ], [ 0, Math.PI * 0.5 ] ], // [ splay, base, mid, high ]
        ];

        // *** Thumbshapes ***
        let thumbshapes = this.thumbshapes = {
            OUT:     null,
            DEFAULT: null,
            OPPOSED: null,
            ACROSS:  null
        }

        // thumbshape: OUT
        bones[ this.fingerIdxs[1] ].getWorldPosition( tempV3_0 ).addScaledVector( palmLateralVec, thumbSizeUpper * 1.2 );
        this.thumbIK.update( tempV3_0, 10, true ); // do not bend tip
        this.thumbshapes.OUT = [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ];

        // thumbshape: OPPOSED 
        bones[ this.fingerIdxs[1] ].getWorldPosition( tempV3_0 ).addScaledVector( palmOutVec, thumbSizeFull )
        this.thumbIK.update( tempV3_0, 10, false );
        this.thumbshapes.OPPOSED = [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ];

        // thumbshape: DEFAULT
        this.handLocations[ "2_BASE_PALMAR" ].getWorldPosition( tempV3_0 );
        tempV3_0.addScaledVector( palmLateralVec, fingerWidth*1.5 );
        this.thumbIK.update( tempV3_0, 10, true );
        this.thumbshapes.DEFAULT = [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ];

        // thumbshape: ACROSS
        this.handLocations[ "5_BASE_PALMAR" ].getWorldPosition( tempV3_0 );
        tempV3_0.addScaledVector( palmOutVec, fingerWidth*0.5 );
        this.thumbIK.update( tempV3_0, 10, false, 0 );
        this.thumbshapes.ACROSS = [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ];


        // *** Basic and ThumbCombination Handshapes *** 
        // set in "bind" pose (thumb is modified)
        for( let i = 0; i < 5; ++i ){
            for( let j = 0; j < 3; ++j ){
                bones[ this.fingerIdxs[i] + j ].quaternion.copy( this.fingerAxes.bindQuats[ i*3 + j ] );
                bones[ this.fingerIdxs[i] + j ].updateWorldMatrix();
            }
        }

        let handshapes = this.handshapes = {
            // basic handshapes    
            FIST:            { selected: [0,0,0,0,0], defaultThumb: this.thumbshapes.DEFAULT, thumbOptions: null, fingers: [ [0,1,1,1],[0,1,1,1],[0,1,1,1],[0,1,1,1] ] },
            FINGER_2:        { selected: [0,1,0,0,0], defaultThumb: null, thumbOptions: [], fingers: [ [0,0,0,0],[0,1,1,1],[0,1,1,1],[0,1,1,1] ] },
            FINGER_23:       { selected: [0,1,1,0,0], defaultThumb: null, thumbOptions: [], fingers: [ [0,0,0,0],[0,0,0,0],[0,1,1,1],[0,1,1,1] ] },
            FINGER_23_SPREAD:{ selected: [0,1,1,0,0], defaultThumb: null, thumbOptions: [], fingers: [ [0.8,0,0,0],[-0.2,0,0,0],[0,1,1,1],[0,1,1,1] ] },
            FINGER_2345:     { selected: [0,1,1,1,1], defaultThumb: this.thumbshapes.DEFAULT, thumbOptions: null, fingers: [ [0.8,0,0,0],[0,0,0,0],[0.8,0,0,0],[0.8,0,0,0] ] },
            FLAT:            { selected: [0,1,1,1,1], defaultThumb: this.thumbshapes.DEFAULT, thumbOptions: null, fingers: [ [0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0] ] },
            // thumb combinations
            PINCH_12:        { selected: [2,2,0,0,0], defaultThumb: null, thumbOptions: [], fingers: [ [0,0.7,0.4,0.25],[0,1,1,1],[0,1,1,1],[0,1,1,1] ] },
            PINCH_12_OPEN:   { selected: [2,2,0,0,0], defaultThumb: null, thumbOptions: [], fingers: [ [0,0.7,0.4,0.25],[0,0.4,0.2,0.2],[0,0.2,0.2,0.2],[0,0,0.2,0.2] ] },
            PINCH_ALL:       { selected: [2,2,2,2,2], defaultThumb: null, thumbOptions: [], fingers: [ [0,0.7,0.4,0.25],[0,0.7,0.34,0.26],[0,0.7,0.3,0.23],[0,0.89,0.22,0.22] ] },

            CEE_12:          { selected: [3,3,0,0,0], defaultThumb: null, thumbOptions: [], fingers: [ [0,0.6,0.4,0.2],[0,1,1,1],[0,1,1,1],[0,1,1,1] ] }, 
            CEE_12_OPEN:     { selected: [3,3,0,0,0], defaultThumb: null, thumbOptions: [], fingers: [ [0,0.6,0.4,0.2],[0,0.4,0.2,0.2],[0,0.2,0.2,0.1],[0,0,0.2,0.2] ] },
            CEE_ALL:         { selected: [3,3,3,3,3], defaultThumb: null, thumbOptions: [], fingers: [ [0,0.6,0.4,0.2],[0,0.6,0.4,0.2],[0,0.6,0.4,0.1],[0,0.6,0.4,0.2] ] }
        };

        // finger_2, finger_23, finger_23_spread thumbs
        let shape = handshapes.FIST;
        this._setFingers( shape.fingers[0], shape.fingers[1], shape.fingers[2], shape.fingers[3] );
        for( let i = 2; i < 6; ++i ){
            this.handLocations[ i.toString() + "_MID_RADIAL" ].getWorldPosition( tempV3_0 );
            this.thumbIK.update( tempV3_0, 10, true );
            let thumbQuats = [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ]
            handshapes.FINGER_2.thumbOptions.push( thumbQuats );    
            handshapes.FINGER_23.thumbOptions.push( thumbQuats );    
            handshapes.FINGER_23_SPREAD.thumbOptions.push( thumbQuats );    
        }
        handshapes.FINGER_2.defaultThumb = handshapes.FINGER_2.thumbOptions[1]; // thumb to middle
        handshapes.FINGER_23.defaultThumb = handshapes.FINGER_23.thumbOptions[2]; // thumb to ring
        handshapes.FINGER_23_SPREAD.defaultThumb = handshapes.FINGER_23_SPREAD.thumbOptions[2]; // thumb to ring

        // pinch_12, pinch_12_open, cee_12, cee_12_open thumbs
        shape = handshapes.PINCH_ALL;
        this._setFingers( shape.fingers[0], shape.fingers[1], shape.fingers[2], shape.fingers[3] );
        for( let i = 2; i < 6; ++i ){
            this.handLocations[ i.toString() + "_TIP" ].getWorldPosition( tempV3_0 );
            this.thumbIK.update( tempV3_0, 10, false );
            let thumbQuats = [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ]
            handshapes.PINCH_12.thumbOptions.push( thumbQuats );    
            handshapes.PINCH_12_OPEN.thumbOptions.push( thumbQuats );    
            handshapes.PINCH_ALL.thumbOptions.push( thumbQuats );    
            
            // reuse pinch position to compute CEE thumb, opening it
            tempV3_0.addScaledVector( palmOutVec, thumbSizeUpper ); // openin thumb
            this.thumbIK.update( tempV3_0, 10, false );
            thumbQuats = [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ]
            handshapes.CEE_12.thumbOptions.push( thumbQuats );    
            handshapes.CEE_12_OPEN.thumbOptions.push( thumbQuats );  
            handshapes.CEE_ALL.thumbOptions.push( thumbQuats );  
        }
        handshapes.PINCH_12.defaultThumb = handshapes.PINCH_12.thumbOptions[0]; // thumb to index
        handshapes.PINCH_12_OPEN.defaultThumb = handshapes.PINCH_12_OPEN.thumbOptions[0]; // thumb to index
        handshapes.PINCH_ALL.defaultThumb = handshapes.PINCH_ALL.thumbOptions[1]; // thumb to middle
        handshapes.CEE_12.defaultThumb = handshapes.CEE_12.thumbOptions[0]; // thumb to index
        handshapes.CEE_12_OPEN.defaultThumb = handshapes.CEE_12_OPEN.thumbOptions[0]; // thumb to index
        handshapes.CEE_ALL.defaultThumb = handshapes.CEE_ALL.thumbOptions[1]; // thumb to middle
        
        // *** Bendings ***
        // [2].t might containe null OR an array with 4 arrays (one per finger) with 3 quaternions
        let handBendings = this.handBendings = {
            STRAIGHT:       { 1: [0,0,0,0],       2:{ t: null, f:[0,0,0,0] } }, 
            HALF_BENT:      { 1: [0,0.5,0,0],     2:{ t:[], f:[0,0.5,0,0] } }, 
            BENT:           { 1: [0,1,0,0],       2:{ t:[], f:[0,1,0,0] } }, 
            ROUND:          { 1: [0,0.5,0.5,0.5], 2:{ t:[], f:[0,5/9,6/9,9/9] } }, 
            HOOKED:         { 1: [0,0,1,1],       2:{ t:[], f:[0,1,1,8/9] } }, 
            DOUBLE_BENT:    { 1: [0,1,1,0],       2:{ t:[], f:[0,1,1,8/9] } }, // [2] reference from hooked 
            DOUBLE_HOOKED:  { 1: [0,1,1,1],       2:{ t:[], f:[0,1,1,8/9] } }, // [2] reference from hooked
        }

        this._setFingers( handBendings.BENT[2].f, handBendings.BENT[2].f, handBendings.BENT[2].f, handBendings.BENT[2].f );
        for( let i = 2; i < 6; ++i ){
            this.handLocations[ i.toString() + "_TIP" ].getWorldPosition( tempV3_0 );
            this.thumbIK.update( tempV3_0, 10, false );
            let thumbQuats = [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ]
            handBendings.BENT[2].t.push( thumbQuats );    

            thumbQuats = [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ]
            nlerpQuats( thumbQuats[0], thumbQuats[0], this.thumbshapes.DEFAULT[0], 0.10 );
            nlerpQuats( thumbQuats[1], thumbQuats[1], this.thumbshapes.DEFAULT[1], 0.10 );
            nlerpQuats( thumbQuats[2], thumbQuats[2], this.thumbshapes.DEFAULT[2], 0.10 );
            handBendings.HALF_BENT[2].t.push( thumbQuats );
        }

        this._setFingers( handBendings.ROUND[2].f, handBendings.ROUND[2].f, handBendings.ROUND[2].f, handBendings.ROUND[2].f );
        for( let i = 2; i < 6; ++i ){
            this.handLocations[ i.toString() + "_PAD_BACK" ].getWorldPosition( tempV3_0 );
            this.thumbIK.update( tempV3_0, 10, false );
            let thumbQuats = [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ]
            handBendings.ROUND[2].t.push( thumbQuats );   

        }

        this._setFingers( handBendings.HOOKED[2].f, handBendings.HOOKED[2].f, handBendings.HOOKED[2].f, handBendings.HOOKED[2].f );
        for( let i = 2; i < 6; ++i ){
            this.handLocations[ i.toString() + "_MID_BACK" ].getWorldPosition( tempV3_0 );
            this.thumbIK.update( tempV3_0, 10, i < 4 ); // target with thumb tip for ring and pinky. Target with thumb pad joint for middle and index
            handBendings.HOOKED[2].t.push( [ bones[ this.fingerIdxs[0] ].quaternion.clone(), bones[ this.fingerIdxs[0] + 1 ].quaternion.clone(), bones[ this.fingerIdxs[0] + 2 ].quaternion.clone(), ] );
        }
        handBendings.DOUBLE_BENT[2].t = handBendings.HOOKED[2].t; // reference
        handBendings.DOUBLE_HOOKED[2].t = handBendings.HOOKED[2].t; // reference

    }
    
    reset() {
        this.transition = false;
        this.time = 1; this.start = 0; this.attackPeak = 0; this.relax = 0; this.end = 0.1;
        
        let bones = this.skeleton.bones;
        let q = null;
        for ( let i = 0; i < 5; ++i ){
            for ( let j = 0; j < 3; ++j ){
                q = this.fingerAxes.bindQuats[ i*3 + j ];
                this.defG[i][j].copy( q );
                this.curG[i][j].copy( q );
                bones[ this.fingerIdxs[i] + j ].quaternion.copy( q );
            }
        }
        // this.update( 1 ); // force position reset
    }


    _setFingers( index, middle, ring, pinky ){
        // order of quaternion multiplication matter
        let bones = this.skeleton.bones;
        let bendAxes = this.fingerAxes.bendAxes; 
        let splayAxes = this.fingerAxes.splayAxes; 
        let fingers = this.fingerIdxs;
        let ranges = this.angleRanges;

        // all finger bends
        let baseBend = Math.min( 1, Math.max( -0.2, index[1] ) );// +  ( fingerplayResult ? fingerplayResult[1] : 0 ) ) );
        bones[ fingers[1]      ].quaternion.setFromAxisAngle(  bendAxes[3],  baseBend * Math.PI*0.5 );
        bones[ fingers[1] + 1  ].quaternion.setFromAxisAngle(  bendAxes[4],  index[2] * Math.PI*0.6 );
        bones[ fingers[1] + 2  ].quaternion.setFromAxisAngle(  bendAxes[5],  index[3] * Math.PI*0.5 );
        baseBend = Math.min( 1, Math.max( -0.2, middle[1] ) ); // +  ( fingerplayResult ? fingerplayResult[2] : 0 ) ) );
        bones[ fingers[2]     ].quaternion.setFromAxisAngle(  bendAxes[6],  baseBend * Math.PI*0.5 );
        bones[ fingers[2] + 1 ].quaternion.setFromAxisAngle(  bendAxes[7],  middle[2] * Math.PI*0.6 );
        bones[ fingers[2] + 2 ].quaternion.setFromAxisAngle(  bendAxes[8],  middle[3] * Math.PI*0.5 );
        baseBend = Math.min( 1, Math.max( -0.2, ring[1] ) ); //+  ( fingerplayResult ? fingerplayResult[3] : 0 ) ) );
        bones[ fingers[3]       ].quaternion.setFromAxisAngle(  bendAxes[9],  baseBend * Math.PI*0.5 );
        bones[ fingers[3] + 1   ].quaternion.setFromAxisAngle(  bendAxes[10], ring[2] * Math.PI*0.6 );
        bones[ fingers[3] + 2   ].quaternion.setFromAxisAngle(  bendAxes[11], ring[3] * Math.PI*0.5 );
        baseBend = Math.min( 1, Math.max( -0.2, pinky[1] ) ); //+  ( fingerplayResult ? fingerplayResult[4] : 0 ) ) );
        bones[ fingers[4]      ].quaternion.setFromAxisAngle(  bendAxes[12], baseBend * Math.PI*0.5 );
        bones[ fingers[4] + 1  ].quaternion.setFromAxisAngle(  bendAxes[13], pinky[2] * Math.PI*0.6 );
        bones[ fingers[4] + 2  ].quaternion.setFromAxisAngle(  bendAxes[14], pinky[3] * Math.PI*0.5 );

        // other fingers splay
        bones[ fingers[1] ].quaternion.multiply( this._tempQ_0.setFromAxisAngle(  splayAxes[1], this._computeSplayAngle( index, 1 ) ) );
        bones[ fingers[2] ].quaternion.multiply( this._tempQ_0.setFromAxisAngle(  splayAxes[2], this._computeSplayAngle( middle, 2 ) ) );
        bones[ fingers[3] ].quaternion.multiply( this._tempQ_0.setFromAxisAngle(  splayAxes[3], -1 * this._computeSplayAngle( ring, 3 ) ) );
        bones[ fingers[4] ].quaternion.multiply( this._tempQ_0.setFromAxisAngle(  splayAxes[4], -1 * this._computeSplayAngle( pinky, 4 ) - this._computeSplayAngle( ring, 3 ) ) );

        // apply bind quaternions
        for ( let i = 1; i < 5; ++i ){
            bones[ fingers[i]     ].quaternion.multiply(  this._tempQ_0.copy(this.fingerAxes.bindQuats[i*3]) );
            bones[ fingers[i]     ].updateWorldMatrix();
            bones[ fingers[i] + 1 ].quaternion.multiply(  this._tempQ_0.copy(this.fingerAxes.bindQuats[i*3+1]) );
            bones[ fingers[i] + 1 ].updateWorldMatrix();
            bones[ fingers[i] + 2 ].quaternion.multiply(  this._tempQ_0.copy(this.fingerAxes.bindQuats[i*3+2]) );            
            bones[ fingers[i] + 2 ].updateWorldMatrix();
        }
    }
       
    _computeSplayAngle( fingerInfo, index ){
        let t = fingerInfo[0] * ( 1 - Math.abs( fingerInfo[1] ) );
        let range = this.angleRanges[ index ][0];
        return  range[0] * (1-t) + range[1] * t;
    }
    
    // must always update bones. (this.transition would be useless)
    update( dt, fingerplayResult ) {       
        if ( !this.transition ){ return; }

        this.time +=dt;
        let bones = this.skeleton.bones;
        let fingerIdxs = this.fingerIdxs;
        
        if ( this.time < this.start ){}
        else if ( this.time < this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            for( let i = 0; i < 5; ++i ){
                for( let j = 0; j < 3; ++j ){
                    nlerpQuats( this.curG[ i ][ j ], this.srcG[i][j], this.trgG[i][j], t );
                    bones[ fingerIdxs[i] + j ].quaternion.copy( this.curG[i][j] );
                }
            }
        }
        else if ( this.time < this.relax ){
            for( let i = 0; i < 5; ++i ){
                for( let j = 0; j < 3; ++j ){
                    bones[ fingerIdxs[i] + j ].quaternion.copy( this.trgG[i][j] );
                    this.curG[ i ][ j ].copy( this.trgG[i][j] )
                }

            }
        }
        else if ( this.time < this.end ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            for( let i = 0; i < 5; ++i ){
                for( let j = 0; j < 3; ++j ){
                    nlerpQuats( this.curG[ i ][ j ], this.trgG[i][j], this.defG[i][j], t );
                    bones[ fingerIdxs[i] + j ].quaternion.copy( this.curG[i][j] );
                }
            }
        }else{
            for( let i = 0; i < 5; ++i ){
                for( let j = 0; j < 3; ++j ){
                    bones[ fingerIdxs[i] + j ].quaternion.copy( this.defG[i][j] );
                    this.curG[ i ][ j ].copy( this.defG[i][j] )
                }
            }
            this.transition = false;
        }

    }

    // specialFingers is used only for the thumb in the pinch-cee combinations. In all other cases and for fingers, selectedFingers is used 
    _stringToMainBend( mainbend, handArray, selectedFingers, specialFingers = null ){        
        if ( mainbend && mainbend.toUpperCase ){ mainbend = mainbend.toUpperCase(); }
        let b = this.handBendings[ mainbend ];
        if ( !b ){ return; }

        // thumb only in thumb combinations
        if ( selectedFingers[0] >= 2 ){
            let bt = b[2].t;
            
            // several thumb options. Needs to be specified depending on selected fingers
            if ( bt && bt.length > 3 ){ 
                if ( specialFingers && specialFingers.length ){ bt = bt[ specialFingers[0] - 1 ]; }
                else{ for( let i = 1; i < 5; ++i ){ if ( selectedFingers[i] ){ bt = bt[i-1]; break; } } }
            } 
            if ( !bt ){ bt = this.thumbshapes.DEFAULT; }
            handArray[0][0].copy( bt[0] ); 
            handArray[0][1].copy( bt[1] ); 
            handArray[0][2].copy( bt[2] ); 
        }

        // rest of fingers
        for( let i = 1; i < 5; ++i ){
            let s = selectedFingers[i]; 
            if ( !s ){ continue; }
            let f = ( s == 1 ) ? b[1] : b[2].f;
            // ignore splay from handbending
            handArray[i][1] = s == 3 ? ( f[1] * 0.8 ) : f[1]; // CEE opens a bit all fingers with respect to thumb
            handArray[i][2] = f[2];
            handArray[i][3] = f[3]; 
        }
    }

    // selectMode: if str is not numbers,  0 does nothing, 1 same shapes as mainbend in basic handshape, 2 same as mainbend in thumbcombinations
    _stringToFingerBend( str, outFinger, selectMode = 0, bendRange = 4 ){
        if ( !str ){ return; }

        if ( typeof( str ) == "string" ){ str = str.toUpperCase(); }
        let b = this.handBendings[ str ];
        if ( !b ){ 
            if ( typeof( str ) == "string" ){
                // strings of three int values 0-9
                for( let i = 0; (i < 3) && (i < str.length); ++i ){
                    let val = parseInt( str[i] );
                    if ( isNaN(val) ){ continue; }
                    outFinger[1+i] = val / bendRange;
                }
            }
            return;
        }

        if ( !selectMode ){ return; }
        let f = ( selectMode == 1 ) ? b[1] : b[2].f;
        outFinger[1] = selectMode == 3 ? ( f[1] * 0.8 ) : f[1]; 
        outFinger[2] = f[2]; 
        outFinger[3] = f[3]; 
    }

    _stringToSplay( str, outFinger ){
        let val = str;
        if ( typeof val == "string" ){ 
            val = parseFloat( val );
        } 
        if ( isNaN(val) ){ return; }
        outFinger[0] = val;
    }

    // to avoid having duplicated code for main and second attributes. Fills outHand. Returns 0 on success, >0 otherwise
    _newGestureHandComposer( bml, outHand, isSecond ){
        /*
        outHand = [
            [quat, quat quat ]
            [s,b,b,b]
            [s,b,b,b]
            [s,b,b,b]
            [s,b,b,b]
        ]
        */

        let shapeName = isSecond ? bml.secondHandshape : bml.handshape;
        if ( shapeName && shapeName.toUpperCase ){ shapeName = shapeName.toUpperCase(); }
        let g = this.handshapes[ shapeName ];
        if ( !g ){ return false; }
            
        // copy selected shape into buffers        
        for( let j = 0; j < 3; ++j ){ outHand[0][j].copy( g.defaultThumb[j] ); }
        for( let i = 1; i < 5; ++i ){
            let src = g.fingers[i-1];
            for( let j = 0; j < src.length; ++j ){ outHand[i][j] = src[j]; }
        }
        
        let selectedFingers = g.selected;
        
        // special fingers override default
        let specFing = bml.specialFingers; // get special fingers
        if ( specFing && !isSecond ){
            let newSelectedFingers = [selectedFingers[0],0,0,0,0];
            specFing = specFing.split(''); // ['23'] -> ['2','3']
            for (let i = 0; i < specFing.length; i++) {
                let num = parseInt(specFing[i]) - 1;
                if (isNaN(num) || num < 1 || num > 4) { specFing.splice(i, 1); i--; continue; } // only fingers, no thumb
                newSelectedFingers[num] = (g.selected[0] ? g.selected[0] : 1); // depending on thumb, selected value is 1,2 or 3
                specFing[i] = num;
            } // str to num (['2', '3'] -> [1,2])
            
            if ( specFing.length ){ 
                selectedFingers = newSelectedFingers;
                switch (shapeName){
                    case "FIST":
                        for (let i = 1; i < selectedFingers.length; i++) {
                            if (!selectedFingers[i]) outHand[i] = [0,0,0,0]; // non-selected fingers into flat
                            selectedFingers[i] = 1 - selectedFingers[i];
                        }
                        break;
                        
                    case "FLAT": case "CEE_ALL": case "PINCH_ALL":
                        for (let i = 1; i < selectedFingers.length; i++) {
                            if (!selectedFingers[i]) outHand[i] = [0,1,1,1]; // non-selected fingers into fist
                        }
                        break;
                        
                    case "PINCH_12": case "PINCH_12_OPEN": case "CEE_12": case "CEE_12_OPEN": 
                        for (let i = 0; i < specFing.length; i++) {
                            outHand[specFing[i]] = [ ...this.handshapes[ (shapeName.includes("CEE_") ? "CEE_ALL" : "PINCH_ALL") ].fingers[ specFing[i] - 1] ];
                        }
                        break;
                        
                    default:
                        // get default fingers (handshapes: fingerX)
                        let defFing = shapeName.match(/\d+/g); // ['FINGER_23_SPREAD'] -> ['23']
                        if (defFing) {
                            defFing = defFing[0].split(''); // ['23'] -> ['2','3']
                            defFing = defFing.map(function(str) {
                                return parseInt(str) - 1;
                            }); // str to num (['2', '3'] -> [2,3])
                            if(defFing[0] == 0) defFing.shift(); // avoid thumb
                            
                            // change handshape
                            for (let i = 0; i < specFing.length; i++) {                                
                                if (!defFing[i]) { 
                                    outHand[specFing[i]] = [...outHand[defFing[0]]]; // copy array as value not reference
                                }  // if more special fingers than default
                                else if (specFing[i] == defFing[i]) { continue; } // default and special are the same finger -> skip
                                else { outHand[specFing[i]] = [...outHand[defFing[i]]]; } // interchange finger config (eg: default=2, special=5)
                            }
                        }
                        break;

                }
                // change unselected to open or fist
                let isOpen = shapeName.includes("_OPEN", 5);
                for (let i = 1; i < selectedFingers.length; i++) {
                    if (!selectedFingers[i]) { outHand[i] = (isOpen ? [0,0.2,0.2,0.2] : [0,1,1,1]); }
                }
                
                // relocate thumb if pinch or cee. All pinc_ cee_ are transformed into pinch_all cee_all
                if ( shapeName.includes("PINCH_") || shapeName.includes("CEE_") ){
                    let relocationThumbshape = shapeName.includes("PINCH_") ? this.handshapes.PINCH_ALL.thumbOptions : this.handshapes.CEE_ALL.thumbOptions;
                    relocationThumbshape = relocationThumbshape[ specFing[0] - 1 ]; // relocate to first specialFinger
                    for( let j = 0; j < 3; ++j ){ outHand[0][j].copy( relocationThumbshape[j] ); }                                    
                }        
            }    
        } // end of special fingers

        // apply mainbends if any
        this._stringToMainBend( isSecond ? bml.secondMainBend : bml.mainBend, outHand, selectedFingers, specFing );

        // modify with thumbshape
        let thumbshapeName = isSecond ? bml.secondThumbshape : bml.thumbshape;
        if ( typeof( thumbshapeName ) == "string" ){ thumbshapeName = thumbshapeName.toUpperCase(); }
        let thumbGest = this.thumbshapes[ thumbshapeName ];
        if ( thumbGest ){
            for( let i = 0; i < 3; ++i ){ outHand[0][i].copy( thumbGest[i] ); }        
        }

        // bml.tco (thumb combination opening). Applicable to cee and pinch (select mode 2 and 3). 1=keep original, 0=open fingers
        let thumbCombinationOpening = parseFloat( isSecond ? bml.secondtco : bml.tco );
        thumbCombinationOpening = isNaN( thumbCombinationOpening ) ? 0 : Math.max(-1, Math.min(1, thumbCombinationOpening ) );
        thumbCombinationOpening = 1- thumbCombinationOpening;
        for( let i = 1; i < 5; ++i ){
            outHand[i][0] *= thumbCombinationOpening;
            outHand[i][1] *= thumbCombinationOpening;
            outHand[i][2] *= thumbCombinationOpening; 
            outHand[i][3] *= thumbCombinationOpening; 
        }
        return true;
    }

    newGestureBML( bml ){
        this.target = bml.target;
this._computeLookUpTables();
        let shape = [ 
            [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()],
            [0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]
        ];
        let secondShape = [ 
            [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()],
            [0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]
        ];
        if ( !this._newGestureHandComposer( bml, shape, false ) ){ 
            console.warn( "Gesture: HandShape incorrect handshape \"" + bml.handshape + "\"" );
            return false; 
        };
        if ( this._newGestureHandComposer( bml, secondShape, true ) ){ 
            for( let i = 0; i < 3; ++i ){
                nlerpQuats( shape[0][i], shape[0][i], secondShape[0][i], 0.5 );
            }
            for( let i = 1; i < 5; ++i ){
                shape[i][0] = 0.5 * ( shape[i][0] + secondShape[i][0] );
                shape[i][1] = 0.5 * ( shape[i][1] + secondShape[i][1] );
                shape[i][2] = 0.5 * ( shape[i][2] + secondShape[i][2] );
                shape[i][3] = 0.5 * ( shape[i][3] + secondShape[i][3] );
            }
        };

        // Jasigning uses numbers in a string for bend. Its range is 0-4. This realizer works with 0-9. Remap
        let bendRange = this.bendRange;
        // if ( bml.bendRange ){
        //     let newBend = parseInt( bml.bendRange );
        //     bendRange = isNaN( bendRange ) ? bendRange : newBend; 
        // }

        // specific bendings
        // this._stringToFingerBend( bml.bend1, this.trgG[0], 1, bendRange ); // thumb
        this._stringToFingerBend( bml.bend2, shape[1], 1, bendRange );
        this._stringToFingerBend( bml.bend3, shape[2], 1, bendRange );
        this._stringToFingerBend( bml.bend4, shape[3], 1, bendRange );
        this._stringToFingerBend( bml.bend5, shape[4], 1, bendRange );

        // check if any splay attributes is present. ( function already checks if passed argument is valid )           
        // this._stringToSplay( bml.splay1, this.trgG[0] ); // thumb
        this._stringToSplay( bml.splay2 ? bml.splay2 : bml.mainSplay, shape[1] );
        this._stringToSplay( bml.splay3, shape[2] ); // not affected by mainsplay, otherwise it feels weird
        this._stringToSplay( bml.splay4 ? bml.splay4 : bml.mainSplay, shape[3] );
        this._stringToSplay( bml.splay5 ? bml.splay5 : bml.mainSplay, shape[4] );
        
        
        let temp = this.srcG;
        this.srcG = this.curG;
        this.curG = temp;
        
        this._setFingers( shape[1], shape[2], shape[3], shape[4] );
        if( this.handLocations[ this.target ] ){
            this.thumbIK.update( this.handLocations[ this.target ].getWorldPosition( new THREE.Vector3() ), 10 );
            this.trgG[0][0].copy( this.skeleton.bones[ this.fingerIdxs[0] ].quaternion );
            this.trgG[0][1].copy( this.skeleton.bones[ this.fingerIdxs[0] + 1 ].quaternion );
            this.trgG[0][2].copy( this.skeleton.bones[ this.fingerIdxs[0] + 2 ].quaternion );
        }else{
            this.trgG[0][0].copy( shape[0][0] );
            this.trgG[0][1].copy( shape[0][1] );
            this.trgG[0][2].copy( shape[0][2] );
        }


        let bones = this.skeleton.bones;
        let fingerIdxs = this.fingerIdxs;
        for( let i = 1; i < 5; ++i ){
            for( let j = 0; j < 3; ++j ){
                this.trgG[i][j].copy( bones[ fingerIdxs[i] + j ].quaternion );
                bones[ fingerIdxs[i] + j ].quaternion.copy( this.srcG[i][j] ); // set fingers as they were
            }
        }

        if ( bml.shift ){
            for( let i = 0; i < 5; ++i ){
                for( let j = 0; j < 3; ++j ){
                    this.defG[i][j].copy( this.trgG[i][j] );
                }
            }
        }
        
        this.time = 0;
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.transition = true;
    }
    
}

export { HandShape };