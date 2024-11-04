# Integration Guide

## Iframe
Insert Performs inside your application using the _iframe_ HTML element.
```html
<iframe src='https://webglstudio.org/projects/signon/performs'>
```

| Name                       | Type    | Description                                                                                                                 |
|----------------------------|---------|-----------------------------------------------------------------------------------------------------------------------------|
|  avatar                    | String  | Character file URL                                                                                                          |
|  config                    | String  | Configuration file URL                                                                                                      |
|  cloth                     | String  | Top cloth color value                                                                                                       |
|  color                     | String  | Background color                                                                                                            |
|  background                | String  | _open_, _studio_ or _photocall_. Use _open_ as default                                                                      |
|  img                       | String  | Image file URL for _photocall_                                                                                              |
|  offset                    | Float   | [0, 1]. Space between images in the photocall.                                                                              |
|  light                     | String  | Light color                                                                                                                 |
|  lightpos                  | String  | Direct light position                                                                                                       |
|  restrictView              | Boolean | Restrict camera controls                                                                                                    |
|  controls                  | Boolean | Show GUI controls.                                                                                                          |
|  applyIdle                 | Boolean | Play idle animation for Script mode.                                                                                        |
|  srcEmbeddedTransforms     | Boolean | External (parent) transforms are computed and embedded into the root joint of source skeleton animation for retargeting.    |
|  trgEmbeddedTransforms     | Boolean | External (parent) transforms are computed and embedded into the root joint of target skeleton for retargeting.              |
|  srcReferencePose          | Integer | [0, 1, 2] Pose of the source skeleton that will be used as the bind pose for the retargeting.                               |
|  trgReferencePose          | Integer | [0, 1, 2] Pose of the target skeleton that will be used as the bind pose for the retargeting.                               |

> [!IMPORTANT]  
> You can combine multiple parameters by concatenating with _&_.
>
> So for example showing a custom avatar in a blue chroma would look like that:
>```html
><iframe src='https://webglstudio.org/projects/signon/performs?avatar=https://models.readyplayer.me/67162be7608ab3c0a85ceb2d.glb&background=studio&color=rgb(54,54,190)'>
>```

### Expected values

#### avatar
URL of a glTF file. Supported extensions are _glb_ and _gltf_.

##### Expected values (String)
- **`../3Dcharacters/ReadyEva/ReadyEva.glb`** - Relative URL.
- **`https://models.readyplayer.me/67162be7608ab3c0a85ceb2d.glb`** - Get Ready Player Me avatar in T-pose with ARKit morph targets. It can be also an own hosted file.

>[!NOTE]
> Without any of the optional parameters, the avatar is returned based on default values.

#### config (String)
URL of a JSON file with the configuration provided by [performs-atelier](https://github.com/upf-gti/performs-atelier).

##### Expected values
- **`../3Dcharacters/ReadyEva/ReadyEva.json`** - Relative URL.
- **`https://webglstudio.org/3Dcharacters/ReadyEva/ReadyEva.json`**

>[!IMPORTANT]
> Without a config file, the **_Script Mode_** doesn't work. The default avatars have already had it.

#### cloth (String)
Control the top cloth color by multipling it by the given color.

##### Expected values
- **`rgb(255,255,255)`** - RGB color.
- **`0xffffff`** - Hexadecimal color.
- **`hsl(0,100%,50%)`** - HSL color.
- **`skyblue`** - X11 color name.

#### color (String)
Control the background color.

##### Expected values
- **`rgb(255,255,255)`** - RGB color.
- **`0xffffff`** - Hexadecimal color.
- **`hsl(0,100%,50%)`** - HSL color.
- **`skyblue`** - X11 color name.

#### background (String)
Specify which background preset to display.
##### Expected values
- **`open`** - Open space. No walls, only transparent floot. This is the **default** background.
- **`studio`** - Backdrop like chroma.
- **`photocall`** - Like studio background, but featuring a repeated logo or image. The logo can be customized using the [_img_ parameter](####img).

#### img (String)
Specify the image or logo to be used on the photocall wall. If this is set, the default background will be the photocall design. Supported formats are _jpg_, _jpeg_ and _png_.
##### Expected values
- **`../data/imgs/performs2.png`** - Relative URL
- **`https://webglstudio.org/projects/signon/performs/data/imgs/performs.png`**

#### offset (Float)
Defines the spacing between the repeated logo or image in the photocall background. Default offset is **`0.0`**.
##### Expected values
- min: **`0`**
- max: **`1`**
>[!IMPORTANT]
> Use a decimal point as the seperator.

#### light (String)
Control the direct light color.
##### Expected values
- **`rgb(255,255,255)`** - RGB color.
- **`0xffffff`** - Hexadecimal color.
- **`hsl(0,100%,50%)`** - HSL color.
- **`skyblue`** - X11 color name.

#### lightpos (String)
Control the direct light position in world space.
##### Expected values
- **`1,1.5,5`** - x,y,z.

#### restrictView (Boolean)
Restrict user camera controls.
##### Expected values
- **`true`** - Restrict view: panning is disabled, and camera orbit and dolly in/out are limited (default).
- **`false`** - Free controls: allows for damping, orbiting, zooming, and panning of the camera.

#### controls (Boolean)
Toogle GUI controls visibility.
##### Expected values
- **`true`** - Show GUI (default).
- **`false`** - Hide GUI.

#### applyIdle (Boolean)
Play Idle animation as a base for Script animation mode.
##### Expected values
- **`true`** - Play idle animation.
- **`false`** - Not play idle animation (default).

#### srcEmbeddedTransforms (Boolean)
Toogle (parent) transforms computations and embedding into the root joint of source skeleton animation for retargeting in Keyframe mode.
##### Expected values
- **`true`** -  Takes into account the transforms from the actual bone parent (world transforms)
- **`false`** -  Takes into account the transforms from the actual bone objects (local transforms).

#### trgEmbeddedTransforms (Boolean)
Toogle (parent) transforms computations and embedding into the root joint of target skeleton for retargeting in Keyframe mode.
##### Expected values
- **`true`** -  Takes into account the transforms from the actual bone parent (world transforms)
- **`false`** -  Takes into account the transforms from the actual bone objects (local transforms).

#### srcReferencePose (Number)
Pose of the source skeleton that will be used as the reference pose for the retargeting in Keyframe mode.
##### Expected values
- **`0`** - [Default] Skeleton's actual bind pose. (default)
- **`1`** - [Current] Skeleton's current pose.
- **`2`** - [Tpose] Computes a Tpose from the skeleton's actual bind pose.

#### trgReferencePose (Number)
Pose of the target skeleton that will be used as the reference pose for the retargeting in Keyframe mode.
##### Expected values
- **`0`** - [Default] Skeleton's actual bind pose. (default)
- **`1`** - [Current] Skeleton's current pose.
- **`2`** - [Tpose] Computes a Tpose from the skeleton's actual bind pose.