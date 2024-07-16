function quadraticBezierVec3( a, b, c, out, t ){
    let invT = 1.0 - t;
    let ta = invT * invT;
    let tb = 2 * t * invT;
    let tc = t * t;

    out.x = a.x * ta + b.x * tb + c.x * tc;
    out.y = a.y * ta + b.y * tb + c.y * tc;
    out.z = a.z * ta + b.z * tb + c.z * tc;
    return out;
}

function cubicBezierVec3( a, b, c, d, out, t ){
    let invT = 1.0 - t;
    let ta = invT * invT * invT;
    let tb = 3 * t * invT * invT;
    let tc = 3 * t * t * invT;
    let td = t * t * t;

    out.x = a.x * ta + b.x * tb + c.x * tc + d.x * td;
    out.y = a.y * ta + b.y * tb + c.y * tc + d.y * td;
    out.z = a.z * ta + b.z * tb + c.z * tc + d.z * td;
    return out;
}
// ------------ THREEJS Quaternions

// mirror THREE.Quaternion for avatars
function mirrorQuat( destQuat, srcQuat ){
    //destQuat.x = srcQuat.x;
    destQuat.y = -srcQuat.y;
    destQuat.z = -srcQuat.z;
    //destQuat.w = srcQuat.w;
}

function mirrorQuatSelf( q ){
    //q.x = -q.x;
    q.y = -q.y;
    q.z = -q.z;
    //q.w = q.w;
}

// nlerp THREE.Quaternion. Good for interpolation between similar/close quaternions. Cheaper than slerp
function nlerpQuats( destQuat, qa, qb, t ){
    // let bsign = ( qa.x * qb.x + qa.y * qb.y + qa.z * qb.z + qa.w * qb.w ) < 0 ? -1 : 1;    
    // destQuat.x = qa.x * (1-t) + bsign * qb.x * t;
    // destQuat.y = qa.y * (1-t) + bsign * qb.y * t;
    // destQuat.z = qa.z * (1-t) + bsign * qb.z * t;
    // destQuat.w = qa.w * (1-t) + bsign * qb.w * t;
    // missing neighbourhood
    destQuat.x = qa.x * (1-t) + qb.x * t;
    destQuat.y = qa.y * (1-t) + qb.y * t;
    destQuat.z = qa.z * (1-t) + qb.z * t;
    destQuat.w = qa.w * (1-t) + qb.w * t;
    destQuat.normalize();
}

// decompose a quaternion into twist and swing quaternions. (Twist before swing decomposition). Arguments cannot be the same instance of quaternion
function getTwistSwingQuaternions( q, normAxis, outTwist, outSwing ){
    //  R = [ Wr, Vr ] = S * T  source rotation
    // T = norm( [ Wr, proj(Vr) ] ) twist 
    // S = R * inv(T)
    let dot =  q.x * normAxis.x + q.y * normAxis.y + q.z * normAxis.z;
    outTwist.set( dot * normAxis.x, dot * normAxis.y, dot * normAxis.z, q.w )
    outTwist.normalize(); // already manages (0,0,0,0) quaternions by setting identity

    outSwing.copy( outTwist );
    outSwing.invert(); // actually computes the conjugate so quite cheap
    outSwing.premultiply( q );
    outSwing.normalize();
}

function getTwistQuaternion( q, normAxis, outTwist ){
    let dot =  q.x * normAxis.x + q.y * normAxis.y + q.z * normAxis.z;
    outTwist.set( dot * normAxis.x, dot * normAxis.y, dot * normAxis.z, q.w )
    outTwist.normalize(); // already manages (0,0,0,0) quaternions by setting identity
    return outTwist;
}

// symmetry bit0 = left-right, bit1 = up-down, bit2 = in-out symmetry
function stringToDirection( str, outV, symmetry = 0x00, accumulate = false ){
    outV.set(0,0,0);
    if ( typeof( str ) != "string" ){ return false; }

    str = str.toUpperCase();
    let success = false;

    // right hand system. If accumulate, count repetitions
    if ( str.includes( "L" ) ){ outV.x += 1 * ( accumulate ? ( str.split("L").length -1 ): 1 ); success = true; } 
    if ( str.includes( "R" ) ){ outV.x -= 1 * ( accumulate ? ( str.split("R").length -1 ): 1 ); success = true; }
    if ( str.includes( "U" ) ){ outV.y += 1 * ( accumulate ? ( str.split("U").length -1 ): 1 ); success = true; } 
    if ( str.includes( "D" ) ){ outV.y -= 1 * ( accumulate ? ( str.split("D").length -1 ): 1 ); success = true; }
    if ( str.includes( "O" ) ){ outV.z += 1 * ( accumulate ? ( str.split("O").length -1 ): 1 ); success = true; } 
    if ( str.includes( "I" ) ){ outV.z -= 1 * ( accumulate ? ( str.split("I").length -1 ): 1 ); success = true; }
 
    if ( symmetry & 0x01 ){ outV.x *= -1; }
    if ( symmetry & 0x02 ){ outV.y *= -1; }
    if ( symmetry & 0x04 ){ outV.z *= -1; }

    if ( !success ){ outV.set(0,0,0); }
    else if ( !accumulate ){ outV.normalize(); }
    return success;
}


// Skeleton

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

function getBindQuaternion( skeleton, boneIdx, outQuat ){
    let m1 = skeleton.boneInverses[ boneIdx ].clone().invert(); 
    let parentIdx = findIndexOfBone( skeleton, skeleton.bones[ boneIdx ].parent );
    if ( parentIdx > -1 ){
        let m2 = skeleton.boneInverses[ parentIdx ]; 
        m1.premultiply(m2);
    }
    outQuat.setFromRotationMatrix( m1 ).normalize();
    return outQuat;
}

// sets bind quaternions only. Warning: Not the best function to call every frame.
function forceBindPoseQuats( skeleton, skipRoot = false ){
    let bones = skeleton.bones;
    let inverses = skeleton.boneInverses;
    if ( inverses.length < 1 ){ return; }
    let boneMat = inverses[0].clone(); 
    let _ignoreVec3 = skeleton.bones[0].position.clone();
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

export { quadraticBezierVec3, cubicBezierVec3,  mirrorQuat, mirrorQuatSelf, nlerpQuats, getTwistSwingQuaternions, getTwistQuaternion, stringToDirection,  findIndexOfBone, findIndexOfBoneByName, getBindQuaternion, forceBindPoseQuats }